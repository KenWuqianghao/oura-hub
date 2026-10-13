<script lang="ts">
  import { ChevronLeft, ChevronRight } from 'lucide-svelte'
  import DayStrip from '../components/DayStrip.svelte'
  import NightChart from '../components/NightChart.svelte'
  import Small from '../components/Small.svelte'
  import Meter from '../components/Meter.svelte'
  import Section from '../components/Section.svelte'
  import KV from '../components/KV.svelte'
  import Seg from '../components/Seg.svelte'
  import Num from '../components/Num.svelte'
  import Empty from '../components/Empty.svelte'
  import AppleHealthDay from '../components/today/AppleHealthDay.svelte'
  import { hub, selectDay } from '../lib/store.svelte'
  import { t, i18n, has } from '../lib/i18n.svelte'
  import { zhRingText } from '../i18n/today'
  import { activityTitle } from '../lib/kinds'
  import { nightRows, nightAside } from '../lib/night'
  import { resource } from '../lib/health.svelte'
  import { loadDayHealth } from '../lib/todayHealth'
  import { oneNightPerWakeDay } from '../lib/trendsRing'
  import * as F from '../lib/fmt'
  import type { Summary, Night, Contributor } from '../lib/api'

  const s = $derived(hub.summary as Summary)
  const w = $derived(hub.watch)
  const day = $derived(hub.day || F.todayYmd())
  const isToday = $derived(day === F.todayYmd())
  // Apple Health for the selected day; the last day stays on screen while the next one loads, so the numbers tween
  const health = resource(() => loadDayHealth(day))
  const totals = $derived(health.data?.totals)
  const night = $derived(F.nightForDay(s, day))
  const act = $derived(s.activity_daily?.[day])
  const profile = $derived(s.activity_profile?.[day] ?? [])
  const prevProfile = $derived(s.activity_profile?.[F.addDays(day, -1)] ?? [])
  const scores = $derived(F.SCORE_KINDS.map(k => {
    const hit = F.latestScore(s, k, day)
    const last7 = Array.from({ length: 7 }, (_, i) => { const d = F.addDays(day, i - 6); const sc = s.scores?.days?.[d]?.[k]; return sc && typeof sc.score === 'number' ? sc.score : null })
    return { kind: k, hit, last7 }
  }))
  const nightsByWake = $derived(oneNightPerWakeDay(s.nights))
  let range = $state(30)
  const series = (pick: (n: Night) => number | null | undefined) => nightsByWake.filter(({ night }) => pick(night) != null).slice(-range).map(({ ymd, night }) => ({ ymd, value: pick(night) as number }))
  const stepsSeries = $derived(Object.entries(s.activity_daily ?? {}).sort().slice(-range).filter(([, v]) => v.steps != null).map(([ymd, v]) => ({ ymd, value: v.steps as number })))
  const smalls = $derived([
    { title: t('common.hrv'), unit: 'ms', points: series(n => n.hrv_ms), baseline: s.vitals?.hrv?.baseline ?? null, color: '--c-heart', text: t('today.hrv_text'), route: 'trends/hrv_ms' },
    { title: t('common.lowest_heart_rate'), unit: 'bpm', points: series(n => n.rhr), baseline: s.vitals?.rhr?.baseline ?? null, color: '--c-heart', text: t('today.rhr_text'), route: 'trends/rhr' },
    { title: t('today.time_asleep'), unit: 'min', points: series(n => n.metrics?.asleep_min ?? (n.in_bed_h != null ? n.in_bed_h * 60 : null)), baseline: s.sleep_debt?.need_h ? s.sleep_debt.need_h * 60 : null, color: '--c-sleep', text: t('today.asleep_text'), route: 'trends/asleep_min' },
    { title: t('common.steps'), unit: '', points: stepsSeries, baseline: null, color: '--c-activity', text: t('today.steps_text'), route: 'trends/steps' },
  ])
  const debt = $derived(s.sleep_debt)
  const ill = $derived(s.illness)
  const dayScores = $derived(s.scores?.days?.[day] ?? {})
  const workouts = $derived([...(hub.dayData?.workouts ?? []), ...F.workoutsOn(s, day).map(wk => ({ start: F.hmOnDay(wk.start.slice(0, 10), wk.start.slice(-5)), end: F.hmOnDay(wk.start.slice(0, 10), wk.start.slice(-5)) + wk.durationMin * 60_000, label: wk.label, source: 'ring' }))])
  const ringAgo = $derived(s.device?.fresh_hours != null && hub.receivedAt ? F.ago(hub.receivedAt - s.device.fresh_hours * 3600) : '—')
  const watchAgo = $derived(w?.freshness ? F.ago(w.freshness.newest_sample_unix) : '—')
  const hrDay = $derived(hub.dayData?.day === day ? hub.dayData.hr : [])

  // the phone's digest sentence is English free text: in Chinese the lede is built from the night's fields
  const lede = $derived.by(() => {
    if (isToday && s.digest && i18n.locale === 'en') return s.digest
    if (!night) return null
    const a = [night.in_bed_h != null ? t('today.lede_in_bed', { time: F.hoursText(night.in_bed_h) }) : '', night.efficiency != null ? t('today.lede_eff', { n: Math.round(night.efficiency) }) : ''].filter(Boolean)
    const b = [night.hrv_ms != null ? t('today.lede_hrv', { n: Math.round(night.hrv_ms) }) : '', night.rhr != null ? t('today.lede_rhr', { n: Math.round(night.rhr) }) : ''].filter(Boolean)
    const cap = (x: string) => x ? x[0].toUpperCase() + x.slice(1) : x
    return [a, b].filter(p => p.length).map(p => cap(p.join(t('common.list_sep'))) + t('today.lede_stop')).join(t('today.lede_gap'))
  })
  const ringText = (text: string | undefined) => text ? (i18n.locale === 'zh' ? zhRingText[text] ?? text : text) : ''
  const contributorName = (c: Contributor) => { const key = `today.c_${c.key}`; return has(key) ? t(key) : c.name }
  const scoreNote = (sc: typeof scores[number]) => !sc.hit ? t(sc.kind === 'activity' ? 'today.tracking_today' : 'today.after_night')
    : sc.hit.day !== day ? t('today.from_day', { day: i18n.locale === 'en' ? F.dayLabel(sc.hit.day).toLowerCase() : F.dayLabel(sc.hit.day) })
    : dayScores[sc.kind]?.contributors ? t('today.contributors_n', { n: dayScores[sc.kind].contributors!.length }) : ''
  const basis = $derived(s.scores?.basis ? (i18n.locale === 'zh' ? t('today.basis') : s.scores.basis.replace(/ — see .*$/, '')) : '')
</script>

<div class="wrap">
  <div class="section">
    <div class="cols cols-2-1">
      <div>
        <div class="day-nav">
          <button class="btn quiet icon" aria-label={t('today.prev_day')} title={t('today.prev_day')} onclick={() => selectDay(F.addDays(day, -1))}><ChevronLeft size={18} /></button>
          <h1 class="large-title">{F.dayTitle(day)}</h1>
          <button class="btn quiet icon" aria-label={t('today.next_day')} title={t('today.next_day')} onclick={() => selectDay(F.addDays(day, 1))} disabled={isToday}><ChevronRight size={18} /></button>
          {#if !isToday}<button class="btn" onclick={() => selectDay(F.todayYmd())}>{t('common.today')}</button>{/if}
        </div>
        <p class="lede" class:sub={!lede}>{lede ?? t('today.no_night')}</p>
        <div class="meters">
          {#each scores as sc}
            <Meter name={F.scoreTitle(sc.kind)} score={sc.hit?.score ?? null} days={sc.last7} provisional={!!sc.hit?.provisional} note={scoreNote(sc)} />
          {/each}
        </div>
      </div>
      <div>
        <div class="eyebrow">{t('today.status')}</div>
        <KV rows={[
          [t('today.ring_synced'), `${ringAgo}${s.device?.battery_pct != null ? ` · ${t('today.battery_n', { n: s.device.battery_pct })}` : ''}`],
          [t('today.watch_newest'), watchAgo],
          [t('today.summary_built'), `${hub.receivedAt ? F.ago(hub.receivedAt) : '—'}${s.pushed_by ? ` · ${s.pushed_by.client} ${s.pushed_by.version}` : ''}`],
        ]}>
          <dt class="k">{t('today.sleep_debt')}</dt><dd class="v">{debt?.valid ? `${F.minutesText(debt.debt_min)} · ` : ''}<span class="pill {F.debtTone(debt?.state)}">{debt?.valid ? F.debtLabel(debt.state) : t('today.debt_days', { n: debt?.valid_days ?? 0 })}</span></dd>
          <dt class="k">{t('today.illness')}</dt><dd class="v"><span class="pill {ill?.available ? F.illnessTone(ill.traffic_light) : 'neutral'}">{ill?.available ? F.illnessLabel(ill.traffic_light) : t('today.needs_nights')}</span></dd>
          {#if s.cardio?.vascular_age != null}<dt class="k">{t('today.vascular_age')}</dt><dd class="v">{t('today.age_yr', { n: F.num(s.cardio.vascular_age, 1) })}{s.cardio.chronological_age != null ? t('today.you_are', { n: s.cardio.chronological_age }) : ''}</dd>{/if}
        </KV>
      </div>
    </div>
  </div>

  <div class="section flush">
    <DayStrip {day} dayStart={F.dayStartMs(day)} nights={s.nights} hr={hrDay} {profile} {prevProfile} {workouts} />
    <div class="cols cols-4" style="margin-top: 14px; gap: 0 32px">
      <div class="stat"><div class="label">{t('today.steps_ring')}</div><div class="value"><Num value={act?.steps} /></div><div class="delta">{totals?.step_count != null ? t('today.watch_n', { n: F.num(totals.step_count) }) : ''}</div></div>
      <div class="stat"><div class="label">{t('common.active_energy')}</div><div class="value"><Num value={act?.active_kcal} /><small>kcal</small></div><div class="delta">{act?.total_kcal != null ? t('today.kcal_total', { n: F.num(act.total_kcal) }) : ''}</div></div>
      <div class="stat"><div class="label">{t('today.exercise_watch')}</div><div class="value"><Num value={totals?.exercise_time} /><small>{t('common.min')}</small></div><div class="delta">{totals?.stand_hour != null ? t('today.stand_hours_n', { n: F.num(totals.stand_hour) }) : ''}</div></div>
      <div class="stat"><div class="label">{t('today.workouts')}</div><div class="value"><Num value={workouts.length} /></div><div class="delta">{workouts.map(x => activityTitle(x.label)).slice(0, 3).join(' · ')}</div></div>
    </div>
  </div>

  <Section title={t('today.last_nights', { n: range })}>
    {#snippet right()}<Seg bind:value={range} options={[14, 30, 90].map(n => ({ value: n, label: t('common.days_n', { n }) }))} label={t('today.nights_range')} />{/snippet}
    <div class="cols cols-4">
      {#each smalls as sm (sm.route)}
        <div>
          <div style="display:flex; align-items:baseline; justify-content:space-between; gap: 8px">
            <h2 style="margin:0"><a href={'#/' + sm.route} style="color:inherit">{sm.title}</a></h2>
            <span class="num small sub">{#if sm.points.length}<Num value={sm.points[sm.points.length - 1].value} />{sm.unit ? ' ' + sm.unit : ''}{/if}</span>
          </div>
          <Small points={sm.points} baseline={sm.baseline} unit={sm.unit} color={sm.color} />
          <div class="small sub" style="margin-top: 4px">{sm.text}</div>
        </div>
      {/each}
    </div>
  </Section>

  {#if night}
    <Section title={t('today.the_night')} aside={nightAside(night)}>
      <div class="cols cols-1-3">
        <KV rows={nightRows(night)} />
        <div class="panel"><div class="panel-body"><NightChart {night} height={440} /></div></div>
      </div>
    </Section>
  {/if}

  {#if scores.some(x => x.hit)}
    <Section title={t('today.what_made')} aside={basis}>
      <div class="cols cols-3">
        {#each scores as { kind, hit } (kind)}
          {@const sc = dayScores[kind] ?? (hit ? s.scores?.days?.[hit.day]?.[kind] : null)}
          <div>
            <h2>{F.scoreTitle(kind)}{sc ? ` · ${Math.round(sc.score)}` : ''}</h2>
            {#if !sc}<div class="empty small">{t('today.no_score')}</div>{:else}
              {#each (sc.contributors ?? []) as c (c.key)}
                <div class="contrib">
                  <span>{contributorName(c)} <span class="small muted">{t('today.weight_n', { n: Math.round(c.weight * 100) })}</span></span>
                  <span class="num small">{c.value != null ? `${Number.isInteger(c.value) ? c.value : F.num(c.value, 1)} ${ringText(c.unit)} · ` : ''}<b>{Math.round(c.score)}</b></span>
                  <div class="track"><i style="width:{Math.max(0, Math.min(100, c.score))}%"></i></div>
                  {#if c.source}<div class="source">{ringText(c.source)}</div>{/if}
                </div>
              {/each}
            {/if}
          </div>
        {/each}
      </div>
    </Section>
  {/if}

  <div class="section">
    <div class="cols cols-2-1">
      <div>
        <div class="eyebrow">Apple Watch <span class="aside">{w?.available ? t('today.newest_sample', { ago: watchAgo }) : t('today.nothing_pushed')}</span></div>
        {#if w?.available}
          <AppleHealthDay data={health.data} error={health.error} loading={health.loading} />
        {:else}
          <Empty title={t('today.no_health_title')} text={t('today.no_health_text')} />
        {/if}
      </div>
      <div>
        <div class="eyebrow">{t('today.watch_vitals')}</div>
        <KV rows={[
          [t('common.heart_rate'), w?.heart_rate_latest?.value != null ? `${Math.round(w.heart_rate_latest.value)} bpm · ${F.timeHM(w.heart_rate_latest.at_unix ?? 0)}` : null],
          [t('common.resting_heart_rate'), w?.resting_heart_rate?.value != null ? `${Math.round(w.resting_heart_rate.value)} bpm` : null],
          [t('today.hrv_sdnn'), w?.hrv_sdnn?.latest?.value != null ? `${Math.round(w.hrv_sdnn.latest.value)} ms${w.hrv_sdnn.mean_7d_ms != null ? ` · ${t('today.mean_7d_n', { n: w.hrv_sdnn.mean_7d_ms })}` : ''}` : null],
          [t('today.vo2_max'), w?.vo2_max?.value != null ? `${w.vo2_max.value} ml/kg/min` : null],
          [t('today.respiratory_rate'), w?.respiratory_rate?.value != null ? `${w.respiratory_rate.value} /min` : null],
          [t('common.blood_oxygen'), w?.oxygen_saturation?.value != null ? `${Math.round(w.oxygen_saturation.value * 100)} %` : null],
          [t('today.wrist_temp'), w?.wrist_temperature?.value != null ? `${F.num(w.wrist_temperature.value, 2)} °C` : null],
          w?.last_sleep && [t('today.last_sleep_watch'), `${F.minutesText(w.last_sleep.asleep_min)} · ${F.timeHM(w.last_sleep.start_unix)} – ${F.timeHM(w.last_sleep.end_unix)}`],
        ]} />
      </div>
    </div>
  </div>

  <div class="section">
    <div class="cols cols-2-1">
      <div>
        <div class="eyebrow">{t('today.sleep_debt')} <span class="aside">{t('today.debt_aside', { days: debt?.window_days ?? 14, h: debt?.need_h ?? 8 })}</span></div>
        {#if debt?.valid}
          <p style="margin: 0 0 10px"><span class="hero tone-{F.debtTone(debt.state)}">{F.minutesText(debt.debt_min)}</span> <span class="sub">{F.debtCopy(debt.state)}</span></p>
        {:else}
          <p class="sub" style="margin: 0 0 10px">{t('today.debt_pending', { n: debt?.valid_days ?? 0 })}</p>
        {/if}
        {#if (debt?.days ?? []).some((d: any) => d.total_sleep_min != null)}
          <div class="table-scroll"><table class="t">
            <thead><tr><th>{t('today.night')}</th><th class="r">{t('today.slept')}</th><th class="r">{t('today.need')}</th><th class="r">{t('today.shortfall')}</th><th class="r">{t('today.debt')}</th></tr></thead>
            <tbody>{#each (debt?.days ?? []).filter((d: any) => d.total_sleep_min != null).slice(-14) as d}<tr><td>{F.monthDay(d.date)}</td><td class="r">{F.minutesText(d.total_sleep_min)}</td><td class="r">{F.minutesText(d.sleep_need_min)}</td><td class="r">{d.shortfall_min != null ? F.minutesText(Math.max(0, d.shortfall_min)) : '—'}</td><td class="r">{d.cumulative_debt_min != null ? F.minutesText(d.cumulative_debt_min) : '—'}</td></tr>{/each}</tbody>
          </table></div>
        {/if}
      </div>
      <div>
        <div class="eyebrow">{t('today.ring')}</div>
        <KV rows={[
          [t('today.serial'), s.device?.serial],
          [t('today.firmware'), s.device?.firmware],
          [t('today.battery'), s.device?.battery_pct != null ? `${s.device.battery_pct} %` : null],
          [t('today.last_sync'), s.device?.synced ? `${F.monthDay(s.device.synced)} ${s.device.synced_hm ?? ''}` : null],
          [t('today.days_of_data'), s.device?.days_of_data != null ? Math.round(s.device.days_of_data) : null],
          [t('today.nights'), s.device?.nights ?? s.nights.length],
          s.fitness?.vo2max != null && [t('today.vo2_estimate'), F.num(s.fitness.vo2max)],
        ]} />
      </div>
    </div>
  </div>
</div>

<style>
  .day-nav { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-left: -8px; }
  .meters { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0 32px; margin-top: 18px; }
  @media (max-width: 560px) { .meters { grid-template-columns: minmax(0, 1fr); } }
</style>
