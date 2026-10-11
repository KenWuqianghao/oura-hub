<script lang="ts">
  // Training minutes per day, week, or month, stacked by activity type.
  import ChartFrame from '../ChartFrame.svelte'
  import Duration from '../Duration.svelte'
  import { countsInTotals, training } from '../../lib/activity'
  import type { RangedWorkouts } from '../../lib/activity-data.svelte'
  import { trainingOption, trainingColors, trainingTitle } from '../../lib/activity-charts'
  import { t } from '../../lib/i18n.svelte'
  import * as F from '../../lib/fmt'

  let { data, loading = false, error = '', height = 240 }: { data: RangedWorkouts | null; loading?: boolean; error?: string; height?: number } = $props()
  const tr = $derived(data ? training(data.list, data.start, data.end) : null)
  const used = $derived((data?.list ?? []).filter(countsInTotals))
  const minutes = $derived(used.reduce((a, w) => a + (w.duration_min ?? 0), 0))
  const option = $derived(tr ? trainingOption(tr) : null)
  const colors = $derived(tr ? trainingColors(tr.types) : [])
</script>

<ChartFrame label={t(tr ? `activity.per_${tr.size}` : 'activity.per_week')} when={data ? t('activity.sessions_in', { n: F.num(used.length), range: F.dateRange(data.start, data.end) }) : ' '} {height}
  option={option ?? undefined} ready={!!option} {loading} {error} empty={data && !used.length ? t('activity.no_workouts_period') : ''}>
  {#snippet number()}<Duration minutes={data ? minutes : null} />{/snippet}
  {#snippet legend()}{#each tr?.types ?? [] as type, i (type)}<span><span class="sw" style="background: {colors[i]}"></span>{trainingTitle(type)}</span>{/each}{/snippet}
</ChartFrame>
