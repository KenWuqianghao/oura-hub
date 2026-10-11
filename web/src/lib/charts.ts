// ECharts, set up once with the page's tokens. Every chart on the site spreads
// `base()` so grids, axes, tooltips, and motion share one look: hairline grid,
// recessive axes in the system font, one tooltip listing every series.
import * as echarts from 'echarts/core'
import { LineChart, BarChart, CustomChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, MarkLineComponent, MarkAreaComponent, LegendComponent, AxisPointerComponent, GraphicComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { theme } from './theme.svelte'
import { intlTag } from './i18n.svelte'
import type { BucketSize } from './range'
import * as F from './fmt'

echarts.use([LineChart, BarChart, CustomChart, GridComponent, TooltipComponent, MarkLineComponent, MarkAreaComponent, LegendComponent, AxisPointerComponent, GraphicComponent, CanvasRenderer])

export { echarts }
export type Option = echarts.EChartsCoreOption

/** The value of a CSS custom property on :root, for the current scheme. */
export function token(name: string): string {
  void theme.dark
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}
/** A colour prop for a chart: a token name ("--c-heart"), "var(--c-heart)", or any CSS colour. */
export function color(c: string): string {
  return c.startsWith('--') ? token(c) : c.startsWith('var(') ? token(c.slice(4, -1)) : c
}

export function tokens() {
  return {
    ink: token('--ink'), ash: token('--ash'), mute: token('--mute'), rule: token('--rule'), ruleStrong: token('--rule-strong'),
    surface: token('--surface'), raised: token('--raised'), band: token('--band'),
    ring: token('--ring'), watch: token('--watch'),
    activity: token('--c-activity'), heart: token('--c-heart'), sleep: token('--c-sleep'), body: token('--c-body'), respiratory: token('--c-respiratory'),
    deep: token('--deep'), core: token('--core'), rem: token('--rem'), awake: token('--awake'),
    font: token('--font'),
  }
}

/** The shared chrome. Spread into every option. */
export function base(): Option {
  const t = tokens()
  return {
    animation: !theme.reduced,
    animationDuration: 500, animationEasing: 'cubicOut',
    animationDurationUpdate: 300, animationEasingUpdate: 'cubicInOut',
    textStyle: { fontFamily: t.font, color: t.ash },
    tooltip: {
      trigger: 'axis', transitionDuration: theme.reduced ? 0 : 0.12, confine: true,
      axisPointer: { type: 'line', lineStyle: { color: t.ruleStrong, width: 1 }, label: { show: false } },
      backgroundColor: t.raised, borderColor: t.rule, borderWidth: 1,
      textStyle: { color: t.ink, fontFamily: t.font, fontSize: 12 },
      padding: [8, 10], extraCssText: 'box-shadow: 0 8px 28px rgba(0,0,0,.16); border-radius: 10px; font-variant-numeric: tabular-nums;',
    },
  }
}

export const axisLabel = () => { const t = tokens(); return { color: t.ash, fontFamily: t.font, fontSize: 11 } }
export const axisChrome = () => {
  const t = tokens()
  return {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: axisLabel(),
    splitLine: { show: true, lineStyle: { color: t.rule, width: 1, type: 'solid' as const } },
  }
}

export const xTime = (min: number, max: number, extra: Record<string, unknown> = {}) => ({
  type: 'time' as const, min, max, ...axisChrome(), splitLine: { show: false }, axisLabel: { ...axisLabel(), hideOverlap: true }, ...extra,
})
export const yValue = (extra: Record<string, unknown> = {}) => ({ type: 'value' as const, scale: true, ...axisChrome(), ...extra })

/** The first line of a tooltip: the time or the date, in secondary ink. */
export const tipHead = (text: string) => `<div style="color:${token('--ash')};font-size:11px;margin-bottom:4px">${text}</div>`
/** One tooltip row: a bold value and its unit or label. */
export const tipRow = (value: string, label: string) => `<div><b>${value}</b> <span style="color:${token('--ash')}">${label}</span></div>`

const fmtDay = (opts: Intl.DateTimeFormatOptions, ymd: string) => new Intl.DateTimeFormat(intlTag(), opts).format(F.parseYmd(ymd) ?? new Date())
/** A mark in full, for a tooltip: the day with its weekday, the dates of a week, or the month with its year. */
export function bucketLabel(b: { start: string; end: string }, size: BucketSize): string {
  if (size === 'month') return fmtDay({ year: 'numeric', month: 'long' }, b.start)
  if (size === 'week') return F.dateRange(b.start, b.end)
  return fmtDay({ weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }, b.start)
}

/**
 * The axis text of each mark, and the marks that get one. Up to seven days: every
 * weekday. More days: about seven dates, counted back from the newest. Weeks and
 * months: the first mark of a month, every few months counted from January, so
 * January is always there and reads as its year. Many years: years only.
 */
function ticks(starts: string[], size: BucketSize): { label: string; show: boolean }[] {
  const n = starts.length
  if (size === 'day') {
    if (n <= 7) return starts.map(s => ({ label: fmtDay({ weekday: 'short' }, s), show: true }))
    const step = Math.ceil(n / 7)
    let year = ''
    return starts.map((s, i) => {
      if ((n - 1 - i) % step) return { label: '', show: false }
      const label = year && s.slice(0, 4) !== year ? F.fullDateOf(F.dayStartMs(s)) : F.monthDay(s)
      year = s.slice(0, 4)
      return { label, show: true }
    })
  }
  const index = (s: string) => +s.slice(0, 4) * 12 + +s.slice(5, 7) - 1
  const months = n ? index(starts[n - 1]) - index(starts[0]) + 1 : 0
  const every = [1, 2, 3, 4, 6, 12, 24, 60].find(e => Math.ceil(months / e) <= (e >= 12 ? 12 : 7)) ?? 120
  return starts.map((s, i) => {
    const m = index(s), first = i === 0 ? size === 'month' : index(starts[i - 1]) !== m
    if (!first || m % every) return { label: '', show: false }
    return { label: fmtDay(every >= 12 || m % 12 === 0 ? { year: 'numeric' } : { month: 'short' }, s), show: true }
  })
}

/** The x axis of a chart with one mark per day, week, or month. Every category chart of the site uses it, so the dates read the same everywhere. */
export function bucketAxis(points: { start: string }[], size: BucketSize, extra: Record<string, unknown> = {}) {
  const tk = ticks(points.map(p => p.start), size)
  return {
    type: 'category' as const, data: tk.map(x => x.label), ...axisChrome(), splitLine: { show: false },
    axisLabel: { ...axisLabel(), hideOverlap: true, interval: (i: number) => tk[i]?.show ?? false }, ...extra,
  }
}

/** An axis number in little room: "6.5K", "1.2万". */
export const compact = (v: number, decimals = 0) => new Intl.NumberFormat(intlTag(), { notation: 'compact', maximumFractionDigits: Math.abs(v) < 10 ? Math.max(decimals, 1) : 1 }).format(v)

/**
 * A y axis that fits the values from `lo` to `hi` with a little room, on round
 * numbers, in about three steps. One value alone gets a narrow axis around it, not
 * an axis from zero. For lines and range bars; a bar axis starts at zero.
 */
export function fitAxis(lo: number | null, hi: number | null, decimals = 0): { min?: number; max?: number; interval?: number } {
  if (lo == null || hi == null || !Number.isFinite(lo) || !Number.isFinite(hi)) return {}
  const unit = 10 ** -decimals
  const pad = Math.max((hi - lo) * 0.12, Math.abs(hi) * 0.02, unit)
  const raw = (hi - lo + 2 * pad) / 3, pow = 10 ** Math.floor(Math.log10(raw))
  const step = Math.max(unit, [1, 2, 2.5, 5, 10].map(m => m * pow).find(s => s >= raw) ?? raw)
  // the step is a float product: round the ends to the step's own digits
  const digits = Math.max(0, -Math.floor(Math.log10(step)) + 1), round = (v: number) => +v.toFixed(digits)
  const min = round(Math.floor((lo - pad) / step) * step)
  return { min: lo >= 0 ? Math.max(0, min) : min, max: round(Math.ceil((hi + pad) / step) * step), interval: step }
}

const list = (v: unknown): any[] => v == null ? [] : Array.isArray(v) ? v : [v]
// The parts of an option that ECharts cannot merge in place: when one of them
// changes, the chart is built again; when none does, the new data morphs in.
const shape = (o: Option) => JSON.stringify([
  list(o.series).map(s => [s.type, s.id ?? s.name ?? '', s.xAxisIndex ?? 0, s.yAxisIndex ?? 0]),
  list(o.grid).length, list(o.xAxis).map(a => a.type), list(o.yAxis).map(a => a.type),
])

/** Svelte action: `use:chart={{ option }}`. A data change morphs; a change of structure replaces. Resizes with the box. */
export function chart(el: HTMLElement, params: { option: Option; group?: string }) {
  const inst = echarts.init(el, undefined, { renderer: 'canvas' })
  let current = ''
  const apply = (p: { option: Option; group?: string }) => {
    const next = shape(p.option)
    inst.setOption(p.option, next === current ? { replaceMerge: ['graphic'] } : { notMerge: true })
    current = next
    if (p.group) { inst.group = p.group; echarts.connect(p.group) }
  }
  apply(params)
  const ro = new ResizeObserver(() => inst.resize())
  ro.observe(el)
  return { update: apply, destroy() { ro.disconnect(); inst.dispose() } }
}
