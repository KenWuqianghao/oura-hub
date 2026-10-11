<script lang="ts">
  // Heart rate over the range: one bar per day from the lowest to the highest value,
  // with the mean of the day marked. A day without data stays empty.
  import Num from '../Num.svelte'
  import ChartFrame from '../ChartFrame.svelte'
  import { daily, healthKinds, coverage, noDataText } from '../../lib/health.svelte'
  import { kindTitle } from '../../lib/kinds'
  import { bucketize, stats, windowOf, type RangeId } from '../../lib/range'
  import { heartRangeOption } from '../../lib/heart-charts'
  import { t } from '../../lib/i18n.svelte'
  import * as F from '../../lib/fmt'

  const KIND = 'heart_rate'
  let { range, height = 300 }: { range: RangeId; height?: number } = $props()
  const res = daily(() => KIND, () => range)
  const held = healthKinds()
  const data = $derived(res.data)
  const win = $derived(windowOf(data?.range ?? range, data?.days ?? []))
  const inWindow = $derived((data?.days ?? []).filter(d => d.ymd >= win.start && d.ymd <= win.end))
  const s = $derived(stats(inWindow, 'mean'))
  const buckets = $derived(bucketize(inWindow, 'mean', win.start, win.end))
  const option = $derived(heartRangeOption(buckets))
</script>

<ChartFrame title={kindTitle(KIND)} color="--c-heart" label={t('common.stat_range')} value={s.min} to={s.max} unit="bpm" when={F.dateRange(win.start, win.end)} {height} {option}
  ready={!!data} loading={res.loading} error={res.error} empty={data && !inWindow.length ? noDataText(held.data ? coverage(held.data, KIND) : undefined) : ''}>
  {#snippet aside()}{#if data}{t('common.stat_average')} <b><Num value={s.mean} /></b> bpm · {t('common.days_with_data', { n: F.num(s.days) })}{/if}{/snippet}
  {#snippet legend()}<span><span class="bar"></span>{t(`heart.legend_range_${buckets.size}`)}</span><span><span class="dot"></span>{t(buckets.size === 'day' ? 'heart.legend_mean' : 'heart.legend_mean_days')}</span>{/snippet}
</ChartFrame>

<style>
  .bar { display: inline-block; width: 6px; height: 14px; border-radius: 3px; background: var(--c-heart); margin-right: 6px; vertical-align: -2px; }
  .dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--surface); border: 1px solid var(--ink); margin-right: 6px; }
</style>
