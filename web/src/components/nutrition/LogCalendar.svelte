<script lang="ts">
  // One cell per day, shaded by the energy in the log. An empty cell is a day with
  // no log, so the gaps are plain. Point at a cell to read the day.
  import type { LogCalendar, CalendarCell } from '../../lib/nutrition'
  import { t, intlTag } from '../../lib/i18n.svelte'
  import * as F from '../../lib/fmt'

  let { calendar }: { calendar: LogCalendar } = $props()
  let hover = $state<CalendarCell | null>(null)
  const date = (ymd: string) => F.parseYmd(ymd) ?? new Date()
  const months = $derived(calendar.weeks.map((week, i) => {
    // the label sits over the first week whose Monday is in a new month
    const month = week[0].ymd.slice(0, 7), prev = i ? calendar.weeks[i - 1][0].ymd.slice(0, 7) : ''
    return month !== prev && !(i === 0 && week[0].ymd.slice(8) > '14') ? new Intl.DateTimeFormat(intlTag(), { month: 'short' }).format(date(week[0].ymd)) : ''
  }))
  const weekdays = $derived([0, 2, 4].map(i => new Intl.DateTimeFormat(intlTag(), { weekday: 'short' }).format(date(calendar.weeks[0][i].ymd))))
  const readout = $derived(!hover ? t('nutrition.cal_hint')
    : `${new Intl.DateTimeFormat(intlTag(), { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }).format(date(hover.ymd))}${t('nutrition.cal_sep')}${hover.value == null ? t('nutrition.cal_no_log') : `${F.num(hover.value)} kcal`}`)
</script>

<div class="cal" style="--weeks: {calendar.weeks.length}">
  <div class="months" aria-hidden="true">{#each months as m, i}<span style="grid-column: {i + 1}">{m}</span>{/each}</div>
  <div class="days" aria-hidden="true">{#each weekdays as d, i}<span style="grid-row: {i * 2 + 1}">{d}</span>{/each}</div>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="grid" role="img" aria-label={t('nutrition.cal_label', { n: calendar.logged, range: F.dateRange(calendar.start, calendar.end) })} onpointerleave={() => (hover = null)}>
    {#each calendar.weeks as week (week[0].ymd)}
      {#each week as cell (cell.ymd)}
        {#if cell.outside}<span></span>{:else}<span class="cell l{cell.level}" class:on={hover?.ymd === cell.ymd} onpointerenter={() => (hover = cell)}></span>{/if}
      {/each}
    {/each}
  </div>
  <div class="foot">
    <span class="readout num">{readout}</span>
    <span class="key" aria-hidden="true">
      <span class="cell l0"></span>{t('nutrition.cal_no_log')}
      <span class="more">{t('nutrition.cal_less')}</span>{#each [1, 2, 3, 4] as l}<span class="cell l{l}"></span>{/each}{t('nutrition.cal_more')}
    </span>
  </div>
</div>

<style>
  .cal { --gap: 3px; display: grid; grid-template-columns: auto minmax(0, 1fr); column-gap: 8px; row-gap: 6px; max-width: calc(var(--weeks) * 20px + 40px); font-size: 11px; color: var(--ash); }
  .months, .grid { grid-column: 2; display: grid; grid-template-columns: repeat(var(--weeks), minmax(0, 1fr)); column-gap: var(--gap); }
  .months span { white-space: nowrap; overflow: visible; width: 0; }
  .days { grid-column: 1; grid-row: 2; display: grid; grid-template-rows: repeat(7, minmax(0, 1fr)); row-gap: var(--gap); align-items: center; }
  .grid { grid-row: 2; grid-template-rows: repeat(7, auto); grid-auto-flow: column; row-gap: var(--gap); }
  .grid > span { aspect-ratio: 1; }
  .cell { border-radius: 3px; background: var(--fill); }
  .grid .cell { transition: transform var(--dur-fast) var(--ease); }
  .grid .cell.on { transform: scale(1.35); outline: 1.5px solid var(--ink); outline-offset: 0; }
  .l1 { background: color-mix(in srgb, var(--c-nutrition) 30%, var(--surface)); }
  .l2 { background: color-mix(in srgb, var(--c-nutrition) 55%, var(--surface)); }
  .l3 { background: color-mix(in srgb, var(--c-nutrition) 80%, var(--surface)); }
  .l4 { background: var(--c-nutrition); }
  .foot { grid-column: 2; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px 20px; font-size: 13px; min-height: 20px; }
  .readout { color: var(--ink); }
  .key { display: inline-flex; align-items: center; gap: 4px; }
  .key .cell { width: 11px; height: 11px; }
  .key .more { margin-left: 14px; }
  @media (max-width: 560px) { .cal { --gap: 1.5px; } .cell { border-radius: 1.5px; } .days { display: none; } .months, .grid, .foot { grid-column: 1 / -1; } }
</style>
