//! The web UI and its JSON API. The UI is a single-page app built into `web/dist`
//! and embedded in the binary. The API is the same data the MCP tools return,
//! plus the raw latest summary, behind the same bearer token.

use std::sync::Arc;

use axum::body::Bytes;
use axum::extract::{Path, State};
use axum::http::{header, HeaderMap, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use rust_embed::RustEmbed;
use serde_json::{json, Value};

use crate::{bearer, token_matches, AppState};

#[derive(RustEmbed)]
#[folder = "web/dist/"]
struct Assets;

fn unauthorized() -> Response {
    (StatusCode::UNAUTHORIZED, Json(json!({ "error": "unauthorized" }))).into_response()
}

fn authed(st: &AppState, headers: &HeaderMap) -> bool {
    bearer(headers).is_some_and(|t| token_matches(t, &st.token))
}

fn embedded(path: &str) -> Option<Response> {
    let file = Assets::get(path)?;
    let mime = file.metadata.mimetype();
    let cache = if path.starts_with("assets/") { "public, max-age=31536000, immutable" } else { "no-cache" };
    Some((
        [(header::CONTENT_TYPE, HeaderValue::from_str(mime).unwrap_or(HeaderValue::from_static("application/octet-stream"))),
         (header::CACHE_CONTROL, HeaderValue::from_static(cache))],
        file.data.into_owned(),
    )
        .into_response())
}

/// The app shell, or a plain page when the UI was not built into this binary.
pub async fn index() -> Response {
    embedded("index.html").unwrap_or_else(|| {
        (
            StatusCode::OK,
            [(header::CONTENT_TYPE, "text/html; charset=utf-8")],
            "<!doctype html><title>oura-hub</title><p>The hub is running. The web UI was not built into this binary: run <code>npm run build</code> in <code>web/</code> and rebuild.</p>",
        )
            .into_response()
    })
}

/// Static files; unknown paths fall back to the app shell for client-side routes.
pub async fn asset(Path(path): Path<String>) -> Response {
    match embedded(&path) {
        Some(r) => r,
        None if path.starts_with("assets/") || path.contains('.') => StatusCode::NOT_FOUND.into_response(),
        None => index().await,
    }
}

/// A login check: `{ok:true}` with a valid token, 401 without.
pub async fn session(State(st): State<Arc<AppState>>, headers: HeaderMap) -> Response {
    if !authed(&st, &headers) {
        return unauthorized();
    }
    Json(json!({ "ok": true, "name": st.mcp.name, "version": st.mcp.version })).into_response()
}

/// The latest summary snapshot as pushed, with its timestamps.
pub async fn summary(State(st): State<Arc<AppState>>, headers: HeaderMap) -> Response {
    if !authed(&st, &headers) {
        return unauthorized();
    }
    match st.store.latest() {
        Ok(Some(s)) => Json(json!({ "received_at": s.received_at, "generated_at": s.generated_at, "body": s.body })).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, Json(json!({ "error": "no summary has been pushed yet" }))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))).into_response(),
    }
}

/// Run one MCP tool by name with a JSON object of arguments; the tool result as JSON.
pub async fn tool(State(st): State<Arc<AppState>>, headers: HeaderMap, Path(name): Path<String>, body: Bytes) -> Response {
    if !authed(&st, &headers) {
        return unauthorized();
    }
    if !st.mcp.tools.iter().any(|t| t.name == name) {
        return (StatusCode::NOT_FOUND, Json(json!({ "error": format!("unknown tool {name:?}") }))).into_response();
    }
    let args: Value = if body.is_empty() {
        json!({})
    } else {
        match serde_json::from_slice(&body) {
            Ok(v) => v,
            Err(e) => return (StatusCode::BAD_REQUEST, Json(json!({ "error": format!("invalid JSON: {e}") }))).into_response(),
        }
    };
    match (st.mcp.handler)(&name, &args) {
        Ok(v) => Json(v).into_response(),
        Err(text) => (StatusCode::UNPROCESSABLE_ENTITY, Json(json!({ "error": text }))).into_response(),
    }
}
