//! The statistics the agent tools report. Pure: values in, numbers out. The model
//! quotes these numbers and never computes them.

/// Baseline days needed before a deviation from the baseline means anything.
pub const MIN_BASELINE_DAYS: usize = 14;
/// Paired days needed before a correlation is reported.
pub const MIN_PAIRED_DAYS: usize = 10;
/// Paired days from which a strong, significant correlation grades A.
const STRONG_EVIDENCE_DAYS: usize = 30;
/// The smallest |r| that grades A.
const STRONG_EVIDENCE_R: f64 = 0.3;

pub fn mean(xs: &[f64]) -> Option<f64> {
    (!xs.is_empty()).then(|| xs.iter().sum::<f64>() / xs.len() as f64)
}

fn all_equal(xs: &[f64]) -> bool {
    xs.windows(2).all(|w| w[0] == w[1])
}

/// Sample standard deviation (n - 1). None below two values. Exactly 0 when all
/// values are equal, whatever the rounding of the mean.
pub fn sd(xs: &[f64]) -> Option<f64> {
    if xs.len() < 2 {
        return None;
    }
    if all_equal(xs) {
        return Some(0.0);
    }
    let m = mean(xs)?;
    Some((xs.iter().map(|x| (x - m).powi(2)).sum::<f64>() / (xs.len() - 1) as f64).sqrt())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Band {
    NotEnoughData,
    NoSpread,
    Usual,
    Notable,
    Unusual,
}

impl Band {
    pub fn as_str(self) -> &'static str {
        match self {
            Band::NotEnoughData => "not_enough_data",
            Band::NoSpread => "no_spread",
            Band::Usual => "usual",
            Band::Notable => "notable",
            Band::Unusual => "unusual",
        }
    }
}

/// The recent days against the baseline days.
#[derive(Debug, Clone, PartialEq)]
pub struct Deviation {
    pub band: Band,
    /// Recent mean minus baseline mean. None for `NotEnoughData`.
    pub delta: Option<f64>,
    /// `delta` in percent of the baseline mean. None when that mean is 0.
    pub delta_pct: Option<f64>,
    /// `delta` in baseline standard deviations. None for `NotEnoughData` and `NoSpread`.
    pub z: Option<f64>,
}

pub fn deviation(recent: &[f64], baseline: &[f64]) -> Deviation {
    let none = Deviation { band: Band::NotEnoughData, delta: None, delta_pct: None, z: None };
    let (Some(recent_mean), Some(base_mean), Some(base_sd)) = (mean(recent), mean(baseline), sd(baseline)) else {
        return none;
    };
    if baseline.len() < MIN_BASELINE_DAYS {
        return none;
    }
    let delta = recent_mean - base_mean;
    let delta_pct = (base_mean != 0.0).then(|| delta / base_mean.abs() * 100.0);
    if base_sd == 0.0 {
        return Deviation { band: Band::NoSpread, delta: Some(delta), delta_pct, z: None };
    }
    let z = delta / base_sd;
    let band = match z.abs() {
        a if a < 1.0 => Band::Usual,
        a if a < 2.0 => Band::Notable,
        _ => Band::Unusual,
    };
    Deviation { band, delta: Some(delta), delta_pct, z: Some(z) }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Evidence {
    A,
    B,
    C,
    D,
}

impl Evidence {
    pub fn as_str(self) -> &'static str {
        match self {
            Evidence::A => "A",
            Evidence::B => "B",
            Evidence::C => "C",
            Evidence::D => "D",
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Correlation {
    pub n: usize,
    pub r: Option<f64>,
    pub ci95: Option<(f64, f64)>,
    pub evidence: Evidence,
    pub note: String,
}

/// Pearson r of two equal-length samples. None when either has no spread.
fn pearson(xs: &[f64], ys: &[f64]) -> Option<f64> {
    if all_equal(xs) || all_equal(ys) {
        return None;
    }
    let (mx, my) = (mean(xs)?, mean(ys)?);
    let (mut sxy, mut sxx, mut syy) = (0.0, 0.0, 0.0);
    for (x, y) in xs.iter().zip(ys) {
        sxy += (x - mx) * (y - my);
        sxx += (x - mx).powi(2);
        syy += (y - my).powi(2);
    }
    Some((sxy / (sxx * syy).sqrt()).clamp(-1.0, 1.0))
}

/// 95% confidence interval of r by the Fisher z transform. Needs n > 3.
fn fisher_ci95(r: f64, n: usize) -> Option<(f64, f64)> {
    if n <= 3 {
        return None;
    }
    let (z, se) = (r.atanh(), 1.0 / ((n - 3) as f64).sqrt());
    Some(((z - 1.96 * se).tanh(), (z + 1.96 * se).tanh()))
}

/// `xs[i]` and `ys[i]` are the two values of paired day i.
pub fn correlate(xs: &[f64], ys: &[f64]) -> Correlation {
    let n = xs.len().min(ys.len());
    let undetermined = |note: String| Correlation { n, r: None, ci95: None, evidence: Evidence::D, note };
    if n < MIN_PAIRED_DAYS {
        let more = MIN_PAIRED_DAYS - n;
        return undetermined(format!("Only {n} paired days; {more} more needed before a correlation is reported (minimum {MIN_PAIRED_DAYS})."));
    }
    let Some(r) = pearson(&xs[..n], &ys[..n]) else {
        let flat = if all_equal(&xs[..n]) { "x" } else { "y" };
        return undetermined(format!("{flat} has the same value on every one of the {n} paired days, so r is undefined."));
    };
    let ci95 = fisher_ci95(r, n);
    let excludes_zero = ci95.is_some_and(|(lo, hi)| lo > 0.0 || hi < 0.0);
    let (evidence, note) = if excludes_zero && n >= STRONG_EVIDENCE_DAYS && r.abs() >= STRONG_EVIDENCE_R {
        (Evidence::A, "The 95% interval excludes 0 and |r| is at least 0.3. A correlation is not a cause.")
    } else if excludes_zero {
        (Evidence::B, "The 95% interval excludes 0, but n is under 30 or |r| is under 0.3. A correlation is not a cause.")
    } else {
        (Evidence::C, "The 95% interval includes 0: no reliable link at this sample size.")
    };
    Correlation { n, r: Some(r), ci95, evidence, note: note.into() }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mean_and_sample_sd() {
        let xs = [2.0, 4.0, 4.0, 4.0, 5.0, 5.0, 7.0, 9.0];
        assert_eq!(mean(&xs), Some(5.0));
        // sum of squares 32, n - 1 = 7
        assert!((sd(&xs).unwrap() - (32.0f64 / 7.0).sqrt()).abs() < 1e-12);
        assert_eq!(sd(&[3.0]), None);
        assert_eq!(sd(&[0.1, 0.1, 0.1]), Some(0.0));
    }

    #[test]
    fn deviation_bands_follow_the_z_score() {
        // 14 values with mean 10 and sd sqrt(14/13 * 1) ~ 1.04
        let base: Vec<f64> = (0..14).map(|i| if i % 2 == 0 { 9.0 } else { 11.0 }).collect();
        let sd = sd(&base).unwrap();
        let band = |recent: f64| deviation(&[recent], &base).band;
        assert_eq!(band(10.0 + 0.5 * sd), Band::Usual);
        assert_eq!(band(10.0 - 1.5 * sd), Band::Notable);
        assert_eq!(band(10.0 + 2.5 * sd), Band::Unusual);
        let d = deviation(&[12.0], &base);
        assert_eq!(d.delta, Some(2.0));
        assert_eq!(d.delta_pct, Some(20.0));
    }

    #[test]
    fn deviation_needs_a_baseline_and_a_recent_day() {
        let thirteen = vec![1.0; 13];
        assert_eq!(deviation(&[1.0], &thirteen).band, Band::NotEnoughData);
        let base: Vec<f64> = (0..14).map(f64::from).collect();
        let d = deviation(&[], &base);
        assert_eq!((d.band, d.delta, d.z), (Band::NotEnoughData, None, None));
        let flat = vec![5.0; 14];
        let d = deviation(&[6.0], &flat);
        assert_eq!((d.band, d.delta, d.z), (Band::NoSpread, Some(1.0), None));
    }

    #[test]
    fn pearson_r_and_its_interval_match_a_known_sample() {
        let xs: Vec<f64> = (1..=12).map(f64::from).collect();
        let ys = [2.0, 1.0, 4.0, 3.0, 7.0, 5.0, 8.0, 6.0, 11.0, 9.0, 12.0, 10.0];
        let c = correlate(&xs, &ys);
        // r and the interval from an independent python computation
        assert!((c.r.unwrap() - 0.916083916).abs() < 1e-6, "{c:?}");
        let (lo, hi) = c.ci95.unwrap();
        assert!((lo - 0.72151).abs() < 1e-4 && (hi - 0.97657).abs() < 1e-4, "{lo} {hi}");
        assert_eq!(c.evidence, Evidence::B, "n = 12 is under 30");
    }

    #[test]
    fn evidence_grades() {
        let xs: Vec<f64> = (0..40).map(f64::from).collect();
        let up: Vec<f64> = xs.iter().map(|x| x + (x * 7.0).sin() * 3.0).collect();
        assert_eq!(correlate(&xs, &up).evidence, Evidence::A);
        let noise: Vec<f64> = xs.iter().map(|x| (x * 12.9898).sin() * 43758.5453 % 1.0).collect();
        assert_eq!(correlate(&xs, &noise).evidence, Evidence::C);
        let few = correlate(&xs[..9], &up[..9]);
        assert_eq!((few.evidence, few.r, few.ci95), (Evidence::D, None, None));
        assert!(few.note.contains("1 more"), "{}", few.note);
    }

    #[test]
    fn a_series_without_spread_has_no_r() {
        let xs: Vec<f64> = (0..20).map(f64::from).collect();
        let flat = vec![3.0; 20];
        let c = correlate(&xs, &flat);
        assert_eq!((c.evidence, c.r, c.ci95), (Evidence::D, None, None));
        assert!(c.note.starts_with("y "), "{}", c.note);
    }
}
