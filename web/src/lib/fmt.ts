// Formatting, translated from the iOS app's Fmt and Theme helpers.
import type { Night, Summary } from './api'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function parseYmd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return null
  return new Date(+m[1], +m[2] - 1, +m[3])
}
export function todayYmd(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export function addDays(ymd: string, n: number): string {
  const d = parseYmd(ymd); if (!d) return ymd
  d.setDate(d.getDate() + n); return todayYmd(d)
}
/** "Today", "Yesterday", or "Mon, Sep 22". */
export function dayLabel(ymd: string, now = new Date()): string {
  const d = parseYmd(ymd); if (!d) return ymd
  const t = todayYmd(now)
  if (ymd === t) return 'Today'
  if (ymd === addDays(t, -1)) return 'Yesterday'
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`
}
export function dayTitle(ymd: string): string {
  const d = parseYmd(ymd); if (!d) return ymd
  const long = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${long[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`
}
export function monthDay(day: string): string {
  const d = parseYmd(day); if (d) return `${MONTHS[d.getMonth()]} ${d.getDate()}`
  const tail = day.slice(-5); const p = tail.split('-').map(Number)
  if (p.length === 2 && p[0] >= 1 && p[0] <= 12) return `${MONTHS[p[0] - 1]} ${p[1]}`
  return day
}
export function hoursMinutes(hours: number): [string, string][] {
  const total = Math.max(0, Math.round(hours * 60))
  if (total < 60) return [[`${total}`, 'min']]
  return [[`${Math.floor(total / 60)}`, 'hr'], [`${total % 60}`, 'min']]
}
export const minutesParts = (min: number) => hoursMinutes(min / 60)
export const minutesText = (min: number) => hoursMinutes(min / 60).map(p => p.join(' ')).join(' ')
export function num(v: number | null | undefined, decimals = 0, fallback = '—'): string {
  if (v == null || !Number.isFinite(v)) return fallback
  return decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString()
}
export function timeHM(unix: number): string {
  const d = new Date(unix * 1000)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
export function dateTime(unix: number): string {
  const d = new Date(unix * 1000)
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${timeHM(unix)}`
}
export function ago(unix: number, now = Date.now() / 1000): string {
  const s = Math.max(0, now - unix)
  if (s < 90) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 48 * 3600) return `${(s / 3600).toFixed(s < 10 * 3600 ? 1 : 0)} h ago`
  return `${Math.round(s / 86400)} d ago`
}

/** Color a change only when it is large enough to matter. */
export function tone(delta: number | null | undefined, goodWhenPositive = true, threshold = 8): string {
  if (delta == null || Math.abs(delta) < threshold) return 'var(--secondary)'
  const isGood = delta >= 0 ? goodWhenPositive : !goodWhenPositive
  return isGood ? 'var(--good)' : 'var(--alert)'
}
export function scoreBand(score: number): { label: string; color: string } {
  if (score >= 85) return { label: 'Optimal', color: 'var(--good)' }
  if (score >= 70) return { label: 'Good', color: 'var(--secondary)' }
  if (score >= 60) return { label: 'Fair', color: 'var(--caution)' }
  return { label: 'Pay attention', color: 'var(--alert)' }
}
export function debtColor(state: string): string {
  return { none: 'var(--good)', low: 'var(--sleep)', moderate: 'var(--caution)', high: 'var(--alert)' }[state] ?? 'var(--secondary)'
}
export function debtLabel(state: string): string {
  return { none: 'Well rested', low: 'Low', moderate: 'Moderate', high: 'High' }[state] ?? state
}
export function debtCopy(state: string): string {
  return {
    none: 'You have slept close to your need over the past two weeks.',
    low: 'A little short. One early night settles it.',
    moderate: 'Your sleep has run short for several nights. Protect tonight.',
    high: 'A large shortfall has built up. Rest is the priority.',
  }[state] ?? ''
}
export const stageColor = (s: number) => s === 1 ? 'var(--deep)' : s === 2 ? 'var(--light)' : s === 3 ? 'var(--rem)' : 'var(--awake)'
export const stageName = (s: number) => s === 1 ? 'Deep' : s === 2 ? 'Core' : s === 3 ? 'REM' : 'Awake'

// ── summary helpers (identical rules to the iOS Summary extension) ──
/** The calendar date you woke from a night: onset date, plus one if it crossed midnight. */
export function wakeYmd(n: Night): string | null {
  if (!n.ymd) return null
  if (n.start && n.end && n.end < n.start) return addDays(n.ymd, 1)
  return n.ymd
}
export function days(s: Summary): string[] {
  const set = new Set(Object.keys(s.activity_profile ?? {}))
  for (const n of s.nights) { const w = wakeYmd(n); if (w) set.add(w) }
  return [...set].sort().reverse()
}
export function nightForDay(s: Summary, day: string): Night | undefined {
  const c = s.nights.filter(n => wakeYmd(n) === day)
  if (c.length) return c.reduce((a, b) => ((a.in_bed_h ?? 0) >= (b.in_bed_h ?? 0) ? a : b))
  return s.nights.find(n => !n.ymd && (n.date ?? '').endsWith(day.slice(5)))
}
export function hasHypnogram(n: Night): boolean { return (n.stages?.length ?? 0) > 1 }
export function workoutsOn(s: Summary, day: string) {
  return (s.workouts ?? []).filter(w => w.isWorkout >= 0.5 && w.start.slice(0, 10) === day)
}
export type ScoreKind = 'sleep' | 'readiness' | 'activity'
export const SCORE_KINDS: ScoreKind[] = ['sleep', 'readiness', 'activity']
export const scoreTint = (k: ScoreKind) => k === 'sleep' ? 'var(--sleep)' : k === 'readiness' ? 'var(--readiness)' : 'var(--activity)'
export const scoreTitle = (k: ScoreKind) => k[0].toUpperCase() + k.slice(1)
/** The newest score of a kind on or before `day`, walking back up to a week. */
export function latestScore(s: Summary, kind: ScoreKind, upTo: string): { day: string; score: number; provisional: boolean } | null {
  const all = s.scores?.days ?? {}
  let day = upTo
  for (let i = 0; i < 7; i++) {
    const sc = all[day]?.[kind]
    if (sc && typeof sc.score === 'number') return { day, score: sc.score, provisional: !!sc.provisional }
    day = addDays(day, -1)
  }
  return null
}
export function activityLabel(s: string): string { return s ? s[0].toUpperCase() + s.slice(1) : s }
