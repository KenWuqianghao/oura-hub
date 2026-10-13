<script lang="ts">
  // The days of a trend as a table, newest first: the value, the low and the high
  // of the day when the kind has them, and the distance from the mean of the period.
  import type { DayPoint } from '../../lib/api'
  import { t } from '../../lib/i18n.svelte'
  import * as F from '../../lib/fmt'
  import ShowMore from '../ShowMore.svelte'

  const PAGE = 30
  let { days, mean, decimals, unit = '', dim = false }: { days: DayPoint[]; mean: number | null; decimals: number; unit?: string; dim?: boolean } = $props()
  let shown = $state(PAGE)
  const rows = $derived([...days].reverse())
  const minMax = $derived(days.some(d => d.min != null && d.max != null))
  const year = String(new Date().getFullYear())
  const dayText = (ymd: string) => ymd.startsWith(year) ? F.dayLabel(ymd) : F.fullDateOf(F.parseYmd(ymd) ?? 0)
  const withUnit = (text: string) => unit ? `${text} ${unit}` : text
</script>

{#if rows.length}
  <div class="table-scroll" class:dim><table class="t">
    <thead><tr><th>{t('trends.day')}</th><th class="r">{t('trends.value')}</th>{#if minMax}<th class="r">{t('trends.low_high')}</th>{/if}<th class="r">{t('trends.vs_mean')}</th></tr></thead>
    <tbody>
      {#each rows.slice(0, shown) as p (p.ymd)}
        <tr>
          <td>{dayText(p.ymd)}</td>
          <td class="r">{withUnit(F.num(p.value, decimals))}</td>
          {#if minMax}<td class="r">{p.min != null && p.max != null ? `${F.num(p.min, decimals)}–${F.num(p.max, decimals)}` : '—'}</td>{/if}
          <td class="r">{mean == null ? '' : F.signed(p.value - mean, decimals)}</td>
        </tr>
      {/each}
    </tbody>
  </table></div>
  <ShowMore bind:shown total={rows.length} step={PAGE} />
{/if}

<style>
  .table-scroll { transition: opacity var(--dur) ease; }
  .table-scroll.dim { opacity: 0.55; }
</style>
