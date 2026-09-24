// ECharts, set up once with the page's tokens. Every chart on the site goes through
// `theme()` so grids, axes, tooltips, and marks share one look: hairline solid grid,
// 2px lines, small filled markers, recessive axes, one tooltip listing every series.
import * as echarts from 'echarts/core'
import { LineChart, BarChart, CustomChart, ScatterChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, MarkLineComponent, MarkAreaComponent, LegendComponent, DataZoomComponent, AxisPointerComponent, GraphicComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([LineChart, BarChart, CustomChart, ScatterChart, GridComponent, TooltipComponent, MarkLineComponent, MarkAreaComponent, LegendComponent, DataZoomComponent, AxisPointerComponent, GraphicComponent, CanvasRenderer])

export { echarts }

export function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

export function tokens() {
  return {
    ink: token('--ink'), ash: token('--ash'), mute: token('--mute'), rule: token('--rule'), ruleStrong: token('--rule-strong'),
    surface: token('--surface'), signal: token('--signal'), ember: token('--ember'), slate: token('--slate'),
    deep: token('--deep'), core: token('--core'), rem: token('--rem'), awake: token('--awake'),
    good: token('--good'), warn: token('--warn'), alert: token('--alert'), band: token('--band'),
    font: token('--font'), mono: token('--mono'),
  }
}

/** The shared chrome. Spread into every option. */
export function base(): echarts.EChartsCoreOption {
  const t = tokens()
  return {
    animation: false,
    textStyle: { fontFamily: t.font, color: t.ash },
    color: [t.signal, t.ember, t.slate],
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: t.ruleStrong, width: 1 }, label: { show: false } },
      backgroundColor: t.surface, borderColor: t.ruleStrong, borderWidth: 1,
      textStyle: { color: t.ink, fontFamily: t.font, fontSize: 12 },
      padding: [8, 10], extraCssText: 'box-shadow: 0 8px 24px rgba(0,0,0,.18); border-radius: 8px;',
    },
  }
}

export const axisChrome = () => {
  const t = tokens()
  return {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: t.ash, fontFamily: t.mono, fontSize: 11 },
    splitLine: { show: true, lineStyle: { color: t.rule, width: 1, type: 'solid' as const } },
  }
}

export const xTime = (min: number, max: number, extra: Record<string, unknown> = {}) => ({
  type: 'time' as const, min, max, ...axisChrome(), splitLine: { show: false }, axisLabel: { ...axisChrome().axisLabel, hideOverlap: true }, ...extra,
})

export const yValue = (extra: Record<string, unknown> = {}) => ({ type: 'value' as const, scale: true, ...axisChrome(), ...extra })

export const fmtTime = (ms: number) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
export const fmtDay = (ms: number) => { const d = new Date(ms); return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]} ${d.getDate()}` }

/** Svelte action: `use:chart={option}`; re-sets the option on change, resizes with the box. */
export function chart(el: HTMLElement, params: { option: echarts.EChartsCoreOption; group?: string }) {
  let inst = echarts.init(el, undefined, { renderer: 'canvas' })
  inst.setOption(params.option, { notMerge: true })
  if (params.group) { inst.group = params.group; echarts.connect(params.group) }
  const ro = new ResizeObserver(() => inst.resize())
  ro.observe(el)
  const mq = matchMedia('(prefers-color-scheme: dark)')
  const onScheme = () => { inst.setOption(params.option, { notMerge: true }) }
  mq.addEventListener('change', onScheme)
  return {
    update(p: { option: echarts.EChartsCoreOption; group?: string }) {
      params = p
      inst.setOption(p.option, { notMerge: true })
      if (p.group) { inst.group = p.group; echarts.connect(p.group) }
    },
    destroy() { ro.disconnect(); mq.removeEventListener('change', onScheme); inst.dispose() },
  }
}
