//! The two statistics tools. A series name picks one value per local day from the
//! ring summary or from Apple Health; `stats` does the arithmetic; this module
//! only loads series, cuts windows, and shapes the JSON.

use std::collections::BTreeMap;

use serde_json::{json, Value};

use crate::health::{self, ymd_of_day};
use crate::stats;
use crate::store::Store;
use crate::kinds::{self, Agg};
use crate::{parse_ymd, DayWindow, MAX_WINDOW_DAYS};

pub const MAX_SERIES: usize = 20;
pub const MAX_RECENT_DAYS: i64 = 14;
pub const MAX_BASELINE_DAYS: i64 = 365;
pub const MAX_LAG_DAYS: i64 = 7;
pub const SLEEP_FIELDS: &[&str] = &["asleep_min", "in_bed_min", "deep_min", "core_min", "rem_min", "awake_min"];
/// Sleep fields that a source without sleep stages writes as 0: for such a night they are missing.
const STAGE_FIELDS: &[&str] = &["deep_min", "core_min", "rem_min", "awake_min"];

/// Ring metrics that come from `activity_daily` (a calendar day). Every other
/// metric comes from the sleep periods of the summary.
const ACTIVITY_METRICS: &[&str] = &["steps", "active_kcal", "total_kcal"];

/// What a series name means. Parsed once, where the name enters.
#[derive(Debug, Clone, PartialEq)]
pub enum SeriesRef {
    Ring(&'static str),
    Health(String),
    Sleep(&'static str),
}

impl SeriesRef {
    pub fn parse(name: &str) -> Result<Self, String> {
        let ring: Vec<&str> = oura_summary::agent::TREND_METRICS.iter().map(|(m, _)| *m).collect();
        let forms = || {
            format!(
                "a series is ring:<metric> ({}), health:<kind> (a kind of list_health_kinds), or sleep:<field> ({})",
                ring.join(", "),
                SLEEP_FIELDS.join(", ")
            )
        };
        match name.split_once(':') {
            Some(("ring", metric)) => ring
                .iter()
                .find(|m| **m == metric)
                .map(|m| SeriesRef::Ring(m))
                .ok_or_else(|| format!("unknown series {name:?}; {}", forms())),
            Some(("health", "sleep_analysis")) => Err("health:sleep_analysis splits a night at midnight; use sleep:asleep_min or another sleep:<field>".into()),
            Some(("health", kind)) if !kind.is_empty() => Ok(SeriesRef::Health(kind.to_string())),
            Some(("sleep", field)) => SLEEP_FIELDS
                .iter()
                .find(|f| **f == field)
                .map(|f| SeriesRef::Sleep(f))
                .ok_or_else(|| format!("unknown series {name:?}; {}", forms())),
            _ => Err(format!("unknown series {name:?}; {}", forms())),
        }
    }

    fn source(&self) -> &'static str {
        match self {
            SeriesRef::Ring(_) => "ring",
            SeriesRef::Health(_) | SeriesRef::Sleep(_) => "apple_health",
        }
    }

    fn name(&self) -> String {
        match self {
            SeriesRef::Ring(m) => format!("ring:{m}"),
            SeriesRef::Health(k) => format!("health:{k}"),
            SeriesRef::Sleep(f) => format!("sleep:{f}"),
        }
    }
}

/// One value per local day. A day with no data has no key.
pub struct Series {
    pub name: String,
    pub source: &'static str,
    pub unit: String,
    /// A total that grows through the day (steps, energy): today's value is partial,
    /// so the series never holds today.
    pub day_total: bool,
    /// Local days since 1970-01-01.
    pub points: BTreeMap<i64, f64>,
}

impl Series {
    fn head(&self) -> Value {
        json!({ "series": self.name, "source": self.source, "unit": self.unit, "day_total": self.day_total })
    }
}

/// The local day a sleep period of the summary ends on. `ymd` is the day it
/// starts on, so a period that ends earlier in the day than it starts ends on the next day.
fn wake_day(night: &Value) -> Option<i64> {
    let clock = |key: &str| -> Option<i64> {
        let (h, m) = night[key].as_str()?.split_once(':')?;
        Some(h.parse::<i64>().ok()? * 60 + m.parse::<i64>().ok()?)
    };
    let start_day = parse_ymd(night["ymd"].as_str()?)?;
    Some(start_day + i64::from(clock("end")? <= clock("start")?))
}

fn night_metric(night: &Value, metric: &str) -> Option<f64> {
    match metric {
        "asleep_min" | "awakenings" | "waso_min" | "sol_min" => night["metrics"][metric].as_f64(),
        _ => night[metric].as_f64(),
    }
}

/// A ring metric per day. Sleep metrics sit on the wake day; of the periods that
/// end on one day (a nap, a split night) and have the metric, the longest in bed gives the value.
fn ring_points(summary: &Value, metric: &str) -> BTreeMap<i64, f64> {
    if ACTIVITY_METRICS.contains(&metric) {
        let Some(daily) = summary["activity_daily"].as_object() else { return BTreeMap::new() };
        return daily.iter().filter_map(|(ymd, d)| Some((parse_ymd(ymd)?, d[metric].as_f64()?))).collect();
    }
    let mut longest: BTreeMap<i64, (f64, f64)> = BTreeMap::new();
    for night in summary["nights"].as_array().into_iter().flatten() {
        let (Some(day), Some(value)) = (wake_day(night), night_metric(night, metric)) else { continue };
        let in_bed = night["in_bed_h"].as_f64().unwrap_or(0.0);
        if longest.get(&day).is_none_or(|(best, _)| in_bed > *best) {
            longest.insert(day, (in_bed, value));
        }
    }
    longest.into_iter().map(|(day, (_, value))| (day, value)).collect()
}

/// `snapshot` is the latest ring summary; only a ring series reads it.
fn load_series(store: &Store, snapshot: Option<&Value>, series: &SeriesRef, w: &DayWindow, today: i64) -> Result<Series, String> {
    let store_err = |e: anyhow::Error| format!("store error: {e}");
    let in_window = |p: BTreeMap<i64, f64>| p.range(w.first..=w.last).map(|(d, v)| (*d, *v)).collect::<BTreeMap<_, _>>();
    let (unit, day_total, mut points) = match series {
        SeriesRef::Ring(metric) => {
            let summary = snapshot.ok_or("no ring data yet: nothing has been pushed to this hub")?;
            let unit = oura_summary::agent::TREND_METRICS.iter().find(|(m, _)| m == metric).map_or("", |(_, u)| *u);
            (unit.to_string(), ACTIVITY_METRICS.contains(metric), in_window(ring_points(summary, metric)))
        }
        SeriesRef::Health(kind) => {
            let (stored_unit, has_values) = match kinds::lookup(kind) {
                Some(_) => (None, false),
                None => store.health_kind_shape(kind).map_err(store_err)?,
            };
            let def = kinds::def(kind, stored_unit.as_deref(), has_values);
            let (lo, hi) = w.unix_range(0);
            let days = store.health_daily(&def, lo, hi, w.tz_s).map_err(store_err)?;
            if days.is_empty() && !store.health_has_kind(kind).map_err(store_err)? {
                return Err(format!("this hub holds no Apple Health kind {kind:?}; call list_health_kinds"));
            }
            let day_total = matches!(def.agg, Agg::Sum | Agg::Count | Agg::Minutes);
            (def.unit.to_string(), day_total, days.iter().map(|d| (d.day, d.value * def.scale)).collect())
        }
        SeriesRef::Sleep(field) => {
            let (lo, hi) = w.unix_range(health::SLEEP_DAY_SHIFT_S);
            let slices = store.health_sleep_slices(lo, hi, w.tz_s).map_err(store_err)?;
            let has_stages = |n: &Value| ["deep_min", "core_min", "rem_min"].iter().any(|f| n[f].as_f64().is_some_and(|m| m > 0.0));
            let points = health::sleep_nights(&slices)
                .iter()
                .filter(|n| !STAGE_FIELDS.contains(field) || has_stages(n))
                .filter_map(|n| Some((parse_ymd(n["ymd"].as_str()?)?, n[field].as_f64()?)))
                .collect();
            ("min".to_string(), false, points)
        }
    };
    if day_total {
        points.remove(&today);
    }
    Ok(Series { name: series.name(), source: series.source(), unit, day_total, points })
}

fn parse_names(args: &Value, key: &str, max: usize) -> Result<Vec<SeriesRef>, String> {
    let names: Vec<&str> = args[key]
        .as_array()
        .and_then(|a| a.iter().map(Value::as_str).collect())
        .ok_or_else(|| format!("{key} is required: an array of series names"))?;
    if names.is_empty() || names.len() > max {
        return Err(format!("{key} takes 1 to {max} names"));
    }
    names.into_iter().map(SeriesRef::parse).collect()
}

/// The latest ring summary, read only when a ring series needs it.
fn snapshot_for(store: &Store, refs: &[&SeriesRef]) -> Result<Option<Value>, String> {
    if !refs.iter().any(|r| matches!(r, SeriesRef::Ring(_))) {
        return Ok(None);
    }
    let snap = store.latest().map_err(|e| format!("store error: {e}"))?;
    Ok(Some(snap.ok_or("no ring data yet: nothing has been pushed to this hub")?.body))
}

fn round3(x: f64) -> f64 {
    (x * 1000.0).round() / 1000.0
}

fn r3(x: Option<f64>) -> Value {
    json!(x.map(round3))
}

fn range_values(points: &BTreeMap<i64, f64>, first: i64, last: i64) -> Vec<f64> {
    points.range(first..=last).map(|(_, v)| *v).collect()
}

pub fn baseline(store: &Store, args: &Value, now: i64) -> Result<Value, String> {
    let refs = parse_names(args, "series", MAX_SERIES)?;
    let recent_days = args["recent_days"].as_i64().unwrap_or(1).clamp(1, MAX_RECENT_DAYS);
    let baseline_days = args["baseline_days"].as_i64().unwrap_or(28).clamp(stats::MIN_BASELINE_DAYS as i64, MAX_BASELINE_DAYS);
    let tz_s = DayWindow::tz_from_args(store, args)?;
    let today = DayWindow::today(tz_s, now);
    let end = match &args["end_ymd"] {
        Value::Null => today,
        v => v.as_str().and_then(parse_ymd).ok_or("end_ymd must be a date as YYYY-MM-DD")?,
    };
    // one day more than the windows need: a day total ends a day earlier
    let window = DayWindow::new(tz_s, end - recent_days - baseline_days, end);
    let snapshot = snapshot_for(store, &refs.iter().collect::<Vec<_>>())?;
    let results = refs
        .iter()
        .map(|r| {
            let series = load_series(store, snapshot.as_ref(), r, &window, today)?;
            let end = if series.day_total && end == today { today - 1 } else { end };
            let recent_first = end - recent_days + 1;
            let base_first = recent_first - baseline_days;
            let recent = range_values(&series.points, recent_first, end);
            let base = range_values(&series.points, base_first, recent_first - 1);
            let dev = stats::deviation(&recent, &base);
            let mut out = series.head();
            out["recent"] = json!({
                "start_ymd": ymd_of_day(recent_first), "end_ymd": ymd_of_day(end),
                "n": recent.len(), "mean": r3(stats::mean(&recent)),
            });
            out["baseline"] = json!({
                "start_ymd": ymd_of_day(base_first), "end_ymd": ymd_of_day(recent_first - 1),
                "n": base.len(), "missing_days": baseline_days as usize - base.len(),
                "mean": r3(stats::mean(&base)), "sd": r3(stats::sd(&base)),
            });
            out["delta"] = r3(dev.delta);
            out["delta_pct"] = r3(dev.delta_pct);
            out["z"] = r3(dev.z);
            out["band"] = json!(dev.band.as_str());
            out["latest_ymd"] = json!(series.points.keys().next_back().map(|d| ymd_of_day(*d)));
            Ok(out)
        })
        .collect::<Result<Vec<_>, String>>()?;
    Ok(json!({ "tz_offset_s": tz_s, "baselines": results }))
}

pub fn correlation(store: &Store, args: &Value, now: i64) -> Result<Value, String> {
    let name = |key: &str| -> Result<SeriesRef, String> {
        SeriesRef::parse(args[key].as_str().ok_or_else(|| format!("{key} is required: a series name"))?)
    };
    let (x, y) = (name("x")?, name("y")?);
    let days = args["days"].as_i64().unwrap_or(90).clamp(14, MAX_WINDOW_DAYS);
    let lag = args["lag_days"].as_i64().unwrap_or(0).clamp(0, MAX_LAG_DAYS);
    if x == y && lag == 0 {
        return Err("x and y are the same series; use a different y or a lag_days above 0".into());
    }
    let tz_s = DayWindow::tz_from_args(store, args)?;
    let today = DayWindow::today(tz_s, now);
    let window = DayWindow::new(tz_s, today - days + 1, today);
    let snapshot = snapshot_for(store, &[&x, &y])?;
    let (sx, sy) = (load_series(store, snapshot.as_ref(), &x, &window, today)?, load_series(store, snapshot.as_ref(), &y, &window, today)?);
    let (xs, ys): (Vec<f64>, Vec<f64>) = sx.points.iter().filter_map(|(d, xv)| Some((*xv, *sy.points.get(&(d + lag))?))).unzip();
    let c = stats::correlate(&xs, &ys);
    let mut out = window.json();
    out["x"] = sx.head();
    out["y"] = sy.head();
    out["lag_days"] = json!(lag);
    out["n"] = json!(c.n);
    out["n_eff"] = json!(c.n_eff.map(|n| (n * 10.0).round() / 10.0));
    out["r"] = r3(c.r);
    out["ci95"] = json!(c.ci95.map(|(lo, hi)| [round3(lo), round3(hi)]));
    out["evidence"] = json!(c.evidence.as_str());
    out["note"] = json!(c.note);
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_series_name_has_one_source_and_unknown_forms_list_the_valid_ones() {
        assert_eq!(SeriesRef::parse("ring:hrv_ms"), Ok(SeriesRef::Ring("hrv_ms")));
        assert_eq!(SeriesRef::parse("health:step_count"), Ok(SeriesRef::Health("step_count".into())));
        assert_eq!(SeriesRef::parse("sleep:rem_min"), Ok(SeriesRef::Sleep("rem_min")));
        for bad in ["hrv_ms", "ring:mood", "sleep:efficiency", "health:", "oura:rhr"] {
            let e = SeriesRef::parse(bad).unwrap_err();
            assert!(e.contains("ring:<metric>") && e.contains("sleep:<field>"), "{bad}: {e}");
        }
    }

    #[test]
    fn a_ring_night_sits_on_its_wake_day_and_the_longest_period_wins() {
        let summary = json!({
            "nights": [
                { "ymd": "2024-01-10", "start": "23:00", "end": "07:00", "in_bed_h": 8.0, "hrv_ms": 50.0, "metrics": { "asleep_min": 420.0 } },
                { "ymd": "2024-01-11", "start": "13:00", "end": "14:00", "in_bed_h": 1.0, "hrv_ms": 70.0, "metrics": { "asleep_min": 50.0 } },
                { "ymd": "2024-01-11", "start": "00:30", "end": "06:30", "in_bed_h": 6.0, "hrv_ms": 40.0, "metrics": { "asleep_min": 300.0 } },
            ],
            "activity_daily": { "2024-01-10": { "steps": 5000.0 } }
        });
        let day = |ymd| parse_ymd(ymd).unwrap();
        let hrv = ring_points(&summary, "hrv_ms");
        assert_eq!(hrv.keys().copied().collect::<Vec<_>>(), [day("2024-01-11")]);
        assert_eq!(hrv[&day("2024-01-11")], 50.0, "the 23:00 night ends on the 11th and beats the 6 h and 1 h periods");
        let asleep = ring_points(&summary, "asleep_min");
        assert_eq!(asleep[&day("2024-01-11")], 420.0);
        assert_eq!(ring_points(&summary, "steps")[&day("2024-01-10")], 5000.0, "activity stays on its calendar day");
    }
}
