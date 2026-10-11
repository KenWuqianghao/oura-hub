<script lang="ts">
  // One night: the hypnogram, then heart rate, HRV, skin temperature, blood oxygen,
  // and movement lanes on the same hours. The series come from the ring summary.
  import { chart, base, tokens, xTime, yValue, axisLabel, tipHead, tipRow } from '../lib/charts'
  import type { Night } from '../lib/api'
  import { hmOnDay, stageName, clockOf, num } from '../lib/fmt'
  import { t as tr } from '../lib/i18n.svelte'

  let { night, height = 420 }: { night: Night; height?: number } = $props()
  const H = 3600_000
  const s0 = $derived(night.ymd && night.start ? hmOnDay(night.ymd, night.start) : 0)
  const total = $derived((night.in_bed_h ?? 0) * H)
  const codes = $derived((night.stages_full?.length ? night.stages_full : night.stages) ?? [])
  const runs = $derived.by(() => {
    const out: [number, number, number][] = []
    const per = total / Math.max(codes.length, 1)
    codes.forEach((c, i) => { const last = out[out.length - 1]; if (last && last[2] === c) last[1] = s0 + (i + 1) * per; else out.push([s0 + i * per, s0 + (i + 1) * per, c]) })
    return out
  })
  const spread = (arr: number[] | undefined) => (arr ?? []).map((v, i, a) => [s0 + (i / Math.max(a.length - 1, 1)) * total, v] as [number, number]).filter(p => Number.isFinite(p[1]) && p[1] !== 0)
  const lanes = $derived([
    { id: 'hr', name: tr('charts.lane_hr'), unit: 'bpm', data: spread(night.series?.hr), color: tokens().heart },
    { id: 'hrv', name: tr('charts.lane_hrv'), unit: 'ms', data: spread(night.series?.hrv), color: tokens().heart },
    { id: 'temp', name: tr('charts.lane_temp'), unit: '°C', data: spread(night.series?.temp), color: tokens().body, decimals: 1 },
    { id: 'spo2', name: tr('charts.lane_spo2'), unit: '%', data: spread(night.series?.spo2), color: tokens().respiratory },
    { id: 'motion', name: tr('charts.lane_motion'), unit: tr('charts.motion_unit'), data: spread(night.series?.motion), color: tokens().activity, bars: true },
  ].filter(l => l.data.length > 1))

  const option = $derived.by(() => {
    const t = tokens()
    const stageLevel = (s: number) => s === 1 ? 1 : s === 2 ? 2 : s === 3 ? 3 : 4
    const stageColor = (s: number) => s === 1 ? t.deep : s === 2 ? t.core : s === 3 ? t.rem : t.awake
    const top = 16, hypH = runs.length ? 72 : 0, laneH = Math.max(46, Math.floor((height - top - hypH - 40) / Math.max(lanes.length, 1)) - 10)
    const grids: any[] = []
    if (runs.length) grids.push({ left: 96, right: 20, top, height: hypH })
    lanes.forEach((_, i) => grids.push({ left: 96, right: 20, top: top + (runs.length ? hypH + 14 : 0) + i * (laneH + 10), height: laneH }))
    const n = grids.length
    const xa = grids.map((_, i) => ({ ...xTime(s0, s0 + total), gridIndex: i, show: i === n - 1, axisLabel: { ...axisLabel(), formatter: (v: number) => clockOf(v), hideOverlap: true }, splitLine: { show: true, lineStyle: { color: t.rule, width: 1, type: 'solid' as const } }, splitNumber: 8 }))
    const ya: any[] = []
    if (runs.length) ya.push({ type: 'value', gridIndex: 0, min: 0, max: 4.4, inverse: true, axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false } })
    lanes.forEach((_, i) => ya.push({ ...yValue(), gridIndex: (runs.length ? 1 : 0) + i, splitNumber: 2 }))
    const labels: any[] = []
    if (runs.length) labels.push({ type: 'text', left: 8, top: grids[0].top, z: 10, style: { text: tr('charts.lane_stages'), fill: t.ash, fontSize: 11, fontFamily: t.font } })
    lanes.forEach((l, i) => { const g = grids[(runs.length ? 1 : 0) + i]; labels.push({ type: 'text', left: 8, top: g.top, z: 10, style: { text: l.name, fill: t.ash, fontSize: 11, fontFamily: t.font } }) })
    const series: any[] = []
    if (runs.length) series.push({
      id: 'sleep', type: 'custom', xAxisIndex: 0, yAxisIndex: 0, silent: true, data: runs,
      renderItem: (_p: any, api: any) => {
        const s = api.value(2) as number, level = stageLevel(s)
        const x0 = api.coord([api.value(0), 0])[0], x1 = api.coord([api.value(1), 0])[0]
        const yTop = api.coord([0, level - 0.9])[1], yBot = api.coord([0, 4.4])[1]
        return { type: 'rect', shape: { x: x0, y: yTop, width: Math.max(x1 - x0, 1), height: yBot - yTop }, style: { fill: stageColor(s) } }
      },
    })
    lanes.forEach((l, i) => series.push(l.bars
      ? { id: l.id, type: 'bar', xAxisIndex: (runs.length ? 1 : 0) + i, yAxisIndex: (runs.length ? 1 : 0) + i, data: l.data, itemStyle: { color: l.color, opacity: 0.7 }, barMaxWidth: 6 }
      : { id: l.id, type: 'line', xAxisIndex: (runs.length ? 1 : 0) + i, yAxisIndex: (runs.length ? 1 : 0) + i, data: l.data, showSymbol: false, lineStyle: { width: 1.5, color: l.color }, itemStyle: { color: l.color }, areaStyle: { color: l.color, opacity: 0.08 } }))
    return {
      ...base(), grid: grids, xAxis: xa, yAxis: ya, series, graphic: labels,
      axisPointer: { link: [{ xAxisIndex: 'all' }] },
      tooltip: { ...(base().tooltip as object), formatter: (params: any[]) => {
        const p = Array.isArray(params) ? params : [params]
        if (!p.length) return ''
        const x = p[0].axisValue as number
        const out = [tipHead(clockOf(x))]
        const run = runs.find(r => x >= r[0] && x < r[1]); if (run) out.push(tipRow(stageName(run[2]), ''))
        for (const it of p) { const l = lanes.find(l => l.id === it.seriesId); if (l && it.value) out.push(tipRow(num(it.value[1], l.decimals ?? 0), l.unit)) }
        return out.join('')
      } },
    }
  })
</script>

<div use:chart={{ option }} style="height: {height}px; width: 100%"></div>
