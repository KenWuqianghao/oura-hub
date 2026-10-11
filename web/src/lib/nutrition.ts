// The food log, pure. A "logged day" is a day with dietary energy in the log; every
// mean on the Nutrition page is over logged days, never over calendar days. The
// nutrient table and the macro factors are data here, so the page and the tables
// read one source.
import type { DayPoint } from './api'
import type { KnownKind } from '../i18n/kinds'
import { RANGES, rangeDays, type RangeId } from './range'
import { addDays, parseYmd } from './fmt'

export const ENERGY = 'dietary_energy_consumed'
export const BURNED_KINDS = ['active_energy', 'basal_energy'] as const

/** Energy per gram (the general Atwater factors), and the parts the log can split a macro into. */
export const MACROS = [
  { kind: 'dietary_protein', kcalPerG: 4, subs: [] },
  { kind: 'dietary_carbohydrates', kcalPerG: 4, subs: ['dietary_sugar', 'dietary_fiber'] },
  { kind: 'dietary_fat_total', kcalPerG: 9, subs: ['dietary_fat_saturated', 'dietary_fat_monounsaturated', 'dietary_fat_polyunsaturated'] },
] as const satisfies readonly { kind: KnownKind; kcalPerG: number; subs: readonly KnownKind[] }[]
export type MacroKind = typeof MACROS[number]['kind']

export type NutrientGroup = 'minerals' | 'vitamins' | 'other'
/** `target`: reaching the value is the aim. `limit`: a value above it is the concern. */
export type RefRole = 'target' | 'limit'
/** `ref` is in the unit the hub returns for the kind. No `ref`: no FDA Daily Value fits what the hub stores. */
export interface Nutrient { kind: KnownKind; group: NutrientGroup; ref?: { value: number; role: RefRole } }

const dv = (kind: KnownKind, group: NutrientGroup, value?: number, role: RefRole = 'target'): Nutrient => ({ kind, group, ref: value == null ? undefined : { value, role } })
/** FDA Daily Values, adults and children 4 years and older: 21 CFR 101.9(c)(8)(iv) and (c)(9), the 2016 rule. */
export const NUTRIENTS: readonly Nutrient[] = [
  dv('dietary_calcium', 'minerals', 1300), dv('dietary_iron', 'minerals', 18), dv('dietary_phosphorus', 'minerals', 1250), dv('dietary_iodine', 'minerals', 150),
  dv('dietary_magnesium', 'minerals', 420), dv('dietary_zinc', 'minerals', 11), dv('dietary_selenium', 'minerals', 55), dv('dietary_copper', 'minerals', 0.9),
  dv('dietary_manganese', 'minerals', 2.3), dv('dietary_chromium', 'minerals', 35), dv('dietary_molybdenum', 'minerals', 45), dv('dietary_chloride', 'minerals', 2300),
  dv('dietary_potassium', 'minerals', 4700), dv('dietary_sodium', 'minerals', 2300, 'limit'),
  dv('dietary_vitamin_a', 'vitamins', 900), dv('dietary_vitamin_c', 'vitamins', 90), dv('dietary_vitamin_d', 'vitamins', 20), dv('dietary_vitamin_e', 'vitamins', 15),
  dv('dietary_vitamin_k', 'vitamins', 120), dv('dietary_thiamin', 'vitamins', 1.2), dv('dietary_riboflavin', 'vitamins', 1.3), dv('dietary_niacin', 'vitamins', 16),
  dv('dietary_vitamin_b6', 'vitamins', 1.7), dv('dietary_folate', 'vitamins', 400), dv('dietary_vitamin_b12', 'vitamins', 2.4), dv('dietary_biotin', 'vitamins', 30),
  dv('dietary_pantothenic_acid', 'vitamins', 5),
  dv('dietary_protein', 'other', 50), dv('dietary_carbohydrates', 'other', 275), dv('dietary_fiber', 'other', 28), dv('dietary_fat_total', 'other', 78),
  dv('dietary_fat_saturated', 'other', 20, 'limit'), dv('dietary_cholesterol', 'other', 300, 'limit'),
  // the hub stores total sugar and the Daily Value (50 g) is for added sugar; caffeine has no Daily Value
  dv('dietary_sugar', 'other'), dv('dietary_caffeine', 'other'),
]
export const NUTRIENT_GROUPS: readonly NutrientGroup[] = ['minerals', 'vitamins', 'other']

/** Every kind the page reads from the food log, for one batched request. */
export const DIET_KINDS: readonly string[] = [...new Set<string>([
  ENERGY, 'dietary_water', 'dietary_caffeine', ...MACROS.flatMap(m => [m.kind, ...m.subs]), ...NUTRIENTS.map(n => n.kind),
])]

export interface Window { start: string; end: string }
export const within = (days: readonly DayPoint[], w: Window): DayPoint[] => days.filter(d => d.ymd >= w.start && d.ymd <= w.end)
export const meanOf = (days: readonly DayPoint[]): number | null => days.length ? days.reduce((a, d) => a + d.value, 0) / days.length : null

const MIN_LOGGED = 7
/** The shortest range that holds at least seven logged days; "All" when no shorter range does. */
export function defaultRange(logged: readonly DayPoint[], today: string): RangeId {
  for (const r of RANGES) {
    if (r.id === 'All') break
    const start = addDays(today, 1 - rangeDays(r.id))
    if (logged.filter(d => d.ymd >= start && d.ymd <= today).length >= MIN_LOGGED) return r.id
  }
  return 'All'
}

/** Energy burned (active + resting) on the days that have a food log and both parts. */
export function burnedOnLoggedDays(logged: readonly DayPoint[], active: readonly DayPoint[], basal: readonly DayPoint[]): DayPoint[] {
  const a = new Map(active.map(d => [d.ymd, d.value])), b = new Map(basal.map(d => [d.ymd, d.value]))
  return logged.flatMap(d => a.has(d.ymd) && b.has(d.ymd) ? [{ ymd: d.ymd, value: a.get(d.ymd)! + b.get(d.ymd)!, n: 1 }] : [])
}
/** Mean intake and mean energy burned over the days that have both. */
export function balance(intake: readonly DayPoint[], burned: readonly DayPoint[]): { days: number; intake: number; burned: number } | null {
  const out = new Map(burned.map(d => [d.ymd, d.value]))
  const both = intake.filter(d => out.has(d.ymd))
  if (!both.length) return null
  return { days: both.length, intake: meanOf(both)!, burned: both.reduce((a, d) => a + out.get(d.ymd)!, 0) / both.length }
}

export type Series = (kind: string) => readonly DayPoint[]

/** Energy from each macro per day, on the days that have all three. */
export function macroEnergy(series: Series): Record<MacroKind, DayPoint[]> {
  const maps = MACROS.map(m => new Map(series(m.kind).map(d => [d.ymd, d.value * m.kcalPerG])))
  const days = series(MACROS[0].kind).map(d => d.ymd).filter(ymd => maps.every(m => m.has(ymd)))
  const of = (i: number) => days.map(ymd => ({ ymd, value: maps[i].get(ymd)!, n: 1 }))
  return { dietary_protein: of(0), dietary_carbohydrates: of(1), dietary_fat_total: of(2) }
}

export interface MacroRow {
  kind: MacroKind
  /** Mean grams and mean energy per logged day; null when the window has no day with all three macros. */
  grams: number | null; kcal: number | null
  /** Share of the energy from the three macros, 0 to 1. */
  share: number | null
  subs: { kind: string; grams: number | null; days: number }[]
}
export interface MacroSplit { rows: MacroRow[]; days: number; kcal: number | null }
/** The mean split of a window. `kcal` is the mean energy from the three macros, which is not always the logged energy. */
export function macroSplit(series: Series, w: Window): MacroSplit {
  const energy = macroEnergy(series)
  const kcals = MACROS.map(m => meanOf(within(energy[m.kind], w)))
  const total = kcals.every(k => k != null) ? kcals.reduce<number>((a, k) => a + k!, 0) : null
  return {
    days: within(energy.dietary_protein, w).length, kcal: total,
    rows: MACROS.map((m, i) => ({
      kind: m.kind, kcal: kcals[i], grams: kcals[i] == null ? null : kcals[i]! / m.kcalPerG, share: total ? kcals[i]! / total : null,
      subs: m.subs.map(kind => { const d = within(series(kind), w); return { kind, grams: meanOf(d), days: d.length } }),
    })),
  }
}

export interface NutrientRow { nutrient: Nutrient; mean: number | null; days: number; /** Mean as a fraction of the reference: 1 is 100%. */ ratio: number | null }
/** One row per nutrient the hub holds: the mean over the days of the window that have the nutrient. */
export function nutrientRows(series: Series, w: Window, held: (kind: string) => boolean): NutrientRow[] {
  return NUTRIENTS.filter(n => held(n.kind)).map(nutrient => {
    const days = within(series(nutrient.kind), w), mean = meanOf(days)
    return { nutrient, mean, days: days.length, ratio: mean != null && nutrient.ref ? mean / nutrient.ref.value : null }
  })
}

export interface CalendarCell { ymd: string; value: number | null; /** 0: no log. 1 to 4: the quarter of the logged days the energy falls in. */ level: 0 | 1 | 2 | 3 | 4; /** Outside the period: before it, after it, or in the future. */ outside: boolean }
export interface LogCalendar {
  /** `recent`: the last 53 weeks. `year`: the calendar year with the most logged days. */
  mode: 'recent' | 'year'
  year: number; start: string; end: string
  /** Columns of seven cells, Monday first. */
  weeks: CalendarCell[][]
  logged: number
  /** Logged days in the last 53 weeks, whatever the mode. */
  recentLogged: number
  /** The energy at the upper edge of levels 1, 2 and 3. */
  cuts: [number, number, number]
}
const mondayOf = (ymd: string) => addDays(ymd, -(((parseYmd(ymd)?.getDay() ?? 1) + 6) % 7))
const WEEKS = 53

export function logCalendar(logged: readonly DayPoint[], today: string): LogCalendar {
  const recentStart = addDays(mondayOf(today), -(WEEKS - 1) * 7)
  const recent = logged.filter(d => d.ymd >= recentStart && d.ymd <= today)
  let mode: LogCalendar['mode'] = 'recent', start = recentStart, end = today
  if (recent.length < MIN_LOGGED && logged.length) {
    const perYear = new Map<string, number>()
    for (const d of logged) perYear.set(d.ymd.slice(0, 4), (perYear.get(d.ymd.slice(0, 4)) ?? 0) + 1)
    // most days first; the later year wins a tie
    const [year] = [...perYear].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? 1 : -1))[0]
    if (perYear.get(year)! > recent.length) { mode = 'year'; start = `${year}-01-01`; end = `${year}-12-31` }
  }
  const inside = logged.filter(d => d.ymd >= start && d.ymd <= end)
  const sorted = inside.map(d => d.value).sort((a, b) => a - b)
  const q = (p: number) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : 0
  const cuts: [number, number, number] = [q(0.25), q(0.5), q(0.75)]
  const at = new Map(inside.map(d => [d.ymd, d.value]))
  const weeks: CalendarCell[][] = []
  for (let monday = mondayOf(start); monday <= end; monday = addDays(monday, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => {
      const ymd = addDays(monday, i), value = at.get(ymd) ?? null
      const level = value == null ? 0 : value < cuts[0] ? 1 : value < cuts[1] ? 2 : value < cuts[2] ? 3 : 4
      return { ymd, value, level, outside: ymd < start || ymd > end || ymd > today }
    }))
  }
  return { mode, year: +start.slice(0, 4), start, end, weeks, logged: inside.length, recentLogged: recent.length, cuts }
}
