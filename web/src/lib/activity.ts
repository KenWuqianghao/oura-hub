// The Activity page's calculations, pure: the comparison in the lead sentence, the
// workout totals, the training buckets, and the year grid.
import type { DayPoint, HealthWorkout } from './api'
import { addDays, parseYmd, todayYmd } from './fmt'
import { spanDays } from './range'

export interface Comparison { mean: number | null; before: number | null; diff: number | null }
/** The mean of the days with data now, and its difference from the period before, both rounded as the page shows them. */
export function compare(now: DayPoint[], before: DayPoint[]): Comparison {
  const mean = (d: DayPoint[]) => d.length ? d.reduce((a, p) => a + p.value, 0) / d.length : null
  const a = mean(now), b = mean(before)
  return { mean: a, before: b, diff: a != null && b != null ? Math.round(a) - Math.round(b) : null }
}

/** The hub can hold one workout twice. Rows with the same type, start, end, and source count once. */
export function uniqueWorkouts(list: HealthWorkout[]): { list: HealthWorkout[]; repeats: number } {
  const seen = new Set<string>()
  const unique = list.filter(w => { const key = `${w.activity}|${w.start_unix}|${w.end_unix}|${w.source}`; return !seen.has(key) && !!seen.add(key) })
  return { list: unique, repeats: list.length - unique.length }
}

// A row over this length is a logging mistake of the source app (a 2877-minute strength session).
export const MAX_WORKOUT_MIN = 720
export const countsInTotals = (w: HealthWorkout) => w.duration_min != null && w.duration_min <= MAX_WORKOUT_MIN
const dayOf = (w: HealthWorkout) => todayYmd(new Date(w.start_unix * 1000))

export interface TypeTotals {
  activity: string; sessions: number; minutes: number
  /** Null when no session of the type carries the value. */
  kcal: number | null; distance_m: number | null; hr: number | null
}
/** One row per activity type, most sessions first. Heart rate is the mean over the sessions, weighted by their length. */
export function totalsByType(workouts: HealthWorkout[]): TypeTotals[] {
  const rows = new Map<string, TypeTotals & { hrMin: number; hrSum: number }>()
  for (const w of workouts.filter(countsInTotals)) {
    const r = rows.get(w.activity) ?? { activity: w.activity, sessions: 0, minutes: 0, kcal: null, distance_m: null, hr: null, hrMin: 0, hrSum: 0 }
    const min = w.duration_min ?? 0
    r.sessions += 1
    r.minutes += min
    if (w.kcal != null) r.kcal = (r.kcal ?? 0) + w.kcal
    if (w.distance_m != null) r.distance_m = (r.distance_m ?? 0) + w.distance_m
    if (w.hr_avg != null && min > 0) { r.hrMin += min; r.hrSum += w.hr_avg * min; r.hr = r.hrSum / r.hrMin }
    rows.set(w.activity, r)
  }
  return [...rows.values()].sort((a, b) => b.sessions - a.sessions || b.minutes - a.minutes)
}

export type TrainingBucket = 'day' | 'week' | 'month'
export const OTHER = '_other'
export interface Training {
  size: TrainingBucket
  buckets: { start: string; end: string }[]
  /** Stack order, bottom first: the types with the most minutes, then `OTHER` when rarer types exist. */
  types: string[]
  /** `minutes[type][bucket]`. */
  minutes: Record<string, number[]>
}
const monday = (ymd: string) => addDays(ymd, -(((parseYmd(ymd) ?? new Date()).getDay() + 6) % 7))
const bucketOf = (ymd: string, size: TrainingBucket) => size === 'day' ? ymd : size === 'week' ? monday(ymd) : ymd.slice(0, 8) + '01'
function nextBucket(start: string, size: TrainingBucket): string {
  if (size !== 'month') return addDays(start, size === 'week' ? 7 : 1)
  const d = parseYmd(start) ?? new Date()
  return todayYmd(new Date(d.getFullYear(), d.getMonth() + 1, 1))
}
/** Training minutes per day, week, or month from `start` to `end`, split by type. Every bucket of the window is there. */
export function training(workouts: HealthWorkout[], start: string, end: string, top = 4): Training {
  const span = spanDays(start, end)
  const size: TrainingBucket = span <= 14 ? 'day' : span <= 400 ? 'week' : 'month'
  const used = workouts.filter(w => countsInTotals(w) && dayOf(w) >= start && dayOf(w) <= end)
  const ranked = totalsByType(used).sort((a, b) => b.minutes - a.minutes).map(r => r.activity)
  const named = new Set(ranked.slice(0, top))
  const types = ranked.length > top ? [...ranked.slice(0, top), OTHER] : ranked
  const buckets: Training['buckets'] = []
  const index = new Map<string, number>()
  for (let s = bucketOf(start, size); s <= end; s = nextBucket(s, size)) {
    const last = addDays(nextBucket(s, size), -1)
    index.set(s, buckets.length)
    buckets.push({ start: s < start ? start : s, end: last > end ? end : last })
  }
  const minutes: Training['minutes'] = Object.fromEntries(types.map(type => [type, buckets.map(() => 0)]))
  for (const w of used) {
    const i = index.get(bucketOf(dayOf(w), size))
    if (i != null) minutes[named.has(w.activity) ? w.activity : OTHER][i] += w.duration_min ?? 0
  }
  return { size, buckets, types, minutes }
}

export const HEAT_WEEKS = 53
/** Lower bounds of the four shades of the year grid, in exercise minutes. */
export const HEAT_STEPS = [1, 15, 30, 60] as const
/** 0: no minutes. 1 to 4: the shade. */
export const heatLevel = (minutes: number | null) => minutes == null ? 0 : HEAT_STEPS.filter(s => minutes >= s).length
/** The first day of the year grid: the Monday 52 weeks before this week's Monday. */
export const heatStart = (today = todayYmd()) => addDays(monday(today), -(HEAT_WEEKS - 1) * 7)

export interface YearGrid {
  /** 53 columns of Monday to Sunday. A day after today is null. */
  weeks: ({ ymd: string; minutes: number | null } | null)[][]
  /** The column where a month starts. */
  months: { col: number; ymd: string }[]
  activeDays: number; totalDays: number; minutes: number
  /** The most days in a row with exercise minutes. */
  streak: number
}
export function yearGrid(days: DayPoint[], today = todayYmd()): YearGrid {
  const at = new Map(days.map(d => [d.ymd, d.value]))
  const grid: YearGrid = { weeks: [], months: [], activeDays: 0, totalDays: 0, minutes: 0, streak: 0 }
  let run = 0, day = heatStart(today)
  for (let col = 0; col < HEAT_WEEKS; col++) {
    const week: YearGrid['weeks'][number] = []
    for (let row = 0; row < 7; row++, day = addDays(day, 1)) {
      if (day > today) { week.push(null); continue }
      const minutes = at.get(day) ?? null
      week.push({ ymd: day, minutes })
      grid.totalDays += 1
      if (day.endsWith('-01') || (col === 0 && row === 0)) { if (grid.months.at(-1)?.col !== col) grid.months.push({ col, ymd: day }) }
      if (minutes != null && minutes >= 1) { grid.activeDays += 1; grid.minutes += minutes; run += 1; grid.streak = Math.max(grid.streak, run) } else run = 0
    }
    grid.weeks.push(week)
  }
  return grid
}
