#!/usr/bin/env bash
# Install or update the oura-hub on this machine with one command.
#
#   ./deploy/install.sh            # private: reachable on your tailnet (or this machine only)
#   ./deploy/install.sh --public   # also a public https:// address (Tailscale Funnel)
#
# Run it from the repo clone as your normal user, not root. It:
#   1. finds docker or podman,
#   2. makes a token once (~/.config/oura-hub.env) and keeps it on updates,
#   3. builds the image and runs it as a service that restarts after a reboot,
#   4. publishes the port on loopback and on the Tailscale address,
#   5. prints the web address, a sign-in link, and the MCP address.
# Data lives in ~/oura-hub-data (hub.db, oura.db). Run it again to update.
set -euo pipefail

PORT=8787
PUBLIC=0
for arg in "$@"; do
  case "$arg" in
    --public) PUBLIC=1 ;;
    --port=*) PORT="${arg#--port=}" ;;
    -h|--help) sed -n '2,14p' "$0"; exit 0 ;;
    *) echo "unknown option: $arg (try --help)" >&2; exit 2 ;;
  esac
done

cd "$(dirname "$0")/.."
REPO="$PWD"
DATA="$HOME/oura-hub-data"
ENV_FILE="$HOME/.config/oura-hub.env"
IMAGE="localhost/oura-hub:latest"
NAME="oura-hub"

say()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!!\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31mxx\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] && die "Run this as your normal user, not root."

# ── 1. container engine ──
ENGINE=""
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  ENGINE=docker
elif command -v podman >/dev/null 2>&1; then
  ENGINE=podman
else
  die "Install Docker (https://docs.docker.com/engine/install/) or podman, then run this again."
fi
say "container engine: $ENGINE"

# ── 2. token ──
mkdir -p "$(dirname "$ENV_FILE")" "$DATA"
if [ -f "$ENV_FILE" ] && grep -q '^OURA_HUB_TOKEN=' "$ENV_FILE"; then
  say "keeping the token in $ENV_FILE"
else
  if command -v openssl >/dev/null 2>&1; then TOKEN=$(openssl rand -hex 24)
  else TOKEN=$(od -An -tx1 -N24 /dev/urandom | tr -d ' \n'); fi
  umask 077
  printf 'OURA_HUB_TOKEN=%s\n' "$TOKEN" > "$ENV_FILE"
  say "made a new token in $ENV_FILE"
fi
TOKEN=$(sed -n 's/^OURA_HUB_TOKEN=//p' "$ENV_FILE" | head -1)
[ "${#TOKEN}" -ge 16 ] || die "the token in $ENV_FILE is shorter than 16 characters"

# ── 3. Tailscale (optional) ──
TS=""
for c in tailscale /opt/tailscale/tailscale /Applications/Tailscale.app/Contents/MacOS/Tailscale; do
  if command -v "$c" >/dev/null 2>&1 || [ -x "$c" ]; then TS="$c"; break; fi
done
TS_IP=""; TS_NAME=""
if [ -n "$TS" ] && "$TS" status >/dev/null 2>&1; then
  TS_IP=$("$TS" ip -4 2>/dev/null | head -1 || true)
  # "Self" comes first in the status JSON, so the first DNSName is this machine.
  TS_NAME=$("$TS" status --json 2>/dev/null | sed -n 's/.*"DNSName": *"\([^"]*\)\.".*/\1/p' | head -1 || true)
  say "Tailscale: $TS_NAME ($TS_IP)"
else
  warn "Tailscale is not running. The hub will listen on this machine only."
  warn "Install it (https://tailscale.com/download) so your phone can reach the hub from anywhere."
  [ "$PUBLIC" -eq 1 ] && die "--public needs Tailscale."
fi

# ── 4. build ──
say "building the image (the first build takes a few minutes)"
"$ENGINE" build -t "$IMAGE" "$REPO"

# ── 5. run as a service ──
PUBLISH=("127.0.0.1:$PORT:8787")
[ -n "$TS_IP" ] && PUBLISH+=("$TS_IP:$PORT:8787")

if [ "$ENGINE" = podman ] && command -v systemctl >/dev/null 2>&1 && systemctl --user show-environment >/dev/null 2>&1; then
  # Podman + systemd: a Quadlet unit, started at boot even when nobody is logged in.
  UNIT_DIR="$HOME/.config/containers/systemd"
  mkdir -p "$UNIT_DIR"
  while IFS= read -r line; do
    printf '%s\n' "$line"
    if [ "${line#ContainerName=}" != "$line" ]; then
      for p in "${PUBLISH[@]}"; do echo "PublishPort=$p"; done
    fi
  done < "$REPO/deploy/oura-hub.container" > "$UNIT_DIR/oura-hub.container"
  "$ENGINE" rm -f "$NAME" >/dev/null 2>&1 || true
  loginctl enable-linger "$USER" >/dev/null 2>&1 || warn "loginctl enable-linger failed: the hub stops when you log out"
  systemctl --user daemon-reload
  systemctl --user restart oura-hub.service
  say "running as the systemd user service oura-hub.service"
else
  # Docker (or podman without systemd): the engine restarts the container.
  "$ENGINE" rm -f "$NAME" >/dev/null 2>&1 || true
  args=(run -d --name "$NAME" --restart unless-stopped --env-file "$ENV_FILE" -e RUST_LOG=info -v "$DATA:/data")
  [ "$ENGINE" = podman ] && args[${#args[@]}-1]="$DATA:/data:Z"
  for p in "${PUBLISH[@]}"; do args+=(-p "$p"); done
  "$ENGINE" "${args[@]}" "$IMAGE" >/dev/null
  say "running as the $ENGINE container $NAME (restarts after a reboot)"
fi

# ── 6. wait until it answers ──
for _ in $(seq 1 30); do
  curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null 2>&1 || die "the hub did not answer on port $PORT. Logs: $ENGINE logs $NAME"

# ── 7. public address ──
URL="http://127.0.0.1:$PORT"
[ -n "$TS_NAME" ] && URL="http://$TS_NAME:$PORT"
if [ "$PUBLIC" -eq 1 ]; then
  say "turning on Tailscale Funnel (if it asks, open the link it prints, approve, and run this again)"
  if command -v timeout >/dev/null 2>&1; then timeout 60 "$TS" funnel --bg "$PORT"; else "$TS" funnel --bg "$PORT"; fi
  URL="https://$TS_NAME"
fi

cat <<EOF

$(printf '\033[1;32m')The hub is running.$(printf '\033[0m')

  Web app      $URL
  Sign in      $URL/#token=$TOKEN
  MCP address  $URL/mcp/$TOKEN
  Data         $DATA
  Token        $ENV_FILE

Next:
  1. Open the "Sign in" link in a browser. It opens the Connect page.
  2. Scan its QR code with the iPhone Camera to connect Open Oura.
  3. Copy the MCP line for Claude Code or your agent from the same page.

Keep the token secret: it is the only key to your health data.
EOF
if [ -n "$TS_NAME" ] && [ "$PUBLIC" -eq 0 ]; then
  echo "Your phone and your agent must be on the same tailnet. For a hosted agent, run: $0 --public"
fi
