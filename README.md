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

Data lives in two SQLite files: `hub.db` (summary snapshots, Apple Health samples) and
`oura.db` (the ring replica, `oura-store` schema).

Setup, deployment (Docker, podman, Steam Deck, Tailscale Funnel), the tools, and the
agent prompt: [docs/health-hub.md](docs/health-hub.md).

## Build

```bash
cargo +1.93.0 test
cargo +1.93.0 build --release
```

The summary contract and the agent document come from `oura-summary` in open_health;
the ring schema from `oura-store` in open_oura. Both are git dependencies pinned by rev.
