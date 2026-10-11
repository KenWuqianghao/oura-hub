// The Body page, pure. Its kinds are slow and sparse, so the page loads all of each
// once and every range is a window over that: a section can then say where the data
// is when the window is empty.
import type { DailySeries, DayPoint } from './api'
import { kindsIn } from './kinds'
import { addsUp } from './range'

export const COMPOSITION = ['body_mass_index', 'body_fat_percentage', 'lean_body_mass', 'height'] as const
export const MOBILITY_CHARTS = ['walking_speed', 'walking_step_length'] as const
export const MOBILITY_ROWS = ['walking_double_support_percentage', 'walking_asymmetry_percentage', 'apple_walking_steadiness', 'stair_ascent_speed', 'stair_descent_speed', 'six_minute_walk_test_distance'] as const
export const LEVELS = ['headphone_audio_exposure', 'environmental_audio_exposure'] as const
export const HEARING_ROWS = ['environmental_sound_reduction', 'audio_exposure_event'] as const
export const LOGS: readonly string[] = ['mindful_session', ...kindsIn('other')]
export const BODY_KINDS: readonly string[] = ['body_mass', ...COMPOSITION, ...MOBILITY_CHARTS, ...MOBILITY_ROWS, ...LEVELS, ...HEARING_ROWS, ...LOGS]

/** WHO–ITU H.870, the safe listening standard for adults: 80 dB for up to 40 hours a week. */
export const SAFE_LISTENING_DB = 80

export interface Window { start: string; end: string }
const within = (days: readonly DayPoint[], w: Window) => days.filter(d => d.ymd >= w.start && d.ymd <= w.end)

/** What a row says about one kind: the window, and the whole record so an empty window still has an answer. */
export interface KindFacts {
  kind: string; unit: string
  /** True for a kind whose day value is the last measurement: the window shows its lowest and highest, not a mean. */
  spot: boolean
  low: number | null; high: number | null
  /** True for a kind that adds up over a day: the window shows a total, not a mean. */
  sums: boolean
  /** True for an event log: a day value is a count, so the latest row is a date. */
  counts: boolean
  inWindow: DayPoint[]
  /** The total of the window for a kind that adds up, the mean for the others; null when the window is empty. */
  value: number | null
  first: DayPoint | null; latest: DayPoint | null; days: number
}
export function kindFacts(s: DailySeries, w: Window): KindFacts {
  const inWindow = within(s.days, w), sums = addsUp(s.agg)
  const sum = inWindow.reduce((a, d) => a + d.value, 0)
  return {
    kind: s.kind, unit: s.unit, sums, spot: s.agg === 'last',
    low: inWindow.length ? Math.min(...inWindow.map(d => d.value)) : null, high: inWindow.length ? Math.max(...inWindow.map(d => d.value)) : null, counts: s.agg === 'count', inWindow,
    value: inWindow.length ? (sums ? sum : sum / inWindow.length) : null,
    first: s.days[0] ?? null, latest: s.days.at(-1) ?? null, days: s.days.length,
  }
}

/**
 * What the weight sentence states. `change`: two or more measurements in the window.
 * `single`: one, with the measurement before the window when there is one.
 * `stale`: none in the window. `none`: no measurement at all.
 */
export type WeightStory =
  | { is: 'change'; latest: DayPoint; from: DayPoint; delta: number }
  | { is: 'single'; latest: DayPoint; before: DayPoint | null }
  | { is: 'stale'; latest: DayPoint }
  | { is: 'none' }
export function weightStory(days: readonly DayPoint[], w: Window): WeightStory {
  if (!days.length) return { is: 'none' }
  const inWindow = within(days, w)
  if (!inWindow.length) return { is: 'stale', latest: days.at(-1)! }
  const latest = inWindow.at(-1)!
  if (inWindow.length === 1) return { is: 'single', latest, before: days.filter(d => d.ymd < latest.ymd).at(-1) ?? null }
  return { is: 'change', latest, from: inWindow[0], delta: latest.value - inWindow[0].value }
}

/** Days of the window with a daily mean above a level. */
export const daysAbove = (days: readonly DayPoint[], level: number) => days.filter(d => d.value > level).length
