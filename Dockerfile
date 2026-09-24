# oura-hub: the always-on health hub.
FROM docker.io/library/rust:1.93-bookworm AS build
WORKDIR /src
COPY . .
RUN cargo build --release

FROM docker.io/library/debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/*
COPY --from=build /src/target/release/oura-hub /usr/local/bin/oura-hub
ENV OURA_HUB_BIND=0.0.0.0:8787 OURA_HUB_DB=/data/hub.db
VOLUME /data
EXPOSE 8787
ENTRYPOINT ["oura-hub"]
