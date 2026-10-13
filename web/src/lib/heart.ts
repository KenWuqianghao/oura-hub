// The Heart page's calculations, pure.
import type { DayPoint, HealthSample, TrendPoint } from './api'

export interface Against { latest: DayPoint; mean: number; diff: number }
/** The newest day against the mean of all the days, both rounded as the page shows them, so the difference adds up for the reader. */
export function against(days: DayPoint[], decimals = 0): Against | null {
  if (!days.length) return null
  const k = 10 ** decimals, round = (v: number) => Math.round(v * k) / k
  const latest = days[days.length - 1], mean = round(days.reduce((a, d) => a + d.value, 0) / days.length)
  return { latest, mean, diff: round(round(latest.value) - mean) }
}

/** `get_trends` gives one point for each sleep period, naps included. The night's low is the lowest of a wake day. */
export function lowestPerDay(points: TrendPoint[]): TrendPoint[] {
  const low = new Map<string, number>()
  for (const p of points) low.set(p.ymd, Math.min(low.get(p.ymd) ?? Infinity, p.value))
  return [...low].map(([ymd, value]) => ({ ymd, value })).sort((a, b) => a.ymd < b.ymd ? -1 : 1)
}

export interface Paired { days: number; ring: number; watch: number }
/** The means of the two sources over the days that have both, or null when no day has both. */
export function paired(ring: TrendPoint[], watch: DayPoint[]): Paired | null {
  const w = new Map(watch.map(d => [d.ymd, d.value]))
  const both = ring.filter(p => w.has(p.ymd))
  if (!both.length) return null
  return { days: both.length, ring: both.reduce((a, p) => a + p.value, 0) / both.length, watch: both.reduce((a, p) => a + w.get(p.ymd)!, 0) / both.length }
}

// HKElectrocardiogram.Classification raw values, as the phone app writes them: "classification_<n>"
const ECG = { 1: 'sinus', 2: 'afib', 3: 'low', 4: 'high', 5: 'poor', 6: 'other' } as const
export type EcgClass = typeof ECG[keyof typeof ECG] | 'unknown'
function ecgClass(category: string | undefined): EcgClass {
  const n = Number(/^classification_(\d+)$/.exec(category ?? '')?.[1])
  return Object.hasOwn(ECG, n) ? ECG[n as keyof typeof ECG] : 'unknown'
}

export type HeartEvent = { at: number; source: string } & ({ type: 'low'; minutes: number } | { type: 'ecg'; bpm: number | null; result: EcgClass })
/** Low heart rate notifications and ECG recordings as one list, newest first. */
export function heartEvents(low: HealthSample[], ecg: HealthSample[]): HeartEvent[] {
  return [
    ...low.map((s): HeartEvent => ({ type: 'low', at: s.start_unix, source: s.source_name ?? '', minutes: (s.end_unix - s.start_unix) / 60 })),
    ...ecg.map((s): HeartEvent => ({ type: 'ecg', at: s.start_unix, source: s.source_name ?? '', bpm: s.value, result: ecgClass(s.category) })),
  ].sort((a, b) => b.at - a.at)
}
