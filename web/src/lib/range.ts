// Time ranges and buckets, pure. A range picks how far back a chart looks; the
// bucket rule keeps a chart readable: one mark per day up to about 90 marks, then
// one per week, then one per month.
import type { Agg, DayPoint } from './api'

export const RANGES = [
  { id: 'W', days: 7 }, { id: 'M', days: 30 }, { id: '6M', days: 183 }, { id: 'Y', days: 365 }, { id: 'All', days: 4000 },
] as const
export type RangeId = typeof RANGES[number]['id']
export const rangeDays = (id: RangeId): number => RANGES.find(r => r.id === id)!.days

export type BucketSize = 'day' | 'week' | 'month'
/** One mark of a chart. `start` and `end` are the first and the last day of the bucket (yyyy-mm-dd); `n` is the number of days with data. */
export interface Bucket { start: string; end: string; value: number | null; min: number | null; max: number | null; n: number }
export interface Buckets {
  size: BucketSize
  /** True when a mark is the average of several days of a kind that adds up over a day: label the value "daily average". */
  averaged: boolean
  points: Bucket[]
}

const MAX_MARKS = 92
const DAY = 86_400_000
const utc = (ymd: string) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10))
const ymdOf = (ms: number) => new Date(ms).toISOString().slice(0, 10)
/** Whole days from `a` to `b`, the two ends included. */
export const spanDays = (a: string, b: string) => Math.round((utc(b) - utc(a)) / DAY) + 1
export const bucketSize = (days: number): BucketSize => days <= MAX_MARKS ? 'day' : days / 7 <= MAX_MARKS ? 'week' : 'month'

/** The first day of the bucket that holds `ymd`. Weeks start on Monday. */
function bucketStart(ymd: string, size: BucketSize): string {
  if (size === 'day') return ymd
  if (size === 'month') return ymd.slice(0, 8) + '01'
  const ms = utc(ymd)
  return ymdOf(ms - ((new Date(ms).getUTCDay() + 6) % 7) * DAY)
}
function nextStart(start: string, size: BucketSize): string {
  if (size === 'month') { const d = new Date(utc(start)); d.setUTCMonth(d.getUTCMonth() + 1); return ymdOf(d.getTime()) }
  return ymdOf(utc(start) + (size === 'week' ? 7 : 1) * DAY)
}
export const addsUp = (agg: Agg) => agg === 'sum' || agg === 'count' || agg === 'minutes'

/**
 * Daily points → the marks of a chart from `start` to `end` (yyyy-mm-dd, both included).
 * Every bucket in the window is in the result, in order; a bucket with no data has a null value.
 * A bucket of several days shows the mean of its days with data, for every `agg`: for a kind
 * that adds up over a day this is the daily average. `min` and `max` are the extremes of the days.
 */
export function bucketize(days: DayPoint[], agg: Agg, start: string, end: string): Buckets {
  const size = bucketSize(Math.max(1, spanDays(start, end)))
  const points: Bucket[] = []
  const at = new Map<string, Bucket>()
  for (let s = bucketStart(start, size); s <= end; s = nextStart(s, size)) {
    const b: Bucket = { start: s < start ? start : s, end: s, value: null, min: null, max: null, n: 0 }
    const last = ymdOf(utc(nextStart(s, size)) - DAY)
    b.end = last > end ? end : last
    points.push(b); at.set(s, b)
  }
  const sums = new Map<Bucket, number>()
  for (const d of days) {
    const b = at.get(bucketStart(d.ymd, size))
    if (!b || d.ymd < start || d.ymd > end) continue
    sums.set(b, (sums.get(b) ?? 0) + d.value)
    b.n += 1
    const lo = d.min ?? d.value, hi = d.max ?? d.value
    b.min = b.min == null ? lo : Math.min(b.min, lo)
    b.max = b.max == null ? hi : Math.max(b.max, hi)
  }
  for (const [b, sum] of sums) b.value = sum / b.n
  return { size, averaged: size !== 'day' && addsUp(agg), points }
}

export interface Stats { latest: DayPoint | null; mean: number | null; min: number | null; max: number | null; total: number | null; days: number }
/** The numbers a chart head shows, over the daily points in a window. `total` is null for a kind that does not add up. */
export function stats(days: DayPoint[], agg: Agg): Stats {
  if (!days.length) return { latest: null, mean: null, min: null, max: null, total: null, days: 0 }
  const sum = days.reduce((a, d) => a + d.value, 0)
  return {
    latest: days[days.length - 1], mean: sum / days.length,
    min: Math.min(...days.map(d => d.min ?? d.value)), max: Math.max(...days.map(d => d.max ?? d.value)),
    total: addsUp(agg) ? sum : null, days: days.length,
  }
}

/** A line joins two marks with data when at most this many marks without data lie between them. A longer silence is a gap, and the line stops. */
export const MAX_GAP: Record<BucketSize, number> = { day: 7, week: 4, month: 3 }

/**
 * The values of a line that breaks at long gaps. `line` holds each value, a straight
 * fill across a short gap (`filled` is true there, so no symbol and no tooltip value
 * stands on it), and null inside a long gap. `lone` holds the values that no line
 * reaches: draw them as points, or they are invisible.
 */
export function bridge(values: (number | null)[], maxGap: number): { line: (number | null)[]; filled: boolean[]; lone: (number | null)[] } {
  const line = [...values], filled = values.map(() => false), lone: (number | null)[] = values.map(() => null)
  const joined = values.map(() => false)
  let prev = -1
  values.forEach((v, i) => {
    if (v == null) return
    if (prev >= 0 && i - prev - 1 <= maxGap) {
      const a = values[prev]!
      for (let k = prev + 1; k < i; k++) { line[k] = a + (v - a) * (k - prev) / (i - prev); filled[k] = true }
      joined[prev] = joined[i] = true
    }
    prev = i
  })
  values.forEach((v, i) => { if (v != null && !joined[i]) lone[i] = v })
  return { line, filled, lone }
}

/** A mean over the last `n` points up to each point: the trend under the daily noise. */
export function rolling(values: (number | null)[], n = 7): (number | null)[] {
  return values.map((v, i) => {
    if (v == null) return null
    const win = values.slice(Math.max(0, i - n + 1), i + 1).filter((x): x is number => x != null)
    return win.reduce((a, b) => a + b, 0) / win.length
  })
}

const pad = (n: number) => String(n).padStart(2, '0')
/** The first and the last day a range shows, as yyyy-mm-dd. "All" starts at the first day with data. */
export function windowOf(id: RangeId, days: DayPoint[], now = new Date()): { start: string; end: string } {
  const end = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const back = id === 'All' ? (days.length ? spanDays(days[0].ymd, end) : 30) : rangeDays(id)
  return { start: ymdOf(utc(end) - (Math.max(back, 1) - 1) * DAY), end }
}
