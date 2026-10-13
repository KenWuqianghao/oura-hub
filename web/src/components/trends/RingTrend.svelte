<script lang="ts">
  // One ring metric on the Trends page, on the layout of an Apple Health kind: one
  // value per wake day, the 7-day average, and the baseline with its ±5% band.
  import MetricChart from '../MetricChart.svelte'
  import RangePicker from '../RangePicker.svelte'
  import TrendHead from './TrendHead.svelte'
  import TrendFacts, { type Fact } from './TrendFacts.svelte'
  import TrendTable from './TrendTable.svelte'
  import type { DayPoint } from '../../lib/api'
  import type { RingMetric } from '../../lib/trendsRing'
  import { compare, comparisonText } from '../../lib/trends'
  import { unitLabel } from '../../lib/kinds'
  import { spanDays, stats, windowBefore, windowOf, type RangeId } from '../../lib/range'
  import { t } from '../../lib/i18n.svelte'
  import * as F from '../../lib/fmt'

  let { metric, points, baseline, range, ranges, onrange }:
    { metric: RingMetric; points: DayPoint[]; baseline: number | null; range: RangeId; ranges: RangeId[]; onrange: (range: RangeId) => void } = $props()

  const unit = $derived(unitLabel(metric.unit))
  const win = $derived(windowOf(range, points))
  const within = (w: { start: string; end: string }) => points.filter(d => d.ymd >= w.start && d.ymd <= w.end)
  const inWindow = $derived(within(win))
  const st = $derived(stats(inWindow, metric.adds ? 'sum' : 'mean'))
  const before = $derived(windowBefore(range, win.start))
  const cmp = $derived(before ? compare(inWindow, within(before), metric.decimals) : null)
  const sentence = $derived(cmp && range !== 'All' ? comparisonText(cmp, range, metric.adds, metric.decimals, unit) : '')
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

<p class="say">{sentence}</p>

<MetricChart kind={metric.id} {range} series={{ kind: metric.id, agg: metric.adds ? 'sum' : 'mean', unit: metric.unit, days: points }} type={metric.adds ? 'bar' : 'line'} color="--ring"
  decimals={metric.decimals} {unit} stat="average" title={false} height={340}
  refs={baseline != null ? [{ value: baseline, label: t('charts.baseline', { n: F.num(baseline, metric.decimals) }) }] : []}
  bands={baseline != null ? [{ from: baseline * 0.95, to: baseline * 1.05 }] : []} />
<div class="cols cols-1-3 below"><TrendFacts {facts} />{#key metric.id}<div><TrendTable days={inWindow} mean={st.mean} decimals={metric.decimals} {unit} /></div>{/key}</div>

<style>
  .say { margin: 14px 0 16px; }
  .below { margin-top: 20px; }
</style>
