<script lang="ts">
  import { chart, base, tokens, axisChrome, fmtDay } from '../lib/charts'
  import { api, type Trends, type HealthSample } from '../lib/api'
  import { todayYmd, dayLabel } from '../lib/fmt'

  let { metric = 'hrv_ms' }: { metric?: string } = $props()
  type Def = { id: string; title: string; unit: string; color: string; decimals?: number; about: string; kind?: string; agg?: 'mean' | 'last' | 'sum' | 'min' }
  const RING: Def[] = [
    { id: 'hrv_ms', title: 'HRV', unit: 'ms', color: 'signal', about: 'Nightly average RMSSD from the ring. Compare with your own baseline, not with other people: HRV varies a lot between individuals.' },
    { id: 'rhr', title: 'Lowest heart rate', unit: 'bpm', color: 'signal', about: 'The lowest heart rate of the night. A rise of 5 to 10 bpm above baseline often means strain, alcohol, or the start of an illness.' },
    { id: 'skin_temp', title: 'Skin temperature', unit: '°C', color: 'ember', decimals: 1, about: 'Nightly skin temperature. It follows your cycle and your room; a sudden rise can precede illness.' },
    { id: 'efficiency', title: 'Sleep efficiency', unit: '%', color: 'signal', about: 'Time asleep divided by time in bed. Above 85% is considered good.' },
    { id: 'in_bed_h', title: 'Time in bed', unit: 'h', color: 'signal', decimals: 1, about: 'From the ring’s bedtime detection to wake-up.' },
    { id: 'asleep_min', title: 'Time asleep', unit: 'min', color: 'signal', about: 'Time in deep, core, or REM sleep per night.' },
    { id: 'deep_pct', title: 'Deep sleep', unit: '%', color: 'signal', about: 'Share of the night in deep sleep. Most of it comes in the first half of the night.' },
    { id: 'rem_pct', title: 'REM sleep', unit: '%', color: 'signal', about: 'Share of the night in REM. It grows toward the morning; short nights cut it first.' },
    { id: 'awakenings', title: 'Awakenings', unit: '', color: 'ember', about: 'Wake bouts of at least a minute inside the sleep period.' },
    { id: 'waso_min', title: 'Awake after onset', unit: 'min', color: 'ember', about: 'Minutes awake after first falling asleep.' },
    { id: 'steps', title: 'Steps (ring)', unit: '', color: 'ember', about: 'Steps estimated from the ring’s movement signal.' },
    { id: 'active_kcal', title: 'Active energy (ring)', unit: 'kcal', color: 'ember', about: 'Energy above resting, from MET minutes and your weight.' },
  ]
  const WATCH: Def[] = [
    { id: 'w_rhr', kind: 'resting_heart_rate', title: 'Resting heart rate', unit: 'bpm', color: 'slate', agg: 'last', about: 'The Watch’s daily resting heart rate, measured during quiet moments of the day.' },
    { id: 'w_hrv', kind: 'hrv_sdnn', title: 'HRV (SDNN)', unit: 'ms', color: 'slate', agg: 'mean', about: 'The Watch measures SDNN in short windows through the day; the chart shows the daily mean. It is not the ring’s RMSSD.' },
    { id: 'w_vo2', kind: 'vo2_max', title: 'VO₂ max', unit: 'ml/kg/min', color: 'slate', agg: 'last', decimals: 1, about: 'Estimated from outdoor walks and runs with GPS and heart rate.' },
    { id: 'w_rr', kind: 'respiratory_rate', title: 'Respiratory rate', unit: '/min', color: 'slate', agg: 'mean', decimals: 1, about: 'Breaths per minute during sleep, from the Watch.' },
    { id: 'w_spo2', kind: 'oxygen_saturation', title: 'Blood oxygen', unit: '%', color: 'slate', agg: 'mean', decimals: 1, about: 'Daily mean of the Watch’s blood oxygen readings.' },
    { id: 'w_temp', kind: 'wrist_temperature', title: 'Wrist temperature', unit: '°C', color: 'slate', agg: 'mean', decimals: 2, about: 'Nightly wrist temperature from the Watch, as a deviation from its own baseline.' },
    { id: 'w_steps', kind: 'step_count', title: 'Steps (watch + phone)', unit: '', color: 'slate', agg: 'sum', about: 'Daily steps from the best single source, so the phone and the Watch are not added together.' },
    { id: 'w_kcal', kind: 'active_energy', title: 'Active energy (watch)', unit: 'kcal', color: 'slate', agg: 'sum', about: 'Daily active energy from the best single source.' },
  ]
  let selected = $state(metric)
  $effect(() => { selected = metric })
  let days = $state(90)
  let data = $state<{ points: { ymd: string; value: number }[]; latest: number | null; mean: number | null; baseline: number | null } | null>(null)
  let busy = $state(false)
  let error = $state('')
  const def = $derived(RING.find(r => r.id === selected) ?? WATCH.find(x => x.id === selected) ?? RING[0])
  const dayOf = (unix: number) => todayYmd(new Date(unix * 1000))

  async function loadTrend() {
    busy = true; error = ''
    try {
      const ring = RING.find(r => r.id === selected)
      if (ring) {
        const t = await api.tool<Trends>('get_trends', { metric: ring.id, days })
        data = { points: t.points, latest: t.latest, mean: t.mean, baseline: t.baseline }
      } else {
        const w = WATCH.find(x => x.id === selected)!
        const r = await api.tool<{ samples: HealthSample[] }>('get_health_samples', { kind: w.kind, days, limit: 20000 })
        const byDay = new Map<string, Map<string, number[]>>()
        for (const smp of r.samples) {
          if (smp.value == null) continue
          const v = w.kind === 'oxygen_saturation' ? smp.value * 100 : smp.value
          const d = dayOf(smp.start_unix), src = smp.source_bundle ?? ''
          if (!byDay.has(d)) byDay.set(d, new Map()); const m = byDay.get(d)!; if (!m.has(src)) m.set(src, []); m.get(src)!.push(v)
        }
        const points = [...byDay.entries()].sort().map(([ymd, bySrc]) => {
          if (w.agg === 'sum') return { ymd, value: Math.max(...[...bySrc.values()].map(vs => vs.reduce((a, b) => a + b, 0))) }
          const vs = [...bySrc.values()].flat()
          return { ymd, value: w.agg === 'min' ? Math.min(...vs) : w.agg === 'last' ? vs[vs.length - 1] : vs.reduce((a, b) => a + b, 0) / vs.length }
        })
        const vals = points.map(p => p.value)
        data = { points, latest: vals.at(-1) ?? null, mean: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null, baseline: null }
      }
    } catch (e: any) { error = e.message; data = null }
    busy = false
  }
  $effect(() => { selected; days; loadTrend() })
  const fmt = (v: number | null) => v == null ? '—' : v.toFixed(def.decimals ?? 0)
  const rows = $derived(data ? [...data.points].reverse().slice(0, 60) : [])
  const min = $derived(data?.points.length ? Math.min(...data.points.map(p => p.value)) : null)
  const max = $derived(data?.points.length ? Math.max(...data.points.map(p => p.value)) : null)
  // a 7-day rolling mean, the trend under the daily noise
  const rolling = $derived.by(() => {
    const pts = data?.points ?? []
    return pts.map((p, i) => { const win = pts.slice(Math.max(0, i - 6), i + 1); return [new Date(p.ymd + 'T00:00:00').getTime(), win.reduce((a, q) => a + q.value, 0) / win.length] as [number, number] })
  })
  const option = $derived.by(() => {
    const t = tokens()
    const col = (t as any)[def.color] as string
    const pts = (data?.points ?? []).map(p => [new Date(p.ymd + 'T00:00:00').getTime(), p.value])
    return {
      ...base(),
      grid: { left: 48, right: 16, top: 16, bottom: 28 },
      legend: { show: pts.length > 7, bottom: 0, left: 0, icon: 'roundRect', itemWidth: 14, itemHeight: 3, textStyle: { color: t.ash, fontSize: 12 }, data: ['Daily', '7-day mean'] },
      xAxis: { type: 'time', minInterval: 86400000, ...axisChrome(), splitLine: { show: false }, axisLabel: { color: t.ash, fontFamily: t.mono, fontSize: 11, formatter: (v: number) => fmtDay(v), hideOverlap: true } },
      yAxis: { type: 'value', scale: true, ...axisChrome(), axisLabel: { color: t.ash, fontFamily: t.mono, fontSize: 11 } },
      tooltip: { ...(base().tooltip as object), formatter: (params: any[]) => { const p = Array.isArray(params) ? params : [params]; const x = p[0].value[0]; return `<div style="color:${t.ash};font-family:${t.mono};font-size:11px">${fmtDay(x)}</div>` + p.map(it => `<div><b>${(it.value[1] as number).toFixed(def.decimals ?? 0)}</b> <span style="color:${t.ash}">${it.seriesName === 'Daily' ? def.unit : '7-day mean'}</span></div>`).join('') } },
      series: [
        { name: 'Daily', type: 'line', data: pts, showSymbol: pts.length <= 120, symbol: 'circle', symbolSize: 6, lineStyle: { width: 1.5, color: col, opacity: 0.55 }, itemStyle: { color: col, borderColor: t.surface, borderWidth: 2 },
          markLine: data?.baseline != null ? { silent: true, symbol: 'none', lineStyle: { color: t.ash, width: 1, type: 'solid' }, label: { show: true, position: 'insideEndTop', formatter: 'baseline', color: t.ash, fontSize: 11 }, data: [{ yAxis: data.baseline }] } : undefined,
          markArea: data?.baseline != null ? { silent: true, itemStyle: { color: t.band }, data: [[{ yAxis: data.baseline * 0.95 }, { yAxis: data.baseline * 1.05 }]] } : undefined },
        { name: '7-day mean', type: 'line', data: pts.length > 7 ? rolling : [], showSymbol: false, lineStyle: { width: 2.5, color: col }, itemStyle: { color: col } },
      ],
    }
  })
</script>

<div class="wrap">
  <div class="section">
    <h1>Trends</h1>
    <p class="sub">One value per day, from the ring or from Apple Health. The thick line is the 7-day mean; the band is ±5% of your baseline.</p>
  </div>
  <div class="section cols cols-1-3" style="gap: 40px">
    <div class="metric-list">
      <div class="group">Ring</div>
      {#each RING as r}<button class:active={selected === r.id} onclick={() => (selected = r.id)}><span>{r.title}</span><span class="u">{r.unit}</span></button>{/each}
      <div class="group">Apple Watch</div>
      {#each WATCH as x}<button class:active={selected === x.id} onclick={() => (selected = x.id)}><span>{x.title}</span><span class="u">{x.unit}</span></button>{/each}
    </div>
    <div>
      <div style="display:flex; align-items: baseline; gap: 16px; flex-wrap: wrap">
        <h2 style="margin:0; font-size: 20px">{def.title}</h2>
        <span class="spacer" style="flex:1"></span>
        <span class="seg">{#each [30, 90, 180, 365] as d}<button class:active={days === d} onclick={() => (days = d)}>{d} d</button>{/each}</span>
      </div>
      {#if error}<div class="error" style="margin-top: 12px">{error}</div>{/if}
      <div class="cols cols-4" style="gap: 24px; margin: 4px 0 8px">
        <div class="stat"><div class="label">Latest</div><div class="value">{fmt(data?.latest ?? null)}<small>{def.unit}</small></div></div>
        <div class="stat"><div class="label">Mean, {days} days</div><div class="value">{fmt(data?.mean ?? null)}<small>{def.unit}</small></div></div>
        <div class="stat"><div class="label">Baseline</div><div class="value">{fmt(data?.baseline ?? null)}<small>{def.unit}</small></div></div>
        <div class="stat"><div class="label">Range</div><div class="value">{fmt(min)}<small>to {fmt(max)}</small></div></div>
      </div>
      <div class="panel"><div class="panel-body" style="opacity: {busy ? 0.6 : 1}; transition: opacity .2s"><div use:chart={{ option }} style="height: 380px; width: 100%"></div></div></div>
      <div class="small sub" style="margin-top: 10px">{data ? `${data.points.length} days with data in the last ${days}. ` : ''}{def.about}</div>
      {#if rows.length}
        <table class="t" style="margin-top: 20px">
          <thead><tr><th>Day</th><th class="r">Value</th><th class="r">vs mean</th></tr></thead>
          <tbody>{#each rows as p}{@const d = data?.mean != null ? p.value - data.mean : null}<tr><td class="text">{dayLabel(p.ymd)}</td><td class="r">{fmt(p.value)} {def.unit}</td><td class="r">{d == null ? '' : `${d >= 0 ? '+' : ''}${fmt(d)}`}</td></tr>{/each}</tbody>
        </table>
      {/if}
    </div>
  </div>
</div>
