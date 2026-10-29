pub const MIN_BASELINE_DAYS: usize = 14;
pub const MIN_PAIRED_DAYS: usize = 10;
const GRADE_A_MIN_N_EFF: usize = 30;
const GRADE_A_MIN_ABS_R: f64 = 0.3;
const MAX_BASELINE_LAG1: f64 = 0.9;

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

#[derive(Debug, Clone, PartialEq)]
pub struct Deviation {
    pub band: Band,
    /// Recent mean minus baseline mean. None for `NotEnoughData`.
    pub delta: Option<f64>,
    /// `delta` in percent of the baseline mean. None when that mean is 0.
    pub delta_pct: Option<f64>,
    /// `delta` in standard errors of the difference of the two means. Days carry over
    /// (lag-1 autocorrelation of the baseline), so each window counts as fewer
    /// independent days. None for `NotEnoughData` and `NoSpread`.
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
    let rho = lag1_autocorrelation(baseline).clamp(0.0, MAX_BASELINE_LAG1);
    let independent = |n: usize| (n as f64 * (1.0 - rho) / (1.0 + rho)).max(1.0);
    let z = delta / (base_sd * (1.0 / independent(recent.len()) + 1.0 / independent(baseline.len())).sqrt());
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
    /// `n` shrunk for the day-to-day carry-over of the two series. The interval and
    /// the grade use it. None when n is under 10 or a series has no spread.
    pub n_eff: Option<f64>,
    pub r: Option<f64>,
    pub ci95: Option<(f64, f64)>,
    pub evidence: Evidence,
    pub note: String,
}

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

fn lag1_autocorrelation(xs: &[f64]) -> f64 {
    pearson(&xs[..xs.len() - 1], &xs[1..]).unwrap_or(0.0)
}

fn bartlett_effective_n(xs: &[f64], ys: &[f64]) -> f64 {
    let carry = (lag1_autocorrelation(xs) * lag1_autocorrelation(ys)).max(0.0);
    xs.len() as f64 * (1.0 - carry) / (1.0 + carry)
}

fn fisher_ci95(r: f64, n: f64) -> Option<(f64, f64)> {
    if n <= 3.0 {
        return None;
    }
    let (z, se) = (r.atanh(), 1.0 / (n - 3.0).sqrt());
    Some(((z - 1.96 * se).tanh(), (z + 1.96 * se).tanh()))
}

/// `xs[i]` and `ys[i]` are the two values of paired day i.
pub fn correlate(xs: &[f64], ys: &[f64]) -> Correlation {
    let n = xs.len().min(ys.len());
    let undetermined = |note: String| Correlation { n, n_eff: None, r: None, ci95: None, evidence: Evidence::D, note };
    if n < MIN_PAIRED_DAYS {
        let more = MIN_PAIRED_DAYS - n;
        return undetermined(format!("Only {n} paired days; {more} more needed before a correlation is reported (minimum {MIN_PAIRED_DAYS})."));
    }
    let Some(r) = pearson(&xs[..n], &ys[..n]) else {
        let flat = if all_equal(&xs[..n]) { "x" } else { "y" };
        return undetermined(format!("{flat} has the same value on every one of the {n} paired days, so r is undefined."));
    };
    let n_eff = bartlett_effective_n(&xs[..n], &ys[..n]);
    let Some(ci95) = fisher_ci95(r, n_eff) else {
        return Correlation { n_eff: Some(n_eff), ..undetermined(format!("The {n} paired days carry over so much from day to day that they count as {n_eff:.1} independent days: too few for an interval.")) };
    };
    let ci95 = Some(ci95);
    let excludes_zero = ci95.is_some_and(|(lo, hi)| lo > 0.0 || hi < 0.0);
    let (evidence, note) = if excludes_zero && n_eff >= GRADE_A_MIN_N_EFF as f64 && r.abs() >= GRADE_A_MIN_ABS_R {
        (Evidence::A, "A clear link: the 95% interval excludes 0, |r| is at least 0.3, and n_eff is at least 30. A correlation is not a cause.")
    } else if excludes_zero {
        (Evidence::B, "A link, but small (|r| under 0.3) or from few independent days (n_eff under 30). A correlation is not a cause.")
    } else {
        (Evidence::C, "No reliable link: the 95% interval includes 0 at this n_eff.")
    };
    Correlation { n, n_eff: Some(n_eff), r: Some(r), ci95, evidence, note: note.into() }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mean_and_sample_sd() {
        let xs = [2.0, 4.0, 4.0, 4.0, 5.0, 5.0, 7.0, 9.0];
        assert_eq!(mean(&xs), Some(5.0));
        assert!((sd(&xs).unwrap() - (32.0f64 / 7.0).sqrt()).abs() < 1e-12);
        assert_eq!(sd(&[3.0]), None);
        assert_eq!(sd(&[0.1, 0.1, 0.1]), Some(0.0));
    }

    #[test]
    fn deviation_bands_follow_the_z_score() {
        let base: Vec<f64> = (0..14).map(|i| if i % 2 == 0 { 9.0 } else { 11.0 }).collect();
        let sd = sd(&base).unwrap();
        let band = |recent: f64| deviation(&[recent], &base).band;
        assert_eq!(deviation(&[10.0 + sd; 4], &base).band, Band::Notable);
        assert_eq!(deviation(&[10.0 + sd; 9], &base).band, Band::Unusual);
        let drift: Vec<f64> = (0..14).map(|i| 10.0 + f64::from(i % 7) * 0.3).collect();
        let shuffled: Vec<f64> = [0, 3, 6, 2, 5, 1, 4, 0, 3, 6, 2, 5, 1, 4].iter().map(|i| 10.0 + f64::from(*i) * 0.3).collect();
        let z = |base: &[f64]| deviation(&[12.0; 7], base).z.unwrap();
        assert!(z(&drift) < z(&shuffled), "{} {}", z(&drift), z(&shuffled));
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
        let r = pearson(&xs, &ys).unwrap();
        assert!((r - 0.916083916).abs() < 1e-6, "{r}");
        let (lo, hi) = fisher_ci95(r, 12.0).unwrap();
        assert!((lo - 0.72151).abs() < 1e-4 && (hi - 0.97657).abs() < 1e-4, "{lo} {hi}");
    }

    #[test]
    fn evidence_grades() {
        let noise = |seed: u64| -> Vec<f64> {
            let mut s = seed;
            (0..40).map(|_| { s = s.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407); (s >> 11) as f64 / (1u64 << 53) as f64 }).collect()
        };
        let (xs, other) = (noise(1), noise(6));
        let linked: Vec<f64> = xs.iter().zip(&other).map(|(x, e)| x + 0.3 * e).collect();
        assert_eq!(correlate(&xs, &linked).evidence, Evidence::A);
        assert_eq!(correlate(&xs, &other).evidence, Evidence::C);
        let walk = |step: &[f64]| -> Vec<f64> { step.iter().scan(0.0, |acc, s| { *acc += 1.0 + s; Some(*acc) }).collect() };
        let (wx, wy) = (walk(&xs), walk(&other));
        assert!(pearson(&wx, &wy).unwrap() > 0.9);
        let trends = correlate(&wx, &wy);
        assert!(trends.n_eff.unwrap() <= 3.0, "{trends:?}");
        assert_eq!((trends.evidence, trends.ci95), (Evidence::D, None));
        let few = correlate(&xs[..9], &linked[..9]);
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
