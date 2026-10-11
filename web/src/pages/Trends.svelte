<script lang="ts">
  import PageHeader from '../components/PageHeader.svelte'
  import Seg from '../components/Seg.svelte'
  import Num from '../components/Num.svelte'
  import ErrorNote from '../components/ErrorNote.svelte'
  import { chart, base, tokens, color as cssColor, axisChrome, axisLabel, tipHead, tipRow } from '../lib/charts'
  import { api, type Trends, type HealthSample } from '../lib/api'
  import { t } from '../lib/i18n.svelte'
  import * as F from '../lib/fmt'

  let { metric = 'hrv_ms' }: { metric?: string } = $props()
  type RingId = 'hrv_ms' | 'rhr' | 'skin_temp' | 'efficiency' | 'in_bed_h' | 'asleep_min' | 'deep_pct' | 'rem_pct' | 'awakenings' | 'waso_min' | 'steps' | 'active_kcal'
  type WatchId = 'w_rhr' | 'w_hrv' | 'w_vo2' | 'w_rr' | 'w_spo2' | 'w_temp' | 'w_steps' | 'w_kcal'
  type Def = { id: RingId | WatchId; unit: string; decimals?: number; kind?: string; agg?: 'mean' | 'last' | 'sum' }
  const RING: Def[] = [
    { id: 'hrv_ms', unit: 'ms' }, { id: 'rhr', unit: 'bpm' }, { id: 'skin_temp', unit: '°C', decimals: 1 }, { id: 'efficiency', unit: '%' },
    { id: 'in_bed_h', unit: 'h', decimals: 1 }, { id: 'asleep_min', unit: 'min' }, { id: 'deep_pct', unit: '%' }, { id: 'rem_pct', unit: '%' },
    { id: 'awakenings', unit: '' }, { id: 'waso_min', unit: 'min' }, { id: 'steps', unit: '' }, { id: 'active_kcal', unit: 'kcal' },
  ]
  const WATCH: Def[] = [
    { id: 'w_rhr', kind: 'resting_heart_rate', unit: 'bpm', agg: 'last' }, { id: 'w_hrv', kind: 'hrv_sdnn', unit: 'ms', agg: 'mean' },
    { id: 'w_vo2', kind: 'vo2_max', unit: 'ml/kg/min', agg: 'last', decimals: 1 }, { id: 'w_rr', kind: 'respiratory_rate', unit: '/min', agg: 'mean', decimals: 1 },
    { id: 'w_spo2', kind: 'oxygen_saturation', unit: '%', agg: 'mean', decimals: 1 }, { id: 'w_temp', kind: 'wrist_temperature', unit: '°C', agg: 'mean', decimals: 2 },
    { id: 'w_steps', kind: 'step_count', unit: '', agg: 'sum' }, { id: 'w_kcal', kind: 'active_energy', unit: 'kcal', agg: 'sum' },
  ]
  let selected = $state('')
  $effect.pre(() => { selected = metric })
  let days = $state(90)
  let data = $state<{ points: { ymd: string; value: number }[]; latest: number | null; mean: number | null; baseline: number | null } | null>(null)
  let busy = $state(false)
  let error = $state('')
  const def = $derived(RING.find(r => r.id === selected) ?? WATCH.find(x => x.id === selected) ?? RING[0])
  const dayOf = (unix: number) => F.todayYmd(new Date(unix * 1000))
  const isRing = $derived(RING.some(r => r.id === def.id))
  const title = $derived(t(`trends.m_${def.id}`))

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
          return { ymd, value: w.agg === 'last' ? vs[vs.length - 1] : vs.reduce((a, b) => a + b, 0) / vs.length }
        })
        const vals = points.map(p => p.value)
        data = { points, latest: vals.at(-1) ?? null, mean: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null, baseline: null }
      }
    } catch (e: any) { error = e.message; data = null }
    busy = false
  }
  $effect(() => { selected; days; loadTrend() })
  const fmt = (v: number | null) => F.num(v, def.decimals ?? 0)
  const rows = $derived(data ? [...data.points].reverse().slice(0, 60) : [])
  const min = $derived(data?.points.length ? Math.min(...data.points.map(p => p.value)) : null)
  const max = $derived(data?.points.length ? Math.max(...data.points.map(p => p.value)) : null)
  // a 7-day rolling mean, the trend under the daily noise
  const rolling = $derived.by(() => {
    const pts = data?.points ?? []
    return pts.map((p, i) => { const win = pts.slice(Math.max(0, i - 6), i + 1); return [F.dayStartMs(p.ymd), win.reduce((a, q) => a + q.value, 0) / win.length] as [number, number] })
  })
  const option = $derived.by(() => {
    const tk = tokens()
    const col = cssColor(isRing ? '--ring' : '--watch')
    const pts = (data?.points ?? []).map(p => [F.dayStartMs(p.ymd), p.value])
    const baseline = data?.baseline ?? null
    return {
      ...base(),
      grid: { left: 48, right: 16, top: 16, bottom: 28 },
      xAxis: { type: 'time', minInterval: 86400000, ...axisChrome(), splitLine: { show: false }, axisLabel: { ...axisLabel(), formatter: (v: number) => F.monthDayOf(v), hideOverlap: true } },
      yAxis: { type: 'value', scale: true, ...axisChrome() },
      tooltip: { ...(base().tooltip as object), formatter: (params: any) => { const p = Array.isArray(params) ? params : [params]; return tipHead(F.monthDayOf(p[0].value[0])) + p.map((it: any) => tipRow(fmt(it.value[1]), it.seriesId === 'daily' ? def.unit : t('charts.mean_7d'))).join('') } },
      series: [
        { id: 'daily', type: 'line', data: pts, showSymbol: pts.length <= 120, symbol: 'circle', symbolSize: 6, lineStyle: { width: 1.5, color: col, opacity: 0.55 }, itemStyle: { color: col, borderColor: tk.surface, borderWidth: 2 },
          markLine: { silent: true, symbol: 'none', animation: false, lineStyle: { color: tk.ash, width: 1, type: 'solid' }, label: { show: true, position: 'insideEndTop', formatter: t('charts.baseline'), color: tk.ash, fontSize: 11 }, data: baseline != null ? [{ yAxis: baseline }] : [] },
          markArea: { silent: true, itemStyle: { color: tk.band }, data: baseline != null ? [[{ yAxis: baseline * 0.95 }, { yAxis: baseline * 1.05 }]] : [] } },
        { id: 'mean', type: 'line', data: pts.length > 7 ? rolling : [], showSymbol: false, lineStyle: { width: 2.5, color: col }, itemStyle: { color: col } },
      ],
    }
  })
</script>

<div class="wrap">
  <PageHeader title={t('shell.trends')} sub={t('trends.sub')} />
  <div class="section cols cols-1-3" style="gap: 40px">
    <div class="metric-list">
      <div class="group">{t('trends.group_ring')}</div>
      {#each RING as r}<button class:active={selected === r.id} onclick={() => (selected = r.id)}><span>{t(`trends.m_${r.id}`)}</span><span class="u">{r.unit}</span></button>{/each}
      <div class="group">{t('trends.group_watch')}</div>
      {#each WATCH as x}<button class:active={selected === x.id} onclick={() => (selected = x.id)}><span>{t(`trends.m_${x.id}`)}</span><span class="u">{x.unit}</span></button>{/each}
    </div>
    <div>
      <div style="display:flex; align-items: center; gap: 16px; flex-wrap: wrap">
        <h2 style="margin:0; font-size: 22px; font-weight: 700">{title}</h2>
        <span style="flex:1"></span>
        <Seg bind:value={days} options={[30, 90, 180, 365].map(n => ({ value: n, label: t('common.days_n', { n }) }))} label={t('trends.days_range')} />
      </div>
      {#if error}<div style="margin-top: 12px"><ErrorNote message={error} retry={loadTrend} /></div>{/if}
      <div class="cols cols-4" style="gap: 0 24px; margin: 4px 0 8px">
        <div class="stat"><div class="label">{t('common.stat_latest')}</div><div class="value"><Num value={data?.latest} decimals={def.decimals ?? 0} /><small>{def.unit}</small></div></div>
        <div class="stat"><div class="label">{t('trends.mean_days', { n: days })}</div><div class="value"><Num value={data?.mean} decimals={def.decimals ?? 0} /><small>{def.unit}</small></div></div>
        <div class="stat"><div class="label">{t('trends.baseline')}</div><div class="value"><Num value={data?.baseline} decimals={def.decimals ?? 0} /><small>{def.unit}</small></div></div>
        <div class="stat"><div class="label">{t('common.stat_range')}</div><div class="value"><Num value={min} decimals={def.decimals ?? 0} /><small>{t('trends.to_n', { n: fmt(max) })}</small></div></div>
      </div>
      <div class="panel">
        <div class="panel-body" style="opacity: {busy ? 0.6 : 1}; transition: opacity var(--dur) ease"><div use:chart={{ option }} style="height: 380px; width: 100%"></div></div>
        {#if (data?.points.length ?? 0) > 7}
          <div class="legend" style="padding: 0 18px 14px"><span><span class="ln" style="background: var({isRing ? '--ring' : '--watch'}); opacity: .55"></span>{t('charts.daily')}</span><span><span class="ln" style="background: var({isRing ? '--ring' : '--watch'}); height: 3px"></span>{t('charts.mean_7d')}</span></div>
        {/if}
      </div>
      <div class="small sub" style="margin-top: 10px">{data ? `${t('trends.days_with_data', { n: data.points.length, days })} ` : ''}{t(`trends.m_${def.id}_about`)}</div>
      {#if rows.length}
        <div class="table-scroll" style="margin-top: 20px"><table class="t">
          <thead><tr><th>{t('trends.day')}</th><th class="r">{t('trends.value')}</th><th class="r">{t('trends.vs_mean')}</th></tr></thead>
          <tbody>{#each rows as p}{@const d = data?.mean != null ? p.value - data.mean : null}<tr><td class="text">{F.dayLabel(p.ymd)}</td><td class="r">{fmt(p.value)} {def.unit}</td><td class="r">{d == null ? '' : F.signed(d, def.decimals ?? 0)}</td></tr>{/each}</tbody>
        </table></div>
      {/if}
    </div>
  </div>
</div>
