// The chart options of the Nutrition page. A mark is one day up to about 90 days,
// then the mean of the logged days of a week or of a month (the rule of `range.ts`).
import { base, tokens, token, axisChrome, axisLabel, bucketAxis, bucketLabel, bucketTip, compact, tipHead, tipRow, tipNone, tipNote, type Option } from './charts'
import type { Bucket, Buckets } from './range'
import { MACROS, type MacroKind } from './nutrition'
import { kindTitle } from './kinds'
import { t } from './i18n.svelte'
import * as F from './fmt'

/** How much of the family colour each macro keeps over the surface: one hue, three steps. The same numbers paint the DOM swatches. */
export const MACRO_TINT: Record<MacroKind, number> = { dietary_protein: 100, dietary_carbohydrates: 62, dietary_fat_total: 34 }
export const macroCss = (kind: MacroKind) => `color-mix(in srgb, var(--c-nutrition) ${MACRO_TINT[kind]}%, var(--surface))`
// ECharts cannot tween a `color-mix()`, so the canvas gets the mixed hex
function mix(hex: string, over: string, pct: number): string {
  // a minifier can shorten a token to three digits ("#fff")
  const ch = (h: string, i: number) => h.length === 4 ? parseInt(h[1 + i] + h[1 + i], 16) : parseInt(h.slice(1 + i * 2, 3 + i * 2), 16)
  return '#' + [0, 1, 2].map(i => Math.round(ch(hex, i) * pct / 100 + ch(over, i) * (1 - pct / 100)).toString(16).padStart(2, '0')).join('')
}

const yAxis = () => ({ type: 'value' as const, min: 0, splitNumber: 3, ...axisChrome(), axisLabel: { ...axisLabel(), formatter: (v: number) => compact(v) } })
const grid = { left: 8, right: 12, top: 14, bottom: 4, containLabel: true }
const noLog = () => tipNone(t('nutrition.tip_no_log'))
const daysNote = (of: Buckets, b: Bucket) => of.size === 'day' ? '' : tipNote(t('nutrition.tip_mean_of', { n: b.n }))

/** Intake as bars and energy burned as a short horizontal marker on the same day. `burned` has the buckets of `intake`. */
export function energyOption(intake: Buckets, burned: Buckets): Option {
  const tk = tokens(), n = intake.points.length
  return {
    ...base(), grid, xAxis: bucketAxis(intake.points, intake.size), yAxis: yAxis(),
    tooltip: bucketTip(i => {
      const a = intake.points[i], b = burned.points[i]
      if (!a) return ''
      if (a.value == null) return tipHead(bucketLabel(a, intake.size)) + noLog()
      const rows = [tipHead(bucketLabel(a, intake.size)), tipRow(F.num(a.value), `kcal · ${t('nutrition.intake')}`)]
      if (b?.value != null) rows.push(tipRow(F.num(b.value), `kcal · ${t('nutrition.burned')}`), tipRow(F.signed(Math.round(a.value) - Math.round(b.value)), `kcal · ${t('nutrition.tip_difference')}`))
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
    ...base(), grid, xAxis: bucketAxis(first.points, first.size), yAxis: yAxis(),
    tooltip: bucketTip(i => {
      const b = first.points[i]
      if (!b) return ''
      if (b.value == null) return tipHead(bucketLabel(b, first.size)) + noLog()
      const total = MACROS.reduce((a, m) => a + (parts[m.kind].points[i].value ?? 0), 0)
      return tipHead(bucketLabel(b, first.size))
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
