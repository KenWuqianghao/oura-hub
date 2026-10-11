// The chart options of the Nutrition page. A mark is one day up to about 90 days,
// then the mean of the logged days of a week or of a month (the rule of `range.ts`).
import { base, tokens, token, axisChrome, axisLabel, tipHead, tipRow, type Option } from './charts'
import type { Bucket, Buckets } from './range'
import { MACROS, type MacroKind } from './nutrition'
import { kindTitle } from './kinds'
import { t, intlTag } from './i18n.svelte'
import * as F from './fmt'

const fmtDate = (opts: Intl.DateTimeFormatOptions, ymd: string) => new Intl.DateTimeFormat(intlTag(), opts).format(F.parseYmd(ymd) ?? new Date())
/** The label of a mark: short for the axis, long for the tooltip. */
export function bucketLabel(b: Bucket, of: Buckets, long: boolean): string {
  if (of.size === 'month') return long ? fmtDate({ year: 'numeric', month: 'long' }, b.start) : fmtDate(b.start.slice(5, 7) === '01' ? { year: 'numeric' } : { month: 'short' }, b.start)
  if (of.size === 'week') return long ? F.dateRange(b.start, b.end) : F.monthDay(b.start)
  if (long) return fmtDate({ weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }, b.start)
  return of.points.length <= 7 ? fmtDate({ weekday: 'short' }, b.start) : F.monthDay(b.start)
}
export const compact = (v: number) => new Intl.NumberFormat(intlTag(), { notation: 'compact', maximumFractionDigits: 1 }).format(v)

/** How much of the family colour each macro keeps over the surface: one hue, three steps. The same numbers paint the DOM swatches. */
export const MACRO_TINT: Record<MacroKind, number> = { dietary_protein: 100, dietary_carbohydrates: 62, dietary_fat_total: 34 }
export const macroCss = (kind: MacroKind) => `color-mix(in srgb, var(--c-nutrition) ${MACRO_TINT[kind]}%, var(--surface))`
// ECharts cannot tween a `color-mix()`, so the canvas gets the mixed hex
function mix(hex: string, over: string, pct: number): string {
  // a minifier can shorten a token to three digits ("#fff")
  const ch = (h: string, i: number) => h.length === 4 ? parseInt(h[1 + i] + h[1 + i], 16) : parseInt(h.slice(1 + i * 2, 3 + i * 2), 16)
  return '#' + [0, 1, 2].map(i => Math.round(ch(hex, i) * pct / 100 + ch(over, i) * (1 - pct / 100)).toString(16).padStart(2, '0')).join('')
}

const xAxis = (of: Buckets) => ({
  type: 'category' as const, data: of.points.map(p => bucketLabel(p, of, false)), boundaryGap: true, ...axisChrome(), splitLine: { show: false },
  axisLabel: { ...axisLabel(), hideOverlap: true, interval: of.points.length <= 7 ? 0 : 'auto' },
})
const yAxis = () => ({ type: 'value' as const, min: 0, splitNumber: 3, ...axisChrome(), axisLabel: { ...axisLabel(), formatter: compact } })
const grid = { left: 8, right: 12, top: 14, bottom: 4, containLabel: true }
const tooltip = (formatter: (index: number) => string) => {
  const tk = tokens()
  return { ...(base().tooltip as object), axisPointer: { type: 'shadow', shadowStyle: { color: tk.band } }, formatter: (params: any) => formatter((Array.isArray(params) ? params[0] : params).dataIndex) }
}
const noLog = () => `<div style="color:${token('--ash')}">${t('nutrition.tip_no_log')}</div>`
const daysNote = (of: Buckets, b: Bucket) => of.size === 'day' ? '' : `<div style="color:${token('--ash')};font-size:11px;margin-top:4px">${t('nutrition.tip_mean_of', { n: b.n })}</div>`

/** Intake as bars and energy burned as a short horizontal marker on the same day. `burned` has the buckets of `intake`. */
export function energyOption(intake: Buckets, burned: Buckets): Option {
  const tk = tokens(), n = intake.points.length
  return {
    ...base(), grid, xAxis: xAxis(intake), yAxis: yAxis(),
    tooltip: tooltip(i => {
      const a = intake.points[i], b = burned.points[i]
      if (!a) return ''
      if (a.value == null) return tipHead(bucketLabel(a, intake, true)) + noLog()
      const rows = [tipHead(bucketLabel(a, intake, true)), tipRow(F.num(a.value), `kcal · ${t('nutrition.intake')}`)]
      if (b?.value != null) rows.push(tipRow(F.num(b.value), `kcal · ${t('nutrition.burned')}`), tipRow(F.signed(a.value - b.value), `kcal · ${t('nutrition.tip_difference')}`))
      return rows.join('') + daysNote(intake, a)
    }),
    series: [
      { id: 'in', type: 'bar', data: intake.points.map(p => p.value), itemStyle: { color: token('--c-nutrition'), borderRadius: [3, 3, 0, 0] }, barMaxWidth: 26, barCategoryGap: n > 40 ? '18%' : '30%' },
      { id: 'out', type: 'line', data: burned.points.map(p => p.value), connectNulls: false, symbol: 'rect', symbolSize: [n <= 14 ? 30 : n <= 45 ? 14 : 8, 3], showSymbol: true,
        lineStyle: { width: 0 }, itemStyle: { color: tk.activity, borderColor: tk.surface, borderWidth: 1 }, emphasis: { disabled: true }, z: 3 },
    ],
  }
}

/** Energy from protein, carbohydrates and fat, stacked. The three series share the buckets of the first. */
export function macroOption(parts: Record<MacroKind, Buckets>): Option {
  const tk = tokens(), first = parts[MACROS[0].kind], n = first.points.length, green = token('--c-nutrition')
  return {
    ...base(), grid, xAxis: xAxis(first), yAxis: yAxis(),
    tooltip: tooltip(i => {
      const b = first.points[i]
      if (!b) return ''
      if (b.value == null) return tipHead(bucketLabel(b, first, true)) + noLog()
      const total = MACROS.reduce((a, m) => a + (parts[m.kind].points[i].value ?? 0), 0)
      return tipHead(bucketLabel(b, first, true))
        + MACROS.map(m => { const v = parts[m.kind].points[i].value ?? 0; return tipRow(F.num(v), `kcal · ${kindTitle(m.kind)} · ${F.num(total ? v / total * 100 : 0)}%`) }).join('')
        + daysNote(first, b)
    }),
    series: MACROS.map((m, i) => ({
      id: m.kind, type: 'bar', stack: 'macros', data: parts[m.kind].points.map(p => p.value),
      itemStyle: { color: mix(green, tk.surface, MACRO_TINT[m.kind]), borderColor: tk.surface, borderWidth: 0.5, borderRadius: i === MACROS.length - 1 ? [3, 3, 0, 0] : 0 },
      barMaxWidth: 26, barCategoryGap: n > 40 ? '18%' : '30%',
    })),
  }
}
