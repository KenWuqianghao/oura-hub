<script lang="ts">
  import { BedDouble, Watch as WatchIcon } from 'lucide-svelte'
  import CardHeader from '../components/CardHeader.svelte'
  import BigValue from '../components/BigValue.svelte'
  import StatRow from '../components/StatRow.svelte'
  import Hypnogram from '../components/Hypnogram.svelte'
  import Empty from '../components/Empty.svelte'
  import { hub } from '../lib/store.svelte'
  import * as F from '../lib/fmt'
  import type { Summary } from '../lib/api'

  const s = $derived(hub.summary as Summary)
  const w = $derived(hub.watch)
  let shown = $state(14)
  const nights = $derived([...s.nights].filter(n => n.ymd).sort((a, b) => (a.ymd! < b.ymd! ? 1 : -1)))
</script>

<div class="page">
  <div class="large-title">Sleep</div>
  <div class="subtitle">{nights.length} nights from the ring</div>
  <div class="stack">
    {#if w?.last_sleep}
      <div class="card">
        <CardHeader title="Apple Watch, last sleep" icon={WatchIcon} tint="var(--sleep)" detail={`${F.timeHM(w.last_sleep.start_unix)} – ${F.timeHM(w.last_sleep.end_unix)}`} />
        <div style="display:flex; gap: 24px; flex-wrap: wrap">
          <div><div class="label">Asleep</div><BigValue parts={F.minutesParts(w.last_sleep.asleep_min)} size="small" /></div>
          <div><div class="label">In bed</div><BigValue parts={F.minutesParts(w.last_sleep.in_bed_min)} size="small" /></div>
        </div>
        <div style="display:flex; gap: 14px; flex-wrap: wrap" class="footnote tabular">
          <span><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--deep);margin-right:4px"></span>Deep {Math.round(w.last_sleep.deep_min)} min</span>
          <span><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--light);margin-right:4px"></span>Core {Math.round(w.last_sleep.core_min)} min</span>
          <span><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--rem);margin-right:4px"></span>REM {Math.round(w.last_sleep.rem_min)} min</span>
          <span><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--awake);margin-right:4px"></span>Awake {Math.round(w.last_sleep.awake_min)} min</span>
        </div>
      </div>
    {/if}

    {#if !nights.length}
      <div class="card"><Empty icon={BedDouble} title="No Nights Yet" text="Wear your ring tonight and sync in the morning." /></div>
    {/if}
    {#each nights.slice(0, shown) as n}
      <div class="card">
        <CardHeader title={F.dayLabel(F.wakeYmd(n) ?? n.ymd ?? '')} icon={BedDouble} tint="var(--sleep)" detail={`${n.start ?? '—'} – ${n.end ?? '—'}`} />
        <div style="display:flex; gap: 24px; flex-wrap: wrap; align-items: flex-end">
          <div><div class="label">In bed</div><BigValue parts={n.in_bed_h != null ? F.hoursMinutes(n.in_bed_h) : [['—', '']]} size="small" /></div>
          {#if n.metrics?.asleep_min != null}<div><div class="label">Asleep</div><BigValue parts={F.minutesParts(n.metrics.asleep_min)} size="small" /></div>{/if}
          {#if n.efficiency != null}<div><div class="label">Efficiency</div><BigValue parts={[[`${Math.round(n.efficiency)}`, '%']]} size="small" /></div>{/if}
          {#if n.sleep_score != null}<div><div class="label">Score</div><BigValue parts={[[`${Math.round(n.sleep_score)}`, '']]} size="small" color={F.scoreBand(n.sleep_score).color} /></div>{/if}
        </div>
        {#if F.hasHypnogram(n)}
          <Hypnogram stages={n.stages ?? []} height={44} />
          <div style="display:flex; gap: 14px; flex-wrap: wrap" class="footnote tabular">
            {#each [[1, n.deep_pct], [2, n.light_pct], [3, n.rem_pct], [4, n.wake_pct]] as [code, pct]}
              <span><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:{F.stageColor(code as number)};margin-right:4px"></span>{F.stageName(code as number)} {Math.round((pct as number) ?? 0)}%</span>
            {/each}
          </div>
        {/if}
        <div class="divider"></div>
        <div class="grid2" style="gap: 0 24px">
          <StatRow label="HRV" value={n.hrv_ms != null ? `${Math.round(n.hrv_ms)} ms` : '—'} />
          <StatRow label="Lowest HR" value={n.rhr != null ? `${Math.round(n.rhr)} bpm` : '—'} />
          <StatRow label="Skin temp" value={n.skin_temp != null ? `${n.skin_temp.toFixed(1)} °C` : '—'} />
          <StatRow label="Blood O₂" value={n.spo2_mean != null ? `${Math.round(n.spo2_mean)} %` : '—'} />
          {#if n.metrics}
            <StatRow label="Fell asleep in" value={n.metrics.sol_min != null ? `${Math.round(n.metrics.sol_min)} min` : '—'} />
            <StatRow label="Awake after onset" value={n.metrics.waso_min != null ? `${Math.round(n.metrics.waso_min)} min` : '—'} />
            <StatRow label="Awakenings" value={n.metrics.awakenings != null ? `${n.metrics.awakenings}` : '—'} />
            <StatRow label="Cycles" value={n.metrics.cycles != null ? `${n.metrics.cycles}` : '—'} />
          {/if}
        </div>
      </div>
    {/each}
    {#if nights.length > shown}
      <button class="button secondary" onclick={() => (shown += 14)}>Show more nights</button>
    {/if}
  </div>
</div>
