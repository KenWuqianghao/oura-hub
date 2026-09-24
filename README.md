# oura-hub

[![Open Oura: your Oura ring, no account, no cloud](https://open-oura.vercel.app/assets/og.jpg)](https://open-oura.vercel.app)

The always-on health hub for [Open Oura](https://open-oura.vercel.app). The iPhone app
([open_health](https://github.com/KenWuqianghao/open_health)) pushes the Oura ring
summary, the raw ring rows, and the Apple Health samples here after every sync. You get
a full backup on a server you own, a web app, and an MCP server that Claude Code,
Cursor, or any MCP client can read.

```bash
git clone https://github.com/KenWuqianghao/oura-hub.git && cd oura-hub && ./deploy/install.sh
```

Then open the sign-in link it prints and scan the QR code on the **Connect** page with
your iPhone. Full guide: [open-oura.vercel.app/setup](https://open-oura.vercel.app/setup#hub).

## What it serves

- `POST /ingest/summary`, `POST /ingest/events`, `POST /ingest/health`: what the phone
  or `oura push` sends (bearer token).
- `POST /mcp/<token>`: a stateless Streamable HTTP MCP server with the tools
  `get_status_now`, `get_sleep`, `get_trends`, `get_watch`, `get_health_samples`,
  `get_activity`.
- `GET /export/events`: the ring replica back out, in pages.
- `GET /health`: liveness; details with the token.
- `GET /`: the web app: Today, Sleep, Trends,
  Ask, Data, Connect. It signs in with the same token and reads `/api/summary` and
  `/api/tool/<name>`. **Connect** shows a QR code that links the iPhone app in one scan.
- `POST /api/agent/ask`: the built-in agent. Runs your own Claude Code, Codex, or
  Cursor CLI on the hub with the health tools attached; streams the answer.

Data lives in two SQLite files: `hub.db` (summary snapshots, Apple Health samples) and
`oura.db` (the ring replica, `oura-store` schema).

## Install

`deploy/install.sh` needs Docker or podman, and Tailscale signed in for access from
your phone. It makes the token, builds, runs the hub as a service, and prints a
sign-in link that opens the Connect page. `--public` adds a Tailscale Funnel
`https://` address for hosted agents. Run it again to update.

Manual setup, the networking options (Tailscale, Funnel, Caddy), Steam Deck notes, the
tools, and a planning prompt: [docs/health-hub.md](docs/health-hub.md).

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

## License

MIT. Built on [open_oura](https://github.com/Th0rgal/open_oura) by Thomas Marchand.
