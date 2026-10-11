//! What one Apple Health kind means per day: how its rows fold into a day value and
//! the unit a reader sees. The phone stores rows in HealthKit base units (fractions,
//! grams, seconds); every aggregate tool converts here, so no consumer does.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Agg {
    /// Additive through the day. The day total is the best single source (max over
    /// sources of the per-source sum): iPhone and Watch both record these.
    Sum,
    /// Spot readings. `value` = mean of all rows that day; `min` and `max` are returned too.
    Mean,
    /// A slowly changing measurement (body mass, VO2 max, resting HR). `value` = the
    /// last row that day; `min` and `max` too.
    Last,
    /// Category rows. `value` = rows that day from the best source; with a
    /// `category` only rows with that category count.
    Count,
    /// Category rows whose length matters. `value` = minutes, best source.
    Minutes,
}

impl Agg {
    pub fn as_str(self) -> &'static str {
        match self {
            Agg::Sum => "sum",
            Agg::Mean => "mean",
            Agg::Last => "last",
            Agg::Count => "count",
            Agg::Minutes => "minutes",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct KindDef<'a> {
    pub kind: &'a str,
    pub agg: Agg,
    /// The unit after `scale`.
    pub unit: &'a str,
    /// Stored value × `scale` = the value in `unit`.
    pub scale: f64,
    pub category: Option<&'static str>,
}

const fn k(kind: &'static str, agg: Agg, unit: &'static str, scale: f64) -> KindDef<'static> {
    KindDef { kind, agg, unit, scale, category: None }
}

const fn count(kind: &'static str, unit: &'static str, category: Option<&'static str>) -> KindDef<'static> {
    KindDef { kind, agg: Agg::Count, unit, scale: 1.0, category }
}

use Agg::{Last, Mean, Minutes, Sum};

const MG: f64 = 1e3;
const UG: f64 = 1e6;

const KINDS: &[KindDef<'static>] = &[
    k("step_count", Sum, "steps", 1.0),
    k("flights_climbed", Sum, "flights", 1.0),
    k("active_energy", Sum, "kcal", 1.0),
    k("basal_energy", Sum, "kcal", 1.0),
    k("exercise_time", Sum, "min", 1.0),
    k("stand_time", Sum, "min", 1.0),
    k("distance_walking_running", Sum, "m", 1.0),
    k("distance_cycling", Sum, "m", 1.0),
    k("distance_paddle_sports", Sum, "m", 1.0),
    k("time_in_daylight", Sum, "min", 1.0 / 60.0),
    k("workout", Sum, "min", 1.0),
    k("heart_rate", Mean, "bpm", 1.0),
    k("heart_rate_recovery_one_minute", Mean, "bpm", 1.0),
    k("electrocardiogram", Mean, "bpm", 1.0),
    k("resting_heart_rate", Last, "bpm", 1.0),
    k("walking_heart_rate_average", Last, "bpm", 1.0),
    k("hrv_sdnn", Mean, "ms", 1.0),
    k("respiratory_rate", Mean, "/min", 1.0),
    k("oxygen_saturation", Mean, "%", 100.0),
    k("vo2_max", Last, "ml/kg/min", 1.0),
    k("wrist_temperature", Mean, "°C", 1.0),
    k("body_temperature", Mean, "°C", 1.0),
    k("blood_pressure_systolic", Mean, "mmHg", 1.0),
    k("blood_pressure_diastolic", Mean, "mmHg", 1.0),
    k("blood_glucose", Mean, "mg/dL", 1.0),
    k("body_mass", Last, "kg", 1.0),
    k("lean_body_mass", Last, "kg", 1.0),
    k("body_mass_index", Last, "kg/m²", 1.0),
    k("body_fat_percentage", Last, "%", 100.0),
    k("height", Last, "m", 1.0),
    k("apple_walking_steadiness", Last, "%", 100.0),
    k("six_minute_walk_test_distance", Last, "m", 1.0),
    k("walking_double_support_percentage", Mean, "%", 100.0),
    k("walking_asymmetry_percentage", Mean, "%", 100.0),
    k("walking_speed", Mean, "m/s", 1.0),
    k("walking_step_length", Mean, "m", 1.0),
    k("stair_ascent_speed", Mean, "m/s", 1.0),
    k("stair_descent_speed", Mean, "m/s", 1.0),
    k("running_speed", Mean, "m/s", 1.0),
    k("paddle_sports_speed", Mean, "m/s", 1.0),
    k("headphone_audio_exposure", Mean, "dB", 1.0),
    k("environmental_audio_exposure", Mean, "dB", 1.0),
    k("environmental_sound_reduction", Mean, "dB", 1.0),
    k("physical_effort", Mean, "kcal/kg/h", 1.0),
    k("estimated_workout_effort_score", Mean, "effort", 1.0),
    k("dietary_energy_consumed", Sum, "kcal", 1.0),
    k("dietary_water", Sum, "mL", 1e3),
    k("dietary_carbohydrates", Sum, "g", 1.0),
    k("dietary_protein", Sum, "g", 1.0),
    k("dietary_fat_total", Sum, "g", 1.0),
    k("dietary_fat_saturated", Sum, "g", 1.0),
    k("dietary_fat_monounsaturated", Sum, "g", 1.0),
    k("dietary_fat_polyunsaturated", Sum, "g", 1.0),
    k("dietary_fiber", Sum, "g", 1.0),
    k("dietary_sugar", Sum, "g", 1.0),
    k("dietary_sodium", Sum, "mg", MG),
    k("dietary_potassium", Sum, "mg", MG),
    k("dietary_calcium", Sum, "mg", MG),
    k("dietary_iron", Sum, "mg", MG),
    k("dietary_magnesium", Sum, "mg", MG),
    k("dietary_phosphorus", Sum, "mg", MG),
    k("dietary_zinc", Sum, "mg", MG),
    k("dietary_cholesterol", Sum, "mg", MG),
    k("dietary_chloride", Sum, "mg", MG),
    k("dietary_vitamin_c", Sum, "mg", MG),
    k("dietary_vitamin_e", Sum, "mg", MG),
    k("dietary_niacin", Sum, "mg", MG),
    k("dietary_vitamin_b6", Sum, "mg", MG),
    k("dietary_thiamin", Sum, "mg", MG),
    k("dietary_riboflavin", Sum, "mg", MG),
    k("dietary_pantothenic_acid", Sum, "mg", MG),
    k("dietary_copper", Sum, "mg", MG),
    k("dietary_manganese", Sum, "mg", MG),
    k("dietary_caffeine", Sum, "mg", MG),
    k("dietary_vitamin_a", Sum, "µg", UG),
    k("dietary_vitamin_d", Sum, "µg", UG),
    k("dietary_vitamin_k", Sum, "µg", UG),
    k("dietary_vitamin_b12", Sum, "µg", UG),
    k("dietary_folate", Sum, "µg", UG),
    k("dietary_biotin", Sum, "µg", UG),
    k("dietary_selenium", Sum, "µg", UG),
    k("dietary_iodine", Sum, "µg", UG),
    k("dietary_chromium", Sum, "µg", UG),
    k("dietary_molybdenum", Sum, "µg", UG),
    count("stand_hour", "h", Some("stood")),
    count("handwashing_event", "events", None),
    count("constipation", "events", None),
    count("audio_exposure_event", "events", None),
    count("low_heart_rate_event", "events", None),
    k("mindful_session", Minutes, "min", 1.0),
    // Every row counts, `in_bed` and `awake` too. `get_health_sleep` has the stages.
    k("sleep_analysis", Minutes, "min", 1.0),
];

pub fn lookup(kind: &str) -> Option<KindDef<'static>> {
    KINDS.iter().find(|d| d.kind == kind).copied()
}

/// The definition of `kind`. HealthKit sends kinds the table does not name; for
/// those the rule comes from the name and from what the rows hold: `stored_unit` is
/// the unit on the rows and `has_values` says whether a row carries a value.
pub fn def<'a>(kind: &'a str, stored_unit: Option<&'a str>, has_values: bool) -> KindDef<'a> {
    if let Some(d) = lookup(kind) {
        return d;
    }
    let additive = kind.starts_with("dietary_") || kind.starts_with("distance_");
    let (agg, unit) = match (additive, has_values) {
        (true, _) => (Sum, stored_unit.unwrap_or("")),
        (false, true) => (Mean, stored_unit.unwrap_or("")),
        (false, false) => (Agg::Count, "events"),
    };
    KindDef { kind, agg, unit, scale: 1.0, category: None }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_named_kind_ignores_the_stored_unit() {
        let d = def("oxygen_saturation", Some("fraction"), true);
        assert_eq!((d.agg, d.unit, d.scale), (Mean, "%", 100.0));
        let d = def("stand_hour", None, false);
        assert_eq!((d.agg, d.category), (Agg::Count, Some("stood")));
    }

    #[test]
    fn an_unnamed_kind_follows_its_name_then_its_rows() {
        let d = def("dietary_new_nutrient", Some("g"), true);
        assert_eq!((d.agg, d.unit, d.scale), (Sum, "g", 1.0));
        assert_eq!(def("distance_swimming", Some("m"), true).agg, Sum);
        let d = def("forced_vital_capacity", Some("L"), true);
        assert_eq!((d.agg, d.unit), (Mean, "L"));
        let d = def("sexual_activity", None, false);
        assert_eq!((d.agg, d.unit), (Agg::Count, "events"));
        assert_eq!(def("not_stored_at_all", None, false).agg, Agg::Count);
    }

    #[test]
    fn every_kind_is_in_the_table_once() {
        for (i, d) in KINDS.iter().enumerate() {
            assert!(!KINDS[..i].iter().any(|e| e.kind == d.kind), "{} is listed twice", d.kind);
        }
    }
}
