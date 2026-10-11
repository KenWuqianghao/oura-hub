<script lang="ts">
  // Every Apple Health night of the period, newest first. A night that the means
  // and the charts leave out stays in this log, with a mark.
  import type { HistoryNight } from '../../lib/sleepHistory'
  import { t } from '../../lib/i18n.svelte'
  import * as F from '../../lib/fmt'

  const PAGE = 30
  let { nights, dim = false }: { nights: HistoryNight[]; dim?: boolean } = $props()
  let shown = $state(PAGE)
  const rows = $derived([...nights].reverse())
  const dur = (min: number | null) => min == null ? '—' : F.minutesText(min)
  const stage = (n: HistoryNight, min: number) => n.asleep_min != null && n.deep_min + n.core_min + n.rem_min > 0 ? F.minutesText(min) : '—'
  const mark = (n: HistoryNight) => n.overlapping ? ' †' : !n.schedule ? ' ‡' : ''
</script>

<div class="table-scroll" class:dim><table class="t">
  <thead><tr>
    <th>{t('sleep.woke_on')}</th><th>{t('sleep.source')}</th><th class="r">{t('sleep.bedtime')}</th><th class="r">{t('sleep.wake_time')}</th>
    <th class="r">{t('common.in_bed')}</th><th class="r">{t('common.asleep')}</th><th class="r">{t('common.deep')}</th><th class="r">{t('common.core')}</th><th class="r">{t('common.rem')}</th><th class="r">{t('common.awake')}</th>
  </tr></thead>
  <tbody>
    {#each rows.slice(0, shown) as n (n.ymd)}
      <tr class:out={n.overlapping}>
        <td>{F.fullDateOf(F.parseYmd(n.ymd) ?? 0)}{mark(n)}</td><td>{n.source}</td>
        <td class="r">{F.timeHM(n.start_unix)}</td><td class="r">{F.timeHM(n.end_unix)}</td>
        <td class="r">{dur(n.in_bed_min)}</td><td class="r">{dur(n.asleep_min)}</td>
        <td class="r">{stage(n, n.deep_min)}</td><td class="r">{stage(n, n.core_min)}</td><td class="r">{stage(n, n.rem_min)}</td>
        <td class="r">{n.asleep_min != null ? F.minutesText(n.awake_min) : '—'}</td>
      </tr>
    {/each}
  </tbody>
</table></div>
{#if rows.length > shown}
  <button class="btn more" onclick={() => (shown += PAGE)}>{t('sleep.show_more_n', { n: Math.min(PAGE, rows.length - shown) })}</button>
{/if}

<style>
  .table-scroll { transition: opacity var(--dur) ease; }
  .table-scroll.dim { opacity: 0.55; }
  tr.out td { color: var(--mute); }
  .more { margin-top: 12px; }
</style>
