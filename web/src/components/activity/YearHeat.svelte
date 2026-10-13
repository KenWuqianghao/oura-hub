<script lang="ts">
  // The last 53 weeks, one cell per day, shaded by exercise minutes. Weeks are
  // columns that start on Monday. It does not follow the range of the page.
  import KV from '../KV.svelte'
  import Skeleton from '../Skeleton.svelte'
  import { api } from '../../lib/api'
  import { resource } from '../../lib/health.svelte'
  import { HEAT_STEPS, HEAT_WEEKS, heatLevel, heatStart, yearGrid } from '../../lib/activity'
  import { t, intlTag } from '../../lib/i18n.svelte'
  import * as F from '../../lib/fmt'

  const KIND = 'exercise_time'
  const res = resource(async () => (await api.healthDaily({ kinds: [KIND], start_ymd: heatStart(), end_ymd: F.todayYmd() })).kinds[0]?.days ?? [])
  const grid = $derived(res.data ? yearGrid(res.data) : null)
  // a month label needs about three columns: drop the first when the next month starts right after it
  const months = $derived((grid?.months ?? []).filter((m, i, all) => i > 0 || !all[1] || all[1].col - m.col >= 3))
  const monthName = (ymd: string) => new Intl.DateTimeFormat(intlTag(), ymd.slice(5, 7) === '01' ? { year: 'numeric' } : { month: 'short' }).format(F.parseYmd(ymd) ?? new Date())
  const weekday = (row: number) => new Intl.DateTimeFormat(intlTag(), { weekday: 'short' }).format(new Date(2024, 0, 1 + row))
  const dayText = (ymd: string) => new Intl.DateTimeFormat(intlTag(), { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }).format(F.parseYmd(ymd) ?? new Date())
  const cellText = (c: { ymd: string; minutes: number | null }) => `${dayText(c.ymd)}: ${c.minutes != null ? `${F.num(c.minutes)} ${t('common.min')}` : t('common.no_data')}`
  const stepText = (i: number) => i + 1 < HEAT_STEPS.length ? `${HEAT_STEPS[i]}–${HEAT_STEPS[i + 1] - 1}` : `${HEAT_STEPS[i]}+`

  let tip = $state<{ text: string; x: number; y: number } | null>(null)
  let box = $state<HTMLElement>()
  function hover(e: PointerEvent) {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]')
    if (!el || !box) { tip = null; return }
    const a = el.getBoundingClientRect(), b = box.getBoundingClientRect()
    tip = { text: el.dataset.tip ?? '', x: a.left - b.left + a.width / 2, y: a.top - b.top }
  }
  // the newest weeks are on the right: at phone width the grid scrolls, and it opens there
  const toEnd = (node: HTMLElement) => { node.scrollLeft = node.scrollWidth }
</script>

<div class="cols year">
  <figure class="panel heat" bind:this={box} onpointermove={hover} onpointerleave={() => (tip = null)}>
    {#if res.error && !grid}
      <div class="error">{res.error}</div>
    {:else if !grid}
      <Skeleton height={168} />
    {:else}
      <div class="scroll" use:toEnd>
        <div class="grid" style="--weeks: {HEAT_WEEKS}">
          {#each months as m (m.ymd)}<span class="month" style="grid-column: {m.col + 2}">{monthName(m.ymd)}</span>{/each}
          {#each [0, 2, 4, 6] as row}<span class="weekday" style="grid-row: {row + 2}">{weekday(row)}</span>{/each}
          {#each grid.weeks as week, col}
            {#each week as c, row}
              {#if c}<i class="l{heatLevel(c.minutes)}" style="grid-column: {col + 2}; grid-row: {row + 2}" data-tip={cellText(c)} aria-label={cellText(c)} role="img"></i>{/if}
            {/each}
          {/each}
        </div>
      </div>
      <figcaption>
        <span>{t('activity.heat_legend')}</span>
        <span class="key"><i class="l0"></i>{t('activity.heat_none')}</span>
        {#each HEAT_STEPS as _, i}<span class="key"><i class="l{i + 1}"></i>{stepText(i)}</span>{/each}
      </figcaption>
      {#if tip}<div class="tip" style="left: {tip.x}px; top: {tip.y}px">{tip.text}</div>{/if}
    {/if}
  </figure>
  <KV rows={grid ? [
    [t('activity.heat_active_days'), t('activity.heat_days_of', { n: F.num(grid.activeDays), total: F.num(grid.totalDays) })],
    [t('activity.heat_total'), F.minutesText(grid.minutes)],
    [t('activity.heat_mean_active'), grid.activeDays ? F.minutesText(grid.minutes / grid.activeDays) : null],
    [t('activity.heat_streak'), t('activity.heat_days', { n: F.num(grid.streak) })],
  ] : []} />
</div>

<style>
  .year { grid-template-columns: minmax(0, 1fr) 300px; }
  .heat { margin: 0; padding: 16px 18px 14px; position: relative; }
  .scroll { overflow-x: auto; scrollbar-width: none; }
  .grid { display: grid; grid-template-columns: max-content repeat(var(--weeks), minmax(9px, 1fr)); grid-template-rows: 18px repeat(7, auto); gap: 3px; min-width: 680px; }
  .grid i { aspect-ratio: 1; border-radius: 3px; display: block; }
  .month { grid-row: 1; font-size: 11px; color: var(--ash); white-space: nowrap; width: 0; overflow: visible; }
  .weekday { grid-column: 1; font-size: 11px; color: var(--ash); padding-right: 6px; align-self: center; line-height: 1; white-space: nowrap; }
  .l0 { background: var(--fill); }
  .l1 { background: color-mix(in srgb, var(--c-activity) 28%, var(--surface)); }
  .l2 { background: color-mix(in srgb, var(--c-activity) 52%, var(--surface)); }
  .l3 { background: color-mix(in srgb, var(--c-activity) 76%, var(--surface)); }
  .l4 { background: var(--c-activity); }
  figcaption { display: flex; flex-wrap: wrap; gap: 4px 14px; align-items: center; margin-top: 12px; font-size: 12px; color: var(--ash); font-variant-numeric: tabular-nums; }
  .key { display: inline-flex; align-items: center; gap: 5px; }
  .key i { width: 11px; height: 11px; border-radius: 3px; display: block; }
  .tip { position: absolute; transform: translate(-50%, calc(-100% - 6px)); background: var(--raised); border: 1px solid var(--rule); border-radius: 10px; padding: 6px 10px; font-size: 12px; white-space: nowrap; pointer-events: none; box-shadow: 0 8px 28px rgba(0, 0, 0, 0.16); font-variant-numeric: tabular-nums; z-index: 2; }
  @media (max-width: 980px) { .year { grid-template-columns: minmax(0, 1fr); } }
</style>
