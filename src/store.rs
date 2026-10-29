//! Snapshot storage. Every pushed summary is one row. The latest row feeds the
//! MCP tools; the history keeps the freshness honest and lets a later step diff.

use std::path::Path;
use std::sync::Mutex;

use anyhow::{Context, Result};
use rusqlite::{params, Connection, OptionalExtension, ToSql};
use serde_json::Value;
use sha2::{Digest, Sha256};

use crate::health::{DayValue, HealthBatch, HealthOutcome, HealthSample, SleepSlice, Workout, SLEEP_DAY_SHIFT_S};
use crate::kinds::{Agg, KindDef};

pub struct Store {
    conn: Mutex<Connection>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Snapshot {
    pub id: i64,
    pub received_at: i64,
    pub generated_at: Option<f64>,
    pub body: Value,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PutOutcome {
    /// False when an identical body was already stored.
    pub stored: bool,
    pub sha256: String,
    pub snapshots: i64,
}

/// What the hub holds of one kind.
#[derive(Debug, Clone, PartialEq)]
pub struct KindStats {
    pub kind: String,
    pub samples: i64,
    pub newest_end_unix: f64,
    /// None when every row starts before `FIRST_START_FLOOR`.
    pub first_start_unix: Option<f64>,
    /// The unit on the newest row, before any `kinds` scale.
    pub unit: Option<String>,
    /// Whether the newest row carries a value.
    pub has_values: bool,
}

/// 2000-01-01. A few category rows arrive with a start near 0; they are not the
/// start of anyone's history.
const FIRST_START_FLOOR: f64 = 946_684_800.0;

const NEWEST_ROW: &str = "FROM health_samples WHERE kind =";
const SAMPLE_COLS: &str = "uuid, kind, start_unix, end_unix, value, unit, category, source_bundle, source_name, device, metadata";

fn sample_row(r: &rusqlite::Row) -> rusqlite::Result<HealthSample> {
    let metadata: Option<String> = r.get(10)?;
    Ok(HealthSample {
        uuid: r.get(0)?, kind: r.get(1)?, start_unix: r.get(2)?, end_unix: r.get(3)?,
        value: r.get(4)?, unit: r.get(5)?, category: r.get(6)?, source_bundle: r.get(7)?,
        source_name: r.get(8)?, device: r.get(9)?,
        metadata: metadata.and_then(|m| serde_json::from_str(&m).ok()),
    })
}

const SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY,
    received_at INTEGER NOT NULL,
    generated_at REAL,
    sha256 TEXT NOT NULL UNIQUE,
    body TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS snapshots_received ON snapshots(received_at);
CREATE TABLE IF NOT EXISTS health_samples (
    uuid TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    start_unix REAL NOT NULL,
    end_unix REAL NOT NULL,
    value REAL,
    unit TEXT,
    category TEXT,
    source_bundle TEXT,
    source_name TEXT,
    device TEXT,
    metadata TEXT,
    received_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS health_kind_start ON health_samples(kind, start_unix);
CREATE INDEX IF NOT EXISTS health_end ON health_samples(end_unix);
";

impl Store {
    pub fn open(path: &Path) -> Result<Self> {
        let conn = Connection::open(path).with_context(|| format!("opening {}", path.display()))?;
        Self::init(conn)
    }

    pub fn in_memory() -> Result<Self> {
        Self::init(Connection::open_in_memory()?)
    }

    fn init(conn: Connection) -> Result<Self> {
        conn.execute_batch("PRAGMA journal_mode=WAL;")?;
        conn.execute_batch(SCHEMA)?;
        Ok(Self { conn: Mutex::new(conn) })
    }

    /// The hash that decides "unchanged": the body without `generated_at`, which the
    /// client stamps on every build even when nothing else moved.
    pub fn content_sha256(body: &Value) -> String {
        let mut content = body.clone();
        if let Some(obj) = content.as_object_mut() {
            obj.remove("generated_at");
        }
        hex::encode(Sha256::digest(content.to_string().as_bytes()))
    }

    /// Store one summary. A body whose content (ignoring `generated_at`) is already
    /// stored is not stored twice.
    pub fn put(&self, body: &Value, received_at: i64) -> Result<PutOutcome> {
        let text = serde_json::to_string(body)?;
        let sha256 = Self::content_sha256(body);
        let generated_at = body.get("generated_at").and_then(Value::as_f64);
        let conn = self.conn.lock().unwrap();
        let inserted = conn.execute(
            "INSERT OR IGNORE INTO snapshots(received_at, generated_at, sha256, body) VALUES (?1, ?2, ?3, ?4)",
            params![received_at, generated_at, sha256, text],
        )?;
        let snapshots: i64 = conn.query_row("SELECT COUNT(*) FROM snapshots", [], |r| r.get(0))?;
        Ok(PutOutcome { stored: inserted == 1, sha256, snapshots })
    }

    /// The most recently received snapshot.
    pub fn latest(&self) -> Result<Option<Snapshot>> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT id, received_at, generated_at, body FROM snapshots ORDER BY received_at DESC, id DESC LIMIT 1",
            [],
            |r| {
                let text: String = r.get(3)?;
                Ok((r.get::<_, i64>(0)?, r.get::<_, i64>(1)?, r.get::<_, Option<f64>>(2)?, text))
            },
        )
        .optional()?
        .map(|(id, received_at, generated_at, text)| {
            Ok(Snapshot { id, received_at, generated_at, body: serde_json::from_str(&text)? })
        })
        .transpose()
    }

    pub fn count(&self) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        Ok(conn.query_row("SELECT COUNT(*) FROM snapshots", [], |r| r.get(0))?)
    }

    /// Upsert Apple Health samples by UUID and apply the deletions.
    pub fn put_health(&self, batch: &HealthBatch, received_at: i64) -> Result<HealthOutcome> {
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction()?;
        let mut out = HealthOutcome { samples_seen: batch.samples.len(), ..Default::default() };
        for s in &batch.samples {
            let metadata = s.metadata.as_ref().map(|m| m.to_string());
            out.stored += tx.execute(
                "INSERT OR REPLACE INTO health_samples
                   (uuid, kind, start_unix, end_unix, value, unit, category, source_bundle, source_name, device, metadata, received_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
                params![s.uuid, s.kind, s.start_unix, s.end_unix, s.value, s.unit, s.category,
                        s.source_bundle, s.source_name, s.device, metadata, received_at],
            )?;
        }
        for uuid in &batch.deleted {
            out.deleted += tx.execute("DELETE FROM health_samples WHERE uuid = ?1", params![uuid])?;
        }
        tx.commit()?;
        out.total = conn.query_row("SELECT COUNT(*) FROM health_samples", [], |r| r.get(0))?;
        Ok(out)
    }

    /// Samples of one kind (or all kinds) that end at or after `since_unix`, newest first.
    pub fn health_rows(&self, kind: Option<&str>, since_unix: f64, limit: usize) -> Result<Vec<HealthSample>> {
        self.health_rows_between(kind, since_unix, None, limit)
    }

    /// Samples that end inside `[since_unix, until_unix]` (open-ended without `until`), newest first.
    pub fn health_rows_between(&self, kind: Option<&str>, since_unix: f64, until_unix: Option<f64>, limit: usize) -> Result<Vec<HealthSample>> {
        let conn = self.conn.lock().unwrap();
        let until = until_unix.unwrap_or(f64::MAX);
        let sql = format!(
            "SELECT {SAMPLE_COLS} FROM health_samples WHERE end_unix >= ?1 AND end_unix <= ?4 {} ORDER BY end_unix DESC LIMIT ?2",
            if kind.is_some() { "AND kind = ?3" } else { "" }
        );
        let mut stmt = conn.prepare(&sql)?;
        let rows = match kind {
            Some(k) => stmt.query_map(params![since_unix, limit as i64, k, until], sample_row)?.collect::<std::result::Result<Vec<_>, _>>()?,
            None => stmt.query_map(params![since_unix, limit as i64, "", until], sample_row)?.collect::<std::result::Result<Vec<_>, _>>()?,
        };
        Ok(rows)
    }

    /// The newest sample of every kind. Sparse kinds (VO2 max, resting heart rate)
    /// may be older than any window the caller uses.
    pub fn health_latest_per_kind(&self) -> Result<Vec<HealthSample>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT h.uuid, h.kind, h.start_unix, h.end_unix, h.value, h.unit, h.category, h.source_bundle, h.source_name, h.device, h.metadata
             FROM health_samples h
             JOIN (SELECT kind, MAX(end_unix) AS newest FROM health_samples GROUP BY kind) n
               ON n.kind = h.kind AND n.newest = h.end_unix
             GROUP BY h.kind",
        )?;
        let rows = stmt.query_map([], sample_row)?.collect::<std::result::Result<Vec<_>, _>>()?;
        Ok(rows)
    }

    pub fn health_kinds(&self) -> Result<Vec<KindStats>> {
        let conn = self.conn.lock().unwrap();
        // The count and the newest end need every row. The rest is a seek per kind
        // on the (kind, start_unix) index: the oldest start, and the newest row for
        // the unit and for whether the kind carries values.
        let mut stmt = conn.prepare(&format!(
            "SELECT k.kind, k.samples, k.newest,
                    (SELECT MIN(start_unix) FROM health_samples WHERE kind = k.kind AND start_unix >= ?1),
                    (SELECT unit {NEWEST_ROW} k.kind ORDER BY start_unix DESC LIMIT 1),
                    (SELECT value IS NOT NULL {NEWEST_ROW} k.kind ORDER BY start_unix DESC LIMIT 1)
             FROM (SELECT kind, COUNT(*) AS samples, MAX(end_unix) AS newest FROM health_samples GROUP BY kind) k
             ORDER BY k.kind"
        ))?;
        let rows = stmt
            .query_map(params![FIRST_START_FLOOR], |r| {
                Ok(KindStats {
                    kind: r.get(0)?, samples: r.get(1)?, newest_end_unix: r.get(2)?, first_start_unix: r.get(3)?,
                    unit: r.get(4)?, has_values: r.get(5)?,
                })
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?;
        Ok(rows)
    }

    /// The unit and whether there is a value on the newest row of one kind: what
    /// `kinds::def` needs for a kind its table does not name. `(None, false)` for a
    /// kind with no rows.
    /// Whether the hub holds any row of `kind`: one seek on the (kind, start_unix) index.
    pub fn health_has_kind(&self, kind: &str) -> Result<bool> {
        let conn = self.conn.lock().unwrap();
        Ok(conn.query_row(&format!("SELECT 1 {NEWEST_ROW} ?1 LIMIT 1"), params![kind], |_| Ok(())).optional()?.is_some())
    }

    pub fn health_kind_shape(&self, kind: &str) -> Result<(Option<String>, bool)> {
        let conn = self.conn.lock().unwrap();
        let shape = conn
            .query_row(
                &format!("SELECT unit, value IS NOT NULL {NEWEST_ROW} ?1 ORDER BY start_unix DESC LIMIT 1"),
                params![kind],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()?;
        Ok(shape.unwrap_or((None, false)))
    }

    /// One value per local day for one kind, oldest first, in stored units. A row
    /// belongs to the day its start falls on; `lo_unix` (inclusive) and `hi_unix`
    /// (exclusive) bound the start.
    pub fn health_daily(&self, def: &KindDef, lo_unix: f64, hi_unix: f64, tz_s: i64) -> Result<Vec<DayValue>> {
        // A cast truncates toward zero, which is the floor only from 1970-01-01 local on.
        const DAY: &str = "CAST((start_unix + ?4) / 86400 AS INTEGER)";
        const WINDOW: &str = "FROM health_samples WHERE kind = ?1 AND start_unix >= ?2 AND start_unix < ?3";
        let best_source = |per_source: &str| {
            format!(
                "SELECT day, MAX(v), NULL, NULL, n FROM (
                   SELECT {DAY} AS day, {per_source} AS v, COUNT(*) AS n {WINDOW} GROUP BY day, source_bundle)
                 WHERE v IS NOT NULL GROUP BY day ORDER BY day"
            )
        };
        let sql = match (def.agg, def.category) {
            (Agg::Sum, _) => best_source("SUM(value)"),
            (Agg::Minutes, _) => best_source("SUM(end_unix - start_unix) / 60.0"),
            (Agg::Count, None) => best_source("COUNT(*)"),
            (Agg::Count, Some(_)) => best_source("COUNT(CASE WHEN category = ?5 THEN 1 END)"),
            (Agg::Mean, _) => format!(
                "SELECT {DAY} AS day, AVG(value), MIN(value), MAX(value), COUNT(value) {WINDOW} AND value IS NOT NULL
                 GROUP BY day ORDER BY day"
            ),
            (Agg::Last, _) => format!(
                "WITH r AS (SELECT {DAY} AS day, start_unix, value {WINDOW} AND value IS NOT NULL)
                 SELECT a.day, l.value, a.lo, a.hi, a.n
                 FROM (SELECT day, MIN(value) AS lo, MAX(value) AS hi, COUNT(*) AS n FROM r GROUP BY day) a
                 JOIN (SELECT day, value, MAX(start_unix) FROM r GROUP BY day) l ON l.day = a.day
                 ORDER BY a.day"
            ),
        };
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(&sql)?;
        let mut args: Vec<&dyn ToSql> = vec![&def.kind, &lo_unix, &hi_unix, &tz_s];
        if let (Agg::Count, Some(category)) = (def.agg, &def.category) {
            args.push(category);
        }
        let rows = stmt
            .query_map(args.as_slice(), |r| Ok(DayValue { day: r.get(0)?, value: r.get(1)?, min: r.get(2)?, max: r.get(3)?, n: r.get(4)? }))?
            .collect::<std::result::Result<Vec<_>, _>>()?;
        Ok(rows)
    }

    /// Workouts that start inside `[lo_unix, hi_unix]`, newest first, each with the
    /// mean and the maximum of the heart rate rows that start inside it.
    pub fn health_workouts(&self, lo_unix: f64, hi_unix: f64, limit: usize) -> Result<Vec<Workout>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(&format!(
            "SELECT {SAMPLE_COLS} FROM health_samples
             WHERE kind = 'workout' AND start_unix >= ?1 AND start_unix <= ?2 ORDER BY start_unix DESC LIMIT ?3"
        ))?;
        let samples = stmt.query_map(params![lo_unix, hi_unix, limit as i64], sample_row)?.collect::<std::result::Result<Vec<_>, _>>()?;
        let mut hr = conn.prepare(
            "SELECT AVG(value), MAX(value) FROM health_samples WHERE kind = 'heart_rate' AND start_unix >= ?1 AND start_unix <= ?2",
        )?;
        samples
            .into_iter()
            .map(|sample| {
                let (hr_avg, hr_max) = hr.query_row(params![sample.start_unix, sample.end_unix], |r| Ok((r.get(0)?, r.get(1)?)))?;
                Ok(Workout { sample, hr_avg, hr_max })
            })
            .collect()
    }

    /// Seconds of sleep per night, source, and category.
    pub fn health_sleep_slices(&self, lo_unix: f64, hi_unix: f64, tz_s: i64) -> Result<Vec<SleepSlice>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT CAST((start_unix + ?3 + ?4) / 86400 AS INTEGER) AS day, COALESCE(source_bundle, ''), MAX(source_name),
                    COALESCE(category, ''), SUM(end_unix - start_unix), MIN(start_unix), MAX(end_unix)
             FROM health_samples WHERE kind = 'sleep_analysis' AND start_unix >= ?1 AND start_unix < ?2
             GROUP BY day, source_bundle, category ORDER BY day",
        )?;
        let rows = stmt
            .query_map(params![lo_unix, hi_unix, tz_s, SLEEP_DAY_SHIFT_S], |r| {
                Ok(SleepSlice {
                    day: r.get(0)?, source_bundle: r.get(1)?, source_name: r.get(2)?, category: r.get(3)?,
                    seconds: r.get(4)?, first_start_unix: r.get(5)?, last_end_unix: r.get(6)?,
                })
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?;
        Ok(rows)
    }

    /// The UTC offset of the latest snapshot in seconds; 0 when there is none.
    pub fn latest_tz_s(&self) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        let hours: Option<Option<i64>> = conn
            .query_row("SELECT CAST(json_extract(body, '$.tz') AS INTEGER) FROM snapshots ORDER BY received_at DESC, id DESC LIMIT 1", [], |r| r.get(0))
            .optional()?;
        Ok(hours.flatten().unwrap_or(0) * 3600)
    }

    /// Keep only the newest `keep` snapshots. Returns the number removed.
    pub fn prune(&self, keep: i64) -> Result<usize> {
        let conn = self.conn.lock().unwrap();
        Ok(conn.execute(
            "DELETE FROM snapshots WHERE id NOT IN (SELECT id FROM snapshots ORDER BY received_at DESC, id DESC LIMIT ?1)",
            params![keep],
        )?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use crate::health::{DayValue, HealthBatch, HealthSample};

    #[test]
    fn put_latest_and_dedup() {
        let s = Store::in_memory().unwrap();
        assert!(s.latest().unwrap().is_none());
        let a = s.put(&json!({ "generated_at": 10.0, "nights": [] }), 100).unwrap();
        assert!(a.stored);
        assert_eq!(a.snapshots, 1);
        let again = s.put(&json!({ "generated_at": 10.0, "nights": [] }), 101).unwrap();
        assert!(!again.stored);
        assert_eq!(again.snapshots, 1);
        let restamped = s.put(&json!({ "generated_at": 11.0, "nights": [] }), 101).unwrap();
        assert!(!restamped.stored, "a new generated_at alone is not new content");
        assert_eq!(restamped.snapshots, 1);
        let b = s.put(&json!({ "generated_at": 20.0, "nights": [{ "ymd": "2023-11-14" }] }), 102).unwrap();
        assert!(b.stored, "new content is stored");
        let latest = s.latest().unwrap().unwrap();
        assert_eq!(latest.received_at, 102);
        assert_eq!(latest.generated_at, Some(20.0));
        assert_eq!(latest.body["generated_at"], 20.0);
    }

    #[test]
    fn health_upsert_query_and_delete() {
        let s = Store::in_memory().unwrap();
        let sample = |uuid: &str, kind: &str, end: f64| HealthSample {
            uuid: uuid.into(), kind: kind.into(), start_unix: end - 60.0, end_unix: end, value: Some(1.0),
            unit: None, category: None, source_bundle: None, source_name: None, device: None,
            metadata: Some(json!({ "k": 1 })),
        };
        let batch = HealthBatch { tz_offset_s: None, samples: vec![sample("a", "heart_rate", 100.0), sample("b", "step_count", 200.0)], deleted: vec![] };
        let out = s.put_health(&batch, 1).unwrap();
        assert_eq!((out.samples_seen, out.stored, out.total), (2, 2, 2));
        let again = HealthBatch { tz_offset_s: None, samples: vec![sample("a", "heart_rate", 100.0)], deleted: vec!["b".into(), "zzz".into()] };
        let out = s.put_health(&again, 2).unwrap();
        assert_eq!((out.stored, out.deleted, out.total), (1, 1, 1));
        let rows = s.health_rows(Some("heart_rate"), 0.0, 10).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].metadata, Some(json!({ "k": 1 })));
        assert!(s.health_rows(None, 150.0, 10).unwrap().is_empty());
        let latest = s.health_latest_per_kind().unwrap();
        assert_eq!(latest.len(), 1);
        assert_eq!(latest[0].uuid, "a");
        let kinds = s.health_kinds().unwrap();
        assert_eq!(kinds.len(), 1);
        assert_eq!((kinds[0].kind.as_str(), kinds[0].samples, kinds[0].newest_end_unix), ("heart_rate", 1, 100.0));
    }

    // 2022-01-08 00:00 UTC, day 19000
    const D: f64 = 19_000.0 * 86400.0;

    fn h(uuid: &str, kind: &str, start: f64, value: Option<f64>, category: Option<&str>, bundle: &str) -> HealthSample {
        HealthSample {
            uuid: uuid.into(), kind: kind.into(), start_unix: start, end_unix: start + 600.0, value,
            unit: None, category: category.map(Into::into), source_bundle: Some(bundle.into()),
            source_name: Some(bundle.into()), device: None, metadata: None,
        }
    }

    fn with(samples: Vec<HealthSample>) -> Store {
        let s = Store::in_memory().unwrap();
        s.put_health(&HealthBatch { tz_offset_s: None, samples, deleted: vec![] }, 1).unwrap();
        s
    }

    fn daily(s: &Store, kind: &str, tz_s: i64) -> Vec<DayValue> {
        s.health_daily(&crate::kinds::def(kind, None, false), D - 86400.0, D + 2.0 * 86400.0, tz_s).unwrap()
    }

    #[test]
    fn a_sum_kind_takes_the_best_source_of_the_day() {
        let s = with(vec![
            h("a", "step_count", D + 100.0, Some(4000.0), None, "watch"),
            h("b", "step_count", D + 200.0, Some(2000.0), None, "watch"),
            h("c", "step_count", D + 100.0, Some(5000.0), None, "phone"),
            h("d", "step_count", D + 86400.0, Some(700.0), None, "phone"),
        ]);
        let days = daily(&s, "step_count", 0);
        assert_eq!(days.iter().map(|d| (d.day, d.value, d.n)).collect::<Vec<_>>(), [(19000, 6000.0, 2), (19001, 700.0, 1)]);
        assert_eq!(days[0].min, None);
    }

    #[test]
    fn a_mean_kind_has_the_mean_min_and_max_of_all_sources() {
        let s = with(vec![
            h("a", "heart_rate", D + 100.0, Some(50.0), None, "watch"),
            h("b", "heart_rate", D + 200.0, Some(70.0), None, "watch"),
            h("c", "heart_rate", D + 300.0, Some(120.0), None, "strap"),
        ]);
        assert_eq!(daily(&s, "heart_rate", 0), [DayValue { day: 19000, value: 80.0, min: Some(50.0), max: Some(120.0), n: 3 }]);
    }

    #[test]
    fn a_last_kind_has_the_last_reading_of_the_day() {
        let s = with(vec![
            h("a", "body_mass", D + 300.0, Some(71.0), None, "scale"),
            h("b", "body_mass", D + 900.0, Some(70.2), None, "scale"),
            h("c", "body_mass", D + 100.0, Some(70.6), None, "phone"),
        ]);
        assert_eq!(daily(&s, "body_mass", 0), [DayValue { day: 19000, value: 70.2, min: Some(70.2), max: Some(71.0), n: 3 }]);
    }

    #[test]
    fn a_count_kind_counts_only_its_category() {
        let s = with(vec![
            h("a", "stand_hour", D + 3600.0, None, Some("stood"), "watch"),
            h("b", "stand_hour", D + 7200.0, None, Some("idle"), "watch"),
            h("c", "stand_hour", D + 10800.0, None, Some("stood"), "watch"),
            h("d", "handwashing_event", D + 100.0, None, Some("value_0"), "watch"),
        ]);
        assert_eq!(daily(&s, "stand_hour", 0).iter().map(|d| (d.value, d.n)).collect::<Vec<_>>(), [(2.0, 3)]);
        assert_eq!(daily(&s, "handwashing_event", 0)[0].value, 1.0);
        // 600 s rows
        assert_eq!(with(vec![h("m", "mindful_session", D, None, Some("value_0"), "app")]).health_daily(
            &crate::kinds::def("mindful_session", None, false), D, D + 86400.0, 0).unwrap()[0].value, 10.0);
    }

    #[test]
    fn the_offset_moves_a_row_to_the_local_day() {
        // 23:00 UTC is the next day at UTC+2 and the same day at UTC
        let s = with(vec![h("a", "step_count", D + 23.0 * 3600.0, Some(10.0), None, "watch")]);
        assert_eq!(daily(&s, "step_count", 0)[0].day, 19000);
        assert_eq!(daily(&s, "step_count", 2 * 3600)[0].day, 19001);
    }

    #[test]
    fn workouts_carry_the_heart_rate_inside_them() {
        let mut w = h("w", "workout", D, Some(10.0), Some("running"), "watch");
        w.metadata = Some(json!({ "total_energy_kcal": 90.0 }));
        let s = with(vec![
            w,
            h("w0", "workout", D - 7200.0, Some(10.0), Some("walking"), "watch"),
            h("a", "heart_rate", D - 60.0, Some(60.0), None, "watch"),
            h("b", "heart_rate", D + 60.0, Some(140.0), None, "watch"),
            h("c", "heart_rate", D + 500.0, Some(160.0), None, "watch"),
            h("d", "heart_rate", D + 900.0, Some(100.0), None, "watch"),
        ]);
        let ws = s.health_workouts(D - 86400.0, D + 86400.0, 10).unwrap();
        assert_eq!(ws.iter().map(|w| w.sample.uuid.as_str()).collect::<Vec<_>>(), ["w", "w0"], "newest first");
        assert_eq!((ws[0].hr_avg, ws[0].hr_max), (Some(150.0), Some(160.0)));
        assert_eq!((ws[1].hr_avg, ws[1].hr_max), (None, None));
        assert_eq!(s.health_workouts(D - 86400.0, D + 86400.0, 1).unwrap().len(), 1);
    }

    #[test]
    fn sleep_rows_join_the_night_they_wake_on() {
        let s = with(vec![
            h("a", "sleep_analysis", D - 3600.0, None, Some("asleep_core"), "watch"),
            h("b", "sleep_analysis", D + 7.0 * 3600.0, None, Some("asleep_core"), "watch"),
            h("c", "sleep_analysis", D + 19.0 * 3600.0, None, Some("asleep_rem"), "watch"),
        ]);
        let slices = s.health_sleep_slices(D - 86400.0, D + 86400.0, 0).unwrap();
        assert_eq!(slices.iter().map(|x| (x.day, x.category.as_str(), x.seconds)).collect::<Vec<_>>(),
                   [(19000, "asleep_core", 1200.0), (19001, "asleep_rem", 600.0)]);
        assert_eq!((slices[0].first_start_unix, slices[0].last_end_unix), (D - 3600.0, D + 7.0 * 3600.0 + 600.0));
    }

    #[test]
    fn kind_stats_ignore_a_start_before_2000_and_the_offset_comes_from_the_snapshot() {
        let s = with(vec![
            h("a", "constipation", 3.0, None, Some("value_2"), "phone"),
            h("b", "constipation", D, None, Some("value_2"), "phone"),
            h("c", "constipation", D + 86400.0, None, Some("value_2"), "phone"),
        ]);
        let k = &s.health_kinds().unwrap()[0];
        assert_eq!((k.samples, k.first_start_unix, k.has_values), (3, Some(D), false));
        assert_eq!(s.latest_tz_s().unwrap(), 0);
        s.put(&json!({ "tz": 2, "nights": [] }), 5).unwrap();
        assert_eq!(s.latest_tz_s().unwrap(), 7200);
    }

    #[test]
    fn prune_keeps_the_newest() {
        let s = Store::in_memory().unwrap();
        for i in 0..5 {
            s.put(&json!({ "generated_at": i, "nights": [i] }), 1000 + i).unwrap();
        }
        assert_eq!(s.prune(2).unwrap(), 3);
        assert_eq!(s.count().unwrap(), 2);
        assert_eq!(s.latest().unwrap().unwrap().received_at, 1004);
    }
}
