<script lang="ts">
  // Training minutes per day, week, or month, stacked by activity type.
  import Num from '../Num.svelte'
  import Skeleton from '../Skeleton.svelte'
  import { chart } from '../../lib/charts'
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

<figure class="panel training" aria-busy={loading}>
  <figcaption>
    <div class="label">{t(tr ? `activity.per_${tr.size}` : 'activity.per_week')}</div>
    <div class="value">
      {#if data}<Num value={Math.floor(minutes / 60)} /><small>{t('common.hr')}</small> <Num value={Math.round(minutes) % 60} /><small>{t('common.min')}</small>{:else}—{/if}
    </div>
    <div class="when">
      <span>{data ? t('activity.sessions_in', { n: F.num(used.length), range: F.dateRange(data.start, data.end) }) : ' '}</span>
      <span class="legend">{#each tr?.types ?? [] as type, i (type)}<span><span class="sw" style="background: {colors[i]}"></span>{trainingTitle(type)}</span>{/each}</span>
    </div>
  </figcaption>
  <div class="plot" style="height: {height}px">
    {#if error && !data}
      <div class="state">{error}</div>
    {:else if !option}
      <Skeleton {height} />
    {:else}
      <div use:chart={{ option }} class="canvas" class:dim={loading} style="height: {height}px"></div>
      {#if !used.length}<div class="state">{t('activity.no_workouts_range')}</div>{/if}
    {/if}
  </div>
</figure>

<style>
  .training { margin: 0; padding: 16px 10px 10px; }
  figcaption { padding: 0 8px 6px; }
  .label { font-size: 12px; font-weight: 600; color: var(--ash); letter-spacing: 0.05em; text-transform: uppercase; }
  :global(:lang(zh)) .label { font-size: 13px; letter-spacing: 0; text-transform: none; }
  .value { font-family: var(--round); font-size: 28px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.2; white-space: nowrap; }
  .value small { font-family: var(--font); font-size: 14px; font-weight: 500; color: var(--ash); letter-spacing: 0; margin: 0 2px 0 3px; }
  .when { font-size: 13px; color: var(--ash); display: flex; flex-wrap: wrap; gap: 4px 16px; justify-content: space-between; min-height: 19px; }
  .plot { position: relative; }
  .canvas { width: 100%; transition: opacity var(--dur) ease; }
  .canvas.dim { opacity: 0.55; }
  .state { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; text-align: center; padding: 0 24px; color: var(--mute); font-size: 13px; pointer-events: none; }
</style>
