<script lang="ts">
  import { BedDouble, Flame, Sparkles, Activity, HeartPulse, Thermometer, Wind, Moon, Radar, HeartHandshake, Watch as WatchIcon, CircleDot, Footprints, ListChecks } from 'lucide-svelte'
  import CardHeader from '../components/CardHeader.svelte'
  import BigValue from '../components/BigValue.svelte'
  import StatRow from '../components/StatRow.svelte'
  import Sparkline from '../components/Sparkline.svelte'
  import Hypnogram from '../components/Hypnogram.svelte'
  import Ridge from '../components/Ridge.svelte'
  import ScoreRing from '../components/ScoreRing.svelte'
  import ScoreBreakdown from '../components/ScoreBreakdown.svelte'
  import TrendChart from '../components/TrendChart.svelte'
  import Empty from '../components/Empty.svelte'
  import { hub } from '../lib/store.svelte'
  import * as F from '../lib/fmt'
  import type { Summary, Night } from '../lib/api'

  let { go }: { go: (route: string) => void } = $props()
  const s = $derived(hub.summary as Summary)
  const w = $derived(hub.watch)
  const days = $derived(F.days(s))
  const day = $derived(days[0] ?? F.todayYmd())
  const night = $derived(F.nightForDay(s, day))
  const act = $derived(s.activity_daily?.[day])
  const profile = $derived(s.activity_profile?.[day] ?? [])
  const scores = $derived(F.SCORE_KINDS.map(k => ({ kind: k, hit: F.latestScore(s, k, day) })))
  const anyScore = $derived(scores.some(x => x.hit))
  const latestHR = $derived(s.vitals?.hr ?? null)
  const nightsByWake = $derived([...s.nights].filter(n => n.ymd).sort((a, b) => (a.ymd! < b.ymd! ? -1 : 1)))
  const temps = $derived(nightsByWake.map(n => n.skin_temp).filter((v): v is number => v != null).slice(-14))
  const oxy = $derived(nightsByWake.map(n => n.spo2_mean).filter((v): v is number => v != null).slice(-14))
  const latestTemp = $derived([...nightsByWake].reverse().find(n => n.skin_temp != null))
  const latestOxy = $derived([...nightsByWake].reverse().find(n => n.spo2_mean != null))
  const ws = $derived(F.workoutsOn(s, day).slice(0, 3))
  const stagePcts = (n: Night) => [[1, n.deep_pct], [2, n.light_pct], [3, n.rem_pct], [4, n.wake_pct]] as [number, number | null | undefined][]
  const vitalCells = $derived([
    { title: 'HRV', icon: Activity, tint: 'var(--hrv)', value: F.num(s.vitals?.hrv?.latest), unit: 'ms', delta: s.vitals?.hrv?.delta_pct, series: s.vitals?.hrv?.series ?? [], baseline: s.vitals?.hrv?.baseline, good: true, route: 'trends/hrv_ms', hint: 'Measured at night.', text: 'Nightly average RMSSD. Higher than your baseline usually means you are recovered.' },
    { title: 'Heart Rate', icon: HeartPulse, tint: 'var(--heart)', value: F.num(latestHR?.latest ?? s.vitals?.rhr?.latest), unit: 'bpm', delta: latestHR ? null : s.vitals?.rhr?.delta_pct, series: s.vitals?.rhr?.series ?? [], baseline: s.vitals?.rhr?.baseline, good: false, route: 'trends/rhr', detail: latestHR?.hm ? `Latest ${F.monthDay(latestHR.date ?? '')} · ${latestHR.hm}` : 'Nightly minimum', hint: 'Wear the ring.', text: 'The line is your lowest heart rate each night. A rise of 5 to 10 bpm above baseline is worth an easy day.' },
    { title: 'Skin Temp', icon: Thermometer, tint: 'var(--temperature)', value: latestTemp?.skin_temp != null ? latestTemp.skin_temp.toFixed(1) : '—', unit: '°C', delta: null, series: temps, baseline: null, good: true, route: 'trends/skin_temp', detail: latestTemp ? `Latest ${F.monthDay(F.wakeYmd(latestTemp) ?? '')}` : '', hint: 'Measured at night.', text: 'Nightly skin temperature. A jump of half a degree often precedes illness by a day.' },
    { title: 'Blood O₂', icon: Wind, tint: 'var(--oxygen)', value: F.num(latestOxy?.spo2_mean), unit: '%', delta: null, series: oxy, baseline: null, good: true, route: 'sleep', detail: latestOxy ? `Latest ${F.monthDay(F.wakeYmd(latestOxy) ?? '')}` : '', hint: 'Turn on SpO₂ on the ring.', text: 'Average blood oxygen during sleep. Values under 95% on several nights are worth a look.' },
  ])
  const debt = $derived(s.sleep_debt)
  const debtDays = $derived((debt?.days ?? []).filter((d: any) => d.total_sleep_min != null).slice(-14))
  const ill = $derived(s.illness)
  const illTint = $derived(ill?.traffic_light === 'MAJOR_SIGNS' ? 'var(--alert)' : ill?.traffic_light === 'MINOR_SIGNS' ? 'var(--caution)' : 'var(--good)')
  const illLabel: Record<string, string> = { NO_SIGNS: 'No Signs', MINOR_SIGNS: 'Minor Signs', MAJOR_SIGNS: 'Major Signs' }
  const illCopy: Record<string, string> = {
    NO_SIGNS: 'No signs of illness. Your biometrics are within your normal range.',
    MINOR_SIGNS: 'A few biometrics have drifted outside your usual range. Worth an easy day.',
    MAJOR_SIGNS: 'Several biometrics are elevated. Your body may be fighting something.',
  }
  const relAge = (d: number) => `${Math.abs(d).toFixed(1)} yr ${d < 0 ? 'younger' : 'older'}`
  const summaryAge = $derived(hub.receivedAt ? F.ago(hub.receivedAt) : '')
  const ringAge = $derived(s.device?.fresh_hours != null && hub.receivedAt ? F.ago(hub.receivedAt - s.device.fresh_hours * 3600) : '')
  // 14-day series for the two big charts
  const hrvPoints = $derived(nightsByWake.filter(n => n.hrv_ms != null).slice(-30).map(n => ({ ymd: F.wakeYmd(n) ?? n.ymd!, value: n.hrv_ms as number })))
  const rhrPoints = $derived(nightsByWake.filter(n => n.rhr != null).slice(-30).map(n => ({ ymd: F.wakeYmd(n) ?? n.ymd!, value: n.rhr as number })))
  const dayScores = $derived(s.scores?.days?.[day] ?? {})
</script>

<div class="page">
  <div class="large-title">Summary</div>
  <div class="subtitle">{F.dayTitle(day)}{summaryAge ? ` · updated ${summaryAge}` : ''}{ringAge ? ` · ring synced ${ringAge}` : ''}</div>

  <div class="grid">
    {#if s.digest}
      <div class="card span8">
        <CardHeader title="Highlights" icon={Sparkles} tint="var(--accent)" />
        <div class="body" style="font-size: 20px">{s.digest}</div>
        <div class="caption">The digest compares last night's HRV and resting heart rate with your 14-day baseline. Scores below are on-device estimates{s.scores?.basis ? ` (${F.scoreBasisLabel(s.scores.basis)})` : ''}.</div>
      </div>
    {/if}
    <div class="card span4">
      <div style="display:flex; justify-content: space-around; gap: 8px">
        {#each scores as { kind, hit }}
          <div style="display:flex; flex-direction:column; align-items:center; gap: 8px; flex: 1; min-width: 0">
            <ScoreRing score={hit?.score ?? null} tint={F.scoreTint(kind)} size={96} lineWidth={10} />
            <div style="text-align:center">
              <div style="font-size:15px; font-weight:600">{F.scoreTitle(kind)}{hit?.provisional ? ' ◌' : ''}</div>
              {#if hit}
                <div class="caption" style="color: {hit.day === day ? F.scoreBand(hit.score).color : 'var(--secondary)'}">{hit.day === day ? F.scoreBand(hit.score).label : F.dayLabel(hit.day)}</div>
              {:else}
                <div class="caption">{kind === 'activity' ? 'Tracking today' : 'After a night'}</div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
      {#if !anyScore}
        <div class="caption">Your scores start after the first night with your ring on.</div>
      {:else if scores.some(x => x.hit?.provisional)}
        <div class="caption">◌ Early estimates. They settle after about two weeks of nights.</div>
      {/if}
    </div>

    <div class="card span8 link" role="button" tabindex="0" onclick={() => go('sleep')} onkeydown={e => e.key === 'Enter' && go('sleep')}>
      <CardHeader title="Sleep" icon={BedDouble} tint="var(--sleep)" detail={night ? `${night.start ?? '—'} – ${night.end ?? '—'}` : ''} chevron />
      {#if night}
        <div class="row">
          <div><div class="label">Time in Bed</div><BigValue parts={night.in_bed_h != null ? F.hoursMinutes(night.in_bed_h) : [['—', '']]} /></div>
          {#if night.metrics?.asleep_min != null}<div><div class="label">Asleep</div><BigValue parts={F.minutesParts(night.metrics.asleep_min)} /></div>{/if}
          {#if F.hasHypnogram(night) && night.efficiency != null}<div><div class="label">Efficiency</div><BigValue parts={[[`${Math.round(night.efficiency)}`, '%']]} /></div>{/if}
          {#if night.hrv_ms != null}<div><div class="label">HRV</div><BigValue parts={[[`${Math.round(night.hrv_ms)}`, 'ms']]} /></div>{/if}
          {#if night.rhr != null}<div><div class="label">Lowest HR</div><BigValue parts={[[`${Math.round(night.rhr)}`, 'bpm']]} /></div>{/if}
        </div>
        {#if F.hasHypnogram(night)}
          <Hypnogram stages={night.stages_full?.length ? night.stages_full : night.stages ?? []} height={90} ticks={F.hourTicks(night.start, night.in_bed_h)} />
          <div class="legend">
            {#each stagePcts(night) as [code, pct]}<span><span class="dot" style="background:{F.stageColor(code)}"></span>{F.stageName(code)} {Math.round(pct ?? 0)}%</span>{/each}
            {#if night.metrics}<span>· fell asleep in {Math.round(night.metrics.sol_min ?? 0)} min</span><span>· {night.metrics.awakenings ?? 0} awakenings</span><span>· {night.metrics.cycles ?? 0} cycles</span>{/if}
          </div>
        {/if}
      {:else}
        <Empty icon={Moon} title="No Sleep Yet" text="Wear your ring tonight. Tomorrow morning, last night will appear here." />
      {/if}
    </div>

    <div class="card span4">
      <CardHeader title="Activity" icon={Flame} tint="var(--activity)" />
      {#if !act && profile.length < 2}
        <Empty icon={Footprints} title="No Movement Yet" text="Steps and active energy appear after the first sync of the day." />
      {:else}
        <div class="row" style="gap: 20px">
          <div><div class="label">Steps</div><BigValue parts={[[F.num(act?.steps), '']]} /></div>
          <div><div class="label">Active</div><BigValue parts={[[F.num(act?.active_kcal), 'kcal']]} /></div>
          <div><div class="label">Total</div><BigValue parts={[[F.num(act?.total_kcal), 'kcal']]} size="small" /></div>
        </div>
      {/if}
      {#if profile.length > 1}<Ridge {profile} height={70} axis />{/if}
      {#if ws.length}
        <div class="divider"></div>
        {#each ws as wk}<div class="stat-row"><span>{F.activityLabel(wk.label)}</span><span class="v muted">{wk.durationMin} min · {wk.start.slice(-5)}</span></div>{/each}
      {/if}
    </div>

    <div class="section-title">Vitals</div>
    {#each vitalCells as c}
      <div class="card span3 link" role="button" tabindex="0" onclick={() => go(c.route)} onkeydown={e => e.key === 'Enter' && go(c.route)}>
        <CardHeader title={c.title} icon={c.icon} tint={c.tint} chevron={c.value !== '—'} />
        {#if c.value !== '—'}
          <BigValue parts={[[c.value, c.unit]]} />
          {#if c.delta != null}
            <div class="caption" style="color: {F.tone(c.delta, c.good)}">{c.delta >= 0 ? '+' : ''}{Math.round(c.delta)}% vs baseline{c.baseline != null ? ` (${F.num(c.baseline, 1)} ${c.unit})` : ''}</div>
          {:else if c.detail}
            <div class="caption">{c.detail}</div>
          {/if}
        {:else}
          <div style="font-size:20px;font-weight:600;color:var(--secondary)">No Data</div>
          <div class="caption">{c.hint}</div>
        {/if}
        {#if c.series.length > 1}<Sparkline series={c.series} accent={c.tint} baseline={c.baseline ?? null} height={64} />{/if}
        <div class="caption">{c.text}</div>
      </div>
    {/each}

    {#if hrvPoints.length > 1 || rhrPoints.length > 1}
      <div class="card span6">
        <CardHeader title="HRV, last 30 nights" icon={Activity} tint="var(--hrv)" detail={s.vitals?.hrv?.baseline != null ? `Baseline ${F.num(s.vitals.hrv.baseline, 1)} ms` : ''} />
        <TrendChart points={hrvPoints} accent="var(--hrv)" baseline={s.vitals?.hrv?.baseline ?? null} unit="ms" height={220} />
      </div>
      <div class="card span6">
        <CardHeader title="Lowest heart rate, last 30 nights" icon={HeartPulse} tint="var(--heart)" detail={s.vitals?.rhr?.baseline != null ? `Baseline ${F.num(s.vitals.rhr.baseline, 1)} bpm` : ''} />
        <TrendChart points={rhrPoints} accent="var(--heart)" baseline={s.vitals?.rhr?.baseline ?? null} unit="bpm" height={220} />
      </div>
    {/if}

    {#if anyScore}
      <div class="section-title">Score breakdown for {F.dayLabel(day).toLowerCase()}</div>
      {#each F.SCORE_KINDS as kind}
        <div class="card span4">
          <CardHeader title={F.scoreTitle(kind)} icon={ListChecks} tint={F.scoreTint(kind)} />
          <ScoreBreakdown title="Contributors" score={dayScores[kind]} tint={F.scoreTint(kind)} />
        </div>
      {/each}
    {/if}

    {#if w?.available}
      <div class="section-title">Apple Watch</div>
      <div class="card span8">
        <CardHeader title="Today" icon={WatchIcon} tint="var(--activity)" detail={w.freshness ? `newest sample ${w.freshness.age_min < 60 ? Math.round(w.freshness.age_min) + ' min' : (w.freshness.age_min / 60).toFixed(1) + ' h'} ago` : ''} />
        <div class="row" style="gap: 32px">
          <div><div class="label">Steps</div><BigValue parts={[[F.num(w.today?.steps), '']]} /></div>
          <div><div class="label">Active</div><BigValue parts={[[F.num(w.today?.active_kcal), 'kcal']]} /></div>
          <div><div class="label">Exercise</div><BigValue parts={[[F.num(w.today?.exercise_min), 'min']]} /></div>
          <div><div class="label">Stand</div><BigValue parts={[[F.num(w.today?.stand_hours), 'hr']]} /></div>
          <div><div class="label">Distance</div><BigValue parts={[[w.today?.distance_m != null ? (w.today.distance_m / 1000).toFixed(1) : '—', 'km']]} /></div>
        </div>
        <div class="caption">Yesterday: {F.num(w.yesterday?.steps)} steps · {F.num(w.yesterday?.active_kcal)} kcal · {F.num(w.yesterday?.exercise_min)} min exercise · {F.num(w.yesterday?.stand_hours)} stand hours. Day totals take the best single source, so the iPhone and the Watch are not added together.</div>
        {#if w.workouts_48h?.length}
          <div class="divider"></div>
          <table class="plain">
            <thead><tr><th>Workout</th><th>When</th><th>Duration</th><th>Energy</th><th>Distance</th><th>Source</th></tr></thead>
            <tbody>
              {#each w.workouts_48h as wk}
                <tr><td>{F.activityLabel(wk.activity)}</td><td>{F.dateTime(wk.start_unix)}</td><td>{wk.duration_min != null ? Math.round(wk.duration_min) + ' min' : '—'}</td><td>{wk.kcal != null ? Math.round(wk.kcal) + ' kcal' : '—'}</td><td>{wk.distance_m != null ? (wk.distance_m / 1000).toFixed(2) + ' km' : '—'}</td><td class="muted">{wk.source ?? ''}</td></tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
      <div class="card span4">
        <CardHeader title="Watch vitals" icon={HeartPulse} tint="var(--heart)" />
        <StatRow label="Heart rate" value={w.heart_rate_latest?.value != null ? `${Math.round(w.heart_rate_latest.value)} bpm · ${F.timeHM(w.heart_rate_latest.at_unix ?? 0)}` : '—'} />
        <StatRow label="Resting heart rate" value={w.resting_heart_rate?.value != null ? `${Math.round(w.resting_heart_rate.value)} bpm` : '—'} />
        <StatRow label="HRV (SDNN), latest" value={w.hrv_sdnn?.latest?.value != null ? `${Math.round(w.hrv_sdnn.latest.value)} ms` : '—'} />
        <StatRow label="HRV (SDNN), 7-day mean" value={w.hrv_sdnn?.mean_7d_ms != null ? `${w.hrv_sdnn.mean_7d_ms} ms` : '—'} />
        <StatRow label="VO₂ max" value={w.vo2_max?.value != null ? `${w.vo2_max.value} ml/kg/min` : '—'} />
        <StatRow label="Respiratory rate" value={w.respiratory_rate?.value != null ? `${w.respiratory_rate.value} /min` : '—'} />
        <StatRow label="Blood oxygen" value={w.oxygen_saturation?.value != null ? `${Math.round(w.oxygen_saturation.value * 100)} %` : '—'} />
        <StatRow label="Wrist temperature" value={w.wrist_temperature?.value != null ? `${w.wrist_temperature.value.toFixed(2)} °C` : '—'} />
        {#if w.last_sleep}
          <div class="divider"></div>
          <StatRow label="Last sleep" value={`${F.minutesText(w.last_sleep.asleep_min)} asleep · ${F.timeHM(w.last_sleep.start_unix)} – ${F.timeHM(w.last_sleep.end_unix)}`} />
          <StatRow label="Stages" value={`deep ${Math.round(w.last_sleep.deep_min)} · core ${Math.round(w.last_sleep.core_min)} · REM ${Math.round(w.last_sleep.rem_min)} · awake ${Math.round(w.last_sleep.awake_min)} min`} />
        {/if}
      </div>
    {/if}

    {#if debt || ill}<div class="section-title">Recovery</div>{/if}
    {#if debt}
      <div class="card span6">
        <CardHeader title="Sleep Debt" icon={Moon} tint="var(--sleep)" detail={`Past ${debt.window_days} days · need ${debt.need_h} h`} />
        {#if debt.valid}
          <div style="display:flex; align-items:baseline; gap:10px">
            <BigValue parts={F.minutesParts(debt.debt_min)} color={F.debtColor(debt.state)} />
            <span class="pill" style="color:{F.debtColor(debt.state)}; background: color-mix(in srgb, {F.debtColor(debt.state)} 14%, transparent)">{F.debtLabel(debt.state)}</span>
          </div>
          <div class="label">{F.debtCopy(debt.state)} Recent shortfall: {F.minutesText(debt.recent_shortfall_min)}.</div>
        {:else}
          <div style="font-size:20px;font-weight:600">{debt.valid_days} of 5 days available</div>
          <div class="label">5 days of sleep data are needed within the past 2 weeks. The debt is the sum of each night's shortfall against your need, discounted over 14 days.</div>
        {/if}
        {#if debtDays.length}
          <table class="plain">
            <thead><tr><th>Night</th><th>Slept</th><th>Need</th><th>Shortfall</th><th>Debt</th></tr></thead>
            <tbody>
              {#each debtDays as d}
                <tr><td>{F.monthDay(d.date)}</td><td>{F.minutesText(d.total_sleep_min)}</td><td>{F.minutesText(d.sleep_need_min)}</td><td>{d.shortfall_min != null ? F.minutesText(Math.max(0, d.shortfall_min)) : '—'}</td><td>{d.cumulative_debt_min != null ? F.minutesText(d.cumulative_debt_min) : '—'}</td></tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
    {/if}
    {#if ill}
      <div class="card span6">
        <CardHeader title="Symptom Radar" icon={Radar} tint={illTint} detail={ill.available ? `${ill.days_with_data ?? 0} of 30 days` : ''} />
        {#if !ill.available}
          <div class="label">{ill.status === 'MISSING_LAST_NIGHT_SLEEP' ? 'Wear the ring overnight and sync. Last night is missing.' : 'Needs more recent nights (at least 7 of the last 14).'}</div>
        {:else}
          <div style="font-size:22px;font-weight:600">{illLabel[ill.traffic_light] ?? '—'}</div>
          <div class="label">{illCopy[ill.status] ?? ''}</div>
          {#if ill.biomarkers?.length}
            <table class="plain">
              <thead><tr><th>Biomarker</th><th>Value</th><th>Normal range</th><th></th></tr></thead>
              <tbody>{#each ill.biomarkers as b}<tr><td>{b.type}</td><td>{b.value}</td><td>{b.lower} – {b.upper}</td><td style="color: {b.reason ? 'var(--caution)' : 'var(--good)'}">{b.reason ?? 'in range'}</td></tr>{/each}</tbody>
            </table>
          {/if}
        {/if}
      </div>
    {/if}

    <div class="section-title">Body and ring</div>
    <div class="card span6">
      <CardHeader title="Heart Health" icon={HeartHandshake} tint="var(--cardio)" />
      {#if s.cardio?.vascular_age != null}
        <div class="label">Vascular age</div>
        <BigValue parts={[[s.cardio.vascular_age.toFixed(1), 'yr']]} />
        {#if s.cardio.chronological_age != null}
          <div class="label" style="color:{F.tone((s.cardio.vascular_age - s.cardio.chronological_age) * 100, false, 50)}">{relAge(s.cardio.vascular_age - s.cardio.chronological_age)} than your age</div>
        {/if}
        {#if s.cardio.pwv_ms != null}<div class="divider"></div><StatRow label="Pulse speed in arteries" value={`${s.cardio.pwv_ms.toFixed(1)} m/s`} />{/if}
      {:else}
        <div class="caption">Vascular age needs the on-device cardio model and a few nights of raw PPG. It arrives after the ring records with Cardio PPG on.</div>
      {/if}
      {#if s.fitness?.vo2max != null}
        <div class="divider"></div>
        <StatRow label="Cardio fitness (VO₂ max, estimate)" value={s.fitness.vo2max.toFixed(0)} />
        <div class="caption">The ring's VO₂ max is the Jackson non-exercise estimate from age, sex, and weight. The Watch measures it from outdoor walks and runs{w?.vo2_max?.value != null ? `: ${w.vo2_max.value} ml/kg/min` : ''}.</div>
      {/if}
    </div>
    <div class="card span6">
      <CardHeader title="Ring" icon={CircleDot} tint="var(--device)" detail={s.device?.firmware ? `Firmware ${s.device.firmware}` : ''} />
      {#if s.device?.battery_pct != null}
        <div class="row"><div><div class="label">Battery</div><BigValue parts={[[`${s.device.battery_pct}`, '%']]} color={s.device.battery_pct < 20 ? 'var(--alert)' : 'var(--text)'} /></div></div>
      {/if}
      <div class="divider"></div>
      <StatRow label="Serial" value={s.device?.serial ?? '—'} />
      <StatRow label="Last sync" value={s.device?.synced ? `${F.monthDay(s.device.synced)} ${s.device.synced_hm ?? ''}` : '—'} />
      <StatRow label="Days of data" value={s.device?.days_of_data != null ? `${Math.round(s.device.days_of_data)}` : '—'} />
      <StatRow label="Nights" value={`${s.device?.nights ?? s.nights.length}`} />
      <StatRow label="Summary built by" value={s.pushed_by ? `${s.pushed_by.client} ${s.pushed_by.version}` : '—'} />
    </div>
  </div>
</div>
