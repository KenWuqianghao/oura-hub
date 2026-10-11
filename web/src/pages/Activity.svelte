<script lang="ts">
  import PageHeader from '../components/PageHeader.svelte'
  import Section from '../components/Section.svelte'
  import RangePicker from '../components/RangePicker.svelte'
  import MetricChart from '../components/MetricChart.svelte'
  import MetricRow from '../components/MetricRow.svelte'
  import Empty from '../components/Empty.svelte'
  import ErrorNote from '../components/ErrorNote.svelte'
  import Skeleton from '../components/Skeleton.svelte'
  import StepsLead from '../components/activity/StepsLead.svelte'
  import DayBars from '../components/activity/DayBars.svelte'
  import OutOfRange from '../components/OutOfRange.svelte'
  import TrainingChart from '../components/activity/TrainingChart.svelte'
  import WorkoutTypes from '../components/activity/WorkoutTypes.svelte'
  import WorkoutLog from '../components/activity/WorkoutLog.svelte'
  import YearHeat from '../components/activity/YearHeat.svelte'
  import { healthKinds, coverage } from '../lib/health.svelte'
  import { rangedWorkouts } from '../lib/activity-data.svelte'
  import { t } from '../lib/i18n.svelte'
  import * as F from '../lib/fmt'
  import type { RangeId } from '../lib/range'

  const DAILY = ['active_energy', 'basal_energy', 'exercise_time', 'stand_hour', 'distance_walking_running', 'flights_climbed', 'time_in_daylight']
  const MORE = ['physical_effort', 'estimated_workout_effort_score', 'distance_cycling', 'distance_paddle_sports', 'running_speed', 'paddle_sports_speed']

  let range = $state<RangeId>('M')
  const wk = rangedWorkouts(() => range)
  const held = healthKinds()
  const newestWorkout = $derived(held.data ? coverage(held.data, 'workout')?.newest : undefined)
</script>

<div class="wrap">
  <PageHeader title={t('shell.activity')}>
    {#snippet right()}<RangePicker bind:value={range} />{/snippet}
    <StepsLead {range} />
  </PageHeader>

  <div class="section flush">
    <MetricChart kind="step_count" {range} height={280} />
  </div>

  <Section title={t('activity.measures')}>
    <div class="measures">{#each DAILY as kind (kind)}<DayBars {kind} {range} />{/each}</div>
  </Section>

  <Section title={t('activity.more_measures')}>
    <div class="rows">{#each MORE as kind (kind)}<MetricRow {kind} {range} />{/each}</div>
    <OutOfRange kinds={MORE} {range} />
  </Section>

  <Section title={t('activity.workouts')}>
    <TrainingChart data={wk.data} loading={wk.loading} error={wk.error} />
    <div class="types">
      {#if wk.error && !wk.data}
        <ErrorNote message={wk.error} />
      {:else if !wk.data}
        <Skeleton lines={4} height={18} gap={14} />
      {:else if wk.data.list.length}
        <WorkoutTypes workouts={wk.data.list} repeats={wk.data.repeats} />
      {:else}
        <Empty title={t('activity.no_workouts_period')} text={newestWorkout ? t('activity.no_workouts_text', { date: F.fullDateOf(F.parseYmd(newestWorkout) ?? new Date()) }) : held.data ? t('activity.no_workouts_ever') : ''} />
      {/if}
    </div>
  </Section>

  {#if wk.data?.list.length}
    <Section title={t('activity.workout_log')}>
      <WorkoutLog workouts={wk.data.list} />
    </Section>
  {/if}

  <Section title={t('activity.year')} aside={t('activity.year_aside')}>
    <YearHeat />
  </Section>
</div>

<style>
  .measures { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 48px; }
  .measures :global(.day-bars:first-child) { grid-column: 1 / -1; border-top: 0; padding-top: 0; }
  .rows { columns: 2; column-gap: 48px; }
  .rows :global(.metric-row) { break-inside: avoid; }
  .types { margin-top: 20px; }
  @media (max-width: 860px) { .measures { grid-template-columns: minmax(0, 1fr); } .rows { columns: 1; } }
</style>
