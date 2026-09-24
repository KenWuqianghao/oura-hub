<script lang="ts">
  import { TrendingUp } from 'lucide-svelte'
  import CardHeader from '../components/CardHeader.svelte'
  import BigValue from '../components/BigValue.svelte'
  import TrendChart from '../components/TrendChart.svelte'
  import { api, type Trends, type HealthSample } from '../lib/api'
  import { todayYmd } from '../lib/fmt'

  let { metric = 'hrv_ms' }: { metric?: string } = $props()
  const RING: { id: string; title: string; unit: string; tint: string; decimals?: number }[] = [
    { id: 'hrv_ms', title: 'HRV', unit: 'ms', tint: 'var(--hrv)' },
    { id: 'rhr', title: 'Lowest heart rate', unit: 'bpm', tint: 'var(--heart)' },
    { id: 'skin_temp', title: 'Skin temperature', unit: '°C', tint: 'var(--temperature)', decimals: 1 },
    { id: 'efficiency', title: 'Sleep efficiency', unit: '%', tint: 'var(--sleep)' },
    { id: 'in_bed_h', title: 'Time in bed', unit: 'h', tint: 'var(--sleep)', decimals: 1 },
    { id: 'asleep_min', title: 'Time asleep', unit: 'min', tint: 'var(--sleep)' },
    { id: 'deep_pct', title: 'Deep sleep', unit: '%', tint: 'var(--deep)' },
    { id: 'rem_pct', title: 'REM sleep', unit: '%', tint: 'var(--rem)' },
    { id: 'awakenings', title: 'Awakenings', unit: '', tint: 'var(--awake)' },
    { id: 'steps', title: 'Steps (ring)', unit: '', tint: 'var(--activity)' },
    { id: 'active_kcal', title: 'Active energy (ring)', unit: 'kcal', tint: 'var(--activity)' },
  ]
  const WATCH: { id: string; kind: string; title: string; unit: string; tint: string; agg: 'mean' | 'last' | 'sum' | 'min'; decimals?: number }[] = [
    { id: 'w_rhr', kind: 'resting_heart_rate', title: 'Resting heart rate (watch)', unit: 'bpm', tint: 'var(--heart)', agg: 'last' },
    { id: 'w_hrv', kind: 'hrv_sdnn', title: 'HRV SDNN (watch)', unit: 'ms', tint: 'var(--hrv)', agg: 'mean' },
    { id: 'w_vo2', kind: 'vo2_max', title: 'VO₂ max (watch)', unit: '', tint: 'var(--cardio)', agg: 'last', decimals: 1 },
    { id: 'w_rr', kind: 'respiratory_rate', title: 'Respiratory rate (watch)', unit: '/min', tint: 'var(--oxygen)', agg: 'mean', decimals: 1 },
    { id: 'w_spo2', kind: 'oxygen_saturation', title: 'Blood oxygen (watch)', unit: '%', tint: 'var(--oxygen)', agg: 'mean', decimals: 1 },
    { id: 'w_temp', kind: 'wrist_temperature', title: 'Wrist temperature (watch)', unit: '°C', tint: 'var(--temperature)', agg: 'mean', decimals: 2 },
  ]
  let selected = $state(metric)
  $effect(() => { selected = metric })
  let days = $state(30)
  let data = $state<{ points: { ymd: string; value: number }[]; latest: number | null; mean: number | null; baseline: number | null } | null>(null)
  let busy = $state(false)
  let error = $state('')
  const def = $derived(RING.find(r => r.id === selected) ?? WATCH.find(w => w.id === selected) ?? RING[0])

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
        const byDay = new Map<string, number[]>()
        for (const smp of r.samples) {
          if (smp.value == null) continue
          let v = smp.value
          if (w.kind === 'oxygen_saturation') v = v * 100
          const d = dayOf(smp.end_unix)
          if (!byDay.has(d)) byDay.set(d, [])
          byDay.get(d)!.push(v)
        }
        const points = [...byDay.entries()].sort().map(([ymd, vs]) => ({
          ymd,
          value: w.agg === 'sum' ? vs.reduce((a, b) => a + b, 0) : w.agg === 'min' ? Math.min(...vs) : w.agg === 'last' ? vs[vs.length - 1] : vs.reduce((a, b) => a + b, 0) / vs.length,
        }))
        const vals = points.map(p => p.value)
        data = { points, latest: vals.at(-1) ?? null, mean: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null, baseline: null }
      }
    } catch (e: any) { error = e.message; data = null }
    busy = false
  }
  $effect(() => { selected; days; loadTrend() })
  const fmt = (v: number | null) => v == null ? '—' : v.toFixed(def.decimals ?? 0)
</script>

<div class="page">
  <div class="large-title">Trends</div>
  <div class="subtitle">One value per day</div>
  <div class="stack">
    <div class="card">
      <select class="input" bind:value={selected}>
        <optgroup label="Ring">{#each RING as r}<option value={r.id}>{r.title}</option>{/each}</optgroup>
        <optgroup label="Apple Watch">{#each WATCH as w}<option value={w.id}>{w.title}</option>{/each}</optgroup>
      </select>
      <div class="segmented" style="align-self:flex-start">
        {#each [14, 30, 90, 180] as d}<button class:active={days === d} onclick={() => (days = d)}>{d} d</button>{/each}
      </div>
    </div>
    <div class="card">
      <CardHeader title={def.title} icon={TrendingUp} tint={def.tint} detail={busy ? 'Loading…' : ''} />
      {#if error}<div class="error">{error}</div>{/if}
      {#if data}
        <div style="display:flex; gap: 24px; flex-wrap: wrap">
          <div><div class="label">Latest</div><BigValue parts={[[fmt(data.latest), def.unit]]} size="small" /></div>
          <div><div class="label">Mean</div><BigValue parts={[[fmt(data.mean), def.unit]]} size="small" /></div>
          {#if data.baseline != null}<div><div class="label">Baseline</div><BigValue parts={[[fmt(data.baseline), def.unit]]} size="small" /></div>{/if}
        </div>
        <TrendChart points={data.points} accent={def.tint} baseline={data.baseline} unit={def.unit} />
        <div class="caption">{data.points.length} days with data in the last {days}.</div>
      {/if}
    </div>
  </div>
</div>
