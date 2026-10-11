<script lang="ts">
  import PageHeader from '../components/PageHeader.svelte'
  import Section from '../components/Section.svelte'
  import RangePicker from '../components/RangePicker.svelte'
  import MetricChart from '../components/MetricChart.svelte'
  import OutOfRange from '../components/OutOfRange.svelte'
  import HeartLead from '../components/heart/HeartLead.svelte'
  import HeartRange from '../components/heart/HeartRange.svelte'
  import RingWatch from '../components/heart/RingWatch.svelte'
  import Events from '../components/heart/Events.svelte'
  import { healthKinds, coverage } from '../lib/health.svelte'
  import { hub } from '../lib/store.svelte'
  import { t } from '../lib/i18n.svelte'
  import { windowOf, type RangeId } from '../lib/range'

  const REST = ['resting_heart_rate', 'hrv_sdnn']
  const FITNESS = ['vo2_max', 'walking_heart_rate_average', 'heart_rate_recovery_one_minute']
  const BREATHING = ['respiratory_rate', 'oxygen_saturation', 'wrist_temperature']

  let range = $state<RangeId>('M')
  const held = healthKinds()
  // a kind with no rows on the hub gets no chart: the line under the charts names it
  const has = (kind: string) => !held.data || held.data.some(k => k.kind === kind)
  // a kind whose newest value is older than the range shows all its dates, not an empty chart
  const start = $derived(range === 'All' ? '' : windowOf(range, []).start)
  const rangeOf = (kind: string): RangeId => { const c = held.data ? coverage(held.data, kind) : null; return c && c.newest < start ? 'All' : range }
</script>

<div class="wrap">
  <PageHeader title={t('shell.heart')}>
    {#snippet right()}<RangePicker bind:value={range} />{/snippet}
    <HeartLead {range} />
  </PageHeader>

  <div class="section flush">
    <HeartRange {range} />
    <OutOfRange kinds={['heart_rate']} {range} />
  </div>

  <Section title={t('heart.rest_hrv')}>
    <div class="cols cols-2">{#each REST as kind (kind)}<MetricChart {kind} range={rangeOf(kind)} height={200} />{/each}</div>
    <p class="sub small note-line">{t('heart.sdnn_note')}</p>
    <OutOfRange kinds={REST} {range} chartsShowAll />
  </Section>

  {#if hub.summary}
    <Section title={t('heart.ring_watch')} aside={t('heart.ring_watch_aside')}>
      <RingWatch {range} />
    </Section>
  {/if}

  <Section title={t('heart.fitness')} aside={t('heart.fitness_aside')}>
    <div class="cols charts">{#each FITNESS.filter(has) as kind (kind)}<MetricChart {kind} range={rangeOf(kind)} height={170} />{/each}</div>
    <OutOfRange kinds={FITNESS} {range} chartsShowAll />
  </Section>

  <Section title={t('heart.breathing')}>
    <div class="cols charts">{#each BREATHING.filter(has) as kind (kind)}<MetricChart {kind} range={rangeOf(kind)} height={170} color="--c-respiratory" />{/each}</div>
    <OutOfRange kinds={BREATHING} {range} chartsShowAll />
  </Section>

  <Events />
</div>

<style>
  .charts { grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
  .note-line { margin: 14px 0 0; max-width: 100ch; }
</style>
