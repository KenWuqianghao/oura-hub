//! The always-on health hub.
//!
//! Clients push a `build_summary` JSON to `POST /ingest/summary` and the raw ring
//! rows to `POST /ingest/events`. Agents read the summary through MCP at
//! `POST /mcp/<token>` (or `POST /mcp` with a bearer token). The raw rows live in a
//! second SQLite file with the `oura-store` schema, so the hub is a full replica of
//! the ring data: `oura dashboard --db` runs on it, and `GET /export/events` gives
//! the rows back. The process holds no state outside the two files.

pub mod agent;
pub mod analysis;
pub mod health;
pub mod kinds;
pub mod mcp;
pub mod stats;
pub mod store;
pub mod web;

use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use axum::body::Bytes;
use axum::extract::{DefaultBodyLimit, Path, Query, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde_json::{json, Value};

use health::HealthBatch;
use mcp::{Reply, Server, Tool};
use oura_store::replication::ExportBatch;
use store::Store;

/// Snapshots kept after each push.
pub const KEEP_SNAPSHOTS: i64 = 500;
/// A summary with per-night series is a few MB. Allow more before it hurts.
pub const MAX_BODY_BYTES: usize = 64 * 1024 * 1024;

pub struct AppState {
    pub store: Arc<Store>,
    pub agent: agent::AgentConfig,
    /// The ring replica: raw events, readings, devices in the `oura-store` schema.
    pub ring: Mutex<oura_store::Store>,
    pub token: String,
    pub mcp: Server,
}

/// Rows per page on `GET /export/events`.
pub const EXPORT_PAGE: usize = 2000;

pub fn now_unix() -> i64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs() as i64).unwrap_or(0)
}

/// Constant-time comparison so a timing side channel does not leak the token.
pub fn token_matches(given: &str, expected: &str) -> bool {
    let (a, b) = (given.as_bytes(), expected.as_bytes());
    if a.len() != b.len() || a.is_empty() {
        return false;
    }
    a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

pub(crate) fn bearer(headers: &HeaderMap) -> Option<&str> {
    headers
        .get(header::AUTHORIZATION)?
        .to_str()
        .ok()?
        .strip_prefix("Bearer ")
        .map(str::trim)
}

fn unauthorized() -> Response {
    (StatusCode::UNAUTHORIZED, Json(json!({ "error": "unauthorized" }))).into_response()
}

const MAX_DAILY_KINDS: usize = 60;
const MAX_WINDOW_DAYS: i64 = 4000;
const MAX_WORKOUTS: u64 = 2000;

fn window_days(args: &Value) -> i64 {
    args["days"].as_i64().unwrap_or(30).clamp(1, MAX_WINDOW_DAYS)
}

fn parse_ymd(text: &str) -> Option<i64> {
    let mut parts = text.splitn(3, '-');
    let y: i64 = parts.next()?.parse().ok()?;
    let m: u32 = parts.next()?.parse().ok()?;
    let d: u32 = parts.next()?.parse().ok()?;
    let day = oura_summary::days_from_civil(y, m, d);
    (oura_summary::civil(day) == (y, m, d)).then_some(day)
}

/// The local days a per-day tool covers, as days since 1970-01-01, both inclusive.
struct DayWindow {
    tz_s: i64,
    first: i64,
    last: i64,
}

impl DayWindow {
    /// The seconds east of UTC that set the day boundary: the argument, or the
    /// one of the last ring summary (0 with no summary at all).
    fn tz_from_args(store: &Store, args: &Value) -> Result<i64, String> {
        match args["tz_offset_s"].as_i64() {
            Some(tz) => Ok(tz.clamp(-18 * 3600, 18 * 3600)),
            None => store.latest_tz_s().map_err(|e| format!("store error: {e}")),
        }
    }

    fn today(tz_s: i64, now: i64) -> i64 {
        (now + tz_s).div_euclid(86400)
    }

    fn new(tz_s: i64, first: i64, last: i64) -> Self {
        // The store takes the day of a row with a cast that is right only for a positive local time.
        Self { tz_s, first: first.max(1), last: last.max(1) }
    }

    /// `start_ymd` with an optional `end_ymd`, or `days` that end today. The offset
    /// is the argument, or the one of the last ring summary: these tools work with
    /// no summary at all, so then it is 0.
    fn from_args(store: &Store, args: &Value, now: i64) -> Result<Self, String> {
        let tz_s = Self::tz_from_args(store, args)?;
        let today = Self::today(tz_s, now);
        let ymd = |key: &str| -> Result<Option<i64>, String> {
            match &args[key] {
                Value::Null => Ok(None),
                v => v.as_str().and_then(parse_ymd).map(Some).ok_or_else(|| format!("{key} must be a date as YYYY-MM-DD")),
            }
        };
        let (first, last) = match ymd("start_ymd")? {
            Some(first) => (first, ymd("end_ymd")?.unwrap_or(today)),
            None => (today - window_days(args) + 1, today),
        };
        if last < first {
            return Err("end_ymd is before start_ymd".into());
        }
        Ok(Self::new(tz_s, first, last))
    }

    /// The unix range of row starts, `[lo, hi)`. `shift_s` moves the day boundary
    /// earlier: sleep cuts its days at 18:00.
    fn unix_range(&self, shift_s: i64) -> (f64, f64) {
        let lo = self.first * 86400 - self.tz_s - shift_s;
        let hi = (self.last + 1) * 86400 - self.tz_s - shift_s;
        (lo as f64, hi as f64)
    }

    fn json(&self) -> Value {
        json!({ "tz_offset_s": self.tz_s, "start_ymd": health::ymd_of_day(self.first), "end_ymd": health::ymd_of_day(self.last) })
    }
}

fn health_daily(store: &Store, args: &Value, now: i64) -> Result<Value, String> {
    let kinds: Vec<&str> = args["kinds"]
        .as_array()
        .and_then(|ks| ks.iter().map(Value::as_str).collect())
        .ok_or("kinds is required: an array of kind names")?;
    if kinds.is_empty() || kinds.len() > MAX_DAILY_KINDS {
        return Err(format!("kinds takes 1 to {MAX_DAILY_KINDS} names"));
    }
    let window = DayWindow::from_args(store, args, now)?;
    let (lo, hi) = window.unix_range(0);
    let store_err = |e: anyhow::Error| format!("store error: {e}");
    let mut out = window.json();
    out["kinds"] = kinds
        .iter()
        .map(|kind| {
            let (unit, has_values) = match kinds::lookup(kind) {
                Some(_) => (None, false),
                None => store.health_kind_shape(kind).map_err(store_err)?,
            };
            let def = kinds::def(kind, unit.as_deref(), has_values);
            let days = store.health_daily(&def, lo, hi, window.tz_s).map_err(store_err)?;
            Ok(health::daily_json(&def, &days))
        })
        .collect::<Result<Value, String>>()?;
    Ok(out)
}

fn health_sleep(store: &Store, args: &Value, now: i64) -> Result<Value, String> {
    let window = DayWindow::from_args(store, args, now)?;
    let (lo, hi) = window.unix_range(health::SLEEP_DAY_SHIFT_S);
    let slices = store.health_sleep_slices(lo, hi, window.tz_s).map_err(|e| format!("store error: {e}"))?;
    let mut out = window.json();
    out["nights"] = json!(health::sleep_nights(&slices));
    Ok(out)
}

/// The MCP tool table over the latest snapshot.
pub fn tools(store_for_handler: Arc<Store>) -> (Vec<Tool>, mcp::Handler) {
    let metrics: Vec<&str> = oura_summary::agent::TREND_METRICS.iter().map(|(m, _)| *m).collect();
    let tools = vec![
        Tool {
            name: "get_status_now",
            description: "The current health status for planning today: last night's sleep, sleep debt, HRV and resting heart rate against baseline, illness signs, today's activity so far, and how fresh the data is. Call this first.",
            input_schema: json!({ "type": "object", "properties": {}, "additionalProperties": false }),
        },
        Tool {
            name: "get_sleep",
            description: "Recent nights, newest first: bed and wake time, time asleep, efficiency, stage percentages, HRV, resting heart rate, skin temperature deviation, awakenings.",
            input_schema: json!({ "type": "object", "properties": {
                "days": { "type": "integer", "minimum": 1, "maximum": 90, "default": 7, "description": "How many nights to return." }
            }, "additionalProperties": false }),
        },
        Tool {
            name: "get_trends",
            description: "One metric per day over a window, oldest first, with the latest value, the window mean, and the personal baseline when one exists.",
            input_schema: json!({ "type": "object", "properties": {
                "metric": { "type": "string", "enum": metrics, "description": "Which metric to return." },
                "days": { "type": "integer", "minimum": 1, "maximum": 365, "default": 14 }
            }, "required": ["metric"], "additionalProperties": false }),
        },
        Tool {
            name: "get_watch",
            description: "Apple Health data pushed from the iPhone, mostly from the Apple Watch: today's and yesterday's steps, active energy, exercise and stand minutes, stand hours; latest heart rate, resting heart rate, HRV (SDNN), VO2 max, respiratory rate, blood oxygen, wrist temperature; the last sleep with stages; workouts in the last 48 h; freshness.",
            input_schema: json!({ "type": "object", "properties": {}, "additionalProperties": false }),
        },
        Tool {
            name: "list_health_kinds",
            description: "The Apple Health kinds this hub holds: for each kind the number of samples, the start of the oldest one and the end of the newest one, and how get_health_daily folds it into a day (`agg`: sum, mean, last, count, minutes) in which `unit`. Use a kind from this list with get_health_daily or get_health_samples.",
            input_schema: json!({ "type": "object", "properties": {}, "additionalProperties": false }),
        },
        Tool {
            name: "get_health_samples",
            description: "Raw Apple Health samples of one kind, newest first, in the units the phone sent (a fraction for a percentage, grams for every nutrient). Use it for the detail inside a day or two: the heart rate curve of one workout, the stages of one night. For anything longer use get_health_daily (one value per day, any kind, years in one call), get_health_sleep (nights), or get_workouts; this tool stops at `limit` rows and heart_rate alone has hundreds per day. Call list_health_kinds for the kinds this hub holds. A row has `value` and `unit` for a quantity and `category` for a category (sleep_analysis, stand_hour, mindful_session); workout and electrocardiogram have both. Either `days` back from now, or an explicit `start_unix`/`end_unix` window.",
            input_schema: json!({ "type": "object", "properties": {
                "kind": { "type": "string", "description": "Which kind to return; see list_health_kinds." },
                "days": { "type": "integer", "minimum": 1, "maximum": MAX_WINDOW_DAYS, "default": 7, "description": "How many days back from now; a kind with no recent rows needs a long window." },
                "start_unix": { "type": "number", "description": "Window start (unix seconds); overrides days." },
                "end_unix": { "type": "number", "description": "Window end (unix seconds); default now." },
                "limit": { "type": "integer", "minimum": 1, "maximum": 20000, "default": 500 }
            }, "required": ["kind"], "additionalProperties": false }),
        },
        Tool {
            name: "get_health_daily",
            description: "Apple Health per day, aggregated on the hub: one value per local day for each kind, oldest first, only days with data. Use this for every trend, total, or comparison over more than a day or two; it covers years in one call. Each kind follows its own rule, returned as `agg`: `sum` is the day total from the best single source (steps, energy, distance, every dietary_* nutrient; iPhone and Watch are not added together), `mean` is the mean of the day with `min` and `max` (heart_rate, hrv_sdnn, respiratory_rate, oxygen_saturation), `last` is the last reading of the day with `min` and `max` (body_mass, vo2_max, resting_heart_rate), `count` counts rows (stand_hour counts the hours stood), `minutes` adds row lengths (mindful_session). Values come in the display `unit` returned with the kind, not the stored one: % for fractions, mg or µg for minerals and vitamins, mL for water, min for daylight. `n` is the number of rows behind the value. For sleep stages per night use get_health_sleep; for single workouts use get_workouts. Either `days` back from today, or `start_ymd` with an optional `end_ymd`.",
            input_schema: json!({ "type": "object", "properties": {
                "kinds": { "type": "array", "items": { "type": "string" }, "minItems": 1, "maxItems": MAX_DAILY_KINDS, "description": "Which kinds to return; see list_health_kinds." },
                "days": { "type": "integer", "minimum": 1, "maximum": MAX_WINDOW_DAYS, "default": 30, "description": "How many days to return; the window ends today." },
                "start_ymd": { "type": "string", "description": "First day, YYYY-MM-DD; overrides days." },
                "end_ymd": { "type": "string", "description": "Last day, YYYY-MM-DD, inclusive; default today." },
                "tz_offset_s": { "type": "integer", "description": "Seconds east of UTC that set the day boundary; default the offset of the last ring summary." }
            }, "required": ["kinds"], "additionalProperties": false }),
        },
        Tool {
            name: "get_health_sleep",
            description: "Apple Health sleep per night, oldest first, from every source that wrote sleep (Apple Watch, the Oura app, other trackers), back to the first night on record. get_sleep has more detail but only the recent ring nights; use this one for long ranges and for nights the ring did not record. `ymd` is the day the night ends on: a segment belongs to the night of its local start time plus six hours. Per night the source with the most time asleep gives the row: `source`, `start_unix`, `end_unix`, and minutes `in_bed_min`, `asleep_min`, `deep_min`, `core_min`, `rem_min`, `unspecified_min` (asleep with no stage), `awake_min`. `asleep_min` is null when the source logged only time in bed. Either `days` back from today, or `start_ymd` with an optional `end_ymd`.",
            input_schema: json!({ "type": "object", "properties": {
                "days": { "type": "integer", "minimum": 1, "maximum": MAX_WINDOW_DAYS, "default": 30, "description": "How many nights back from today." },
                "start_ymd": { "type": "string", "description": "First wake day, YYYY-MM-DD; overrides days." },
                "end_ymd": { "type": "string", "description": "Last wake day, YYYY-MM-DD, inclusive; default today." },
                "tz_offset_s": { "type": "integer", "description": "Seconds east of UTC that set the day boundary; default the offset of the last ring summary." }
            }, "additionalProperties": false }),
        },
        Tool {
            name: "get_workouts",
            description: "Apple Health workouts, newest first: `activity`, `start_unix`, `end_unix`, `duration_min`, `kcal`, `distance_m`, `hr_avg` and `hr_max` (from the heart rate samples inside the workout; null when there are none), `source`, and `user_entered` (typed in by hand, not measured). Rows are as recorded: a third-party app can write a workout that is many hours long. Either `days` back from now, or an explicit `start_unix`/`end_unix` window on the workout start.",
            input_schema: json!({ "type": "object", "properties": {
                "days": { "type": "integer", "minimum": 1, "maximum": MAX_WINDOW_DAYS, "default": 30 },
                "start_unix": { "type": "number", "description": "Window start (unix seconds); overrides days." },
                "end_unix": { "type": "number", "description": "Window end (unix seconds); default now." },
                "limit": { "type": "integer", "minimum": 1, "maximum": MAX_WORKOUTS, "default": 200 }
            }, "additionalProperties": false }),
        },
        Tool {
            name: "get_activity",
            description: "Recent days, newest first: steps, active kcal, total kcal, walking distance.",
            input_schema: json!({ "type": "object", "properties": {
                "days": { "type": "integer", "minimum": 1, "maximum": 90, "default": 7 }
            }, "additionalProperties": false }),
        },
        Tool {
            name: "get_baseline",
            description: "Compares the last days with the user's own baseline, computed on the hub. Quote its numbers; never compute a mean, a deviation or a percent yourself. Each series name has one source prefix and gives one value per local day: `ring:<metric>` (a metric of get_trends, see its `metric` list; the ring's main sleep period: of the periods that end on one day the longest, and the day is missing when it lacks the metric), `health:<kind>` (an Apple Health kind of list_health_kinds, folded into a day as get_health_daily does, in the same unit; for sleep use sleep:<field>), `sleep:<field>` (an Apple Health night of get_health_sleep, naps of the same source included; field is one of asleep_min, in_bed_min, deep_min, core_min, rem_min, awake_min; a night from a source without stages has no deep, core, rem or awake value). A night is on the local day it ends on. Ring HRV is RMSSD and `health:hrv_sdnn` is SDNN: do not compare their values. Ring days are in the ring summary's time zone; `tz_offset_s` moves only the Apple Health days. A day with no data is missing, never zero; for a logged kind (dietary_*, mindful_session) only the logged days count. A day total (`day_total` true: steps, energy, distances, dietary_*, counts, minutes) leaves out today, because today is not over. The windows are whole local days that end on `end_ymd` (default today; yesterday for a day total): `recent` is the last `recent_days` days and `baseline` is the `baseline_days` days before it, with no overlap. Per series it returns `series`, `source` (ring or apple_health), `unit`, `day_total`, `recent` and `baseline` ({start_ymd, end_ymd, n, mean}; baseline also `missing_days` and `sd`, the sample SD of one day), `delta` (recent mean minus baseline mean), `delta_pct` (delta in percent of the baseline mean), `z` (delta in standard errors of the difference of the two means: delta / (sd * sqrt(1/R + 1/B)), where R and B are the recent and baseline days counted as fewer independent days by the baseline's lag-1 autocorrelation ρ, n (1 - ρ) / (1 + ρ)), `band`, and `latest_ymd` (the newest day with data in the windows, null if none, so a stale source shows). `band` is `not_enough_data` when baseline n is under 14 or recent n is 0 (delta, delta_pct and z are null), `no_spread` when the baseline SD is 0 (z is null), else by |z|: `usual` under 1, `notable` from 1 to under 2, `unusual` from 2.",
            input_schema: json!({ "type": "object", "properties": {
                "series": { "type": "array", "items": { "type": "string" }, "minItems": 1, "maxItems": analysis::MAX_SERIES, "description": "Series names such as ring:hrv_ms, ring:rhr, health:resting_heart_rate, sleep:asleep_min." },
                "recent_days": { "type": "integer", "minimum": 1, "maximum": analysis::MAX_RECENT_DAYS, "default": 1, "description": "Days in the recent window, ending on end_ymd." },
                "baseline_days": { "type": "integer", "minimum": 14, "maximum": analysis::MAX_BASELINE_DAYS, "default": 28, "description": "Days in the baseline window, just before the recent window." },
                "end_ymd": { "type": "string", "description": "Last day of the recent window, YYYY-MM-DD; default today, and yesterday for a day total." },
                "tz_offset_s": { "type": "integer", "description": "Seconds east of UTC that set the day boundary; default the offset of the last ring summary." }
            }, "required": ["series"], "additionalProperties": false }),
        },
        Tool {
            name: "get_correlation",
            description: "Tests whether two series move together, computed on the hub: Pearson r with a 95% confidence interval by the Fisher z transform on an effective number of days. Quote its numbers; never compute r yourself. `x` and `y` are series names. Each series name has one source prefix and gives one value per local day: `ring:<metric>` (a metric of get_trends, see its `metric` list; the ring's main sleep period: of the periods that end on one day the longest, and the day is missing when it lacks the metric), `health:<kind>` (an Apple Health kind of list_health_kinds, folded into a day as get_health_daily does, in the same unit; for sleep use sleep:<field>), `sleep:<field>` (an Apple Health night of get_health_sleep, naps of the same source included; field is one of asleep_min, in_bed_min, deep_min, core_min, rem_min, awake_min; a night from a source without stages has no deep, core, rem or awake value). A night is on the local day it ends on. Ring HRV is RMSSD and `health:hrv_sdnn` is SDNN: do not compare their values. Ring days are in the ring summary's time zone; `tz_offset_s` moves only the Apple Health days. A day with no data is missing, never zero; for a logged kind (dietary_*, mindful_session) only the logged days count. A day total (`day_total` true: steps, energy, distances, dietary_*, counts, minutes) leaves out today, because today is not over. The window is the last `days` whole local days, ending today. `lag_days` pairs x on day d with y on day d + lag_days: a late workout on day d against the night that ends on d + 1 is lag_days 1. Only days where both values exist are paired. It returns `x` and `y` ({series, source, unit, day_total}), `lag_days`, the window `start_ymd` and `end_ymd`, `n` (paired days), `n_eff` (n shrunk for the day-to-day carry-over of both series, by Bartlett's rule from their lag-1 autocorrelations: two slow trends share many days that are not independent), `r`, `ci95` ([low, high], from n_eff), `evidence` and `note`. `evidence` is `D` when n is under 10 (r and ci95 are null and the note says how many more paired days are needed), when a series has the same value on every paired day, or when n_eff is 3 or less; `A` (a clear link) when n_eff is at least 30, the interval excludes 0 and |r| is at least 0.3; `B` (a link, but small or from few independent days) when the interval excludes 0; else `C` (no reliable link). Each extra lag or pair you try can give a B by chance. A correlation is not a cause.",
            input_schema: json!({ "type": "object", "properties": {
                "x": { "type": "string", "description": "First series, such as health:step_count." },
                "y": { "type": "string", "description": "Second series, such as ring:hrv_ms." },
                "days": { "type": "integer", "minimum": 14, "maximum": MAX_WINDOW_DAYS, "default": 90, "description": "How many days back from today." },
                "lag_days": { "type": "integer", "minimum": 0, "maximum": analysis::MAX_LAG_DAYS, "default": 0, "description": "Pair x on day d with y on day d + lag_days." },
                "tz_offset_s": { "type": "integer", "description": "Seconds east of UTC that set the day boundary; default the offset of the last ring summary." }
            }, "required": ["x", "y"], "additionalProperties": false }),
        },
    ];
    let handler: mcp::Handler = Arc::new(move |name, args| {
        let days = |default: u64| args["days"].as_u64().unwrap_or(default).clamp(1, 365) as usize;
        let now = now_unix();
        // Apple Health tools do not need a ring summary.
        let tz_s = |snap: Option<&Value>| snap.and_then(|s| s["tz"].as_i64()).unwrap_or(0) * 3600;
        let watch = |snap: Option<&Value>| -> Result<Value, String> {
            // The last 7 days for totals and means, plus the newest row of every kind
            // so a sparse vital (VO2 max is weekly at best) still has a "latest".
            let mut rows = store_for_handler
                .health_rows(None, now as f64 - 7.0 * 86400.0, 200_000)
                .map_err(|e| format!("store error: {e}"))?;
            let latest = store_for_handler.health_latest_per_kind().map_err(|e| format!("store error: {e}"))?;
            for r in latest {
                if !rows.iter().any(|x| x.uuid == r.uuid) {
                    rows.push(r);
                }
            }
            Ok(health::watch_status(&rows, now, tz_s(snap)))
        };
        if name == "get_watch" {
            let snap = store_for_handler.latest().map_err(|e| format!("store error: {e}"))?;
            return watch(snap.as_ref().map(|s| &s.body));
        }
        if name == "list_health_kinds" {
            let kinds = store_for_handler.health_kinds().map_err(|e| format!("store error: {e}"))?;
            return Ok(json!({ "count": kinds.len(), "kinds": kinds.iter().map(|k| {
                let def = kinds::def(&k.kind, k.unit.as_deref(), k.has_values);
                json!({
                    "kind": k.kind, "samples": k.samples,
                    "first_start_unix": k.first_start_unix.map(|t| t as i64), "newest_end_unix": k.newest_end_unix as i64,
                    "agg": def.agg.as_str(), "unit": def.unit,
                })
            }).collect::<Vec<_>>() }));
        }
        if name == "get_health_daily" {
            return health_daily(&store_for_handler, args, now);
        }
        if name == "get_health_sleep" {
            return health_sleep(&store_for_handler, args, now);
        }
        if name == "get_baseline" {
            return analysis::baseline(&store_for_handler, args, now);
        }
        if name == "get_correlation" {
            return analysis::correlation(&store_for_handler, args, now);
        }
        if name == "get_workouts" {
            let limit = args["limit"].as_u64().unwrap_or(200).clamp(1, MAX_WORKOUTS) as usize;
            let start = args["start_unix"].as_f64().unwrap_or((now - window_days(args) * 86400) as f64);
            let end = args["end_unix"].as_f64().unwrap_or(now as f64);
            let workouts = store_for_handler.health_workouts(start, end, limit).map_err(|e| format!("store error: {e}"))?;
            return Ok(json!({ "count": workouts.len(), "workouts": workouts.iter().map(health::workout_with_hr_json).collect::<Vec<_>>() }));
        }
        if name == "get_health_samples" {
            let kind = args["kind"].as_str().ok_or("kind is required")?;
            let limit = args["limit"].as_u64().unwrap_or(500).clamp(1, 20000) as usize;
            let back = args["days"].as_i64().unwrap_or(7).clamp(1, MAX_WINDOW_DAYS);
            let start = args["start_unix"].as_f64().unwrap_or((now - back * 86400) as f64);
            let end = args["end_unix"].as_f64();
            let rows = store_for_handler
                .health_rows_between(Some(kind), start, end, limit)
                .map_err(|e| format!("store error: {e}"))?;
            return Ok(json!({ "kind": kind, "count": rows.len(), "samples": rows }));
        }
        let snap = store_for_handler
            .latest()
            .map_err(|e| format!("store error: {e}"))?
            .ok_or_else(|| "no health data yet: nothing has been pushed to this hub".to_string())?;
        let s = &snap.body;
        match name {
            "get_status_now" => {
                let mut status = oura_summary::agent::status_now(s, now);
                status["watch"] = watch(Some(s))?;
                Ok(status)
            }
            "get_sleep" => Ok(oura_summary::agent::sleep_nights(s, days(7))),
            "get_trends" => {
                let metric = args["metric"].as_str().ok_or("metric is required")?;
                oura_summary::agent::trends(s, metric, days(14))
            }
            "get_activity" => Ok(oura_summary::agent::activity_days(s, days(7))),
            other => Err(format!("unknown tool {other}")),
        }
    });
    (tools, handler)
}

pub fn app_state(store: Store, ring: oura_store::Store, token: String) -> Arc<AppState> {
    app_state_with_agent(store, ring, token, agent::AgentConfig::new(std::env::temp_dir().join("oura-hub-agent"), String::new()))
}

pub fn app_state_with_agent(store: Store, ring: oura_store::Store, token: String, agent: agent::AgentConfig) -> Arc<AppState> {
    let store = Arc::new(store);
    let (tools, handler) = tools(store.clone());
    Arc::new(AppState {
        store,
        agent,
        ring: Mutex::new(ring),
        token,
        mcp: Server {
            name: "oura-hub",
            version: env!("CARGO_PKG_VERSION"),
            instructions: agent::RULES,
            tools,
            handler,
        },
    })
}

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/ingest/summary", post(ingest))
        .route("/ingest/events", post(ingest_events))
        .route("/ingest/health", post(ingest_health))
        .route("/export/events", get(export_events))
        .route("/mcp", post(mcp_bearer).get(mcp_no_stream).delete(mcp_no_stream))
        .route("/mcp/{token}", post(mcp_path).get(mcp_no_stream).delete(mcp_no_stream))
        // the web UI and its API
        .route("/", get(web::index))
        .route("/api/session", get(web::session))
        .route("/api/summary", get(web::summary))
        .route("/api/tool/{name}", post(web::tool))
        .route("/api/agent/providers", get(web::agent_providers))
        .route("/api/agent/ask", post(web::agent_ask))
        .route("/{*path}", get(web::asset))
        .layer(DefaultBodyLimit::max(MAX_BODY_BYTES))
        .with_state(state)
}

/// Liveness for everyone; the details only with the token, because a public tunnel
/// may sit in front and the serials and counts are personal.
async fn health(State(st): State<Arc<AppState>>, headers: HeaderMap) -> Response {
    if !bearer(&headers).is_some_and(|t| token_matches(t, &st.token)) {
        return Json(json!({ "ok": true })).into_response();
    }
    let latest = st.store.latest().ok().flatten();
    let (ring_ids, serials) = {
        let ring = st.ring.lock().unwrap();
        (ring.max_ids().unwrap_or((0, 0)), ring.device_serials().unwrap_or_default())
    };
    Json(json!({
        "ok": true,
        "snapshots": st.store.count().unwrap_or(0),
        "latest_received_at": latest.as_ref().map(|s| s.received_at),
        "latest_generated_at": latest.as_ref().and_then(|s| s.generated_at),
        "ring": {
            "serials": serials,
            "max_event_id": ring_ids.0,
            "max_reading_id": ring_ids.1,
        },
        "health": st.store.health_kinds().unwrap_or_default().iter().map(|k| {
            json!({
                "kind": k.kind, "count": k.samples,
                "first_start_unix": k.first_start_unix.map(|t| t as i64), "newest_end_unix": k.newest_end_unix as i64,
            })
        }).collect::<Vec<_>>(),
    }))
    .into_response()
}

/// Apple Health samples from the phone. Upsert by UUID; deletions applied.
async fn ingest_health(State(st): State<Arc<AppState>>, headers: HeaderMap, body: Bytes) -> Response {
    if !bearer(&headers).is_some_and(|t| token_matches(t, &st.token)) {
        return unauthorized();
    }
    let batch: HealthBatch = match serde_json::from_slice(&body) {
        Ok(b) => b,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(json!({ "error": format!("invalid health batch: {e}") }))).into_response(),
    };
    match st.store.put_health(&batch, now_unix()) {
        Ok(out) => Json(serde_json::to_value(out).unwrap_or(Value::Null)).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))).into_response(),
    }
}

/// Raw rows from a phone or desktop store. Idempotent: the replica keeps its own
/// ids and ignores rows it already holds.
async fn ingest_events(State(st): State<Arc<AppState>>, headers: HeaderMap, body: Bytes) -> Response {
    if !bearer(&headers).is_some_and(|t| token_matches(t, &st.token)) {
        return unauthorized();
    }
    let batch: ExportBatch = match serde_json::from_slice(&body) {
        Ok(b) => b,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(json!({ "error": format!("invalid batch: {e}") }))).into_response(),
    };
    if batch.schema_version > oura_store::storage::SCHEMA_VERSION {
        return (StatusCode::UNPROCESSABLE_ENTITY, Json(json!({
            "error": format!("batch schema {} is newer than this hub's {}; update the hub",
                             batch.schema_version, oura_store::storage::SCHEMA_VERSION)
        }))).into_response();
    }
    let outcome = {
        let ring = st.ring.lock().unwrap();
        ring.import_batch(&batch)
    };
    match outcome {
        Ok(out) => Json(serde_json::to_value(out).unwrap_or(Value::Null)).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))).into_response(),
    }
}

#[derive(serde::Deserialize, Default)]
struct ExportQuery {
    after_event_id: Option<i64>,
    after_reading_id: Option<i64>,
    limit: Option<usize>,
}

/// The replica's rows back out, in pages: restore a phone or a desktop from the hub.
async fn export_events(State(st): State<Arc<AppState>>, headers: HeaderMap, Query(q): Query<ExportQuery>) -> Response {
    if !bearer(&headers).is_some_and(|t| token_matches(t, &st.token)) {
        return unauthorized();
    }
    let batch = {
        let ring = st.ring.lock().unwrap();
        ring.export_after(q.after_event_id.unwrap_or(0), q.after_reading_id.unwrap_or(0),
                          q.limit.unwrap_or(EXPORT_PAGE).min(EXPORT_PAGE))
    };
    match batch {
        Ok(b) => Json(serde_json::to_value(b).unwrap_or(Value::Null)).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))).into_response(),
    }
}

async fn ingest(State(st): State<Arc<AppState>>, headers: HeaderMap, body: Bytes) -> Response {
    if !bearer(&headers).is_some_and(|t| token_matches(t, &st.token)) {
        return unauthorized();
    }
    let value: Value = match serde_json::from_slice(&body) {
        Ok(v) => v,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(json!({ "error": format!("invalid JSON: {e}") }))).into_response(),
    };
    if !value.is_object() || value.get("nights").is_none() {
        return (StatusCode::UNPROCESSABLE_ENTITY, Json(json!({ "error": "expected a build_summary object with a nights field" }))).into_response();
    }
    let received_at = now_unix();
    match st.store.put(&value, received_at) {
        Ok(out) => {
            let _ = st.store.prune(KEEP_SNAPSHOTS);
            Json(json!({
                "stored": out.stored,
                "sha256": out.sha256,
                "received_at": received_at,
                "generated_at": value.get("generated_at"),
                "snapshots": out.snapshots.min(KEEP_SNAPSHOTS),
            }))
            .into_response()
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))).into_response(),
    }
}

fn mcp_reply(st: &AppState, body: &[u8]) -> Response {
    match st.mcp.handle_bytes(body) {
        Reply::Json(v) => Json(v).into_response(),
        Reply::Accepted => StatusCode::ACCEPTED.into_response(),
    }
}

async fn mcp_bearer(State(st): State<Arc<AppState>>, headers: HeaderMap, body: Bytes) -> Response {
    if !bearer(&headers).is_some_and(|t| token_matches(t, &st.token)) {
        return unauthorized();
    }
    mcp_reply(&st, &body)
}

async fn mcp_path(State(st): State<Arc<AppState>>, Path(token): Path<String>, body: Bytes) -> Response {
    if !token_matches(&token, &st.token) {
        return unauthorized();
    }
    mcp_reply(&st, &body)
}

/// No server-initiated stream and no sessions to terminate.
async fn mcp_no_stream() -> Response {
    StatusCode::METHOD_NOT_ALLOWED.into_response()
}
