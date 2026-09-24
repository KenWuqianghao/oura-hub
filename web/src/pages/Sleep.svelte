<script lang="ts">
  import { BedDouble, Watch as WatchIcon } from 'lucide-svelte'
  import CardHeader from '../components/CardHeader.svelte'
  import BigValue from '../components/BigValue.svelte'
  import StatRow from '../components/StatRow.svelte'
  import Hypnogram from '../components/Hypnogram.svelte'
  import Lane from '../components/Lane.svelte'
  import Empty from '../components/Empty.svelte'
  import { hub } from '../lib/store.svelte'
  import * as F from '../lib/fmt'
  import type { Summary, Night } from '../lib/api'

  const s = $derived(hub.summary as Summary)
  const w = $derived(hub.watch)
  let shown = $state(10)
  const nights = $derived([...s.nights].filter(n => n.ymd).sort((a, b) => (a.ymd! < b.ymd! ? 1 : -1)))
  const ticks = (n: Night) => F.hourTicks(n.start, n.in_bed_h)
  const score = (n: Night) => n.sleep_score ?? s.scores?.days?.[F.wakeYmd(n) ?? '']?.sleep?.score ?? null
</script>

<div class="page">
  <div class="large-title">Sleep</div>
  <div class="subtitle">{nights.length} nights from the ring. Each night: the hypnogram from the on-device model, then heart rate, HRV, skin temperature, blood oxygen, and movement across the same hours.</div>
  <div class="stack">
    {#if w?.last_sleep}
      <div class="card">
        <CardHeader title="Apple Watch, last sleep" icon={WatchIcon} tint="var(--sleep)" detail={`${F.timeHM(w.last_sleep.start_unix)} – ${F.timeHM(w.last_sleep.end_unix)} · ${w.last_sleep.source ?? ''}`} />
        <div class="row">
          <div><div class="label">Asleep</div><BigValue parts={F.minutesParts(w.last_sleep.asleep_min)} /></div>
          <div><div class="label">In bed</div><BigValue parts={F.minutesParts(w.last_sleep.in_bed_min)} /></div>
          <div><div class="label">Deep</div><BigValue parts={[[`${Math.round(w.last_sleep.deep_min)}`, 'min']]} size="small" color="var(--deep)" /></div>
          <div><div class="label">Core</div><BigValue parts={[[`${Math.round(w.last_sleep.core_min)}`, 'min']]} size="small" color="var(--light)" /></div>
          <div><div class="label">REM</div><BigValue parts={[[`${Math.round(w.last_sleep.rem_min)}`, 'min']]} size="small" color="var(--rem)" /></div>
          <div><div class="label">Awake</div><BigValue parts={[[`${Math.round(w.last_sleep.awake_min)}`, 'min']]} size="small" color="var(--awake)" /></div>
        </div>
      </div>
    {/if}

    {#if !nights.length}
      <div class="card"><Empty icon={BedDouble} title="No Nights Yet" text="Wear your ring tonight and sync in the morning." /></div>
    {/if}
    {#each nights.slice(0, shown) as n}
      {@const sc = score(n)}
      <div class="card">
        <CardHeader title={F.dayTitle(F.wakeYmd(n) ?? n.ymd ?? '')} icon={BedDouble} tint="var(--sleep)" detail={`${n.start ?? '—'} – ${n.end ?? '—'}${n.bedtime_adjusted ? ' · bedtime adjusted' : ''}`} />
        <div class="row">
          <div><div class="label">In bed</div><BigValue parts={n.in_bed_h != null ? F.hoursMinutes(n.in_bed_h) : [['—', '']]} /></div>
          {#if n.metrics?.asleep_min != null}<div><div class="label">Asleep</div><BigValue parts={F.minutesParts(n.metrics.asleep_min)} /></div>{/if}
          {#if n.efficiency != null}<div><div class="label">Efficiency</div><BigValue parts={[[`${Math.round(n.efficiency)}`, '%']]} /></div>{/if}
          {#if sc != null}<div><div class="label">Sleep score</div><BigValue parts={[[`${Math.round(sc)}`, '']]} color={F.scoreBand(sc).color} /></div>{/if}
          {#if n.hrv_ms != null}<div><div class="label">HRV</div><BigValue parts={[[`${Math.round(n.hrv_ms)}`, 'ms']]} /></div>{/if}
          {#if n.rhr != null}<div><div class="label">Lowest HR</div><BigValue parts={[[`${Math.round(n.rhr)}`, 'bpm']]} /></div>{/if}
          {#if n.skin_temp != null}<div><div class="label">Skin temp</div><BigValue parts={[[n.skin_temp.toFixed(1), '°C']]} /></div>{/if}
          {#if n.spo2_mean != null}<div><div class="label">Blood O₂</div><BigValue parts={[[`${Math.round(n.spo2_mean)}`, '%']]} /></div>{/if}
        </div>
        {#if F.hasHypnogram(n)}
          <Hypnogram stages={n.stages_full?.length ? n.stages_full : n.stages ?? []} height={110} ticks={ticks(n)} />
          <div class="legend">
            {#each [[1, n.deep_pct], [2, n.light_pct], [3, n.rem_pct], [4, n.wake_pct]] as [code, pct]}
              <span><span class="dot" style="background:{F.stageColor(code as number)}"></span>{F.stageName(code as number)} {Math.round((pct as number) ?? 0)}%</span>
            {/each}
            {#if n.metrics}
              <span>· fell asleep in {Math.round(n.metrics.sol_min ?? 0)} min</span>
              <span>· awake after onset {Math.round(n.metrics.waso_min ?? 0)} min</span>
              <span>· {n.metrics.awakenings ?? 0} awakenings</span>
              <span>· {n.metrics.cycles ?? 0} cycles</span>
              {#if n.metrics.rem_latency_min != null}<span>· first REM after {Math.round(n.metrics.rem_latency_min)} min</span>{/if}
            {/if}
          </div>
        {/if}
        {#if n.series}
          <div class="divider"></div>
          <div class="stack" style="gap: 8px">
            {#if n.series.hr?.length}<Lane name="Heart rate" series={n.series.hr} accent="var(--heart)" unit="bpm" ticks={ticks(n)} />{/if}
            {#if n.series.hrv?.length}<Lane name="HRV" series={n.series.hrv} accent="var(--hrv)" unit="ms" ticks={ticks(n)} />{/if}
            {#if n.series.temp?.length}<Lane name="Skin temp" series={n.series.temp} accent="var(--temperature)" unit="°C" decimals={1} ticks={ticks(n)} />{/if}
            {#if n.series.spo2?.some(v => v > 0)}<Lane name="Blood O₂" series={n.series.spo2 ?? []} accent="var(--oxygen)" unit="%" ticks={ticks(n)} />{/if}
            {#if n.series.motion?.length}<Lane name="Movement" series={n.series.motion} accent="var(--activity)" kind="bars" height={44} ticks={ticks(n)} />{/if}
          </div>
          {#if ticks(n).length}
            <div class="lane"><span></span><div style="display:flex; justify-content: space-between" class="caption"><span>{n.start}</span>{#each ticks(n) as [, label]}<span>{label}</span>{/each}<span>{n.end}</span></div><span></span></div>
          {/if}
        {/if}
        {#if (n as any).autonomic}
          {@const a = (n as any).autonomic}
          <div class="divider"></div>
          <div class="grid3">
            <StatRow label="Deep sleep" value={`HR ${a.hr_deep ?? '—'} · HRV ${a.hrv_deep ?? '—'}`} />
            <StatRow label="Core sleep" value={`HR ${a.hr_light ?? '—'} · HRV ${a.hrv_light ?? '—'}`} />
            <StatRow label="REM sleep" value={`HR ${a.hr_rem ?? '—'} · HRV ${a.hrv_rem ?? '—'}`} />
          </div>
        {/if}
      </div>
    {/each}
    {#if nights.length > shown}
      <button class="button secondary" onclick={() => (shown += 10)}>Show more nights</button>
    {/if}
  </div>
</div>
