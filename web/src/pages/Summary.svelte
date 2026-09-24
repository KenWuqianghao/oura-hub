<script lang="ts">
  import { ChevronLeft, ChevronRight } from 'lucide-svelte'
  import DayStrip from '../components/DayStrip.svelte'
  import NightChart from '../components/NightChart.svelte'
  import Small from '../components/Small.svelte'
  import Meter from '../components/Meter.svelte'
  import { hub, selectDay } from '../lib/store.svelte'
  import * as F from '../lib/fmt'
  import type { Summary, Night } from '../lib/api'

  let { go }: { go: (route: string) => void } = $props()
  const s = $derived(hub.summary as Summary)
  const w = $derived(hub.watch)
  const day = $derived(hub.day || F.todayYmd())
  const isToday = $derived(day === F.todayYmd())
  const night = $derived(F.nightForDay(s, day))
  const act = $derived(s.activity_daily?.[day])
  const profile = $derived(s.activity_profile?.[day] ?? [])
  const prevProfile = $derived(s.activity_profile?.[F.addDays(day, -1)] ?? [])
  const scores = $derived(F.SCORE_KINDS.map(k => {
    const hit = F.latestScore(s, k, day)
    const last7 = Array.from({ length: 7 }, (_, i) => { const d = F.addDays(day, i - 6); const sc = s.scores?.days?.[d]?.[k]; return sc && typeof sc.score === 'number' ? sc.score : null })
    return { kind: k, hit, last7 }
  }))
  const nightsByWake = $derived([...s.nights].filter(n => n.ymd).sort((a, b) => (a.ymd! < b.ymd! ? -1 : 1)))
  let range = $state(30)
  const series = (pick: (n: Night) => number | null | undefined) => nightsByWake.filter(n => pick(n) != null).slice(-range).map(n => ({ ymd: F.wakeYmd(n) ?? n.ymd!, value: pick(n) as number }))
  const stepsSeries = $derived(Object.entries(s.activity_daily ?? {}).sort().slice(-range).filter(([, v]) => v.steps != null).map(([ymd, v]) => ({ ymd, value: v.steps as number })))
  const smalls = $derived([
    { title: 'HRV', unit: 'ms', points: series(n => n.hrv_ms), baseline: s.vitals?.hrv?.baseline ?? null, color: 'var(--signal)', text: 'Nightly RMSSD. Above the band means you are recovered; the band is ±5% of your 14-day baseline.', route: 'trends/hrv_ms' },
    { title: 'Lowest heart rate', unit: 'bpm', points: series(n => n.rhr), baseline: s.vitals?.rhr?.baseline ?? null, color: 'var(--signal)', text: 'The night’s minimum. Five to ten bpm above the band usually means strain, alcohol, or an illness on its way.', route: 'trends/rhr' },
    { title: 'Time asleep', unit: 'min', points: series(n => n.metrics?.asleep_min ?? (n.in_bed_h != null ? n.in_bed_h * 60 : null)), baseline: s.sleep_debt?.need_h ? s.sleep_debt.need_h * 60 : null, color: 'var(--signal)', text: 'Minutes in deep, core, or REM sleep. The line is your sleep need.', route: 'trends/asleep_min', decimals: 0 },
    { title: 'Steps', unit: '', points: stepsSeries, baseline: null, color: 'var(--ember)', text: 'Estimated from the ring’s movement signal.', route: 'trends/steps' },
  ])
  const debt = $derived(s.sleep_debt)
  const ill = $derived(s.illness)
  const dayScores = $derived(s.scores?.days?.[day] ?? {})
  const workouts = $derived([...(hub.dayData?.workouts ?? []), ...F.workoutsOn(s, day).map(wk => ({ start: F.hmOnDay(wk.start.slice(0, 10), wk.start.slice(-5)), end: F.hmOnDay(wk.start.slice(0, 10), wk.start.slice(-5)) + wk.durationMin * 60_000, label: F.activityLabel(wk.label), source: 'ring' }))])
  const ringAgo = $derived(s.device?.fresh_hours != null && hub.receivedAt ? F.ago(hub.receivedAt - s.device.fresh_hours * 3600) : '—')
  const watchAgo = $derived(w?.freshness ? F.ago(w.freshness.newest_sample_unix) : '—')
  const hrDay = $derived(hub.dayData?.day === day ? hub.dayData.hr : [])
  const illLabel: Record<string, string> = { NO_SIGNS: 'No signs of illness', MINOR_SIGNS: 'Minor signs', MAJOR_SIGNS: 'Major signs' }
</script>

<div class="wrap">
  <div class="section">
    <div class="cols cols-2-1">
      <div>
        <div style="display:flex; align-items:center; gap: 8px">
          <button class="btn quiet" aria-label="Previous day" onclick={() => selectDay(F.addDays(day, -1))}><ChevronLeft size={16} /></button>
          <h1>{F.dayTitle(day)}</h1>
          <button class="btn quiet" aria-label="Next day" onclick={() => selectDay(F.addDays(day, 1))} disabled={isToday}><ChevronRight size={16} /></button>
          {#if !isToday}<button class="btn quiet" onclick={() => selectDay(F.todayYmd())}>Today</button>{/if}
        </div>
        {#if isToday && s.digest}
          <p class="lede">{s.digest}</p>
        {:else if night}
          <p class="lede">In bed {night.in_bed_h != null ? F.hoursText(night.in_bed_h) : '—'}{night.efficiency != null ? `, ${Math.round(night.efficiency)}% efficient` : ''}{night.hrv_ms != null ? `. HRV ${Math.round(night.hrv_ms)} ms` : ''}{night.rhr != null ? `, lowest heart rate ${Math.round(night.rhr)} bpm.` : '.'}</p>
        {:else}
          <p class="lede sub">No night recorded for this day.</p>
        {/if}
        <div style="display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0 32px; margin-top: 18px">
          {#each scores as sc}
            <Meter name={F.scoreTitle(sc.kind)} score={sc.hit?.score ?? null} days={sc.last7} provisional={!!sc.hit?.provisional}
              note={sc.hit ? (sc.hit.day === day ? (dayScores[sc.kind]?.contributors ? `${dayScores[sc.kind].contributors.length} contributors` : '') : `from ${F.dayLabel(sc.hit.day).toLowerCase()}`) : (sc.kind === 'activity' ? 'tracking today' : 'after a night')} />
          {/each}
        </div>
      </div>
      <div>
        <div class="eyebrow">Status</div>
        <div class="kv">
          <div class="k">Ring synced</div><div class="v">{ringAgo}{s.device?.battery_pct != null ? ` · battery ${s.device.battery_pct}%` : ''}</div>
          <div class="k">Watch newest sample</div><div class="v">{watchAgo}</div>
          <div class="k">Summary built</div><div class="v">{hub.receivedAt ? F.ago(hub.receivedAt) : '—'}{s.pushed_by ? ` · ${s.pushed_by.client} ${s.pushed_by.version}` : ''}</div>
          <div class="k">Sleep debt</div><div class="v">{debt?.valid ? `${F.minutesText(debt.debt_min)} · ` : ''}<span class="pill {F.statusPillClass(debt?.state)}">{debt?.valid ? F.debtLabel(debt.state) : `${debt?.valid_days ?? 0} of 5 days`}</span></div>
          <div class="k">Illness signs</div><div class="v"><span class="pill {ill?.available ? F.statusPillClass(ill.traffic_light) : 'neutral'}">{ill?.available ? (illLabel[ill.traffic_light] ?? '—') : 'needs more nights'}</span></div>
          {#if s.cardio?.vascular_age != null}<div class="k">Vascular age</div><div class="v">{s.cardio.vascular_age.toFixed(1)} yr{s.cardio.chronological_age != null ? ` (you are ${s.cardio.chronological_age})` : ''}</div>{/if}
        </div>
      </div>
    </div>
  </div>

  <div class="section" style="padding-top: 8px; border-top: 0">
    <DayStrip {day} dayStart={F.dayStartMs(day)} nights={s.nights} hr={hrDay} {profile} {prevProfile} {workouts} />
    <div class="cols cols-4" style="margin-top: 14px; gap: 32px">
      <div class="stat"><div class="label">Steps (ring)</div><div class="value">{F.num(act?.steps)}</div><div class="delta">{w?.today?.steps != null && isToday ? `watch ${F.num(w.today.steps)}` : ''}</div></div>
      <div class="stat"><div class="label">Active energy</div><div class="value">{F.num(act?.active_kcal)}<small>kcal</small></div><div class="delta">{act?.total_kcal != null ? `${F.num(act.total_kcal)} kcal total` : ''}</div></div>
      <div class="stat"><div class="label">Exercise (watch)</div><div class="value">{isToday ? F.num(w?.today?.exercise_min) : '—'}<small>min</small></div><div class="delta">{isToday && w?.today?.stand_hours != null ? `${w.today.stand_hours} stand hours` : ''}</div></div>
      <div class="stat"><div class="label">Workouts</div><div class="value">{workouts.length}</div><div class="delta">{workouts.map(x => x.label).slice(0, 3).join(' · ')}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="eyebrow">Last {range} nights <span class="spacer"></span>
      <span class="seg">{#each [14, 30, 90] as r}<button class:active={range === r} onclick={() => (range = r)}>{r} d</button>{/each}</span>
    </div>
    <div class="cols cols-4">
      {#each smalls as sm}
        <div>
          <div style="display:flex; align-items:baseline; justify-content:space-between; gap: 8px">
            <h2 style="margin:0"><a href={'#/' + sm.route} style="color:inherit">{sm.title}</a></h2>
            <span class="num small sub">{sm.points.length ? `${sm.points[sm.points.length - 1].value.toFixed(sm.decimals ?? 0)}${sm.unit ? ' ' + sm.unit : ''}` : ''}</span>
          </div>
          <Small points={sm.points} baseline={sm.baseline} unit={sm.unit} decimals={sm.decimals ?? 0} color={sm.color} />
          <div class="small sub" style="margin-top: 4px">{sm.text}</div>
        </div>
      {/each}
    </div>
  </div>

  {#if night}
    <div class="section">
      <div class="eyebrow">The night <span class="aside">{night.start} – {night.end}{night.bedtime_adjusted ? ' · bedtime adjusted' : ''}</span></div>
      <div class="cols cols-1-3">
        <div>
          <div class="kv">
            <div class="k">In bed</div><div class="v">{night.in_bed_h != null ? F.hoursText(night.in_bed_h) : '—'}</div>
            <div class="k">Asleep</div><div class="v">{night.metrics?.asleep_min != null ? F.minutesText(night.metrics.asleep_min) : '—'}</div>
            <div class="k">Efficiency</div><div class="v">{night.efficiency != null ? `${Math.round(night.efficiency)} %` : '—'}</div>
            <div class="k">Sleep score</div><div class="v">{night.sleep_score != null ? Math.round(night.sleep_score) : '—'}</div>
            <div class="k">Fell asleep in</div><div class="v">{night.metrics?.sol_min != null ? `${Math.round(night.metrics.sol_min)} min` : '—'}</div>
            <div class="k">Awake after onset</div><div class="v">{night.metrics?.waso_min != null ? `${Math.round(night.metrics.waso_min)} min` : '—'}</div>
            <div class="k">Awakenings</div><div class="v">{night.metrics?.awakenings ?? '—'}</div>
            <div class="k">Cycles</div><div class="v">{night.metrics?.cycles ?? '—'}</div>
            <div class="k">Stages</div><div class="v">{[['deep', night.deep_pct], ['core', night.light_pct], ['REM', night.rem_pct], ['awake', night.wake_pct]].map(([k, v]) => v != null ? `${Math.round(v as number)}% ${k}` : '').filter(Boolean).join(', ')}</div>
            <div class="k">HRV</div><div class="v">{night.hrv_ms != null ? `${Math.round(night.hrv_ms)} ms` : '—'}</div>
            <div class="k">Lowest heart rate</div><div class="v">{night.rhr != null ? `${Math.round(night.rhr)} bpm` : '—'}</div>
            <div class="k">Skin temperature</div><div class="v">{night.skin_temp != null ? `${night.skin_temp.toFixed(1)} °C` : '—'}</div>
            <div class="k">Blood oxygen</div><div class="v">{night.spo2_mean != null ? `${Math.round(night.spo2_mean)} %` : '—'}</div>
          </div>
        </div>
        <div class="panel"><div class="panel-body"><NightChart {night} height={440} /></div></div>
      </div>
    </div>
  {/if}

  {#if scores.some(x => x.hit)}
    <div class="section">
      <div class="eyebrow">What made the scores <span class="aside">{s.scores?.basis ? F.scoreBasisLabel(s.scores.basis) : ''}</span></div>
      <div class="cols cols-3">
        {#each F.SCORE_KINDS as kind}
          {@const sc = dayScores[kind] ?? (F.latestScore(s, kind, day) ? s.scores?.days?.[F.latestScore(s, kind, day)!.day]?.[kind] : null)}
          <div>
            <h2>{F.scoreTitle(kind)}{sc ? ` · ${Math.round(sc.score)}` : ''}</h2>
            {#if !sc}<div class="empty small">No score yet.</div>{:else}
              {#each (sc.contributors ?? []) as c}
                <div class="contrib">
                  <span>{c.name} <span class="small muted">weight {Math.round(c.weight * 100)}%</span></span>
                  <span class="num small">{c.value != null ? `${Number.isInteger(c.value) ? c.value : c.value.toFixed(1)} ${c.unit ?? ''} · ` : ''}<b>{Math.round(c.score)}</b></span>
                  <div class="track"><i style="width:{Math.max(0, Math.min(100, c.score))}%"></i></div>
                  {#if c.source}<div class="source">{c.source}</div>{/if}
                </div>
              {/each}
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <div class="section">
    <div class="cols cols-2-1">
      <div>
        <div class="eyebrow">Apple Watch <span class="aside">{w?.available ? `newest sample ${watchAgo}` : 'nothing pushed yet'}</span></div>
        {#if w?.available}
          <table class="t">
            <thead><tr><th></th><th class="r">Today</th><th class="r">Yesterday</th></tr></thead>
            <tbody>
              <tr><td class="text">Steps</td><td class="r">{F.num(w.today?.steps)}</td><td class="r">{F.num(w.yesterday?.steps)}</td></tr>
              <tr><td class="text">Active energy</td><td class="r">{F.num(w.today?.active_kcal)} kcal</td><td class="r">{F.num(w.yesterday?.active_kcal)} kcal</td></tr>
              <tr><td class="text">Exercise</td><td class="r">{F.num(w.today?.exercise_min)} min</td><td class="r">{F.num(w.yesterday?.exercise_min)} min</td></tr>
              <tr><td class="text">Stand hours</td><td class="r">{F.num(w.today?.stand_hours)}</td><td class="r">{F.num(w.yesterday?.stand_hours)}</td></tr>
              <tr><td class="text">Distance</td><td class="r">{w.today?.distance_m != null ? (w.today.distance_m / 1000).toFixed(1) + ' km' : '—'}</td><td class="r">{w.yesterday?.distance_m != null ? (w.yesterday.distance_m / 1000).toFixed(1) + ' km' : '—'}</td></tr>
            </tbody>
          </table>
          <div class="small sub" style="margin-top: 8px">Day totals take the best single source, so the iPhone and the Watch are never added together.</div>
          {#if w.workouts_48h?.length}
            <table class="t" style="margin-top: 16px">
              <thead><tr><th>Workout</th><th>When</th><th class="r">Duration</th><th class="r">Energy</th><th class="r">Distance</th></tr></thead>
              <tbody>{#each w.workouts_48h as wk}<tr><td class="text">{F.activityLabel(wk.activity)}</td><td>{F.dateTime(wk.start_unix)}</td><td class="r">{wk.duration_min != null ? Math.round(wk.duration_min) + ' min' : '—'}</td><td class="r">{wk.kcal != null ? Math.round(wk.kcal) + ' kcal' : '—'}</td><td class="r">{wk.distance_m != null ? (wk.distance_m / 1000).toFixed(2) + ' km' : '—'}</td></tr>{/each}</tbody>
            </table>
          {/if}
        {:else}
          <div class="empty"><b>No Apple Health data yet.</b>Turn on Apple Health in the app's Health hub settings.</div>
        {/if}
      </div>
      <div>
        <div class="eyebrow">Watch vitals</div>
        <div class="kv">
          <div class="k">Heart rate</div><div class="v">{w?.heart_rate_latest?.value != null ? `${Math.round(w.heart_rate_latest.value)} bpm · ${F.timeHM(w.heart_rate_latest.at_unix ?? 0)}` : '—'}</div>
          <div class="k">Resting heart rate</div><div class="v">{w?.resting_heart_rate?.value != null ? `${Math.round(w.resting_heart_rate.value)} bpm` : '—'}</div>
          <div class="k">HRV (SDNN)</div><div class="v">{w?.hrv_sdnn?.latest?.value != null ? `${Math.round(w.hrv_sdnn.latest.value)} ms` : '—'}{w?.hrv_sdnn?.mean_7d_ms != null ? ` · 7-day mean ${w.hrv_sdnn.mean_7d_ms}` : ''}</div>
          <div class="k">VO₂ max</div><div class="v">{w?.vo2_max?.value != null ? `${w.vo2_max.value} ml/kg/min` : '—'}</div>
          <div class="k">Respiratory rate</div><div class="v">{w?.respiratory_rate?.value != null ? `${w.respiratory_rate.value} /min` : '—'}</div>
          <div class="k">Blood oxygen</div><div class="v">{w?.oxygen_saturation?.value != null ? `${Math.round(w.oxygen_saturation.value * 100)} %` : '—'}</div>
          <div class="k">Wrist temperature</div><div class="v">{w?.wrist_temperature?.value != null ? `${w.wrist_temperature.value.toFixed(2)} °C` : '—'}</div>
          {#if w?.last_sleep}<div class="k">Last sleep (watch)</div><div class="v">{F.minutesText(w.last_sleep.asleep_min)} · {F.timeHM(w.last_sleep.start_unix)} – {F.timeHM(w.last_sleep.end_unix)}</div>{/if}
        </div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="cols cols-2-1">
      <div>
        <div class="eyebrow">Sleep debt <span class="aside">past {debt?.window_days ?? 14} days · need {debt?.need_h ?? 8} h</span></div>
        {#if debt?.valid}
          <p style="margin: 0 0 10px"><span class="hero" style="color: {F.debtColor(debt.state)}">{F.minutesText(debt.debt_min)}</span> <span class="sub">{F.debtCopy(debt.state)}</span></p>
        {:else}
          <p class="sub" style="margin: 0 0 10px">{debt?.valid_days ?? 0} of 5 days available. The debt is the sum of each night's shortfall against your need, discounted over 14 days.</p>
        {/if}
        {#if (debt?.days ?? []).some((d: any) => d.total_sleep_min != null)}
          <table class="t">
            <thead><tr><th>Night</th><th class="r">Slept</th><th class="r">Need</th><th class="r">Shortfall</th><th class="r">Debt</th></tr></thead>
            <tbody>{#each (debt?.days ?? []).filter((d: any) => d.total_sleep_min != null).slice(-14) as d}<tr><td>{F.monthDay(d.date)}</td><td class="r">{F.minutesText(d.total_sleep_min)}</td><td class="r">{F.minutesText(d.sleep_need_min)}</td><td class="r">{d.shortfall_min != null ? F.minutesText(Math.max(0, d.shortfall_min)) : '—'}</td><td class="r">{d.cumulative_debt_min != null ? F.minutesText(d.cumulative_debt_min) : '—'}</td></tr>{/each}</tbody>
          </table>
        {/if}
      </div>
      <div>
        <div class="eyebrow">Ring</div>
        <div class="kv">
          <div class="k">Serial</div><div class="v">{s.device?.serial ?? '—'}</div>
          <div class="k">Firmware</div><div class="v">{s.device?.firmware ?? '—'}</div>
          <div class="k">Battery</div><div class="v">{s.device?.battery_pct != null ? `${s.device.battery_pct} %` : '—'}</div>
          <div class="k">Last sync</div><div class="v">{s.device?.synced ? `${F.monthDay(s.device.synced)} ${s.device.synced_hm ?? ''}` : '—'}</div>
          <div class="k">Days of data</div><div class="v">{s.device?.days_of_data != null ? Math.round(s.device.days_of_data) : '—'}</div>
          <div class="k">Nights</div><div class="v">{s.device?.nights ?? s.nights.length}</div>
          {#if s.fitness?.vo2max != null}<div class="k">VO₂ max (estimate)</div><div class="v">{s.fitness.vo2max.toFixed(0)}</div>{/if}
        </div>
      </div>
    </div>
  </div>
</div>
