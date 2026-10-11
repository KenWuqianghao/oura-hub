<script lang="ts">
  // One Apple Health kind over a time range: a head with the number that stands for
  // the range, then bars, a line with its 7-day mean, or min–max range bars. The
  // kind catalogue picks the chart and the colour; the loader brings the data.
  import Num from './Num.svelte'
  import Skeleton from './Skeleton.svelte'
  import { chart, base, tokens, color as cssColor, axisChrome, axisLabel, bucketAxis, bucketLabel, compact, fitAxis, tipHead, tipRow, type Option } from '../lib/charts'
  import { resource, loadDaily } from '../lib/health.svelte'
  import { kindInfo, kindTitle, unitLabel, type ChartType } from '../lib/kinds'
  import { bucketize, bridge, rolling, stats, windowOf, MAX_GAP, type RangeId } from '../lib/range'
  import { headline, type StatChoice } from '../lib/metric'
  import { t } from '../lib/i18n.svelte'
  import * as F from '../lib/fmt'
  import type { DailySeries } from '../lib/api'

  let { kind, range, series, type, color, height = 220, refs = [], bands = [], stat = 'auto', title = true, bare = false }: {
    /** The Apple Health kind. It picks the title, the colour, the decimals, and the chart type from the catalogue. */
    kind: string
    range: RangeId
    /** Data to draw in place of a load from the hub: the page already has it, or made it. */
    series?: DailySeries
    type?: ChartType
    /** A token name ("--c-heart"), or any CSS colour. */
    color?: string
    height?: number
    /** Horizontal reference lines, in the unit of the chart. */
    refs?: { value: number; label?: string }[]
    /** Horizontal bands, for a target zone or a normal range. */
    bands?: { from: number; to: number; label?: string }[]
    stat?: StatChoice
    /** The title above the number: the kind's own title, another text, or none. */
    title?: boolean | string
    /** Without the panel surface, for a chart that sits inside another panel. */
    bare?: boolean
  } = $props()

  const res = resource((): Promise<DailySeries & { range?: RangeId }> => series ? Promise.resolve(series) : loadDaily(kind, range))
  const info = $derived(kindInfo(kind))
  const kindOf = $derived(type ?? info.chart)
  const data = $derived(res.data?.kind === kind ? res.data : null)
  // the range of the data on screen: it follows the picker only when the new data is there
  const shown = $derived(data?.range ?? range)
  const win = $derived(windowOf(shown, data?.days ?? []))
  const inWindow = $derived((data?.days ?? []).filter(d => d.ymd >= win.start && d.ymd <= win.end))
  const buckets = $derived(bucketize(inWindow, data?.agg ?? 'mean', win.start, win.end))
  const head = $derived(headline(inWindow, data?.agg ?? 'mean', kindOf, stat))
  const unit = $derived(unitLabel(data?.unit ?? ''))
  const trend = $derived(kindOf === 'line' && buckets.size === 'day' && inWindow.length > 7)
  const rangeText = $derived(F.dateRange(win.start, win.end))


  const option = $derived.by((): Option => {
    const tk = tokens(), col = cssColor(color ?? info.color), pts = buckets.points, dec = info.decimals
    const values = pts.map(p => p.value)
    const present = values.filter((v): v is number => v != null)
    // the average of the days, the number the head shows: the mean of the marks would weigh a week of one day like a week of seven
    const mean = stats(inWindow, data?.agg ?? 'mean').mean
    const lineOf = (value: number, label: string, dashed: boolean) => ({
      yAxis: value, lineStyle: { color: tk.ash, width: 1, type: dashed ? [4, 3] : 'solid' },
      label: { show: !!label, formatter: label, position: 'insideEndTop', color: tk.ash, fontSize: 11, fontFamily: tk.font },
    })
    const marks = {
      markLine: { silent: true, symbol: 'none', animation: false, data: [
        ...(kindOf === 'bar' && mean != null && present.length > 1 ? [lineOf(mean, t(head.label === 'common.stat_daily_average' ? 'charts.line_daily_average' : 'charts.line_average', { n: F.num(mean, dec) }), true)] : []),
        ...refs.map(r => lineOf(r.value, r.label ?? '', false)),
      ] },
      markArea: { silent: true, itemStyle: { color: tk.band }, label: { color: tk.ash, fontSize: 11, position: 'insideTopLeft' }, data: bands.map(b => [{ yAxis: b.from, name: b.label ?? '' }, { yAxis: b.to }]) },
    }
    const few = present.length <= 45, joined = bridge(values, MAX_GAP[buckets.size])
    const dot = { symbol: 'circle', symbolSize: 6, itemStyle: { color: col, borderColor: tk.surface, borderWidth: 1.5, opacity: trend ? 0.7 : 1 } }
    const main = kindOf === 'bar'
      ? { id: 'v', type: 'bar', data: values, itemStyle: { color: col, borderRadius: [3, 3, 0, 0] }, barMaxWidth: 26, barCategoryGap: pts.length > 40 ? '18%' : '30%', ...marks }
      : kindOf === 'range'
        ? { id: 'v', type: 'custom', data: pts.map((p, i) => [i, p.min ?? p.value, p.max ?? p.value]), encode: { x: 0, y: [1, 2] }, ...marks,
            renderItem: (_: unknown, api: any) => {
              if (api.value(1) == null || Number.isNaN(api.value(1))) return null
              const lo = api.coord([api.value(0), api.value(1)]), hi = api.coord([api.value(0), api.value(2)])
              const w = Math.max(2, Math.min(8, api.size([1, 0])[0] * 0.6)), h = Math.max(lo[1] - hi[1], w)
              return { type: 'rect', transition: ['shape'], shape: { x: lo[0] - w / 2, y: (lo[1] + hi[1]) / 2 - h / 2, width: w, height: h, r: w / 2 }, style: { fill: col } }
            } }
        : { id: 'v', type: 'line', data: joined.line.map((v, i) => joined.filled[i] ? { value: v, symbol: 'none' } : v), connectNulls: false, showSymbol: few, ...dot,
            lineStyle: { width: trend ? 1.25 : 2, color: col, opacity: trend ? 0.45 : 1 }, ...marks }
    // a line or a range bar gets an axis around its values, with the reference lines in view; bars start at zero
    const span = kindOf === 'bar' ? null : [
      ...pts.flatMap(p => p.value == null ? [] : kindOf === 'range' ? [p.min ?? p.value, p.max ?? p.value] : [p.value]),
      ...refs.map(r => r.value), ...bands.flatMap(b => [b.from, b.to]),
    ]
    return {
      ...base(),
      grid: { left: 8, right: 12, top: 14, bottom: 4, containLabel: true },
      xAxis: bucketAxis(pts, buckets.size, { boundaryGap: kindOf !== 'line' }),
      yAxis: { type: 'value', splitNumber: 3, ...axisChrome(), axisLabel: { ...axisLabel(), formatter: (v: number) => compact(v, dec) },
        ...(span ? { scale: true, ...(span.length ? fitAxis(Math.min(...span), Math.max(...span), dec) : {}) } : { min: 0 }) },
      tooltip: { ...(base().tooltip as object), axisPointer: { type: kindOf === 'line' ? 'line' : 'shadow', lineStyle: { color: tk.ruleStrong, width: 1 }, shadowStyle: { color: tk.band } },
        formatter: (params: any) => {
          const p = pts[(Array.isArray(params) ? params[0] : params).dataIndex]
          if (!p) return ''
          if (p.value == null) return tipHead(bucketLabel(p, buckets.size)) + `<div style="color:${tk.ash}">${t('common.no_data')}</div>`
          const rows = [tipHead(bucketLabel(p, buckets.size))]
          if (kindOf === 'range') rows.push(tipRow(`${F.num(p.min, dec)}–${F.num(p.max, dec)}`, unit), tipRow(F.num(p.value, dec), t('charts.average')))
          else rows.push(tipRow(F.num(p.value, dec), [unit, buckets.averaged ? t('charts.daily_average') : buckets.size !== 'day' ? t('charts.average') : ''].filter(Boolean).join(' · ')))
          const tr = trend ? rolling(values)[(Array.isArray(params) ? params[0] : params).dataIndex] : null
          if (tr != null) rows.push(tipRow(F.num(tr, dec), t('charts.mean_7d')))
          return rows.join('')
        } },
      series: kindOf === 'line'
        ? [main,
            // the 7-day mean stops where the line stops
            { id: 'trend', type: 'line', data: trend ? bridge(rolling(values), MAX_GAP.day).line : [], connectNulls: false, showSymbol: false, lineStyle: { width: 2.5, color: col }, itemStyle: { color: col }, silent: true },
            // a value with no neighbour within the gap rule has no line through it: it shows as a point
            { id: 'lone', type: 'line', data: few ? [] : joined.lone, showSymbol: true, ...dot, lineStyle: { width: 0 }, silent: true }]
        : [main],
    }
  })
</script>

<figure class="metric-chart" class:panel={!bare} aria-busy={res.loading}>
  <figcaption>
    {#if title}<div class="name" style="color: var({info.color}-ink)">{title === true ? kindTitle(kind) : title}</div>{/if}
    <div class="label">{t(head.label)}</div>
    <div class="value">
      <Num value={head.value} decimals={info.decimals} />{#if head.to != null}–<Num value={head.to} decimals={info.decimals} />{/if}
      {#if unit}<small>{unit}</small>{/if}
    </div>
    <div class="when">
      {rangeText}
      {#if trend}<span class="legend"><span><span class="ln" style="background: var({info.color}); opacity: .45"></span>{t('charts.daily')}</span><span><span class="ln" style="background: var({info.color}); height: 3px"></span>{t('charts.mean_7d')}</span></span>{/if}
    </div>
  </figcaption>
  <div class="plot" style="height: {height}px">
    {#if res.error && !data}
      <div class="state error-text">{res.error}</div>
    {:else if !data}
      <Skeleton {height} />
    {:else}
      <div use:chart={{ option }} class="canvas" class:dim={res.loading} style="height: {height}px"></div>
      {#if !inWindow.length}<div class="state">{t('common.no_data_range')}</div>{/if}
    {/if}
  </div>
</figure>

<style>
  .metric-chart { margin: 0; min-width: 0; }
  .metric-chart.panel { padding: 16px 10px 10px; }
  figcaption { padding: 0 8px 6px; }
  .name { font-weight: 600; font-size: 15px; margin-bottom: 8px; }
  .label { font-size: 12px; font-weight: 600; color: var(--ash); letter-spacing: 0.05em; text-transform: uppercase; }
  :global(:lang(zh)) .label { font-size: 13px; letter-spacing: 0; text-transform: none; }
  .value { font-family: var(--round); font-size: 28px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.2; white-space: nowrap; }
  .value small { font-family: var(--font); font-size: 14px; font-weight: 500; color: var(--ash); letter-spacing: 0; }
  .when { font-size: 13px; color: var(--ash); display: flex; flex-wrap: wrap; gap: 2px 16px; justify-content: space-between; min-height: 19px; }
  .plot { position: relative; }
  .canvas { width: 100%; transition: opacity var(--dur) ease; }
  .canvas.dim { opacity: 0.55; }
  .state { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; text-align: center; padding: 0 24px; color: var(--mute); font-size: 13px; pointer-events: none; }
  .error-text { color: var(--alert); }
</style>
