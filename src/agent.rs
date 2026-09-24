//! The built-in agent: the hub runs one of the user's own agent CLIs (Claude Code,
//! Codex, Cursor) as a subprocess with the hub's MCP server attached, and streams
//! the answer to the web UI. The CLIs use the user's subscriptions; the hub adds
//! no API key. Each provider's JSON line format is mapped to one small event type.

use std::path::{Path, PathBuf};
use std::process::Stdio;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::mpsc;

/// What the UI receives, one JSON object per SSE event.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Event {
    /// The provider opened or resumed a conversation; keep the id for follow-ups.
    Session { id: String },
    /// A piece of the answer.
    Text { text: String },
    /// The agent called a tool.
    Tool { name: String, input: Value },
    /// A tool answered (trimmed).
    ToolResult { name: Option<String>, text: String },
    /// The agent is thinking (a short summary when the provider gives one).
    Thinking { text: String },
    /// The turn ended. `text` is the final answer when the provider reports it.
    Done { session: Option<String>, text: Option<String>, is_error: bool },
    Error { message: String },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Provider {
    Claude,
    Codex,
    Cursor,
}

impl Provider {
    pub fn all() -> [Provider; 3] { [Provider::Claude, Provider::Codex, Provider::Cursor] }
    pub fn id(self) -> &'static str {
        match self { Provider::Claude => "claude", Provider::Codex => "codex", Provider::Cursor => "cursor" }
    }
    pub fn title(self) -> &'static str {
        match self { Provider::Claude => "Claude Code", Provider::Codex => "Codex", Provider::Cursor => "Cursor" }
    }
    pub fn binary(self) -> &'static str {
        match self { Provider::Claude => "claude", Provider::Codex => "codex", Provider::Cursor => "cursor-agent" }
    }
    pub fn parse(id: &str) -> Option<Provider> {
        Provider::all().into_iter().find(|p| p.id() == id)
    }
    /// How to sign in once on the machine that runs the hub.
    pub fn login_hint(self) -> &'static str {
        match self {
            Provider::Claude => "run `claude` once and follow the login link",
            Provider::Codex => "run `codex login --device-auth`",
            Provider::Cursor => "run `cursor-agent login`",
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ProviderInfo {
    pub id: &'static str,
    pub title: &'static str,
    pub available: bool,
    pub path: Option<String>,
    pub login_hint: &'static str,
}

/// The instructions every provider gets, ahead of the user's question.
pub const RULES: &str = "You are a health assistant with an MCP server named \"health\". It holds the user's Oura ring data and Apple Health (Apple Watch) data. All data is theirs and private.\n\
Tools: get_status_now (call it first; ring summary plus a watch block), get_sleep(days), get_trends(metric, days), get_watch, get_health_samples(kind, days, limit), get_activity(days).\n\
Rules: 1) Check freshness before you use a number. Ring data arrives at sync time. If ring_last_sync_age_h is above 12, say the ring data is old and lean on the watch block. A null field is missing; never guess it. \
2) Compare against the user's own baseline (delta_pct), not population norms. \
3) When asked to plan the day, cover training load (hard, easy, or rest), caffeine cutoff, a bedtime target from sleep debt, and one thing to watch. Keep answers under 200 words unless asked for detail. \
4) You are not a doctor. If illness status is MINOR_SIGNS or MAJOR_SIGNS, or resting heart rate is 10% above baseline, say so plainly and suggest rest. \
5) Do not repeat raw numbers unless they changed your advice. Answer in the language the user writes in.";

#[derive(Debug, Clone)]
pub struct AgentConfig {
    /// Where the MCP config files and the CLIs' working directory live.
    pub workdir: PathBuf,
    /// The hub's own MCP endpoint, with the token, reachable from this process.
    pub mcp_url: String,
    pub providers: Vec<ProviderInfo>,
}

fn which(bin: &str) -> Option<String> {
    let path = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&path) {
        let p = dir.join(bin);
        if p.is_file() { return Some(p.display().to_string()); }
    }
    // the native installers put the CLIs here even when PATH does not say so
    if let Some(home) = std::env::var_os("HOME") {
        let p = Path::new(&home).join(".local/bin").join(bin);
        if p.is_file() { return Some(p.display().to_string()); }
    }
    None
}

impl AgentConfig {
    pub fn new(workdir: PathBuf, mcp_url: String) -> Self {
        let providers = Provider::all()
            .into_iter()
            .map(|p| {
                let path = which(p.binary());
                ProviderInfo { id: p.id(), title: p.title(), available: path.is_some(), path, login_hint: p.login_hint() }
            })
            .collect();
        let cfg = Self { workdir, mcp_url, providers };
        if let Err(e) = cfg.write_configs() {
            tracing::warn!("agent: could not write MCP configs: {e}");
        }
        cfg
    }

    fn provider_path(&self, p: Provider) -> Option<String> {
        self.providers.iter().find(|i| i.id == p.id()).and_then(|i| i.path.clone())
    }

    /// The MCP config each CLI reads. Written once; the token is inside, so 0600.
    fn write_configs(&self) -> std::io::Result<()> {
        std::fs::create_dir_all(self.workdir.join(".cursor"))?;
        let servers = json!({ "mcpServers": { "health": { "type": "http", "url": self.mcp_url } } });
        write_private(&self.workdir.join("mcp-claude.json"), &serde_json::to_string_pretty(&servers)?)?;
        write_private(&self.workdir.join(".cursor/mcp.json"), &serde_json::to_string_pretty(&json!({ "mcpServers": { "health": { "url": self.mcp_url } } }))?)?;
        Ok(())
    }

    /// The command line for one question. Public so a test can inspect it.
    pub fn command(&self, provider: Provider, prompt: &str, session: Option<&str>) -> Option<Command> {
        let path = self.provider_path(provider)?;
        let mut cmd = Command::new(path);
        cmd.current_dir(&self.workdir).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
        cmd.env_remove("CLAUDECODE"); // a nested Claude Code refuses to start
        match provider {
            Provider::Claude => {
                cmd.args(["-p", "--output-format", "stream-json", "--verbose", "--strict-mcp-config", "--mcp-config"])
                    .arg(self.workdir.join("mcp-claude.json"))
                    .args(["--allowedTools", "mcp__health__*", "--disallowedTools", "Bash,Edit,Write,NotebookEdit,Task,WebFetch,WebSearch,Read,Glob,Grep",
                           "--append-system-prompt", RULES, "--max-turns", "12"]);
                if let Some(s) = session { cmd.args(["--resume", s]); }
                cmd.arg(prompt);
            }
            Provider::Codex => {
                cmd.arg("exec");
                if let Some(s) = session { cmd.args(["resume", s]); }
                cmd.args(["--json", "--skip-git-repo-check", "-s", "read-only", "-C"]).arg(&self.workdir)
                    .arg("-c").arg(format!("mcp_servers.health.url={}", serde_json::to_string(&self.mcp_url).unwrap_or_default()))
                    .arg(format!("{RULES}\n\nQuestion:\n{prompt}"));
            }
            Provider::Cursor => {
                cmd.args(["-p", "--output-format", "stream-json", "--approve-mcps"]);
                if let Some(s) = session { cmd.args(["--resume", s]); }
                cmd.arg(format!("{RULES}\n\nQuestion:\n{prompt}"));
            }
        }
        Some(cmd)
    }

    /// Run one question and send events to `tx` until the process ends.
    pub async fn ask(&self, provider: Provider, prompt: String, session: Option<String>, tx: mpsc::Sender<Event>) {
        let Some(mut cmd) = self.command(provider, &prompt, session.as_deref()) else {
            let _ = tx.send(Event::Error { message: format!("{} is not installed on the hub ({})", provider.title(), provider.login_hint()) }).await;
            return;
        };
        let mut child = match cmd.spawn() {
            Ok(c) => c,
            Err(e) => { let _ = tx.send(Event::Error { message: format!("could not start {}: {e}", provider.title()) }).await; return; }
        };
        let stdout = child.stdout.take().expect("piped stdout");
        let stderr = child.stderr.take().expect("piped stderr");
        let mut lines = BufReader::new(stdout).lines();
        let mut errs = BufReader::new(stderr).lines();
        let mut done_sent = false;
        let mut err_tail: Vec<String> = Vec::new();
        loop {
            tokio::select! {
                line = lines.next_line() => match line {
                    Ok(Some(l)) => {
                        for ev in parse_line(provider, &l) {
                            if matches!(ev, Event::Done { .. }) { done_sent = true; }
                            if tx.send(ev).await.is_err() { let _ = child.kill().await; return; }
                        }
                    }
                    _ => break,
                },
                line = errs.next_line() => if let Ok(Some(l)) = line {
                    if !l.trim().is_empty() { err_tail.push(l); if err_tail.len() > 20 { err_tail.remove(0); } }
                },
            }
        }
        // drain stderr that arrived after stdout closed
        while let Ok(Some(l)) = errs.next_line().await { if !l.trim().is_empty() { err_tail.push(l); } }
        let status = child.wait().await.ok();
        if !done_sent {
            let ok = status.map(|s| s.success()).unwrap_or(false);
            if ok {
                let _ = tx.send(Event::Done { session: None, text: None, is_error: false }).await;
            } else {
                let tail = err_tail.iter().rev().take(6).cloned().collect::<Vec<_>>().into_iter().rev().collect::<Vec<_>>().join("\n");
                let _ = tx.send(Event::Error { message: if tail.is_empty() { format!("{} exited with {:?}", provider.title(), status) } else { tail } }).await;
            }
        }
    }
}

fn write_private(path: &Path, text: &str) -> std::io::Result<()> {
    std::fs::write(path, text)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600))?;
    }
    Ok(())
}

fn trim(text: &str, max: usize) -> String {
    if text.chars().count() <= max { text.to_string() } else { format!("{}…", text.chars().take(max).collect::<String>()) }
}

/// Map one output line to events. Unknown lines are ignored.
pub fn parse_line(provider: Provider, line: &str) -> Vec<Event> {
    let Ok(v) = serde_json::from_str::<Value>(line) else {
        // Cursor and Codex print plain text when something is wrong (login, network).
        let t = line.trim();
        if !t.is_empty() && provider != Provider::Claude && t.to_ascii_lowercase().contains("error") {
            return vec![Event::Error { message: t.to_string() }];
        }
        return vec![];
    };
    match provider {
        Provider::Codex => parse_codex(&v),
        Provider::Claude | Provider::Cursor => parse_claude_like(&v),
    }
}

/// Claude Code's `--output-format stream-json`; Cursor's stream-json is the same shape.
fn parse_claude_like(v: &Value) -> Vec<Event> {
    let mut out = Vec::new();
    match v["type"].as_str() {
        Some("system") => {
            if v["subtype"] == "init" {
                if let Some(id) = v["session_id"].as_str() { out.push(Event::Session { id: id.into() }); }
            }
        }
        Some("assistant") => {
            for c in v["message"]["content"].as_array().into_iter().flatten() {
                match c["type"].as_str() {
                    Some("text") => if let Some(t) = c["text"].as_str() { if !t.is_empty() { out.push(Event::Text { text: t.into() }); } },
                    Some("tool_use") => out.push(Event::Tool { name: c["name"].as_str().unwrap_or("tool").into(), input: c["input"].clone() }),
                    Some("thinking") => if let Some(t) = c["thinking"].as_str() { out.push(Event::Thinking { text: trim(t, 200) }); },
                    _ => {}
                }
            }
        }
        Some("user") => {
            for c in v["message"]["content"].as_array().into_iter().flatten() {
                if c["type"] == "tool_result" {
                    let text = match &c["content"] {
                        Value::String(s) => s.clone(),
                        Value::Array(a) => a.iter().filter_map(|x| x["text"].as_str()).collect::<Vec<_>>().join("\n"),
                        other => other.to_string(),
                    };
                    out.push(Event::ToolResult { name: None, text: trim(&text, 300) });
                }
            }
        }
        Some("result") => {
            let session = v["session_id"].as_str().or(v["chatId"].as_str()).map(String::from);
            let text = v["result"].as_str().map(String::from);
            let is_error = v["is_error"].as_bool().unwrap_or(false) || v["subtype"].as_str().is_some_and(|s| s.starts_with("error"));
            out.push(Event::Done { session, text, is_error });
        }
        _ => {}
    }
    out
}

/// Codex `exec --json` events.
fn parse_codex(v: &Value) -> Vec<Event> {
    let mut out = Vec::new();
    match v["type"].as_str() {
        Some("thread.started") => if let Some(id) = v["thread_id"].as_str() { out.push(Event::Session { id: id.into() }); },
        Some("item.completed") | Some("item.started") => {
            let item = &v["item"];
            let completed = v["type"] == "item.completed";
            match item["type"].as_str() {
                Some("agent_message") if completed => if let Some(t) = item["text"].as_str() { out.push(Event::Text { text: t.into() }); },
                Some("reasoning") if completed => if let Some(t) = item["text"].as_str() { out.push(Event::Thinking { text: trim(t, 200) }); },
                Some("mcp_tool_call") => {
                    let name = format!("{}__{}", item["server"].as_str().unwrap_or("mcp"), item["tool"].as_str().unwrap_or("tool"));
                    if !completed { out.push(Event::Tool { name, input: item["arguments"].clone() }); }
                    else {
                        let text = item["result"].as_str().map(String::from).unwrap_or_else(|| item["result"].to_string());
                        out.push(Event::ToolResult { name: Some(name), text: trim(&text, 300) });
                    }
                }
                _ => {}
            }
        }
        Some("turn.completed") => out.push(Event::Done { session: None, text: None, is_error: false }),
        Some("turn.failed") | Some("error") => out.push(Event::Error { message: v["error"]["message"].as_str().or(v["message"].as_str()).unwrap_or("agent error").into() }),
        _ => {}
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn claude_lines_become_events() {
        let init = r#"{"type":"system","subtype":"init","session_id":"s1","tools":[]}"#;
        assert_eq!(parse_line(Provider::Claude, init), vec![Event::Session { id: "s1".into() }]);
        let asst = r#"{"type":"assistant","message":{"content":[{"type":"text","text":"Hi"},{"type":"tool_use","name":"mcp__health__get_status_now","input":{}}]}}"#;
        assert_eq!(parse_line(Provider::Claude, asst), vec![
            Event::Text { text: "Hi".into() },
            Event::Tool { name: "mcp__health__get_status_now".into(), input: json!({}) },
        ]);
        let user = r#"{"type":"user","message":{"content":[{"type":"tool_result","content":[{"type":"text","text":"{\"ok\":1}"}]}]}}"#;
        assert_eq!(parse_line(Provider::Claude, user), vec![Event::ToolResult { name: None, text: "{\"ok\":1}".into() }]);
        let res = r#"{"type":"result","subtype":"success","result":"Rest today.","session_id":"s1","is_error":false}"#;
        assert_eq!(parse_line(Provider::Claude, res), vec![Event::Done { session: Some("s1".into()), text: Some("Rest today.".into()), is_error: false }]);
        assert!(parse_line(Provider::Claude, "not json").is_empty());
        assert!(parse_line(Provider::Claude, r#"{"type":"system","subtype":"hook_started"}"#).is_empty());
    }

    #[test]
    fn codex_lines_become_events() {
        assert_eq!(parse_line(Provider::Codex, r#"{"type":"thread.started","thread_id":"t9"}"#), vec![Event::Session { id: "t9".into() }]);
        let call = r#"{"type":"item.started","item":{"type":"mcp_tool_call","server":"health","tool":"get_watch","arguments":{"a":1}}}"#;
        assert_eq!(parse_line(Provider::Codex, call), vec![Event::Tool { name: "health__get_watch".into(), input: json!({"a":1}) }]);
        let msg = r#"{"type":"item.completed","item":{"type":"agent_message","text":"Easy day."}}"#;
        assert_eq!(parse_line(Provider::Codex, msg), vec![Event::Text { text: "Easy day.".into() }]);
        assert_eq!(parse_line(Provider::Codex, r#"{"type":"turn.completed","usage":{}}"#), vec![Event::Done { session: None, text: None, is_error: false }]);
        assert_eq!(parse_line(Provider::Codex, "ERROR codex_login: token expired"), vec![Event::Error { message: "ERROR codex_login: token expired".into() }]);
    }

    #[test]
    fn commands_carry_the_mcp_config_and_the_session() {
        let dir = std::env::temp_dir().join(format!("oura-hub-agent-test-{}", std::process::id()));
        let cfg = AgentConfig::new(dir.clone(), "http://127.0.0.1:1/mcp/tok".into());
        assert!(dir.join("mcp-claude.json").is_file());
        assert!(dir.join(".cursor/mcp.json").is_file());
        let text = std::fs::read_to_string(dir.join("mcp-claude.json")).unwrap();
        assert!(text.contains("http://127.0.0.1:1/mcp/tok"));
        // a provider that is not installed has no command
        let missing = cfg.providers.iter().filter(|p| !p.available).map(|p| p.id).collect::<Vec<_>>();
        for id in missing { assert!(cfg.command(Provider::parse(id).unwrap(), "q", None).is_none()); }
        let _ = std::fs::remove_dir_all(dir);
    }

    #[tokio::test]
    async fn ask_streams_a_fake_provider_and_ends() {
        // A script that prints two Claude-style lines stands in for the CLI.
        let dir = std::env::temp_dir().join(format!("oura-hub-agent-fake-{}", std::process::id()));
        std::fs::create_dir_all(dir.join("bin")).unwrap();
        let script = dir.join("bin/claude");
        std::fs::write(&script, "#!/bin/sh\nprintf '%s\\n' '{\"type\":\"system\",\"subtype\":\"init\",\"session_id\":\"x\"}' '{\"type\":\"result\",\"result\":\"ok\",\"session_id\":\"x\"}'\n").unwrap();
        #[cfg(unix)]
        { use std::os::unix::fs::PermissionsExt; std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o755)).unwrap(); }
        let mut cfg = AgentConfig::new(dir.clone(), "http://127.0.0.1:1/mcp/t".into());
        for p in cfg.providers.iter_mut() { if p.id == "claude" { p.available = true; p.path = Some(script.display().to_string()); } }
        let (tx, mut rx) = mpsc::channel(16);
        cfg.ask(Provider::Claude, "hi".into(), None, tx).await;
        let mut got = Vec::new();
        while let Some(e) = rx.recv().await { got.push(e); }
        assert_eq!(got, vec![
            Event::Session { id: "x".into() },
            Event::Done { session: Some("x".into()), text: Some("ok".into()), is_error: false },
        ]);
        let _ = std::fs::remove_dir_all(dir);
    }
}
