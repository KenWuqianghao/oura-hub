// ECharts, set up once with the page's tokens. Every chart on the site spreads
// `base()` so grids, axes, tooltips, and motion share one look: hairline grid,
// recessive axes in the system font, one tooltip listing every series.
import * as echarts from 'echarts/core'
import { LineChart, BarChart, CustomChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, MarkLineComponent, MarkAreaComponent, LegendComponent, AxisPointerComponent, GraphicComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { theme } from './theme.svelte'

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
