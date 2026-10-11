<script lang="ts">
  // Heart rate over the range: one bar per day from the lowest to the highest value,
  // with the mean of the day marked. A day without data stays empty.
  import Num from '../Num.svelte'
  import Skeleton from '../Skeleton.svelte'
  import { chart } from '../../lib/charts'
  import { daily } from '../../lib/health.svelte'
  import { kindTitle } from '../../lib/kinds'
  import { bucketize, stats, windowOf, type RangeId } from '../../lib/range'
  import { heartRangeOption } from '../../lib/heart-charts'
  import { t } from '../../lib/i18n.svelte'
  import * as F from '../../lib/fmt'

  const KIND = 'heart_rate'
  let { range, height = 300 }: { range: RangeId; height?: number } = $props()
  const res = daily(() => KIND, () => range)
  const data = $derived(res.data)
  const win = $derived(windowOf(data?.range ?? range, data?.days ?? []))
  const inWindow = $derived((data?.days ?? []).filter(d => d.ymd >= win.start && d.ymd <= win.end))
  const s = $derived(stats(inWindow, 'mean'))
  const buckets = $derived(bucketize(inWindow, 'mean', win.start, win.end))
  const option = $derived(heartRangeOption(buckets))
</script>

<figure class="panel heart-range" aria-busy={res.loading}>
  <figcaption>
    <div class="name">{kindTitle(KIND)}</div>
    <div class="label">{t('common.stat_range')}</div>
    <div class="value"><Num value={s.min} />–<Num value={s.max} /><small>bpm</small><span class="mean">{t('heart.mean_n')} <b><Num value={s.mean} /></b> bpm</span></div>
    <div class="when">
      <span>{F.dateRange(win.start, win.end)} · {t('heart.days_with_data', { n: F.num(s.days) })}</span>
      <span class="legend"><span><span class="bar"></span>{t(`heart.legend_range_${buckets.size}`)}</span><span><span class="dot"></span>{t(buckets.size === 'day' ? 'heart.legend_mean' : 'heart.legend_mean_days')}</span></span>
    </div>
  </figcaption>
  <div class="plot" style="height: {height}px">
    {#if res.error && !data}
      <div class="state">{res.error}</div>
    {:else if !data}
      <Skeleton {height} />
    {:else}
      <div use:chart={{ option }} class="canvas" class:dim={res.loading} style="height: {height}px"></div>
      {#if !inWindow.length}<div class="state">{t('common.no_data_range')}</div>{/if}
    {/if}
  </div>
</figure>

<style>
  .heart-range { margin: 0; padding: 16px 10px 10px; }
  figcaption { padding: 0 8px 6px; }
  .name { font-weight: 600; font-size: 15px; margin-bottom: 8px; color: var(--c-heart-ink); }
  .label { font-size: 12px; font-weight: 600; color: var(--ash); letter-spacing: 0.05em; text-transform: uppercase; }
  :global(:lang(zh)) .label { font-size: 13px; letter-spacing: 0; text-transform: none; }
  .value { font-family: var(--round); font-size: 28px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.2; white-space: nowrap; }
  .value small { font-family: var(--font); font-size: 14px; font-weight: 500; color: var(--ash); letter-spacing: 0; margin-left: 5px; }
  .mean { font-family: var(--font); font-size: 14px; font-weight: 400; color: var(--ash); letter-spacing: 0; margin-left: 18px; }
  .mean b { color: var(--ink); font-weight: 600; }
  .when { font-size: 13px; color: var(--ash); display: flex; flex-wrap: wrap; gap: 4px 16px; justify-content: space-between; min-height: 19px; }
  .bar { display: inline-block; width: 6px; height: 14px; border-radius: 3px; background: var(--c-heart); margin-right: 6px; vertical-align: -2px; }
  .dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--surface); border: 1px solid var(--ink); margin-right: 6px; }
  .plot { position: relative; }
  .canvas { width: 100%; transition: opacity var(--dur) ease; }
  .canvas.dim { opacity: 0.55; }
  .state { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: var(--mute); font-size: 13px; pointer-events: none; }
  @media (max-width: 560px) { .mean { display: block; margin: 0; } }
</style>
