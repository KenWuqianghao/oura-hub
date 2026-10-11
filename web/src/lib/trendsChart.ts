// The chart of a ring metric on the Trends page: one value per wake day, the
// 7-day mean over it, and the personal baseline with its ±5% band.
import type { DayPoint } from './api'
import { base, tokens, color as cssColor, axisChrome, axisLabel, tipHead, tipRow, type Option } from './charts'
import { rolling } from './range'
import { t } from './i18n.svelte'
import * as F from './fmt'

export interface RingChartInput { days: DayPoint[]; start: string; end: string; baseline: number | null; unit: string; decimals: number }

/** True when the chart draws the 7-day mean: the legend follows it. */
export const hasTrend = (days: DayPoint[]) => days.length > 7

export function ringOption({ days, start, end, baseline, unit, decimals }: RingChartInput): Option {
  const tk = tokens(), col = cssColor('--ring'), trend = hasTrend(days)
  const at = (ymd: string) => F.dayStartMs(ymd)
  const mean = rolling(days.map(d => d.value))
  return {
    ...base(),
    grid: { left: 8, right: 16, top: 16, bottom: 4, containLabel: true },
    xAxis: { type: 'time', min: at(start), max: at(end), minInterval: 86_400_000, ...axisChrome(), splitLine: { show: false }, axisLabel: { ...axisLabel(), formatter: (v: number) => F.monthDayOf(v), hideOverlap: true } },
    yAxis: { type: 'value', scale: true, splitNumber: 4, ...axisChrome() },
    tooltip: {
      ...(base().tooltip as object),
      formatter: (params: any) => {
        const p = Array.isArray(params) ? params : [params]
        if (!p.length) return ''
        return tipHead(F.fullDateOf(p[0].value[0])) + p.map((it: any) => tipRow(F.num(it.value[1], it.seriesId === 'daily' ? decimals : Math.max(decimals, 1)), it.seriesId === 'daily' ? unit : t('charts.mean_7d'))).join('')
      },
    },
    series: [
      {
        id: 'daily', type: 'line', data: days.map(d => [at(d.ymd), d.value]), showSymbol: days.length <= 45, symbol: 'circle', symbolSize: 6,
        lineStyle: { width: trend ? 1.25 : 2, color: col, opacity: trend ? 0.45 : 1 }, itemStyle: { color: col, borderColor: tk.surface, borderWidth: 1.5, opacity: trend ? 0.7 : 1 },
        markLine: { silent: true, symbol: 'none', animation: false, lineStyle: { color: tk.ash, width: 1, type: 'solid' },
          label: { show: true, position: 'insideEndTop', formatter: `${t('charts.baseline')} ${F.num(baseline, decimals)}`, color: tk.ash, fontSize: 11, fontFamily: tk.font },
          data: baseline != null ? [{ yAxis: baseline }] : [] },
        markArea: { silent: true, itemStyle: { color: tk.band }, data: baseline != null ? [[{ yAxis: baseline * 0.95 }, { yAxis: baseline * 1.05 }]] : [] },
      },
      { id: 'mean', type: 'line', data: trend ? days.map((d, i) => [at(d.ymd), mean[i]]) : [], showSymbol: false, lineStyle: { width: 2.5, color: col }, itemStyle: { color: col }, silent: true },
    ],
  }
}
