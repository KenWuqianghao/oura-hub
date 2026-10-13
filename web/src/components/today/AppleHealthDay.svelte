<script lang="ts">
  // The Apple Health totals of the selected day beside the day before, the food log
  // of the day on one line when there is one, and the workouts that start on the day.
  import Num from '../Num.svelte'
  import ErrorNote from '../ErrorNote.svelte'
  import { DAY_KINDS, type DayHealth, type DayKind } from '../../lib/todayHealth'
  import { activityTitle, kindHref, kindInfo, kindTitle } from '../../lib/kinds'
  import { t } from '../../lib/i18n.svelte'
  import * as F from '../../lib/fmt'

  let { data, error = '', loading = false }: { data: DayHealth | null; error?: string; loading?: boolean } = $props()

  const ROW: Record<DayKind, { label: () => string; unit: () => string }> = {
    step_count: { label: () => t('common.steps'), unit: () => '' },
    active_energy: { label: () => t('common.active_energy'), unit: () => 'kcal' },
    exercise_time: { label: () => t('common.exercise'), unit: () => t('common.min') },
    stand_hour: { label: () => t('common.stand_hours'), unit: () => '' },
    distance_walking_running: { label: () => t('common.distance'), unit: () => 'km' },
    flights_climbed: { label: () => kindTitle('flights_climbed'), unit: () => '' },
    time_in_daylight: { label: () => kindTitle('time_in_daylight'), unit: () => t('common.min') },
  }
  const food = (v: number | null) => F.num(v)
  const withUnit = (v: number | null, decimals: number, unit: string) => v != null ? `${F.num(v, decimals)} ${unit}` : '—'
</script>

{#if error && !data}
  <ErrorNote message={error} />
{:else}
  <div class="day" class:dim={loading && !!data}>
    <div class="table-scroll"><table class="t">
      <thead><tr><th></th><th class="r">{data ? F.dayLabel(data.day) : ''}</th><th class="r">{data ? F.dayLabel(F.addDays(data.day, -1)) : ''}</th></tr></thead>
      <tbody>
        {#each DAY_KINDS as kind (kind)}
          {@const unit = ROW[kind].unit()}
          {@const decimals = kindInfo(kind).decimals}
          <tr>
            <td class="text"><a href={kindHref(kind)}>{ROW[kind].label()}</a></td>
            {#each [data?.totals[kind], data?.before[kind]] as v}
              <td class="r"><Num value={v} {decimals} />{v != null && unit ? ` ${unit}` : ''}</td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table></div>
    {#if data?.food}
      <p class="food"><a href="#/nutrition">{t('today.food_log')}</a>{t('today.food_line', { kcal: food(data.food.dietary_energy_consumed), protein: food(data.food.dietary_protein), carbs: food(data.food.dietary_carbohydrates), fat: food(data.food.dietary_fat_total) })}</p>
    {/if}
    <div class="small sub" style="margin-top: 8px">{t('today.day_totals')}</div>
    {#if data?.workouts.length}
      <div class="table-scroll" style="margin-top: 16px"><table class="t">
        <thead><tr><th>{t('today.workout')}</th><th>{t('today.when')}</th><th class="r">{t('today.duration')}</th><th class="r">{t('today.energy')}</th><th class="r">{t('common.distance')}</th><th class="r">{t('today.hr_avg')}</th><th class="r">{t('today.hr_max')}</th></tr></thead>
        <tbody>
          {#each data.workouts as wk (wk.start_unix)}
            <tr>
              <td class="text">{activityTitle(wk.activity)}</td><td>{F.timeHM(wk.start_unix)} – {F.timeHM(wk.end_unix)}</td>
              <td class="r">{wk.duration_min != null ? F.minutesText(wk.duration_min) : '—'}</td><td class="r">{withUnit(wk.kcal, 0, 'kcal')}</td>
              <td class="r">{withUnit(wk.distance_m != null ? wk.distance_m / 1000 : null, 2, 'km')}</td>
              <td class="r">{withUnit(wk.hr_avg, 0, 'bpm')}</td><td class="r">{withUnit(wk.hr_max, 0, 'bpm')}</td>
            </tr>
          {/each}
        </tbody>
      </table></div>
    {/if}
  </div>
{/if}

<style>
  .day { transition: opacity var(--dur) ease; }
  .day.dim { opacity: 0.7; }
  td a { color: inherit; }
  .food { margin: 10px 0 0; padding: 0 10px; font-variant-numeric: tabular-nums; }
</style>
