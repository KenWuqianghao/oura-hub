<script lang="ts">
  import { BedDouble, Flame, Sparkles, Activity, HeartPulse, Thermometer, Wind, Moon, Radar, HeartHandshake, Watch as WatchIcon, CircleDot, Footprints } from 'lucide-svelte'
  import CardHeader from '../components/CardHeader.svelte'
  import BigValue from '../components/BigValue.svelte'
  import StatRow from '../components/StatRow.svelte'
  import Sparkline from '../components/Sparkline.svelte'
  import Hypnogram from '../components/Hypnogram.svelte'
  import Ridge from '../components/Ridge.svelte'
  import ScoreRing from '../components/ScoreRing.svelte'
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
  const ws = $derived(F.workoutsOn(s, day).slice(0, 2))
  const stagePcts = (n: Night) => [[1, n.deep_pct], [2, n.light_pct], [3, n.rem_pct], [4, n.wake_pct]] as [number, number | null | undefined][]
  const vitalCells = $derived([
    { title: 'HRV', icon: Activity, tint: 'var(--hrv)', value: F.num(s.vitals?.hrv?.latest), unit: 'ms', delta: s.vitals?.hrv?.delta_pct, series: s.vitals?.hrv?.series ?? [], baseline: s.vitals?.hrv?.baseline, good: true, route: 'trends/hrv_ms', hint: 'Measured at night.' },
    { title: 'Heart Rate', icon: HeartPulse, tint: 'var(--heart)', value: F.num(latestHR?.latest ?? s.vitals?.rhr?.latest), unit: 'bpm', delta: latestHR ? null : s.vitals?.rhr?.delta_pct, series: s.vitals?.rhr?.series ?? [], baseline: s.vitals?.rhr?.baseline, good: false, route: 'trends/rhr', detail: latestHR?.hm ? `Latest ${F.monthDay(latestHR.date ?? '')} · ${latestHR.hm}` : 'Nightly minimum', hint: 'Wear the ring.' },
    { title: 'Skin Temp', icon: Thermometer, tint: 'var(--temperature)', value: latestTemp?.skin_temp != null ? latestTemp.skin_temp.toFixed(1) : '—', unit: '°C', delta: null, series: temps, baseline: null, good: true, route: 'trends/skin_temp', detail: latestTemp ? `Latest ${F.monthDay(F.wakeYmd(latestTemp) ?? '')}` : '', hint: 'Measured at night.' },
    { title: 'Blood O₂', icon: Wind, tint: 'var(--oxygen)', value: F.num(latestOxy?.spo2_mean), unit: '%', delta: null, series: oxy, baseline: null, good: true, route: 'sleep', detail: latestOxy ? `Latest ${F.monthDay(F.wakeYmd(latestOxy) ?? '')}` : '', hint: 'Turn on SpO₂ on the ring.' },
  ])
  const debt = $derived(s.sleep_debt)
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
</script>

<div class="page">
  <div class="large-title">Summary</div>
  <div class="subtitle">{summaryAge ? `Updated ${summaryAge}` : ''}{s.device?.fresh_hours != null ? ` · ring synced ${s.device.fresh_hours.toFixed(1)} h before that` : ''}</div>

  <div class="stack">
    {#if s.digest}
      <div class="card">
        <CardHeader title="Highlights" icon={Sparkles} tint="var(--accent)" />
        <div class="body">{s.digest}</div>
      </div>
    {/if}

    <div class="section-title">{F.dayLabel(day)}</div>

    <div class="card">
      <div style="display:flex; justify-content: space-around; gap: 8px">
        {#each scores as { kind, hit }}
          <div style="display:flex; flex-direction:column; align-items:center; gap: 8px; flex: 1; min-width: 0">
            <ScoreRing score={hit?.score ?? null} tint={F.scoreTint(kind)} />
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
        <div class="caption">◌ Scores with a dotted mark are early estimates. They settle after about two weeks of nights.</div>
      {/if}
    </div>

    <div class="card link" role="button" tabindex="0" onclick={() => go('sleep')} onkeydown={e => e.key === 'Enter' && go('sleep')}>
      <CardHeader title="Sleep" icon={BedDouble} tint="var(--sleep)" detail={night ? `${night.start ?? '—'} – ${night.end ?? '—'}` : ''} chevron />
      {#if night}
        <div style="display:flex; justify-content:space-between; align-items:flex-end; gap: 8px">
          <div><div class="label">Time in Bed</div><BigValue parts={night.in_bed_h != null ? F.hoursMinutes(night.in_bed_h) : [['—', '']]} /></div>
          {#if F.hasHypnogram(night) && night.efficiency != null}
            <div style="text-align:right"><div class="label">Efficiency</div><BigValue parts={[[`${Math.round(night.efficiency)}`, '%']]} size="small" /></div>
          {/if}
        </div>
        {#if F.hasHypnogram(night)}
          <Hypnogram stages={night.stages ?? []} height={34} />
          <div style="display:flex; gap: 14px; flex-wrap: wrap" class="footnote tabular">
            {#each stagePcts(night) as [code, pct]}
              <span><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:{F.stageColor(code)};margin-right:4px"></span>{F.stageName(code)} {Math.round(pct ?? 0)}%</span>
            {/each}
          </div>
        {/if}
      {:else}
        <Empty icon={Moon} title="No Sleep Yet" text="Wear your ring tonight. Tomorrow morning, last night will appear here." />
      {/if}
    </div>

    <div class="card">
      <CardHeader title="Activity" icon={Flame} tint="var(--activity)" />
      {#if !act && profile.length < 2}
        <Empty icon={Footprints} title="No Movement Yet" text="Steps and active energy appear after the first sync of the day." />
      {:else}
        <div style="display:flex; gap: 24px">
          <div><div class="label">Steps</div><BigValue parts={[[F.num(act?.steps), '']]} /></div>
          <div><div class="label">Active Energy</div><BigValue parts={[[F.num(act?.active_kcal), 'kcal']]} /></div>
        </div>
      {/if}
      {#if profile.length > 1}<Ridge {profile} height={40} />{/if}
      {#if ws.length}
        <div class="divider"></div>
        {#each ws as wk}
          <div class="stat-row"><span>{F.activityLabel(wk.label)}</span><span class="v muted">{wk.durationMin} min · {wk.start.slice(-5)}</span></div>
        {/each}
      {/if}
    </div>

    <div class="section-title">Vitals</div>
    <div class="grid2">
      {#each vitalCells as c}
        <div class="card link" role="button" tabindex="0" onclick={() => go(c.route)} onkeydown={e => e.key === 'Enter' && go(c.route)}>
          <CardHeader title={c.title} icon={c.icon} tint={c.tint} chevron={c.value !== '—'} />
          {#if c.value !== '—'}
            <BigValue parts={[[c.value, c.unit]]} size="small" />
            {#if c.delta != null}
              <div class="caption" style="color: {F.tone(c.delta, c.good)}">{c.delta >= 0 ? '+' : ''}{Math.round(c.delta)}% vs baseline</div>
            {:else if c.detail}
              <div class="caption">{c.detail}</div>
            {/if}
          {:else}
            <div style="font-size:20px;font-weight:600;color:var(--secondary)">No Data</div>
            <div class="caption">{c.hint}</div>
          {/if}
          {#if c.series.length > 1}<Sparkline series={c.series} accent={c.tint} baseline={c.baseline ?? null} />{/if}
        </div>
      {/each}
    </div>

    {#if w?.available}
      <div class="section-title">Apple Watch</div>
      <div class="card">
        <CardHeader title="Today" icon={WatchIcon} tint="var(--activity)" detail={w.freshness ? `${w.freshness.age_min < 60 ? Math.round(w.freshness.age_min) + ' min' : (w.freshness.age_min / 60).toFixed(1) + ' h'} ago` : ''} />
        <div style="display:flex; gap: 24px; flex-wrap: wrap">
          <div><div class="label">Steps</div><BigValue parts={[[F.num(w.today?.steps), '']]} size="small" /></div>
          <div><div class="label">Active</div><BigValue parts={[[F.num(w.today?.active_kcal), 'kcal']]} size="small" /></div>
          <div><div class="label">Exercise</div><BigValue parts={[[F.num(w.today?.exercise_min), 'min']]} size="small" /></div>
          <div><div class="label">Stand</div><BigValue parts={[[F.num(w.today?.stand_hours), 'hr']]} size="small" /></div>
        </div>
        <div class="divider"></div>
        <StatRow label="Heart rate" value={w.heart_rate_latest?.value != null ? `${Math.round(w.heart_rate_latest.value)} bpm · ${F.timeHM(w.heart_rate_latest.at_unix ?? 0)}` : '—'} />
        <StatRow label="Resting heart rate" value={w.resting_heart_rate?.value != null ? `${Math.round(w.resting_heart_rate.value)} bpm` : '—'} />
        <StatRow label="HRV (SDNN), 7-day mean" value={w.hrv_sdnn?.mean_7d_ms != null ? `${w.hrv_sdnn.mean_7d_ms} ms` : '—'} />
        <StatRow label="VO₂ max" value={w.vo2_max?.value != null ? `${w.vo2_max.value}` : '—'} />
        {#if w.last_sleep}
          <div class="divider"></div>
          <StatRow label="Last sleep (watch)" value={`${F.minutesText(w.last_sleep.asleep_min)} · deep ${Math.round(w.last_sleep.deep_min)} · REM ${Math.round(w.last_sleep.rem_min)} min`} />
        {/if}
        {#if w.workouts_48h?.length}
          <div class="divider"></div>
          {#each w.workouts_48h.slice(0, 3) as wk}
            <div class="stat-row"><span>{F.activityLabel(wk.activity)}</span><span class="v muted">{wk.duration_min != null ? Math.round(wk.duration_min) + ' min' : ''}{wk.kcal != null ? ` · ${Math.round(wk.kcal)} kcal` : ''} · {F.dateTime(wk.start_unix)}</span></div>
          {/each}
        {/if}
      </div>
    {/if}

    {#if debt || ill}
      <div class="section-title">Recovery</div>
    {/if}
    {#if debt}
      <div class="card">
        <CardHeader title="Sleep Debt" icon={Moon} tint="var(--sleep)" detail={`Past ${debt.window_days} days`} />
        {#if debt.valid}
          <div style="display:flex; align-items:baseline; gap:10px">
            <BigValue parts={F.minutesParts(debt.debt_min)} color={F.debtColor(debt.state)} />
            <span class="pill" style="color:{F.debtColor(debt.state)}; background: color-mix(in srgb, {F.debtColor(debt.state)} 14%, transparent)">{F.debtLabel(debt.state)}</span>
          </div>
          <div class="label">{F.debtCopy(debt.state)}</div>
        {:else}
          <div style="font-size:20px;font-weight:600">{debt.valid_days} of 5 days available</div>
          <div class="label">5 days of sleep data are needed within the past 2 weeks.</div>
        {/if}
      </div>
    {/if}
    {#if ill}
      <div class="card">
        <CardHeader title="Symptom Radar" icon={Radar} tint={illTint} detail={ill.available ? `${ill.days_with_data ?? 0} of 30 days` : ''} />
        {#if !ill.available}
          <div class="label">{ill.status === 'MISSING_LAST_NIGHT_SLEEP' ? 'Wear the ring overnight and sync. Last night is missing.' : 'Needs more recent nights (at least 7 of the last 14).'}</div>
        {:else}
          <div style="font-size:20px;font-weight:600">{illLabel[ill.traffic_light] ?? '—'}</div>
          <div class="label">{illCopy[ill.status] ?? ''}</div>
        {/if}
      </div>
    {/if}

    {#if s.cardio?.vascular_age != null || s.fitness?.vo2max != null}
      <div class="section-title">Cardiovascular</div>
      <div class="card">
        <CardHeader title="Heart Health" icon={HeartHandshake} tint="var(--cardio)" />
        {#if s.cardio?.vascular_age != null}
          <div class="label">Vascular age</div>
          <BigValue parts={[[s.cardio.vascular_age.toFixed(1), 'yr']]} />
          {#if s.cardio.chronological_age != null}
            <div class="label" style="color:{F.tone((s.cardio.vascular_age - s.cardio.chronological_age) * 100, false, 50)}">{relAge(s.cardio.vascular_age - s.cardio.chronological_age)} than your age</div>
          {/if}
          {#if s.cardio.pwv_ms != null}<div class="divider"></div><StatRow label="Pulse speed in arteries" value={`${s.cardio.pwv_ms.toFixed(1)} m/s`} />{/if}
        {/if}
        {#if s.fitness?.vo2max != null}
          {#if s.cardio?.vascular_age != null}<div class="divider"></div>{/if}
          <StatRow label="Cardio fitness (VO₂ max)" value={s.fitness.vo2max.toFixed(0)} />
        {/if}
      </div>
    {/if}

    <div class="section-title">Ring</div>
    <div class="card">
      <CardHeader title="Device" icon={CircleDot} tint="var(--device)" detail={s.device?.firmware ? `Firmware ${s.device.firmware}` : ''} />
      {#if s.device?.battery_pct != null}
        <BigValue parts={[[`${s.device.battery_pct}`, '%']]} size="small" color={s.device.battery_pct < 20 ? 'var(--alert)' : 'var(--text)'} />
      {/if}
      <div class="divider"></div>
      <StatRow label="Serial" value={s.device?.serial ?? '—'} />
      <StatRow label="Last sync" value={s.device?.synced ? `${F.monthDay(s.device.synced)} ${s.device.synced_hm ?? ''}` : '—'} />
      <StatRow label="Days of data" value={s.device?.days_of_data != null ? `${Math.round(s.device.days_of_data)}` : '—'} />
      <StatRow label="Nights" value={`${s.device?.nights ?? s.nights.length}`} />
    </div>
  </div>
</div>
