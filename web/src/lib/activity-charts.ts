// Chart options of the Activity page: the compact bars of a daily measure and the
// stacked training minutes. Call them inside `$derived`, so they follow the
// language and the colour scheme.
import { base, tokens, color as cssColor, axisChrome, axisLabel, tipHead, tipRow, type Option } from './charts'
import { t, intlTag } from './i18n.svelte'
import { activityTitle } from './kinds'
import { OTHER, type Training } from './activity'
import type { Buckets } from './range'
import * as F from './fmt'

const fmt = (opts: Intl.DateTimeFormatOptions, ymd: string) => new Intl.DateTimeFormat(intlTag(), opts).format(F.parseYmd(ymd) ?? new Date())
/** The label of one mark that stands for a day, a week, or a month. `long` is for a tooltip, the short form for an axis of `count` marks. */
export function markLabel(b: { start: string; end: string }, size: 'day' | 'week' | 'month', count: number, long: boolean): string {
  if (size === 'month') return long ? fmt({ year: 'numeric', month: 'long' }, b.start) : fmt(b.start.slice(5, 7) === '01' ? { year: 'numeric' } : { month: 'short' }, b.start)
  if (size === 'week') return long ? F.dateRange(b.start, b.end) : fmt({ month: 'short', day: 'numeric' }, b.start)
  if (long) return fmt({ weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }, b.start)
  return fmt(count <= 7 ? { weekday: 'short' } : { month: 'short', day: 'numeric' }, b.start)
}
export const compact = (v: number, decimals = 0) => new Intl.NumberFormat(intlTag(), { notation: 'compact', maximumFractionDigits: Math.abs(v) < 10 ? Math.max(decimals, 1) : 1 }).format(v)

const categoryAxis = (labels: string[]) => ({
  type: 'category', data: labels, ...axisChrome(), splitLine: { show: false },
  axisLabel: { ...axisLabel(), hideOverlap: true, interval: labels.length <= 7 ? 0 : 'auto' },
})
const shadowTip = () => { const tk = tokens(); return { ...(base().tooltip as object), axisPointer: { type: 'shadow', shadowStyle: { color: tk.band } } } }
const index = (params: unknown): number => (Array.isArray(params) ? params[0] : params).dataIndex

/** Bars of one daily measure with a dashed line at `mean`, the daily average the caption shows. */
export function dayBarsOption(buckets: Buckets, o: { color: string; decimals: number; unit: string; mean: number | null }): Option {
  const tk = tokens(), pts = buckets.points
  return {
    ...base(),
    grid: { left: 4, right: 4, top: 8, bottom: 2, containLabel: true },
    xAxis: categoryAxis(pts.map(p => markLabel(p, buckets.size, pts.length, false))),
    yAxis: { type: 'value', min: 0, splitNumber: 2, ...axisChrome(), axisLabel: { ...axisLabel(), formatter: (v: number) => compact(v, o.decimals) } },
    tooltip: { ...shadowTip(), formatter: (params: unknown) => {
      const p = pts[index(params)]
      if (!p) return ''
      const head = tipHead(markLabel(p, buckets.size, pts.length, true))
      if (p.value == null) return head + `<div style="color:${tk.ash}">${t('common.no_data')}</div>`
      return head + tipRow(F.num(p.value, o.decimals), [o.unit, buckets.averaged ? t('charts.daily_average') : ''].filter(Boolean).join(' · '))
    } },
    series: [{
      id: 'v', type: 'bar', data: pts.map(p => p.value), itemStyle: { color: cssColor(o.color), borderRadius: [2, 2, 0, 0] }, barMaxWidth: 18, barCategoryGap: pts.length > 40 ? '18%' : '30%',
      markLine: { silent: true, symbol: 'none', animation: false, label: { show: false }, data: o.mean != null ? [{ yAxis: o.mean, lineStyle: { color: tk.ash, width: 1, type: [4, 3] } }] : [] },
    }],
  }
}

// the built CSS shortens "#ffffff" to "#fff"
const rgb = (hex: string) => hex.length === 4 ? [1, 2, 3].map(i => parseInt(hex[i] + hex[i], 16)) : [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
/** `share` of colour `a` over colour `b`, both hex tokens. */
const mix = (a: string, b: string, share: number) => { const x = rgb(a), y = rgb(b); return `rgb(${x.map((v, i) => Math.round(v * share + y[i] * (1 - share))).join(', ')})` }
const TINTS = [1, 0.66, 0.44, 0.28]
/** The colours of the stack, in the order of `types`: one hue from strong to light, and grey for the rest. */
export function trainingColors(types: string[]): string[] {
  const tk = tokens()
  let slot = 0
  return types.map(type => type === OTHER ? mix(tk.mute, tk.surface, 0.6) : mix(tk.activity, tk.surface, TINTS[slot++] ?? 0.28))
}
/** The hub sends "activity_31" for a HealthKit type it has no name for: show the number, so two such types stay apart. */
export function workoutTitle(activity: string): string {
  const id = /^activity_(\d+)$/.exec(activity)?.[1]
  return id ? t('activity.unnamed_type', { n: id }) : activityTitle(activity)
}
export const trainingTitle = (type: string) => type === OTHER ? t('activity.other_types') : workoutTitle(type)

const SLOTS = 5
/** Training time for each bucket, stacked by type. The axis is in hours when a bucket holds four hours or more. The series count is fixed, so a range change morphs the bars. */
export function trainingOption(tr: Training): Option {
  const tk = tokens(), colors = trainingColors(tr.types), n = tr.buckets.length
  const hours = Math.max(0, ...tr.buckets.map((_, i) => tr.types.reduce((a, type) => a + tr.minutes[type][i], 0))) >= 240
  return {
    ...base(),
    grid: { left: 8, right: 12, top: 14, bottom: 4, containLabel: true },
    xAxis: categoryAxis(tr.buckets.map(b => markLabel(b, tr.size, n, false))),
    yAxis: { type: 'value', min: 0, splitNumber: 3, minInterval: 1, ...axisChrome(), axisLabel: { ...axisLabel(), formatter: (v: number) => `${F.num(v)} ${t(hours ? 'common.hr' : 'common.min')}` } },
    tooltip: { ...shadowTip(), formatter: (params: unknown) => {
      const i = index(params), b = tr.buckets[i]
      if (!b) return ''
      const rows = tr.types.map((type, k) => ({ type, k, min: tr.minutes[type][i] })).filter(r => r.min > 0).reverse()
      const total = rows.reduce((a, r) => a + r.min, 0)
      return tipHead(markLabel(b, tr.size, n, true))
        + (rows.length ? '' : `<div style="color:${tk.ash}">${t('activity.no_training')}</div>`)
        + rows.map(r => `<div><span style="display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:6px;background:${colors[r.k]}"></span><b>${F.minutesText(r.min)}</b> <span style="color:${tk.ash}">${trainingTitle(r.type)}</span></div>`).join('')
        + (rows.length > 1 ? `<div style="margin-top:4px;border-top:1px solid ${tk.rule};padding-top:4px"><b>${F.minutesText(total)}</b> <span style="color:${tk.ash}">${t('common.stat_total')}</span></div>` : '')
    } },
    series: Array.from({ length: SLOTS }, (_, k) => ({
      id: `s${k}`, type: 'bar', stack: 'min', data: k < tr.types.length ? tr.minutes[tr.types[k]].map(m => hours ? m / 60 : m) : tr.buckets.map(() => 0),
      itemStyle: { color: colors[k] ?? 'transparent', borderColor: tk.surface, borderWidth: 1, borderRadius: 2 }, barMaxWidth: 30, barCategoryGap: n > 40 ? '16%' : '30%',
    })),
  }
}
