// The ring metrics of the Trends page, read from the ring summary: one value per
// wake day. `get_trends` reads the same summary but returns one point per night
// row, so a day with a nap has two points; here the longest night of a day stands
// for the day, the rule of the Today page.
import type { DailyStat, DayPoint, Night, Summary } from './api'
import { wakeYmd } from './fmt'
import { RANGES, spanDays, type RangeId } from './range'

/** One night per wake day, the longest one, oldest first. */
export function oneNightPerWakeDay(nights: Night[]): { ymd: string; night: Night }[] {
  const byDay = new Map<string, Night>()
  for (const n of nights) {
    const d = wakeYmd(n)
    if (d && (byDay.get(d)?.in_bed_h ?? -1) < (n.in_bed_h ?? 0)) byDay.set(d, n)
  }
  return [...byDay.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([ymd, night]) => ({ ymd, night }))
}

type Read<T> = (from: T) => number | null | undefined
const nightly = (pick: Read<Night>) => (s: Summary): DayPoint[] =>
  oneNightPerWakeDay(s.nights).flatMap(({ ymd, night }) => { const v = pick(night); return v == null ? [] : [{ ymd, value: v, n: 1 }] })
const daily = (pick: Read<DailyStat>) => (s: Summary): DayPoint[] =>
  Object.entries(s.activity_daily ?? {}).sort(([a], [b]) => (a < b ? -1 : 1)).flatMap(([ymd, d]) => { const v = pick(d); return v == null ? [] : [{ ymd, value: v, n: 1 }] })

export const RING_IDS = ['hrv_ms', 'rhr', 'skin_temp', 'efficiency', 'in_bed_h', 'asleep_min', 'deep_pct', 'rem_pct', 'awakenings', 'waso_min', 'steps', 'active_kcal'] as const
export type RingId = typeof RING_IDS[number]
/** `unit` is a unit of the hub: `unitLabel` turns a word unit into the page's language. */
export interface RingMetric { id: RingId; unit: string; decimals: number; adds: boolean; points: (s: Summary) => DayPoint[]; baseline?: (s: Summary) => number | null | undefined }

export const RING: readonly RingMetric[] = [
  { id: 'hrv_ms', unit: 'ms', decimals: 0, adds: false, points: nightly(n => n.hrv_ms), baseline: s => s.vitals?.hrv?.baseline },
  { id: 'rhr', unit: 'bpm', decimals: 0, adds: false, points: nightly(n => n.rhr), baseline: s => s.vitals?.rhr?.baseline },
  { id: 'skin_temp', unit: '°C', decimals: 1, adds: false, points: nightly(n => n.skin_temp) },
  { id: 'efficiency', unit: '%', decimals: 0, adds: false, points: nightly(n => n.efficiency) },
  { id: 'in_bed_h', unit: 'h', decimals: 1, adds: false, points: nightly(n => n.in_bed_h) },
  { id: 'asleep_min', unit: 'min', decimals: 0, adds: false, points: nightly(n => n.metrics?.asleep_min) },
  { id: 'deep_pct', unit: '%', decimals: 0, adds: false, points: nightly(n => n.deep_pct) },
  { id: 'rem_pct', unit: '%', decimals: 0, adds: false, points: nightly(n => n.rem_pct) },
  { id: 'awakenings', unit: '', decimals: 0, adds: false, points: nightly(n => n.metrics?.awakenings) },
  { id: 'waso_min', unit: 'min', decimals: 0, adds: false, points: nightly(n => n.metrics?.waso_min) },
  { id: 'steps', unit: 'steps', decimals: 0, adds: true, points: daily(d => d.steps) },
  { id: 'active_kcal', unit: 'kcal', decimals: 0, adds: true, points: daily(d => d.active_kcal) },
]
export const ringMetric = (id: string): RingMetric | undefined => RING.find(m => m.id === id)

/** The ranges worth offering for a ring metric. The summary holds weeks, not years: a range longer than the data is left out, and "All" stands for the whole of it. */
export function ringRanges(points: DayPoint[], today: string): RangeId[] {
  const span = points.length ? spanDays(points[0].ymd, today) : 0
  const shorter = RANGES.filter(r => r.id !== 'All' && r.days < span).map(r => r.id)
  return shorter.length ? [...shorter, 'All'] : ['W']
}
