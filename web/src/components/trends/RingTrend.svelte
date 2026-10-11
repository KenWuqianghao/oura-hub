<script lang="ts">
  // One ring metric on the Trends page, on the layout of an Apple Health kind: one
  // value per wake day, the 7-day mean, and the baseline with its ±5% band.
  import Num from '../Num.svelte'
  import RangePicker from '../RangePicker.svelte'
  import TrendHead from './TrendHead.svelte'
  import TrendFacts, { type Fact } from './TrendFacts.svelte'
  import TrendTable from './TrendTable.svelte'
  import type { DayPoint } from '../../lib/api'
  import { chart } from '../../lib/charts'
  import { ringOption, hasTrend } from '../../lib/trendsChart'
  import type { RingMetric } from '../../lib/trendsRing'
  import { compare, comparisonText, windowBefore } from '../../lib/trends'
  import { unitLabel } from '../../lib/kinds'
  import { spanDays, stats, windowOf, type RangeId } from '../../lib/range'
  import { t } from '../../lib/i18n.svelte'
  import * as F from '../../lib/fmt'

  let { metric, points, baseline, range, ranges, onrange }:
    { metric: RingMetric; points: DayPoint[]; baseline: number | null; range: RangeId; ranges: RangeId[]; onrange: (range: RangeId) => void } = $props()

  const HEIGHT = 340
  const unit = $derived(unitLabel(metric.unit))
  const win = $derived(windowOf(range, points))
  const within = (w: { start: string; end: string }) => points.filter(d => d.ymd >= w.start && d.ymd <= w.end)
  const inWindow = $derived(within(win))
  const st = $derived(stats(inWindow, metric.adds ? 'sum' : 'mean'))
  const before = $derived(windowBefore(range, win.start))
  const cmp = $derived(before ? compare(inWindow, within(before), metric.decimals) : null)
  const sentence = $derived(cmp && range !== 'All' ? comparisonText(cmp, range, metric.adds, metric.decimals, unit) : '')
  const option = $derived(ringOption({ days: inWindow, start: win.start, end: win.end, baseline, unit, decimals: metric.decimals }))
  const dateOf = (ymd: string) => F.fullDateOf(F.parseYmd(ymd) ?? 0)

  const facts = $derived.by((): Fact[] => [
    { label: t('common.stat_latest'), value: st.latest?.value, decimals: metric.decimals, unit, note: st.latest ? dateOf(st.latest.ymd) : '' },
    ...(baseline != null ? [{ label: t('trends.baseline'), value: baseline, decimals: metric.decimals, unit, note: t('trends.baseline_note') }] : []),
    { label: t('common.stat_range'), value: st.min, to: st.max, decimals: metric.decimals, unit },
    ...(metric.adds ? [{ label: t('common.stat_total'), value: st.total, decimals: metric.decimals, unit }] : []),
    { label: t('trends.days_with_data'), value: st.days, note: t('trends.of_days', { n: F.num(spanDays(win.start, win.end)) }) },
    { label: t('trends.first_summary'), text: points.length ? dateOf(points[0].ymd) : '—', note: t('trends.summary_note') },
  ])
</script>

<TrendHead title={t(`trends.m_${metric.id}`)} ink="--ring-ink" about={t(`trends.m_${metric.id}_about`)}>
  <RangePicker value={range} {ranges} onchange={onrange} />
</TrendHead>

<p class="sentence">{sentence}</p>

<figure class="panel">
  <figcaption>
    <div class="label">{t(metric.adds ? 'common.stat_daily_average' : 'common.stat_average')}</div>
    <div class="value"><Num value={st.mean} decimals={metric.decimals} />{#if unit}<small>{unit}</small>{/if}</div>
    <div class="when">
      {F.dateRange(win.start, win.end)}
      {#if hasTrend(inWindow)}<span class="legend"><span><span class="ln" style="background: var(--ring); opacity: .45"></span>{t('charts.daily')}</span><span><span class="ln" style="background: var(--ring); height: 3px"></span>{t('charts.mean_7d')}</span></span>{/if}
    </div>
  </figcaption>
  <div class="plot" style="height: {HEIGHT}px">
    <div use:chart={{ option }} style="height: {HEIGHT}px; width: 100%"></div>
    {#if !inWindow.length}<div class="state">{t('common.no_data_range')}</div>{/if}
  </div>
</figure>
<TrendFacts {facts} />
{#key metric.id}<div class="days"><TrendTable days={inWindow} mean={st.mean} decimals={metric.decimals} {unit} /></div>{/key}

<style>
  .sentence { margin: 14px 0 16px; min-height: 22px; font-size: 16px; max-width: 72ch; }
  /* the figure head of MetricChart, so a ring metric and an Apple Health kind read the same */
  figure { margin: 0; min-width: 0; padding: 16px 10px 10px; }
  figcaption { padding: 0 8px 6px; }
  .label { font-size: 12px; font-weight: 600; color: var(--ash); letter-spacing: 0.05em; text-transform: uppercase; }
  :global(:lang(zh)) .label { font-size: 13px; letter-spacing: 0; text-transform: none; }
  .value { font-family: var(--round); font-size: 28px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.2; white-space: nowrap; }
  .value small { font-family: var(--font); font-size: 14px; font-weight: 500; color: var(--ash); letter-spacing: 0; margin-left: 4px; }
  .when { font-size: 13px; color: var(--ash); display: flex; flex-wrap: wrap; gap: 2px 16px; justify-content: space-between; min-height: 19px; }
  .plot { position: relative; }
  .state { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: var(--mute); font-size: 13px; pointer-events: none; }
  .days { margin-top: 20px; }
</style>
