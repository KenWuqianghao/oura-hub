<script lang="ts">
  // One daily measure in little room: the title and the number of the range on the
  // left, the bars on the right. A page stacks these in two columns.
  import Num from '../Num.svelte'
  import Skeleton from '../Skeleton.svelte'
  import { chart } from '../../lib/charts'
  import { daily, noDataText } from '../../lib/health.svelte'
  import { kindInfo, kindTitle, unitLabel } from '../../lib/kinds'
  import { bucketize, stats, windowOf, type RangeId } from '../../lib/range'
  import { dayBarsOption } from '../../lib/activity-charts'
  import { t } from '../../lib/i18n.svelte'
  import * as F from '../../lib/fmt'

  let { kind, range, height = 92 }: { kind: string; range: RangeId; height?: number } = $props()
  const res = daily(() => kind, () => range)
  const info = $derived(kindInfo(kind))
  const data = $derived(res.data?.kind === kind ? res.data : null)
  const win = $derived(windowOf(data?.range ?? range, data?.days ?? []))
  const inWindow = $derived((data?.days ?? []).filter(d => d.ymd >= win.start && d.ymd <= win.end))
  const s = $derived(stats(inWindow, data?.agg ?? 'sum'))
  const unit = $derived(unitLabel(data?.unit ?? ''))
  const option = $derived(dayBarsOption(bucketize(inWindow, data?.agg ?? 'sum', win.start, win.end), { color: info.color, decimals: info.decimals, unit, mean: s.days > 1 ? s.mean : null }))
</script>

<figure class="day-bars" aria-busy={res.loading}>
  <figcaption>
    <a class="name" href="#/trends/{kind}">{kindTitle(kind)}</a>
    <div class="value"><Num value={s.mean} decimals={info.decimals} />{#if unit}<small>{unit}</small>{/if}</div>
    <div class="label">{t('common.stat_daily_average')}</div>
    <div class="label">{#if s.total != null}{t('activity.total_n', { n: F.num(s.total, info.decimals), unit })}{/if}</div>
  </figcaption>
  <div class="plot" style="height: {height}px">
    {#if res.error && !data}
      <div class="state">{res.error}</div>
    {:else if !data}
      <Skeleton {height} />
    {:else}
      <div use:chart={{ option }} class="canvas" class:dim={res.loading} style="height: {height}px"></div>
      {#if !inWindow.length}<div class="state">{noDataText(undefined)}</div>{/if}
    {/if}
  </div>
</figure>

<style>
  .day-bars { margin: 0; min-width: 0; display: grid; grid-template-columns: 168px minmax(0, 1fr); gap: 16px; align-items: center; padding: 14px 0; border-top: 0.5px solid var(--rule-strong); }
  figcaption { min-width: 0; }
  .name { font-weight: 600; color: var(--ink); }
  .value { font-family: var(--round); font-size: 24px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.25; white-space: nowrap; }
  .value small { font-family: var(--font); font-size: 13px; font-weight: 500; color: var(--ash); letter-spacing: 0; margin-left: 4px; }
  .label { font-size: 13px; color: var(--ash); min-height: 19px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .plot { position: relative; }
  .canvas { width: 100%; transition: opacity var(--dur) ease; }
  .canvas.dim { opacity: 0.55; }
  .state { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: var(--mute); font-size: 13px; pointer-events: none; }
  @media (max-width: 560px) { .day-bars { grid-template-columns: minmax(0, 1fr); gap: 6px; } }
</style>
