<script lang="ts">
  // The shared pieces on one page, with real data: open #/kit to see what a page can
  // compose. It is not in the navigation and its own labels are not translated.
  import PageHeader from '../components/PageHeader.svelte'
  import Section from '../components/Section.svelte'
  import RangePicker from '../components/RangePicker.svelte'
  import MetricChart from '../components/MetricChart.svelte'
  import MetricRow from '../components/MetricRow.svelte'
  import Seg from '../components/Seg.svelte'
  import Num from '../components/Num.svelte'
  import KV from '../components/KV.svelte'
  import Empty from '../components/Empty.svelte'
  import ErrorNote from '../components/ErrorNote.svelte'
  import Skeleton from '../components/Skeleton.svelte'
  import { kindsIn, groupTitle, GROUPS } from '../lib/kinds'
  import { workouts, sleepNights } from '../lib/health.svelte'
  import type { RangeId } from '../lib/range'

  let range = $state<RangeId>('M')
  let pick = $state<'a' | 'b' | 'c'>('a')
  const recent = workouts(() => range)
  const nights = sleepNights(() => range)
</script>

<div class="wrap">
  <PageHeader title="Kit" sub="PageHeader, RangePicker, MetricChart, MetricRow, Seg, Num, KV, Empty, ErrorNote, Skeleton.">
    {#snippet right()}<RangePicker bind:value={range} />{/snippet}
  </PageHeader>
  <Section title="MetricChart" aside="bar · range · line · line with a band and a reference line" flush>
    <div class="cols cols-2">
      <MetricChart kind="step_count" {range} />
      <MetricChart kind="heart_rate" {range} />
      <MetricChart kind="resting_heart_rate" {range} />
      <MetricChart kind="body_mass" {range} bands={[{ from: 68, to: 72, label: '68–72' }]} refs={[{ value: 70, label: '70' }]} />
    </div>
  </Section>
  {#each GROUPS as group}
    {#if kindsIn(group).length}
      <Section title={groupTitle(group)} aside="MetricRow">
        <div class="rows">{#each kindsIn(group) as kind (kind)}<MetricRow {kind} {range} />{/each}</div>
      </Section>
    {/if}
  {/each}
  <Section title="Seg, Num, KV">
    {#snippet right()}<Seg bind:value={pick} options={[{ value: 'a', label: '12' }, { value: 'b', label: '3,456' }, { value: 'c', label: '78.9' }]} label="Value" />{/snippet}
    <div class="cols cols-3">
      <div class="stat"><div class="label">Num</div><div class="value"><Num value={pick === 'a' ? 12 : pick === 'b' ? 3456 : 78.9} decimals={pick === 'c' ? 1 : 0} /><small>kcal</small></div></div>
      <KV rows={[['Workouts', recent.data?.length], ['Apple Health nights', nights.data?.length], ['Loading', String(recent.loading || nights.loading)], false, ['A null value', null]]} />
      <div><Empty title="Empty: nothing here yet." text="Say what is missing and what to do." /><ErrorNote message="ErrorNote: the hub did not answer." retry={() => {}} /><div style="height: 12px"></div><Skeleton lines={3} /></div>
    </div>
  </Section>
</div>

<style>
  .rows { columns: 2; column-gap: 48px; }
  .rows :global(.metric-row) { break-inside: avoid; }
  @media (max-width: 860px) { .rows { columns: 1; } }
</style>
