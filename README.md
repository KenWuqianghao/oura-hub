# oura-hub

The always-on health hub for [open_health](https://github.com/KenWuqianghao/open_health).
The iPhone app pushes the Oura ring summary, the raw ring rows, and the Apple Health
samples here. Agents (Grok Bot, Claude Code, any MCP client) read them over MCP.

- `POST /ingest/summary`, `POST /ingest/events`, `POST /ingest/health`: what the phone
  or `oura push` sends (bearer token).
- `POST /mcp/<token>`: a stateless Streamable HTTP MCP server with the tools
  `get_status_now`, `get_sleep`, `get_trends`, `get_watch`, `get_health_samples`,
  `get_activity`.
- `GET /export/events`: the ring replica back out, in pages.
- `GET /health`: liveness; details with the token.
- `GET /`: the web UI (Apple Health style, like the iOS app): Summary, Sleep, Trends,
  Ask, Data. It signs in with the same token and reads `/api/summary` and `/api/tool/<name>`.
- `POST /api/agent/ask`: the built-in agent. Runs your own Claude Code, Codex, or
  Cursor CLI on the hub with the health tools attached; streams the answer.

Data lives in two SQLite files: `hub.db` (summary snapshots, Apple Health samples) and
`oura.db` (the ring replica, `oura-store` schema).

Setup, deployment (Docker, podman, Steam Deck, Tailscale Funnel), the tools, and the
agent prompt: [docs/health-hub.md](docs/health-hub.md).

## Build

```bash
cd web && npm ci && npm run build && cd ..
cargo +1.93.0 test
cargo +1.93.0 build --release
```

The web build lands in `web/dist` and is embedded in the binary. Without it the hub
still runs and serves a "not built" page at `/`. For UI work, `VITE_HUB_URL=https://<hub> npm run dev`
in `web/` proxies the API to a running hub.

The summary contract and the agent document come from `oura-summary` in open_health;
the ring schema from `oura-store` in open_oura. Both are git dependencies pinned by rev.
