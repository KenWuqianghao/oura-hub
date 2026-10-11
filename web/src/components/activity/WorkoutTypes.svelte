<script lang="ts">
  // The workouts of the range by activity type: sessions, time, energy, distance, heart rate.
  import { totalsByType, countsInTotals, MAX_WORKOUT_MIN } from '../../lib/activity'
  import type { HealthWorkout } from '../../lib/api'
  import { workoutTitle } from '../../lib/activity-charts'
  import { t } from '../../lib/i18n.svelte'
  import * as F from '../../lib/fmt'

  let { workouts, repeats = 0 }: { workouts: HealthWorkout[]; /** Rows the hub holds twice, already left out of `workouts`. */ repeats?: number } = $props()
  const rows = $derived(totalsByType(workouts))
  const left = $derived(workouts.filter(w => !countsInTotals(w)).length)
  const all = $derived(rows.reduce((a, r) => ({ sessions: a.sessions + r.sessions, minutes: a.minutes + r.minutes, kcal: a.kcal + (r.kcal ?? 0), m: a.m + (r.distance_m ?? 0) }), { sessions: 0, minutes: 0, kcal: 0, m: 0 }))
  const km = (m: number | null) => m ? `${F.num(m / 1000, 1)} km` : '—'
</script>

<div class="table-scroll"><table class="t">
  <thead><tr>
    <th>{t('activity.col_type')}</th><th class="r">{t('activity.col_sessions')}</th><th class="r">{t('activity.col_time')}</th><th class="r">{t('activity.col_mean_time')}</th>
    <th class="r">{t('activity.col_energy')}</th><th class="r">{t('common.distance')}</th><th class="r">{t('activity.col_hr')}</th>
  </tr></thead>
  <tbody>
    {#each rows as r (r.activity)}
      <tr>
        <td class="text">{workoutTitle(r.activity)}</td><td class="r">{F.num(r.sessions)}</td><td class="r">{F.minutesText(r.minutes)}</td><td class="r">{F.minutesText(r.minutes / r.sessions)}</td>
        <td class="r">{r.kcal != null ? `${F.num(r.kcal)} kcal` : '—'}</td><td class="r">{km(r.distance_m)}</td><td class="r">{r.hr != null ? `${F.num(r.hr)} bpm` : '—'}</td>
      </tr>
    {/each}
  </tbody>
  {#if rows.length > 1}
    <tfoot><tr>
      <td class="text">{t('activity.all_types')}</td><td class="r">{F.num(all.sessions)}</td><td class="r">{F.minutesText(all.minutes)}</td><td class="r">{F.minutesText(all.minutes / all.sessions)}</td>
      <td class="r">{F.num(all.kcal)} kcal</td><td class="r">{km(all.m)}</td><td class="r"></td>
    </tr></tfoot>
  {/if}
</table></div>
{#if left || repeats}<p class="sub small" style="margin: 10px 0 0">{left ? t('activity.left_out', { n: left, h: MAX_WORKOUT_MIN / 60 }) : ''} {repeats ? t('activity.repeats', { n: repeats }) : ''}</p>{/if}

<style>
  tfoot td { font-weight: 600; border-top: 0.5px solid var(--rule-strong); border-bottom: 0; }
</style>
