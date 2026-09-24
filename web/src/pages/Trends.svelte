<script lang="ts">
  import { TrendingUp } from 'lucide-svelte'
  import CardHeader from '../components/CardHeader.svelte'
  import BigValue from '../components/BigValue.svelte'
  import TrendChart from '../components/TrendChart.svelte'
  import { api, type Trends, type HealthSample } from '../lib/api'
  import { todayYmd, dayLabel } from '../lib/fmt'

  let { metric = 'hrv_ms' }: { metric?: string } = $props()
  type Def = { id: string; title: string; unit: string; tint: string; decimals?: number; about: string; kind?: string; agg?: 'mean' | 'last' | 'sum' | 'min' }
  const RING: Def[] = [
    { id: 'hrv_ms', title: 'HRV', unit: 'ms', tint: 'var(--hrv)', about: 'Nightly average RMSSD from the ring. Compare with your own baseline, not with other people: HRV varies a lot between individuals.' },
    { id: 'rhr', title: 'Lowest heart rate', unit: 'bpm', tint: 'var(--heart)', about: 'The lowest heart rate of the night. A rise of 5 to 10 bpm above baseline often means strain, alcohol, or the start of an illness.' },
    { id: 'skin_temp', title: 'Skin temperature', unit: '°C', tint: 'var(--temperature)', decimals: 1, about: 'Nightly skin temperature. Follows your cycle and your environment; a sudden rise can precede illness.' },
    { id: 'efficiency', title: 'Sleep efficiency', unit: '%', tint: 'var(--sleep)', about: 'Time asleep divided by time in bed. Above 85% is considered good.' },
    { id: 'in_bed_h', title: 'Time in bed', unit: 'h', tint: 'var(--sleep)', decimals: 1, about: 'From the ring’s bedtime detection to wake-up.' },
    { id: 'asleep_min', title: 'Time asleep', unit: 'min', tint: 'var(--sleep)', about: 'Time in deep, core, or REM sleep per night.' },
    { id: 'deep_pct', title: 'Deep sleep', unit: '%', tint: 'var(--deep)', about: 'Share of the night in deep sleep. Most of it comes in the first half of the night.' },
    { id: 'rem_pct', title: 'REM sleep', unit: '%', tint: 'var(--rem)', about: 'Share of the night in REM. It grows toward the morning; short nights cut it first.' },
    { id: 'awakenings', title: 'Awakenings', unit: '', tint: 'var(--awake)', about: 'Wake bouts of at least a minute inside the sleep period.' },
    { id: 'waso_min', title: 'Awake after onset', unit: 'min', tint: 'var(--awake)', about: 'Minutes awake after first falling asleep.' },
    { id: 'steps', title: 'Steps (ring)', unit: '', tint: 'var(--activity)', about: 'Steps estimated from the ring’s movement signal.' },
    { id: 'active_kcal', title: 'Active energy (ring)', unit: 'kcal', tint: 'var(--activity)', about: 'Energy above resting, from MET minutes and your weight.' },
  ]
  const WATCH: Def[] = [
    { id: 'w_rhr', kind: 'resting_heart_rate', title: 'Resting heart rate', unit: 'bpm', tint: 'var(--heart)', agg: 'last', about: 'The Watch’s daily resting heart rate, measured during quiet moments of the day.' },
    { id: 'w_hrv', kind: 'hrv_sdnn', title: 'HRV (SDNN)', unit: 'ms', tint: 'var(--hrv)', agg: 'mean', about: 'The Watch measures SDNN in short windows through the day; the chart shows the daily mean. It is not the same metric as the ring’s RMSSD.' },
    { id: 'w_vo2', kind: 'vo2_max', title: 'VO₂ max', unit: 'ml/kg/min', tint: 'var(--cardio)', agg: 'last', decimals: 1, about: 'Estimated from outdoor walks and runs with GPS and heart rate.' },
    { id: 'w_rr', kind: 'respiratory_rate', title: 'Respiratory rate', unit: '/min', tint: 'var(--oxygen)', agg: 'mean', decimals: 1, about: 'Breaths per minute during sleep, from the Watch.' },
    { id: 'w_spo2', kind: 'oxygen_saturation', title: 'Blood oxygen', unit: '%', tint: 'var(--oxygen)', agg: 'mean', decimals: 1, about: 'Daily mean of the Watch’s blood oxygen readings.' },
    { id: 'w_temp', kind: 'wrist_temperature', title: 'Wrist temperature', unit: '°C', tint: 'var(--temperature)', agg: 'mean', decimals: 2, about: 'Nightly wrist temperature from the Watch, as a deviation from its own baseline.' },
    { id: 'w_steps', kind: 'step_count', title: 'Steps (watch + phone)', unit: '', tint: 'var(--activity)', agg: 'sum', about: 'Daily steps from the best single source, so the phone and the Watch are not added together.' },
    { id: 'w_kcal', kind: 'active_energy', title: 'Active energy (watch)', unit: 'kcal', tint: 'var(--activity)', agg: 'sum', about: 'Daily active energy from the best single source.' },
  ]
  let selected = $state(metric)
  $effect(() => { selected = metric })
  let days = $state(30)
  let data = $state<{ points: { ymd: string; value: number }[]; latest: number | null; mean: number | null; baseline: number | null } | null>(null)
  let busy = $state(false)
  let error = $state('')
  const def = $derived(RING.find(r => r.id === selected) ?? WATCH.find(x => x.id === selected) ?? RING[0])
  function dayOf(unix: number): string { return todayYmd(new Date(unix * 1000)) }

  async function loadTrend() {
    busy = true; error = ''
    try {
      const ring = RING.find(r => r.id === selected)
      if (ring) {
        const t = await api.tool<Trends>('get_trends', { metric: ring.id, days })
        data = { points: t.points, latest: t.latest, mean: t.mean, baseline: t.baseline }
      } else {
        const w = WATCH.find(x => x.id === selected)!
        const r = await api.tool<{ samples: HealthSample[] }>('get_health_samples', { kind: w.kind, days, limit: 5000 })
        // per day, per source; sums take the best source, the rest use every sample
        const byDay = new Map<string, Map<string, number[]>>()
        for (const smp of r.samples) {
          if (smp.value == null) continue
          const v = w.kind === 'oxygen_saturation' ? smp.value * 100 : smp.value
          const d = dayOf(smp.start_unix)
          const src = smp.source_bundle ?? ''
          if (!byDay.has(d)) byDay.set(d, new Map())
          const m = byDay.get(d)!
          if (!m.has(src)) m.set(src, [])
          m.get(src)!.push(v)
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
  const rows = $derived(data ? [...data.points].reverse().slice(0, 45) : [])
  const min = $derived(data?.points.length ? Math.min(...data.points.map(p => p.value)) : null)
  const max = $derived(data?.points.length ? Math.max(...data.points.map(p => p.value)) : null)
</script>

<div class="page">
  <div class="large-title">Trends</div>
  <div class="subtitle">One value per day, from the ring or from Apple Health</div>
  <div class="grid">
    <div class="card span3" style="padding: 8px">
      <div class="metric-list">
        <div class="group">Ring</div>
        {#each RING as r}<button class:active={selected === r.id} onclick={() => (selected = r.id)}><span>{r.title}</span><span class="caption">{r.unit}</span></button>{/each}
        <div class="group">Apple Watch</div>
        {#each WATCH as x}<button class:active={selected === x.id} onclick={() => (selected = x.id)}><span>{x.title}</span><span class="caption">{x.unit}</span></button>{/each}
      </div>
    </div>
    <div class="span9 stack">
      <div class="card">
        <div style="display:flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap">
          <CardHeader title={def.title} icon={TrendingUp} tint={def.tint} detail={busy ? 'Loading…' : ''} />
          <div class="segmented">{#each [14, 30, 90, 180, 365] as d}<button class:active={days === d} onclick={() => (days = d)}>{d} d</button>{/each}</div>
        </div>
        {#if error}<div class="error">{error}</div>{/if}
        {#if data}
          <div class="row" style="gap: 32px">
            <div><div class="label">Latest</div><BigValue parts={[[fmt(data.latest), def.unit]]} /></div>
            <div><div class="label">Mean</div><BigValue parts={[[fmt(data.mean), def.unit]]} /></div>
            {#if data.baseline != null}<div><div class="label">Baseline</div><BigValue parts={[[fmt(data.baseline), def.unit]]} /></div>{/if}
            <div><div class="label">Low</div><BigValue parts={[[fmt(min), def.unit]]} size="small" /></div>
            <div><div class="label">High</div><BigValue parts={[[fmt(max), def.unit]]} size="small" /></div>
          </div>
          <TrendChart points={data.points} accent={def.tint} baseline={data.baseline} unit={def.unit} height={360} />
          <div class="caption">{data.points.length} days with data in the last {days}. {def.about}</div>
        {/if}
      </div>
      {#if rows.length}
        <div class="card">
          <CardHeader title="Day by day" icon={TrendingUp} tint="var(--secondary)" />
          <table class="plain">
            <thead><tr><th>Day</th><th>Value</th><th>vs mean</th></tr></thead>
            <tbody>
              {#each rows as p}
                {@const d = data?.mean != null ? p.value - data.mean : null}
                <tr><td>{dayLabel(p.ymd)}</td><td>{fmt(p.value)} {def.unit}</td><td style="color: {d == null ? 'var(--secondary)' : d >= 0 ? 'var(--text)' : 'var(--secondary)'}">{d == null ? '' : `${d >= 0 ? '+' : ''}${fmt(d)}`}</td></tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  </div>
</div>
