<script lang="ts">
  // The signature: one day on one time axis, from the evening before to midnight.
  // Three stacked plots share the x axis and the crosshair: sleep stages, heart
  // rate, and movement with workouts. Everything the ring and the watch know about
  // the day, in the order it happened.
  import { chart, base, tokens, xTime, yValue, fmtTime } from '../lib/charts'
  import type { Night } from '../lib/api'
  import { hmOnDay, stageName } from '../lib/fmt'

  let { day, dayStart, nights = [], hr = [], profile = [], prevProfile = [], workouts = [] }:
    { day: string; dayStart: number; nights?: Night[]; hr?: [number, number][]; profile?: number[]; prevProfile?: number[]; workouts?: { start: number; end: number; label: string; source: string }[] } = $props()

  const H = 3600_000
  const winStart = $derived(dayStart - 6 * H)
  const winEnd = $derived(dayStart + 24 * H)

  // every sleep in the window, as epochs → [start, end, stage]; a night without a
  // hypnogram still shows its in-bed window as one "awake-colored" block
  const windows = $derived(nights.filter(n => n.ymd && n.start && n.in_bed_h != null).map(n => {
    const s0 = hmOnDay(n.ymd!, n.start!); return { n, s0, s1: s0 + n.in_bed_h! * H }
  }).filter(x => x.s1 > winStart && x.s0 < winEnd))
  const stageRuns = $derived.by(() => {
    const runs: [number, number, number][] = []
    for (const { n, s0, s1 } of windows) {
      const codes = (n.stages_full?.length ? n.stages_full : n.stages) ?? []
      if (codes.length < 2) { runs.push([s0, s1, 0]); continue }
      const per = (s1 - s0) / codes.length
      for (let i = 0; i < codes.length; i++) {
        const last = runs[runs.length - 1]
        if (last && last[2] === codes[i] && last[1] === s0 + i * per) last[1] = s0 + (i + 1) * per
        else runs.push([s0 + i * per, s0 + (i + 1) * per, codes[i]])
      }
    }
    return runs
  })
  const sleepWindows = $derived(windows.map(x => [x.s0, x.s1] as [number, number]))

  const movement = $derived.by(() => {
    const pts: [number, number][] = []
    const prevStart = dayStart - 24 * H
    prevProfile.forEach((v, i) => { const t = prevStart + i * 15 * 60_000; if (t >= winStart) pts.push([t, Math.max(0, v)]) })
    profile.forEach((v, i) => pts.push([dayStart + i * 15 * 60_000, Math.max(0, v)]))
    return pts
  })

  const option = $derived.by(() => {
    const t = tokens()
    const stageLevel = (s: number) => s === 1 ? 1 : s === 2 ? 2 : s === 3 ? 3 : 4
    const stageColor = (s: number) => s === 0 ? t.ruleStrong : s === 1 ? t.deep : s === 2 ? t.core : s === 3 ? t.rem : t.awake
    const grids = [
      { top: 28, height: 84 },
      { top: 140, height: 120 },
      { top: 292, height: 70 },
    ]
    const xa = (i: number, show: boolean) => ({ ...xTime(winStart, winEnd), gridIndex: i, show, axisLabel: { color: t.ash, fontFamily: t.mono, fontSize: 11, formatter: (v: number) => fmtTime(v), hideOverlap: true }, splitLine: { show: true, lineStyle: { color: t.rule, width: 1, type: 'solid' as const } }, splitNumber: 10 })
    return {
      ...base(),
      grid: grids.map(g => ({ left: 56, right: 24, ...g })),
      axisPointer: { link: [{ xAxisIndex: 'all' }], lineStyle: { color: t.ruleStrong } },
      tooltip: {
        ...(base().tooltip as object),
        formatter: (params: any[]) => {
          const p = Array.isArray(params) ? params : [params]
          if (!p.length) return ''
          const x = p[0].axisValue as number
          const lines = [`<div style="color:${t.ash};font-family:${t.mono};font-size:11px;margin-bottom:4px">${fmtTime(x)}</div>`]
          const run = stageRuns.find(r => x >= r[0] && x < r[1])
          if (run) lines.push(`<div><b>${run[2] ? stageName(run[2]) : 'In bed'}</b> <span style="color:${t.ash}">${run[2] ? 'sleep' : 'no stages yet'}</span></div>`)
          for (const item of p) {
            if (item.seriesName === 'Heart rate' && item.value) lines.push(`<div><b>${Math.round(item.value[1])}</b> <span style="color:${t.ash}">bpm</span></div>`)
            if (item.seriesName === 'Movement' && item.value) lines.push(`<div><b>${(item.value[1] as number).toFixed(1)}</b> <span style="color:${t.ash}">MET above rest</span></div>`)
          }
          const w = workouts.find(w => x >= w.start && x <= w.end)
          if (w) lines.push(`<div><b>${w.label}</b> <span style="color:${t.ash}">${w.source}</span></div>`)
          return lines.join('')
        },
      },
      xAxis: [xa(0, false), xa(1, false), xa(2, true)],
      yAxis: [
        { type: 'value', gridIndex: 0, min: 0, max: 4.4, inverse: true, axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false } },
        { ...yValue(), gridIndex: 1, splitNumber: 3, axisLabel: { color: t.ash, fontFamily: t.mono, fontSize: 11, formatter: (v: number) => `${v}` } },
        { ...yValue(), gridIndex: 2, min: 0, splitNumber: 2, axisLabel: { color: t.ash, fontFamily: t.mono, fontSize: 11 } },
      ],
      series: [
        {
          name: 'Sleep', type: 'custom', xAxisIndex: 0, yAxisIndex: 0, silent: true,
          data: stageRuns,
          renderItem: (_p: any, api: any) => {
            const s = api.value(2) as number
            const level = stageLevel(s)
            const x0 = api.coord([api.value(0), 0])[0], x1 = api.coord([api.value(1), 0])[0]
            const yTop = api.coord([0, level - 0.9])[1], yBot = api.coord([0, 4.4])[1]
            return { type: 'rect', shape: { x: x0, y: yTop, width: Math.max(x1 - x0, 1), height: yBot - yTop }, style: { fill: stageColor(s) } }
          },
        },
        {
          name: 'Heart rate', type: 'line', xAxisIndex: 1, yAxisIndex: 1, data: hr, showSymbol: false, symbolSize: 8,
          lineStyle: { width: 1.5, color: t.slate }, itemStyle: { color: t.slate }, sampling: 'lttb', connectNulls: false,
          markArea: sleepWindows.length ? { silent: true, itemStyle: { color: t.band }, data: sleepWindows.map(([a, b]) => [{ xAxis: a }, { xAxis: b }]) } : undefined,
        },
        {
          name: 'Movement', type: 'line', xAxisIndex: 2, yAxisIndex: 2, data: movement, showSymbol: false, smooth: 0.3,
          lineStyle: { width: 1.5, color: t.ember }, itemStyle: { color: t.ember }, areaStyle: { color: t.ember, opacity: 0.12 },
          markArea: workouts.length ? {
            silent: true, itemStyle: { color: t.ember, opacity: 0.18 },
            label: { show: true, position: 'insideTop', color: t.ink, fontSize: 11, fontFamily: t.font },
            data: workouts.map(w => [{ xAxis: w.start, name: w.label }, { xAxis: w.end }]),
          } : undefined,
        },
      ],
    }
  })
</script>

<div class="panel">
  <div class="panel-head">
    <h2 style="margin:0">The day, hour by hour</h2>
    <span class="sub small">from the evening before · {day}</span>
    <span class="spacer" style="flex:1"></span>
    <span class="legend">
      <span><span class="sw" style="background:var(--deep)"></span>Deep</span>
      <span><span class="sw" style="background:var(--core)"></span>Core</span>
      <span><span class="sw" style="background:var(--rem)"></span>REM</span>
      <span><span class="sw" style="background:var(--awake)"></span>Awake</span>
      <span><span class="ln" style="background:var(--slate)"></span>Heart rate (watch)</span>
      <span><span class="ln" style="background:var(--ember)"></span>Movement (ring)</span>
    </span>
  </div>
  <div class="panel-body">
    <div style="position:relative">
      <div style="position:absolute; left: 18px; top: 4px; font-size: 11px; color: var(--mute)">Sleep</div>
      <div style="position:absolute; left: 18px; top: 116px; font-size: 11px; color: var(--mute)">bpm</div>
      <div style="position:absolute; left: 18px; top: 268px; font-size: 11px; color: var(--mute)">MET</div>
      {#if !stageRuns.length}<div class="small muted" style="position:absolute; left: 50%; top: 58px; transform: translateX(-50%)">No night for this day yet</div>{/if}
      {#if !hr.length}<div class="small muted" style="position:absolute; left: 50%; top: 190px; transform: translateX(-50%)">No watch heart rate for this day</div>{/if}
      {#if !movement.length}<div class="small muted" style="position:absolute; left: 50%; top: 318px; transform: translateX(-50%)">No ring movement for this day</div>{/if}
      <div use:chart={{ option }} style="height: 392px; width: 100%"></div>
    </div>
  </div>
</div>
