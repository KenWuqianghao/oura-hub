<script lang="ts">
  // One Apple Health kind on the Trends page: the head, the comparison with the
  // period before in plain words, the chart, the facts, and the days as a table.
  import MetricChart from '../MetricChart.svelte'
  import RangePicker from '../RangePicker.svelte'
  import ErrorNote from '../ErrorNote.svelte'
  import TrendHead from './TrendHead.svelte'
  import TrendFacts, { type Fact } from './TrendFacts.svelte'
  import TrendTable from './TrendTable.svelte'
  import type { HealthKind } from '../../lib/api'
  import { resource } from '../../lib/health.svelte'
  import { loadKindTrend } from '../../lib/trendsLoad'
  import { compare, comparisonText, fitRange } from '../../lib/trends'
  import { kindInfo, kindTitle, kindAbout, unitLabel } from '../../lib/kinds'
  import { addsUp, spanDays, stats, windowOf, type RangeId } from '../../lib/range'
  import { t } from '../../lib/i18n.svelte'
  import * as F from '../../lib/fmt'

  let { kind, meta, range, onrange }: { kind: string; meta: HealthKind; range: RangeId; onrange: (range: RangeId) => void } = $props()

  const res = resource(() => loadKindTrend(kind, range))
  const data = $derived(res.data?.kind === kind ? res.data : null)
  const info = $derived(kindInfo(kind))
  // what is on screen: it follows the picker only when the new data is there
  const shown = $derived(data?.range ?? range)
  const win = $derived(windowOf(shown, data?.series.days ?? []))
  const inWindow = $derived((data?.series.days ?? []).filter(d => d.ymd >= win.start && d.ymd <= win.end))
  const agg = $derived(data?.series.agg ?? meta.agg)
  const st = $derived(stats(inWindow, agg))
  const unit = $derived(unitLabel(data?.series.unit ?? info.display?.unit ?? meta.unit))
  const dim = $derived(res.loading && !!data)

  const cmp = $derived(shown !== 'All' && data?.before ? compare(inWindow, data.before, info.decimals) : null)
  const sentence = $derived(cmp && shown !== 'All' ? comparisonText(cmp, shown, addsUp(agg), info.decimals, unit) : '')
  const empty = $derived(!!data && !inWindow.length)
  const reach = $derived(fitRange(shown, meta.newest_end_unix))
  const dateOf = (unix: number) => F.fullDateOf(unix * 1000)

  const facts = $derived.by((): Fact[] => [
    { label: t('common.stat_latest'), value: st.latest?.value, decimals: info.decimals, unit, note: st.latest ? F.fullDateOf(F.parseYmd(st.latest.ymd) ?? 0) : '' },
    { label: t('common.stat_range'), value: st.min, to: st.max, decimals: info.decimals, unit },
    ...(addsUp(agg) ? [{ label: t('common.stat_total'), value: st.total, decimals: info.decimals, unit }] : []),
    { label: t('trends.days_with_data'), value: data ? st.days : null, note: t('trends.of_days', { n: F.num(spanDays(win.start, win.end)) }) },
    { label: t('trends.first_record'), text: meta.first_start_unix != null ? dateOf(meta.first_start_unix) : '—', note: t('trends.newest_on', { date: dateOf(meta.newest_end_unix) }) },
  ])
</script>

<TrendHead title={kindTitle(kind)} ink="{info.color}-ink" about={kindAbout(kind)}>
  <RangePicker value={range} onchange={onrange} />
</TrendHead>

<p class="sentence" class:dim>
  {#if empty}
    {t('trends.empty_range', { period: t(`trends.period_${shown === 'All' ? 'Y' : shown}`), first: meta.first_start_unix != null ? dateOf(meta.first_start_unix) : '—', newest: dateOf(meta.newest_end_unix) })}
    {#if reach !== shown}<button class="btn" onclick={() => onrange(reach)}>{t(`common.range_${reach}_title`)}</button>{/if}
  {:else}{sentence}{/if}
</p>

{#if res.error && !data}
  <ErrorNote message={res.error} />
{:else}
  <div class="chart" class:dim><MetricChart {kind} {range} series={data?.series} stat="average" title={false} height={340} /></div>
  <TrendFacts {facts} {dim} />
  {#key kind}<div class="days"><TrendTable days={inWindow} mean={st.mean} decimals={info.decimals} {unit} {dim} /></div>{/key}
{/if}

<style>
  .sentence { margin: 14px 0 16px; min-height: 22px; font-size: 16px; max-width: 72ch; transition: opacity var(--dur) ease; }
  .sentence .btn { display: flex; margin-top: 8px; padding: 3px 10px; font-size: 13px; }
  .chart { transition: opacity var(--dur) ease; }
  .dim { opacity: 0.55; }
  .days { margin-top: 20px; }
</style>
