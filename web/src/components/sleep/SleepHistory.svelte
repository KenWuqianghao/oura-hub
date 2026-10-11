<script lang="ts">
  // The long-term sleep history from Apple Health: a sentence that compares the
  // period with the one before, time asleep by stage, bedtime and wake time, the
  // facts of the period, and every night as a table.
  import RangePicker from '../RangePicker.svelte'
  import KV from '../KV.svelte'
  import Skeleton from '../Skeleton.svelte'
  import ErrorNote from '../ErrorNote.svelte'
  import SleepNightsTable from './SleepNightsTable.svelte'
  import { chart } from '../../lib/charts'
  import { resource, healthKinds } from '../../lib/health.svelte'
  import { loadSleepHistory } from '../../lib/sleepLoad'
  import { classify, sleepFacts, stageMarks, scheduleMarks } from '../../lib/sleepHistory'
  import { stagesOption, scheduleOption, segmentsIn, segmentStyle, clock, SEGMENT_LABEL } from '../../lib/sleepCharts'
  import { fitRange } from '../../lib/trends'
  import { windowOf, type RangeId } from '../../lib/range'
  import { t } from '../../lib/i18n.svelte'
  import * as F from '../../lib/fmt'

  const HEIGHT = 250
  let range = $state<RangeId>('6M')
  const res = resource(() => loadSleepHistory(range))
  const kinds = healthKinds()
  const data = $derived(res.data)
  const shown = $derived(data?.range ?? range)
  const nights = $derived(classify(data?.nights ?? []))
  const win = $derived(windowOf(shown, nights.length ? [{ ymd: nights[0].ymd, value: 0, n: 0 }] : []))
  const facts = $derived(sleepFacts(nights))
  const before = $derived(data?.before ? sleepFacts(classify(data.before)) : null)
  const stages = $derived(stageMarks(nights, win.start, win.end))
  const schedule = $derived(scheduleMarks(nights, win.start, win.end))
  const legend = $derived(segmentsIn(stages))
  const dim = $derived(res.loading && !!data)
  // the kind list knows how far back sleep goes, for a period with no night in it
  const meta = $derived(kinds.data?.find(k => k.kind === 'sleep_analysis'))
  const reach = $derived(meta ? fitRange(shown, meta.newest_end_unix) : shown)
  const dateOf = (unix: number) => F.fullDateOf(unix * 1000)

  const lead = $derived.by(() => {
    if (facts.meanAsleep == null) return ''
    const mean = F.minutesText(facts.meanAsleep)
    if (shown === 'All') return t('sleep.lead_all', { n: F.num(facts.nights), mean })
    const period = t(`trends.period_${shown}`), prev = t(`trends.before_${shown}`)
    if (before?.meanAsleep == null) return t('sleep.lead_only', { period, mean })
    const diff = Math.round(facts.meanAsleep) - Math.round(before.meanAsleep)
    return t(diff > 0 ? 'sleep.lead_more' : diff < 0 ? 'sleep.lead_less' : 'sleep.lead_same', { period, mean, before: prev, diff: F.minutesText(Math.abs(diff)) })
  })
  const pct = (v: number) => Math.round(v * 100)
  const rows = $derived([
    [t('sleep.mean_asleep'), facts.meanAsleep != null ? F.minutesText(facts.meanAsleep) : null],
    [t('sleep.mean_in_bed'), facts.meanInBed != null ? F.minutesText(facts.meanInBed) : null],
    [t('sleep.stage_shares'), facts.shares ? [
      t('common.pct_deep', { n: pct(facts.shares.deep) }), t('common.pct_core', { n: pct(facts.shares.core) }), t('common.pct_rem', { n: pct(facts.shares.rem) }),
      ...(pct(facts.shares.unstaged) > 0 ? [t('sleep.pct_unstaged', { n: pct(facts.shares.unstaged) })] : []),
    ].join(t('common.list_sep')) + t('sleep.of_staged', { n: F.num(facts.shares.nights) }) : null],
    [t('sleep.mean_bedtime'), facts.meanBed != null ? clock(facts.meanBed) : null],
    [t('sleep.mean_wake'), facts.meanWake != null ? clock(facts.meanWake) : null],
    [t('sleep.bed_spread'), facts.bedSpreadMin != null ? t('sleep.spread_value', { n: F.num(facts.bedSpreadMin) }) : null],
    [t('sleep.nights_counted'), F.num(facts.nights)],
    [t('sleep.sources'), facts.sources.map(([name, n]) => `${name} ${F.num(n)}`).join(t('common.list_sep')) || null],
  ] as const)
  const per = $derived(t(`sleep.per_${stages.size}`))
</script>

<section class="section" id="sleep-history">
  <div class="eyebrow">
    <span class="title">{t('sleep.history')}</span>
    <span class="aside">{t('sleep.history_aside', { range: F.dateRange(win.start, win.end) })}</span>
    <span class="spacer"></span>
    <RangePicker bind:value={range} />
  </div>
  {#if res.error && !data}
    <ErrorNote message={res.error} />
  {:else if !data}
    <Skeleton height={28} width="60%" /><div style="height: 20px"></div><Skeleton height={2 * HEIGHT + 150} />
  {:else}
    <p class="lead" class:dim>
      {#if nights.length}{lead}{:else}
        {t('sleep.none_in_range', { period: t(`trends.period_${shown === 'All' ? 'Y' : shown}`) })}
        {#if meta?.first_start_unix != null}{t('sleep.has_from', { first: dateOf(meta.first_start_unix), newest: dateOf(meta.newest_end_unix) })}{/if}
        {#if reach !== shown}<button class="btn" onclick={() => (range = reach)}>{t(`common.range_${reach}_title`)}</button>{/if}
      {/if}
    </p>
    <div class="cols cols-1-3">
      <div class="facts" class:dim><KV {rows} /></div>
      <div class="stack">
        <figure class="panel" class:dim>
          <figcaption>
            <div class="name">{t('sleep.asleep_title')} <span class="per">{per}</span></div>
            <div class="legend">{#each legend as s (s)}{@const st = segmentStyle(s)}<span><span class="sw" style="background: {st.color}; {st.borderColor ? `box-shadow: inset 0 0 0 1px ${st.borderColor}` : ''}"></span>{t(SEGMENT_LABEL[s])}</span>{/each}</div>
          </figcaption>
          <div use:chart={{ option: stagesOption(stages, facts.meanAsleep) }} style="height: {HEIGHT}px"></div>
        </figure>
        <figure class="panel" class:dim>
          <figcaption>
            <div class="name">{t('sleep.schedule_title')} <span class="per">{per}</span></div>
          </figcaption>
          <div use:chart={{ option: scheduleOption(schedule, facts.meanBed, facts.meanWake) }} style="height: {HEIGHT}px"></div>
        </figure>
      </div>
    </div>
    <div class="notes small sub">
      <p>{t('sleep.note_overlap', { n: F.num(facts.overlapping) })}</p>
      <p>{t('sleep.note_nap', { n: F.num(facts.unscheduled) })}</p>
      <p>{t('sleep.note_source')}</p>
    </div>
    {#if nights.length}<div class="log"><SleepNightsTable {nights} {dim} /></div>{/if}
  {/if}
</section>

<style>
  section { scroll-margin-top: 60px; }
  .eyebrow { flex-wrap: wrap; row-gap: 8px; }
  .title { color: var(--c-sleep-ink); white-space: nowrap; }
  .lead { font-size: 20px; line-height: 1.4; font-weight: 500; letter-spacing: -0.01em; max-width: 46ch; margin: 0 0 22px; min-height: 56px; }
  :global(:lang(zh)) .lead { letter-spacing: 0; }
  .lead .btn { display: flex; margin-top: 8px; font-size: 13px; padding: 3px 10px; }
  .lead, .facts, figure { transition: opacity var(--dur) ease; }
  .dim { opacity: 0.55; }
  figure { margin: 0; padding: 14px 10px 10px; }
  figcaption { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px 16px; padding: 0 8px 4px; min-height: 28px; }
  .name { font-weight: 600; font-size: 15px; color: var(--c-sleep-ink); }
  .per { font-weight: 400; font-size: 13px; color: var(--ash); margin-left: 6px; }
  .notes { max-width: 96ch; margin-top: 16px; }
  .notes p { margin: 0 0 4px; }
  .log { margin-top: 20px; }
</style>
