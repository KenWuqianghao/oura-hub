<script lang="ts">
  import NightChart from '../components/NightChart.svelte'
  import { hub } from '../lib/store.svelte'
  import * as F from '../lib/fmt'
  import type { Summary } from '../lib/api'

  const s = $derived(hub.summary as Summary)
  const w = $derived(hub.watch)
  let shown = $state(8)
  const nights = $derived([...s.nights].filter(n => n.ymd).sort((a, b) => (a.ymd! < b.ymd! ? 1 : -1)))
  const score = (n: any) => n.sleep_score ?? s.scores?.days?.[F.wakeYmd(n) ?? '']?.sleep?.score ?? null
</script>

<div class="wrap">
  <div class="section">
    <h1>Sleep</h1>
    <p class="sub" style="max-width: 60ch">{nights.length} nights from the ring. Each night: the hypnogram from the on-device model, then heart rate, HRV, skin temperature, blood oxygen, and movement on the same hours. Hover for the values at any minute.</p>
    {#if w?.last_sleep}
      <div class="note" style="margin-top: 12px">Apple Watch, last sleep: {F.minutesText(w.last_sleep.asleep_min)} asleep of {F.minutesText(w.last_sleep.in_bed_min)} in bed ({F.timeHM(w.last_sleep.start_unix)} – {F.timeHM(w.last_sleep.end_unix)}) · deep {Math.round(w.last_sleep.deep_min)} · core {Math.round(w.last_sleep.core_min)} · REM {Math.round(w.last_sleep.rem_min)} · awake {Math.round(w.last_sleep.awake_min)} min.</div>
    {/if}
  </div>
  {#if !nights.length}
    <div class="section"><div class="empty"><b>No nights yet.</b>Wear your ring tonight and sync in the morning.</div></div>
  {/if}
  {#each nights.slice(0, shown) as n}
    {@const sc = score(n)}
    <div class="section">
      <div class="eyebrow">{F.dayTitle(F.wakeYmd(n) ?? n.ymd ?? '')} <span class="aside">{n.start} – {n.end}{n.bedtime_adjusted ? ' · bedtime adjusted' : ''}</span></div>
      <div class="cols cols-1-3">
        <div>
          <div class="kv">
            <div class="k">In bed</div><div class="v">{n.in_bed_h != null ? F.hoursText(n.in_bed_h) : '—'}</div>
            <div class="k">Asleep</div><div class="v">{n.metrics?.asleep_min != null ? F.minutesText(n.metrics.asleep_min) : '—'}</div>
            <div class="k">Efficiency</div><div class="v">{n.efficiency != null ? `${Math.round(n.efficiency)} %` : '—'}</div>
            <div class="k">Sleep score</div><div class="v">{sc != null ? Math.round(sc) : '—'}</div>
            <div class="k">Stages</div><div class="v">{[n.deep_pct, n.light_pct, n.rem_pct, n.wake_pct].map(v => v != null ? `${Math.round(v)}%` : '—').join(' · ')}</div>
            <div class="k">Fell asleep in</div><div class="v">{n.metrics?.sol_min != null ? `${Math.round(n.metrics.sol_min)} min` : '—'}</div>
            <div class="k">Awake after onset</div><div class="v">{n.metrics?.waso_min != null ? `${Math.round(n.metrics.waso_min)} min` : '—'}</div>
            <div class="k">Awakenings · cycles</div><div class="v">{n.metrics?.awakenings ?? '—'} · {n.metrics?.cycles ?? '—'}</div>
            {#if n.metrics?.rem_latency_min != null}<div class="k">First REM after</div><div class="v">{Math.round(n.metrics.rem_latency_min)} min</div>{/if}
            <div class="k">HRV</div><div class="v">{n.hrv_ms != null ? `${Math.round(n.hrv_ms)} ms` : '—'}</div>
            <div class="k">Lowest heart rate</div><div class="v">{n.rhr != null ? `${Math.round(n.rhr)} bpm` : '—'}</div>
            <div class="k">Skin temperature</div><div class="v">{n.skin_temp != null ? `${n.skin_temp.toFixed(1)} °C` : '—'}</div>
            <div class="k">Blood oxygen</div><div class="v">{n.spo2_mean != null ? `${Math.round(n.spo2_mean)} %` : '—'}</div>
          </div>
        </div>
        <div class="panel"><div class="panel-body"><NightChart night={n} height={440} /></div></div>
      </div>
    </div>
  {/each}
  {#if nights.length > shown}
    <div class="section"><button class="btn" onclick={() => (shown += 8)}>Show more nights</button></div>
  {/if}
</div>
