# Health hub: an always-on MCP endpoint for your health data

The hub is a small server that runs all day on a home server, a Steam Deck, a Mac,
or a rented VPS. The iPhone app pushes two things to it after every ring sync:

1. **The health summary** (`build_summary` JSON). Agents (Claude Code, Cursor, any
   MCP client) read it over MCP, and the web app shows it.
2. **The raw ring rows** (events, readings, device rows). The hub keeps them in its
   own `oura.db` with the `oura-store` schema. This is the backup: every report the
   phone or the desktop can run also runs on the hub's file.

Your Mac and your phone can be off. The hub does not talk to the ring. It stores
what a client pushed and serves it. This keeps the ring's single Bluetooth link with
the phone that syncs it.

## Parts

| Part | Where | Job |
| --- | --- | --- |
| `oura-hub` | this repo | HTTP server: `/ingest/summary`, `/ingest/events`, `/ingest/health`, `/export/events`, `/mcp`, `/health`, and the web app |
| `oura-summary::agent` | open_health `crates/oura-summary/src/agent.rs` | Turns the full summary into the short documents the tools return |
| `oura-store::replication` | open_oura | `export_after` / `import_batch`: raw rows in pages, idempotent |
| iOS `HubPush.swift` | open_health `apps/ios/OuraApp` | Pushes the summary and the new rows after each sync |
| iOS `HealthReader.swift` | open_health `apps/ios/OuraApp` | Reads Apple Health samples with anchored queries and pushes the changes |
| `oura push` | open_health `crates/oura-cli` | Builds the summary on a Mac and pushes it |

## Quick start: one command

On the server, with Docker or podman installed and
[Tailscale](https://tailscale.com/download) signed in:

```bash
git clone https://github.com/KenWuqianghao/oura-hub.git && cd oura-hub && ./deploy/install.sh
```

The script makes a token once (`~/.config/oura-hub.env`), builds the image, runs it
as a service that comes back after a reboot (a Quadlet unit under podman + systemd,
a restart policy under Docker), publishes it on loopback and on the Tailscale
address, and prints three lines:

- **Web app**: `http://<server>.<tailnet>.ts.net:8787`
- **Sign in**: the same address with `#token=<token>`. Open it once in a browser; it
  signs in and opens the **Connect** page.
- **MCP address**: `…/mcp/<token>` for an agent.

Add `--public` for a public `https://<server>.<tailnet>.ts.net` address through
Tailscale Funnel (a hosted agent needs it). Run the script again to update: it keeps
the token and the data in `~/oura-hub-data` (`hub.db`, `oura.db`). To back up, copy
that folder. To change the token, delete `~/.config/oura-hub.env` and run the script
again.

**Connect page.** It shows a QR code with `openoura://hub?url=<hub>&token=<token>`.
Scan it with the iPhone Camera, tap **Open in Open Oura**, then **Connect**. The app
asks first, because any web page can make such a link. The page also gives the
Claude Code command and the `mcpServers` JSON with copy buttons. The token stays
hidden until you tap **Show token**.

## Run the hub by hand

Make a token and keep it secret. The hub refuses tokens shorter than 16 characters.

```bash
openssl rand -hex 24
```

With Docker Compose, from the repo root (it listens on loopback only; add a port
line for your Tailscale address, or put a proxy in front, see below):

```bash
OURA_HUB_TOKEN=<token> docker compose up -d --build
```

Or run the binary (build the web app first, see the README):

```bash
OURA_HUB_TOKEN=<token> OURA_HUB_DB=/var/lib/oura/hub.db cargo run --release
```

| Variable | Default | Meaning |
| --- | --- | --- |
| `OURA_HUB_TOKEN` | required | Bearer token for pushes, the web app, and MCP |
| `OURA_HUB_BIND` | `0.0.0.0:8787` | Listen address |
| `OURA_HUB_DB` | `hub.db` | SQLite file for the summary snapshots and Apple Health samples |
| `OURA_HUB_RING_DB` | `oura.db` next to `OURA_HUB_DB` | The ring replica (`oura-store` schema) |
| `OURA_HUB_AGENT_DIR` | `agent/` next to `OURA_HUB_DB` | MCP config files for the Ask page's agent CLIs |
| `RUST_LOG` | `info` | Log filter |

Check it:

```bash
curl -s http://127.0.0.1:8787/health
```

## Reach the hub from your phone and your agent

The hub speaks plain HTTP. Never expose port 8787 to the internet as it is. The
iPhone refuses plain HTTP to a remote host (App Transport Security), except for
`*.ts.net` names. Pick one:

| Option | Who can reach it | Address | Setup |
| --- | --- | --- | --- |
| **Tailscale, plain HTTP** (the install script's default) | Your devices on the tailnet | `http://<server>.<tailnet>.ts.net:8787` | None. Tailscale already encrypts the traffic. |
| **Tailscale Serve** | Your devices on the tailnet | `https://<server>.<tailnet>.ts.net` | `tailscale serve --bg 8787`. Turn on HTTPS certificates once in the Tailscale admin console (DNS → HTTPS Certificates). |
| **Tailscale Funnel** (`--public`) | The whole internet | `https://<server>.<tailnet>.ts.net` | `tailscale funnel --bg 8787`. Needed for a hosted agent (claude.ai connectors, cloud runtimes). |
| **Caddy or another proxy** | The whole internet | `https://hub.example.com` | Your own domain, see below. |

On a public address only the token protects your data: keep it secret. `GET /health`
without the token answers only `{"ok":true}`.

Caddy gets the certificate for you. A `Caddyfile`:

```text
hub.example.com {
    reverse_proxy 127.0.0.1:8787
}
```

For a quick test without an account, a Cloudflare quick tunnel gives a random
`trycloudflare.com` name that changes on every restart:

```bash
docker run -d --name oura-tunnel --restart unless-stopped --network=host docker.io/cloudflare/cloudflared:latest tunnel --no-autoupdate --url http://127.0.0.1:8787
```

On the iPhone and on the agent's computer, install Tailscale and sign in to the same
tailnet, unless you use a public address.

## Device notes

**Steam Deck (SteamOS).** SteamOS is immutable and refuses the Docker install script,
but it ships podman, which the install script uses. Run it as the `deck` user, not
root. The community `deck-tailscale` install puts the binary in
`/opt/tailscale/tailscale`; the script finds it there. Set the sleep timers to Never
(Settings → Power) and keep the Deck on its charger, or the hub goes offline at night.

**Ubuntu or Debian server.** Install Tailscale and Docker, then run the quick start:

```bash
curl -fsSL https://tailscale.com/install.sh | sh && sudo tailscale up
curl -fsSL https://get.docker.com | sh && sudo usermod -aG docker "$USER" && newgrp docker
```

**Mac.** Docker Desktop and the Tailscale app are enough. The hub stops when the Mac
sleeps, so a Mac works best as a test machine.

## Push from the iPhone

Scan the QR code on the hub's **Connect** page with the Camera, then tap **Connect**
in the app. To do it by hand: Settings → **Health hub**, turn on **Send data to my
hub**, enter the hub URL and the token. After every sync the app sends:

- the summary, with the on-device model results folded in (sleep stages, cardio
  age, illness signs), and
- every ring row the hub does not have yet, in pages of 1000. The app remembers the
  last accepted ids, so a push that stops early loses nothing.

A background refresh has about 22 seconds. The push uses at most 8 of them. What
did not fit goes out on the next sync or the next app open. **Send Now** sends at
once. **Send All Ring Data Again** resets the ids, for a new hub.

The token is kept in the Keychain and is readable after the first unlock, so a
background sync on a locked phone can push.

## Apple Health (Apple Watch)

Settings → Health hub → **Include Apple Health data (Watch)**. iOS asks for read
access once. After that, every push also sends the Apple Health samples that changed
since the last run, deletions included. The app uses anchored HealthKit queries and
keeps the anchors in `health-read-state.json` next to the database, so a run that
stops early sends the rest next time.

What is read: heart rate, resting heart rate, walking heart rate average, HRV
(SDNN), VO2 max, steps, active and resting energy, exercise and stand minutes,
stand hours, walking and running distance, respiratory rate, blood oxygen, wrist
temperature, sleep analysis (with stages), and workouts (with energy and distance).

What is never sent: the samples this app wrote itself (the Health export). The hub
already has that data from the ring, and sending it back would count it twice.
Samples from every other source go out, with the source name and the device model,
so the hub can tell the Watch from the iPhone or another app.

**Background delivery.** With the switch on, the app registers a HealthKit observer
for every type at launch and asks iOS for background delivery. When the Watch syncs,
or another app writes, iOS wakes the app; the app pushes the changes under a short
background task and tells HealthKit it is done. A burst of updates (one per type)
becomes one push. HealthKit limits steps, energy, exercise, stand, and distance to
one delivery per hour; the other types arrive at once. So heart rate, HRV, sleep,
and workouts reach the hub within minutes; the daily counters within the hour.
Background delivery does not run on the simulator, and a force-quit stops it until
the app is opened again.

The hub keeps them in `hub.db` (`health_samples`, one row per sample UUID). Two tools
read them:

| Tool | Arguments | Returns |
| --- | --- | --- |
| `get_watch` | none | Today and yesterday totals (best single source per day, so iPhone and Watch steps are not added together), latest heart rate, resting heart rate, HRV with a 7-day mean, VO2 max, respiratory rate, blood oxygen, wrist temperature, the last sleep with stages, workouts in the last 48 h, freshness |
| `get_health_samples` | `kind`, `days` (default 7), `limit` (default 500) | Raw samples of one kind, newest first |

`get_status_now` carries the same picture under `watch`, so one call gives the ring
and the Watch together.

## Push from the Mac

From the Mac that has `oura.db`:

```bash
export OURA_HUB_TOKEN=<token>
oura push --to https://hub.example.com --tz-offset 8
```

The command builds the same summary the dashboard shows, then posts it. A summary
that did not change is not stored twice. Run it after each `oura sync`, or on a
timer. The hub keeps the last 500 snapshots.

The reply shows what the hub stored:

```json
{ "stored": true, "generated_at": 1758500000.0, "received_at": 1758500012, "snapshots": 12 }
```

## The ring replica

`POST /ingest/events` takes an `oura-store::replication::ExportBatch` and imports it
into the hub's `oura.db`. Rows the hub already holds are ignored. `GET
/export/events?after_event_id=0&after_reading_id=0&limit=2000` (Bearer) gives the
rows back in pages, to restore a phone or a desktop.

The replica is a normal store. On the server:

```bash
oura dashboard --db /data/oura.db
```

`GET /health` shows `ring.max_event_id`; compare it with the app's "through id".

## The web UI

Open the hub address in a browser. Sign in with the token; it stays in that browser.
The pages: **Today** (the day on one timeline, last night, activity, vitals, the
Apple Watch), **Sleep** (every night with its hypnogram and the heart rate, HRV,
temperature, blood oxygen, and movement across it), **Trends** (one ring or Watch
metric per day), **Ask** (see below), **Data** (what the hub holds), and **Connect**
(the QR code for the iPhone and the MCP settings). The UI reads
`GET /api/summary` (the latest snapshot) and `POST /api/tool/<name>` (the MCP tools)
with the bearer token. It is built from `web/` and embedded in the binary.

## The built-in agent (Ask)

The **Ask** page runs one of your own agent CLIs on the hub, with the hub's MCP
server attached, and streams the answer. No API key: the CLIs use your
subscriptions. Supported: Claude Code (`claude`), Codex (`codex`), Cursor
(`cursor-agent`). The container image installs all three; the hub lists the ones it
finds at `GET /api/agent/providers`.

Sign in once on the hub, inside the container. The compose file and the Quadlet unit
keep the login directories on volumes: `/root/.claude`, `/root/.codex`, `/root/.cursor`
and `/root/.config` (cursor-agent writes its login there). Without the last one the
Cursor login is lost when the image is rebuilt.

```bash
podman exec -it oura-hub claude
```

```bash
podman exec -it oura-hub codex login --device-auth
```

```bash
podman exec -it oura-hub cursor-agent login
```

Each CLI gets a fixed instruction block (the health tools, the freshness rule, the
baseline rule, the "not a doctor" rule) ahead of your question, and only the hub's
tools: no shell, no file access. Follow-up questions resume the same conversation
(`--resume` for Claude Code and Cursor, `exec resume` for Codex); **New
conversation** starts over. `POST /api/agent/ask` `{provider, prompt, session}`
answers with server-sent events (`session`, `text`, `tool`, `tool_result`,
`thinking`, `done`, `error`).

Environment: `OURA_HUB_AGENT_DIR` (default `agent/` next to `hub.db`) holds the MCP
config files the CLIs read; `OURA_HUB_MCP_URL` overrides the loopback MCP address.

## Connect an agent over MCP

The MCP endpoint is Streamable HTTP with JSON replies. Two ways to authenticate:

- token in the path: `POST https://hub.example.com/mcp/<token>`
- bearer header: `POST https://hub.example.com/mcp` with `Authorization: Bearer <token>`

Some clients accept only a URL per server. Use the path form in their `mcpServers`:

```json
{
  "mcpServers": {
    "health": { "url": "https://hub.example.com/mcp/<token>" }
  }
}
```

Claude Code:

```bash
claude mcp add --transport http health https://hub.example.com/mcp/<token>
```

Test by hand:

```bash
curl -s https://hub.example.com/mcp/<token> -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_status_now","arguments":{}}}'
```

## Tools

| Tool | Arguments | Returns |
| --- | --- | --- |
| `get_status_now` | none | Last night, sleep debt, HRV and resting HR against baseline, illness signs, cardio age, today's activity, battery, and a `freshness` block |
| `get_sleep` | `days` (default 7) | Recent nights, newest first, without the per-epoch series |
| `get_trends` | `metric`, `days` (default 14) | One value per day, oldest first, with latest, mean, and baseline |
| `get_activity` | `days` (default 7) | Steps, active kcal, total kcal, distance per day |
| `get_watch` | none | The Apple Health picture (see above) |
| `get_health_samples` | `kind`, `days`, `limit` | Raw Apple Health samples of one kind |

Metrics for `get_trends`: `hrv_ms`, `rhr`, `skin_temp`, `efficiency`, `in_bed_h`,
`asleep_min`, `deep_pct`, `rem_pct`, `light_pct`, `wake_pct`, `awakenings`,
`waso_min`, `sol_min`, `steps`, `active_kcal`, `total_kcal`.

Every status carries `freshness`. The ring sends data at sync time, not live.
`ring_last_sync_age_h` is the age of the newest ring data. An agent should say
when the data is old, not plan on it.

## A planning prompt

Give the agent a daily trigger and a prompt like this:

> Call `get_status_now`. If `ring_last_sync_age_h` is above 12, say the data is old.
> Then plan my day: training load, when to stop caffeine, and a bedtime. Keep it short.

## Roadmap

1. The hub builds the summary from its own replica when no summary was pushed.
