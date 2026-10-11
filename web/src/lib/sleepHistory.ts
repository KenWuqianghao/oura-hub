// The long-term sleep history from Apple Health, pure: which nights count, the
// facts of a period, and the marks of the two charts.
import type { DayPoint, SleepNight } from './api'
import { bucketize, type BucketSize } from './range'
import { dayStartMs } from './fmt'

/** More time asleep or in bed than this in one night means the source wrote rows that overlap: the hub adds row lengths and does not correct it. */
export const MAX_NIGHT_MIN = 16 * 60
/** A nap is merged into the night before it and stretches `end_unix`. Past this slack between the span and the time in bed, the span is not one sleep. */
export const NAP_SLACK_MIN = 4 * 60

/** Hours from the local midnight of the wake day: −1.5 is 22:30 the evening before, 7.25 is 07:15. */
export interface Schedule { bed: number; wake: number }
export interface HistoryNight extends SleepNight {
  /** Left out of every mean and chart. */
  overlapping: boolean
  /** Null when the span from the first row to the last is not one sleep: the night is left out of the bedtime chart. */
  schedule: Schedule | null
}

function scheduleOf(n: SleepNight): Schedule | null {
  if ((n.end_unix - n.start_unix) / 60 - n.in_bed_min > NAP_SLACK_MIN) return null
  const midnight = dayStartMs(n.ymd) / 1000
  return { bed: (n.start_unix - midnight) / 3600, wake: (n.end_unix - midnight) / 3600 }
}
export function classify(nights: SleepNight[]): HistoryNight[] {
  return nights.map(n => {
    const overlapping = Math.max(n.asleep_min ?? 0, n.in_bed_min) > MAX_NIGHT_MIN
    return { ...n, overlapping, schedule: overlapping ? null : scheduleOf(n) }
  })
}

const mean = (v: number[]) => v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
const sum = (v: number[]) => v.reduce((a, b) => a + b, 0)

export interface SleepFacts {
  /** Nights that count: every night but the overlapping ones. */
  nights: number
  /** Nights left out for overlapping rows, and nights left out of the bedtime chart only. */
  overlapping: number; unscheduled: number
  meanAsleep: number | null; meanInBed: number | null
  /** Shares of the time asleep, over the nights that have stages. `unstaged` is the time asleep with no stage on those nights. */
  shares: { deep: number; core: number; rem: number; unstaged: number; nights: number } | null
  meanBed: number | null; meanWake: number | null
  /** The standard deviation of bedtime in minutes; null under two nights. */
  bedSpreadMin: number | null
  /** Source names with their number of nights, most nights first. */
  sources: [name: string, nights: number][]
}

export function sleepFacts(nights: HistoryNight[]): SleepFacts {
  const kept = nights.filter(n => !n.overlapping)
  const asleep = kept.flatMap(n => n.asleep_min == null ? [] : [n.asleep_min])
  const staged = kept.filter(n => n.asleep_min != null && n.deep_min + n.core_min + n.rem_min > 0)
  const total = sum(staged.map(n => n.asleep_min ?? 0))
  const share = (pick: (n: SleepNight) => number) => sum(staged.map(pick)) / total
  const beds = kept.flatMap(n => n.schedule ? [n.schedule.bed] : [])
  const meanBed = mean(beds)
  const sources = new Map<string, number>()
  for (const n of kept) sources.set(n.source, (sources.get(n.source) ?? 0) + 1)
  return {
    nights: kept.length, overlapping: nights.length - kept.length, unscheduled: kept.filter(n => !n.schedule).length,
    meanAsleep: mean(asleep), meanInBed: mean(kept.map(n => n.in_bed_min)),
    shares: total > 0 ? { deep: share(n => n.deep_min), core: share(n => n.core_min), rem: share(n => n.rem_min), unstaged: share(n => n.unspecified_min), nights: staged.length } : null,
    meanBed, meanWake: mean(kept.flatMap(n => n.schedule ? [n.schedule.wake] : [])),
    bedSpreadMin: meanBed != null && beds.length > 1 ? Math.sqrt(sum(beds.map(b => (b - meanBed) ** 2)) / (beds.length - 1)) * 60 : null,
    sources: [...sources.entries()].sort((a, b) => b[1] - a[1]),
  }
}

/** The segments of a bar, from the bottom up. `inBedOnly` is the time in bed of a night whose source wrote no sleep. */
export const SEGMENTS = ['deep', 'core', 'rem', 'unstaged', 'awake', 'inBedOnly'] as const
export type Segment = typeof SEGMENTS[number]
const MINUTES: Record<Segment, (n: SleepNight) => number> = {
  deep: n => n.deep_min, core: n => n.core_min, rem: n => n.rem_min, unstaged: n => n.unspecified_min, awake: n => n.awake_min,
  inBedOnly: n => n.asleep_min == null ? n.in_bed_min : 0,
}

export interface NightBucket { start: string; end: string; n: number }
export interface StageBucket extends NightBucket { minutes: Record<Segment, number> | null }
export interface ScheduleBucket extends NightBucket { schedule: Schedule | null }
export interface Marks<B> { size: BucketSize; points: B[] }

const point = (ymd: string, value: number): DayPoint => ({ ymd, value, n: 1 })
/** The range rule of every chart of the site, applied to one number per night: a bucket shows the mean night. */
const marks = <N extends { ymd: string }>(nights: N[], pick: (n: N) => number, start: string, end: string) =>
  bucketize(nights.map(n => point(n.ymd, pick(n))), 'mean', start, end)

export function stageMarks(nights: HistoryNight[], start: string, end: string): Marks<StageBucket> {
  const kept = nights.filter(n => !n.overlapping)
  const by = SEGMENTS.map(s => marks(kept, MINUTES[s], start, end))
  return {
    size: by[0].size,
    points: by[0].points.map((b, i) => ({
      start: b.start, end: b.end, n: b.n,
      minutes: b.n ? Object.fromEntries(SEGMENTS.map((s, j) => [s, by[j].points[i].value ?? 0])) as Record<Segment, number> : null,
    })),
  }
}

export function scheduleMarks(nights: HistoryNight[], start: string, end: string): Marks<ScheduleBucket> {
  const kept = nights.filter((n): n is HistoryNight & { schedule: Schedule } => n.schedule != null)
  const bed = marks(kept, n => n.schedule.bed, start, end), wake = marks(kept, n => n.schedule.wake, start, end)
  return {
    size: bed.size,
    points: bed.points.map((b, i) => ({ start: b.start, end: b.end, n: b.n, schedule: b.value != null ? { bed: b.value, wake: wake.points[i].value ?? b.value } : null })),
  }
}
