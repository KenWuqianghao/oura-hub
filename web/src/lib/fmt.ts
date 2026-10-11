// Formatting. Dates, numbers, and relative times go through `Intl` with the page's
// locale; words go through `t()`.
import type { Night, Summary } from './api'
import { t, intlTag, type Key } from './i18n.svelte'

const cache = new Map<string, Intl.DateTimeFormat | Intl.NumberFormat | Intl.RelativeTimeFormat>()
function memo<F extends Intl.DateTimeFormat | Intl.NumberFormat | Intl.RelativeTimeFormat>(kind: string, opts: object, make: (tag: string) => F): F {
  const tag = intlTag(), key = `${kind}|${tag}|${JSON.stringify(opts)}`
  let f = cache.get(key) as F | undefined
  if (!f) { f = make(tag); cache.set(key, f) }
  return f
}
const date = (opts: Intl.DateTimeFormatOptions) => memo('d', opts, tag => new Intl.DateTimeFormat(tag, opts))

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
/** Local midnight (ms) of a "yyyy-mm-dd". */
export function dayStartMs(ymd: string): number { return (parseYmd(ymd) ?? new Date()).getTime() }
/** "HH:MM" on a calendar day → ms. */
export function hmOnDay(ymd: string, hm: string, addDays = 0): number {
  const [h, m] = hm.split(':').map(Number)
  const d = parseYmd(ymd) ?? new Date(); d.setDate(d.getDate() + addDays); d.setHours(h, m, 0, 0); return d.getTime()
}

/** "Oct 11" / "10月11日" from a Date or ms. */
export const monthDayOf = (d: Date | number) => date({ month: 'short', day: 'numeric' }).format(d)
/** "Oct 11, 2026" / "2026年10月11日". */
export const fullDateOf = (d: Date | number) => date({ year: 'numeric', month: 'short', day: 'numeric' }).format(d)
/** "Sep 12 – Oct 11, 2026" / "2026年9月12日至10月11日" from two yyyy-mm-dd days. */
export function dateRange(start: string, end: string): string {
  const a = parseYmd(start), b = parseYmd(end)
  if (!a || !b) return ''
  // zh-CN `formatRange` gives "2026/9/12 – 2026/10/11": build the Chinese range from two dates
  if (intlTag().startsWith('zh')) return `${fullDateOf(a)}至${a.getFullYear() === b.getFullYear() ? monthDayOf(b) : fullDateOf(b)}`
  return date({ year: 'numeric', month: 'short', day: 'numeric' }).formatRange(a, b)
}
/** "18:05", 24-hour in both languages. */
export const clockOf = (d: Date | number) => date({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d)

/** "Today", "Yesterday", or "Mon, Sep 22". */
export function dayLabel(ymd: string, now = new Date()): string {
  const d = parseYmd(ymd); if (!d) return ymd
  const today = todayYmd(now)
  if (ymd === today) return t('common.today')
  if (ymd === addDays(today, -1)) return t('common.yesterday')
  return date({ weekday: 'short', month: 'short', day: 'numeric' }).format(d)
}
/** "Sunday, October 11". */
export function dayTitle(ymd: string): string {
  const d = parseYmd(ymd); if (!d) return ymd
  return date({ weekday: 'long', month: 'long', day: 'numeric' }).format(d)
}
/** "Oct 11" from "yyyy-mm-dd", or from a text that ends in "mm-dd". */
export function monthDay(day: string): string {
  const d = parseYmd(day); if (d) return monthDayOf(d)
  const p = day.slice(-5).split('-').map(Number)
  if (p.length === 2 && p[0] >= 1 && p[0] <= 12) return monthDayOf(new Date(2024, p[0] - 1, p[1]))
  return day
}
export const timeHM = (unix: number) => clockOf(unix * 1000)
export const dateTime = (unix: number) => date({ month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(unix * 1000)

export function num(v: number | null | undefined, decimals = 0, fallback = '—'): string {
  if (v == null || !Number.isFinite(v)) return fallback
  const opts = { minimumFractionDigits: decimals, maximumFractionDigits: decimals }
  return memo('n', opts, tag => new Intl.NumberFormat(tag, opts)).format(v)
}
/** A signed difference: "+7", "−3.2". */
export const signed = (v: number, decimals = 0) => `${v >= 0 ? '+' : '−'}${num(Math.abs(v), decimals)}`

export function ago(unix: number, now = Date.now() / 1000): string {
  const s = Math.max(0, now - unix)
  if (s < 90) return t('common.just_now')
  const opts = { style: 'short', numeric: 'always' } as const
  const rtf = memo('r', opts, tag => new Intl.RelativeTimeFormat(tag, opts))
  if (s < 3600) return rtf.format(-Math.round(s / 60), 'minute')
  if (s < 48 * 3600) return rtf.format(-(s < 10 * 3600 ? Math.round(s / 360) / 10 : Math.round(s / 3600)), 'hour')
  return rtf.format(-Math.round(s / 86400), 'day')
}

/** "8 hr 12 min" / "8 小时 12 分钟" from minutes. */
export function minutesText(min: number): string {
  const total = Math.max(0, Math.round(min))
  if (total < 60) return `${total} ${t('common.min')}`
  return `${Math.floor(total / 60)} ${t('common.hr')} ${total % 60} ${t('common.min')}`
}
export const hoursText = (h: number) => minutesText(h * 60)

export type Tone = 'good' | 'neutral' | 'warn' | 'alert'
export const scoreTone = (score: number): Tone => score >= 85 ? 'good' : score >= 70 ? 'neutral' : score >= 60 ? 'warn' : 'alert'
const SCORE_BAND: Record<Tone, Key> = { good: 'today.band_optimal', neutral: 'today.band_good', warn: 'today.band_fair', alert: 'today.band_attention' }
export const scoreBand = (score: number) => t(SCORE_BAND[scoreTone(score)])

export type DebtState = 'none' | 'low' | 'moderate' | 'high'
const DEBT_TONE: Record<DebtState, Tone> = { none: 'good', low: 'neutral', moderate: 'warn', high: 'alert' }
const isDebt = (s: string | undefined): s is DebtState => s != null && Object.hasOwn(DEBT_TONE, s)
export const debtTone = (state?: string): Tone => isDebt(state) ? DEBT_TONE[state] : 'neutral'
export const debtLabel = (state: string) => isDebt(state) ? t(`today.debt_${state}`) : state
export const debtCopy = (state: string) => isDebt(state) ? t(`today.debt_${state}_copy`) : ''

export type IllnessLight = 'NO_SIGNS' | 'MINOR_SIGNS' | 'MAJOR_SIGNS'
const ILL_TONE: Record<IllnessLight, Tone> = { NO_SIGNS: 'good', MINOR_SIGNS: 'warn', MAJOR_SIGNS: 'alert' }
const isIll = (s: string | undefined): s is IllnessLight => s != null && Object.hasOwn(ILL_TONE, s)
export const illnessTone = (light?: string): Tone => isIll(light) ? ILL_TONE[light] : 'neutral'
export const illnessLabel = (light?: string) => isIll(light) ? t(`today.ill_${light}`) : '—'

/** Sleep stage codes of the ring: 1 deep, 2 core, 3 REM, anything else awake. */
export const stageName = (s: number) => t(s === 1 ? 'common.deep' : s === 2 ? 'common.core' : s === 3 ? 'common.rem' : 'common.awake')

// ── summary helpers (identical rules to the iOS Summary extension) ──
/** The calendar date you woke from a night: onset date, plus one if it crossed midnight. */
export function wakeYmd(n: Night): string | null {
  if (!n.ymd) return null
  if (n.start && n.end && n.end < n.start) return addDays(n.ymd, 1)
  return n.ymd
}
export function nightForDay(s: Summary, day: string): Night | undefined {
  const c = s.nights.filter(n => wakeYmd(n) === day)
  if (c.length) return c.reduce((a, b) => ((a.in_bed_h ?? 0) >= (b.in_bed_h ?? 0) ? a : b))
  return s.nights.find(n => !n.ymd && (n.date ?? '').endsWith(day.slice(5)))
}
export function workoutsOn(s: Summary, day: string) {
  return (s.workouts ?? []).filter(w => w.isWorkout >= 0.5 && w.start.slice(0, 10) === day)
}
export type ScoreKind = 'sleep' | 'readiness' | 'activity'
export const SCORE_KINDS: ScoreKind[] = ['sleep', 'readiness', 'activity']
export const scoreTitle = (k: ScoreKind) => t(`today.score_${k}`)
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
