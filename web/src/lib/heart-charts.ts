// Chart options of the Heart page: the daily heart rate range, and the ring's
// nightly low against the Watch's resting heart rate.
import { base, tokens, axisChrome, axisLabel, bucketAxis, bucketLabel, bucketTip, fitAxis, xTime, yValue, tipHead, tipRow, tipNone, tipSwatch, type Option } from './charts'
import { withBreaks } from './heart'
import { t } from './i18n.svelte'
import type { Buckets } from './range'
import type { DayPoint, TrendPoint } from './api'
import * as F from './fmt'

/** One bar per mark from the lowest to the highest heart rate, with a dot at the mean. A mark with no data stays empty. */
export function heartRangeOption(buckets: Buckets): Option {
  const tk = tokens(), pts = buckets.points
  const lows = pts.flatMap(p => p.min == null ? [] : [p.min]), highs = pts.flatMap(p => p.max == null ? [] : [p.max])
  return {
    ...base(),
    grid: { left: 8, right: 12, top: 14, bottom: 4, containLabel: true },
    xAxis: bucketAxis(pts, buckets.size),
    yAxis: { type: 'value', scale: true, ...axisChrome(), ...(lows.length ? fitAxis(Math.min(...lows), Math.max(...highs)) : {}) },
    tooltip: bucketTip(i => {
      const p = pts[i]
      if (!p) return ''
      if (p.value == null) return tipHead(bucketLabel(p, buckets.size)) + tipNone()
      return tipHead(bucketLabel(p, buckets.size)) + tipRow(`${F.num(p.min)}–${F.num(p.max)}`, 'bpm') + tipRow(F.num(p.value), t(buckets.size === 'day' ? 'heart.tip_mean' : 'heart.tip_mean_days'))
    }),
    series: [{
      id: 'v', type: 'custom', data: pts.map((p, i) => [i, p.min, p.max, p.value]), encode: { x: 0, y: [1, 2] },
      renderItem: (_: unknown, api: any) => {
        if (api.value(1) == null || Number.isNaN(api.value(1))) return null
        const lo = api.coord([api.value(0), api.value(1)]), hi = api.coord([api.value(0), api.value(2)]), mid = api.coord([api.value(0), api.value(3)])
        const w = Math.max(2, Math.min(10, api.size([1, 0])[0] * 0.6)), h = Math.max(lo[1] - hi[1], w)
        return { type: 'group', children: [
          { type: 'rect', transition: ['shape'], shape: { x: lo[0] - w / 2, y: (lo[1] + hi[1]) / 2 - h / 2, width: w, height: h, r: w / 2 }, style: { fill: tk.heart } },
          { type: 'circle', transition: ['shape'], shape: { cx: mid[0], cy: mid[1], r: Math.max(1.5, Math.min(3, w * 0.36)) }, style: { fill: tk.surface, stroke: tk.ink, lineWidth: 1 } },
        ] }
      },
    }],
  }
}

/** Two lines on one bpm axis: the ring's lowest heart rate of the night and the Watch's resting heart rate of the day. */
export function ringWatchOption(ring: TrendPoint[], watch: DayPoint[], start: string, end: string): Option {
  const tk = tokens(), at = F.dayStartMs
  const line = (id: string, name: string, col: string, points: { ymd: string; value: number }[]) => ({
    id, name, type: 'line', data: withBreaks(points, at), connectNulls: false, showSymbol: points.length <= 62, symbol: 'circle', symbolSize: 6,
    lineStyle: { width: 2, color: col }, itemStyle: { color: col, borderColor: tk.surface, borderWidth: 1.5 },
  })
  return {
    ...base(),
    grid: { left: 8, right: 16, top: 14, bottom: 4, containLabel: true },
    xAxis: xTime(at(start), at(end), { minInterval: 86_400_000, axisLabel: { ...axisLabel(), hideOverlap: true, formatter: (v: number) => F.monthDayOf(v) } }),
    yAxis: yValue({ splitNumber: 4 }),
    tooltip: { ...(base().tooltip as object), formatter: (params: unknown) => {
      const list = (Array.isArray(params) ? params : [params]) as { value: [number, number | null]; seriesName: string; color: string }[]
      const rows = list.filter(p => p.value[1] != null)
      if (!rows.length) return ''
      return tipHead(F.fullDateOf(rows[0].value[0])) + rows.map(p => tipSwatch(p.color, F.num(p.value[1]), `bpm · ${p.seriesName}`, true)).join('')
    } },
    series: [line('ring', t('heart.ring_low'), tk.ring, ring.filter(p => p.ymd >= start)), line('watch', t('heart.watch_rest'), tk.watch, watch.filter(p => p.ymd >= start))],
  }
}
