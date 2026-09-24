# oura-hub: the always-on health hub, with the web UI and the agent CLIs built in.
FROM docker.io/library/node:22-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ .
RUN npm run build

FROM docker.io/library/rust:1.93-bookworm AS build
WORKDIR /src
COPY . .
COPY --from=web /web/dist ./web/dist
RUN cargo build --release

FROM docker.io/library/debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl git && rm -rf /var/lib/apt/lists/*
# The agent CLIs. They use the user's own subscriptions; sign in once with
#   podman exec -it oura-hub claude        (follow the link)
#   podman exec -it oura-hub codex login --device-auth
#   podman exec -it oura-hub cursor-agent login
# and keep /root/.claude, /root/.codex, /root/.cursor and /root/.config on volumes
# (see docker-compose.yml): cursor-agent writes its login under /root/.config.
ENV HOME=/root PATH=/root/.local/bin:$PATH
RUN curl -fsSL https://claude.ai/install.sh | bash || echo "claude install skipped"
RUN curl -fsS https://cursor.com/install | bash || echo "cursor-agent install skipped"
ARG CODEX_VERSION=0.152.1
RUN set -e; arch="$(uname -m)"; case "$arch" in x86_64) t=x86_64-unknown-linux-musl;; aarch64) t=aarch64-unknown-linux-musl;; *) t="";; esac; \
    if [ -n "$t" ]; then mkdir -p /root/.local/bin && curl -fsSL "https://github.com/openai/codex/releases/download/rust-v${CODEX_VERSION}/codex-${t}.tar.gz" | tar -xz -C /root/.local/bin && mv /root/.local/bin/codex-${t} /root/.local/bin/codex && chmod +x /root/.local/bin/codex || echo "codex install skipped"; fi
COPY --from=build /src/target/release/oura-hub /usr/local/bin/oura-hub
ENV OURA_HUB_BIND=0.0.0.0:8787 OURA_HUB_DB=/data/hub.db
VOLUME /data
EXPOSE 8787
ENTRYPOINT ["oura-hub"]
