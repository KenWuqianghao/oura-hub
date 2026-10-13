<script lang="ts">
  // Every workout of the range, newest first, 25 at a time.
  import { countsInTotals, MAX_WORKOUT_MIN } from '../../lib/activity'
  import type { HealthWorkout } from '../../lib/api'
  import { activityTitle } from '../../lib/kinds'
  import { t, intlTag } from '../../lib/i18n.svelte'
  import * as F from '../../lib/fmt'
  import ShowMore from '../ShowMore.svelte'

  let { workouts }: { workouts: HealthWorkout[] } = $props()
  const PAGE = 25
  let shown = $state(PAGE)
  const when = (unix: number) => new Intl.DateTimeFormat(intlTag(), { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(unix * 1000)
  const bpm = (v: number | null) => v != null ? `${F.num(v)} bpm` : '—'
</script>

<div class="table-scroll"><table class="t">
  <thead><tr>
    <th>{t('activity.col_start')}</th><th>{t('activity.col_type')}</th><th class="r">{t('activity.col_duration')}</th><th class="r">{t('activity.col_energy')}</th><th class="r">{t('common.distance')}</th>
    <th class="r">{t('activity.col_hr_mean')}</th><th class="r">{t('activity.col_hr_max')}</th><th>{t('activity.col_source')}</th>
  </tr></thead>
  <tbody>
    {#each workouts.slice(0, shown) as w}
      <tr>
        <td>{when(w.start_unix)}</td>
        <td>{activityTitle(w.activity)}{#if w.user_entered}<span class="pill neutral mark">{t('activity.by_hand')}</span>{/if}{#if !countsInTotals(w)} †{/if}</td>
        <td class="r">{w.duration_min != null ? F.minutesText(w.duration_min) : '—'}</td>
        <td class="r">{w.kcal != null ? `${F.num(w.kcal)} kcal` : '—'}</td>
        <td class="r">{w.distance_m ? `${F.num(w.distance_m / 1000, 2)} km` : '—'}</td>
        <td class="r">{bpm(w.hr_avg)}</td><td class="r">{bpm(w.hr_max)}</td>
        <td class="src">{w.source}</td>
      </tr>
    {/each}
  </tbody>
</table></div>
{#if workouts.some(w => !countsInTotals(w))}<p class="sub small" style="margin: 10px 0 0">{t('activity.left_out_mark', { h: MAX_WORKOUT_MIN / 60 })}</p>{/if}
<ShowMore bind:shown total={workouts.length} step={PAGE} />

<style>
  .mark { margin-left: 8px; font-weight: 500; }
  .src { color: var(--ash); }
</style>
