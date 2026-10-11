// The sound level chart of the Body page: the daily mean as a line over the
// lowest-to-highest capsule of the day, with one reference line.
import { base, tokens, token, axisChrome, bucketAxis, bucketLabel, bucketTip, refLine, markLines, tipHead, tipRow, tipNone, type Option } from './charts'
import { bridge, MAX_GAP, type Buckets } from './range'
import { t } from './i18n.svelte'
import * as F from './fmt'

// Headphone samples go down to 0 dB (silence) and would flatten the rest; the tooltip prints the true low.
const FLOOR_DB = 20

export function levelOption(of: Buckets, color: string, ref: number): Option {
  const tk = tokens(), col = token(color), pts = of.points
  const mean = bridge(pts.map(p => p.value), MAX_GAP[of.size])
  return {
    ...base(),
    grid: { left: 8, right: 12, top: 14, bottom: 4, containLabel: true },
    xAxis: bucketAxis(pts, of.size),
    yAxis: { type: 'value', min: FLOOR_DB, max: (v: { max: number }) => Math.max(100, Math.ceil(v.max / 20) * 20), interval: 20, ...axisChrome() },
    tooltip: bucketTip(i => {
      const p = pts[i]
      if (!p) return ''
      if (p.value == null) return tipHead(bucketLabel(p, of.size)) + tipNone()
      return tipHead(bucketLabel(p, of.size)) + tipRow(F.num(p.value), `dB · ${t(of.size === 'day' ? 'body.tip_mean' : 'body.tip_mean_days')}`) + tipRow(`${F.num(p.min)}–${F.num(p.max)}`, `dB · ${t('body.tip_low_high')}`)
    }),
    series: [
      { id: 'span', type: 'custom', clip: true, silent: true, data: pts.map((p, i) => [i, p.min ?? NaN, p.max ?? NaN]), encode: { x: 0, y: [1, 2] },
        renderItem: (_: unknown, api: any) => {
          if (Number.isNaN(api.value(1))) return null
          const lo = api.coord([api.value(0), Math.max(FLOOR_DB, api.value(1))]), hi = api.coord([api.value(0), Math.max(FLOOR_DB, api.value(2))])
          const w = Math.max(2, Math.min(6, api.size([1, 0])[0] * 0.5)), h = Math.max(lo[1] - hi[1], w)
          return { type: 'rect', transition: ['shape'], shape: { x: lo[0] - w / 2, y: hi[1], width: w, height: h, r: w / 2 }, style: { fill: col, opacity: 0.28 } }
        } },
      { id: 'mean', type: 'line', data: mean.line.map((v, i) => mean.filled[i] ? { value: v, symbol: 'none' } : v), connectNulls: false, showSymbol: true, symbol: 'circle', symbolSize: pts.length > 60 ? 4 : 6,
        lineStyle: { width: 2, color: col }, itemStyle: { color: col, borderColor: tk.surface, borderWidth: pts.length > 60 ? 0 : 1.5 }, z: 3,
        markLine: markLines([refLine(ref, `${F.num(ref)} dB`)]) },
    ],
  }
}
