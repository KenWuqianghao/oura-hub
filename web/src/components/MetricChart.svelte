<script lang="ts">
  // One value per day over a time range: the number that stands for the range, then
  // bars, a line with its 7-day average, or low-to-high range bars. For an Apple
  // Health kind the catalogue picks the chart and the colour and the loader brings
  // the data. A caller with its own series (a ring metric) gives the series, the
  // unit, and the decimals.
  import ChartFrame from './ChartFrame.svelte'
  import { base, tokens, color as cssColor, axisChrome, axisLabel, bucketAxis, bucketLabel, bucketTip, compact, fitAxis, averageLine, refLine, markLines, tipHead, tipRow, tipNone, type Option } from '../lib/charts'
  import { resource, loadDaily, healthKinds, coverage, noDataText, type Daily } from '../lib/health.svelte'
  import { kindInfo, kindTitle, unitLabel, type ChartType, type ColorToken } from '../lib/kinds'
  import { addsUp, bucketize, bridge, rolling, stats, windowOf, MAX_GAP, type RangeId } from '../lib/range'
  import { headline, type StatChoice } from '../lib/metric'
  import { t } from '../lib/i18n.svelte'
  import * as F from '../lib/fmt'
  import type { DailySeries } from '../lib/api'

  let { kind, range, series, type, color, decimals, unit, height = 220, refs = [], bands = [], stat = 'auto', title = true, bare = false, loading = false }: {
    /** The Apple Health kind, or the id of the caller's own series. A known kind picks the title, the colour, the decimals, and the chart type from the catalogue. */
    kind: string
    /** The range the chart shows. With `series`, give the range of that data, not the range that is still loading. */
    range: RangeId
    /** Data to draw in place of a load from the hub. `null`: the caller's data is still on its way. */
    series?: DailySeries | null
    type?: ChartType
    /** The colour of the marks, the title, and the legend. */
    color?: ColorToken
    decimals?: number
    /** The unit to print, in place of the unit of the data. */
    unit?: string
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
    /** True while the caller loads newer data for `series`. */
    loading?: boolean
  } = $props()

  const own = $derived(series === undefined)
  const res = resource((): Promise<Daily | null> => own ? loadDaily(kind, range) : Promise.resolve(null))
  const held = healthKinds()
  const info = $derived(kindInfo(kind))
  const kindOf = $derived(type ?? info.chart)
  const col = $derived(color ?? info.color)
  const dec = $derived(decimals ?? info.decimals)
  const data = $derived<Daily | null>(own ? (res.data?.kind === kind ? res.data : null) : series ? { ...series, range } : null)
  // the range of the data on screen: it follows the picker only when the new data is there
  const shown = $derived(data?.range ?? range)
  const win = $derived(windowOf(shown, data?.days ?? []))
  const inWindow = $derived((data?.days ?? []).filter(d => d.ymd >= win.start && d.ymd <= win.end))
  const agg = $derived(data?.agg ?? 'mean')
  const buckets = $derived(bucketize(inWindow, agg, win.start, win.end))
  const head = $derived(headline(inWindow, agg, kindOf, stat))
  const unitText = $derived(unit ?? unitLabel(data?.unit ?? ''))
  const trend = $derived(kindOf === 'line' && buckets.size === 'day' && inWindow.length > 7)
  const empty = $derived.by(() => {
    if (!data || inWindow.length) return ''
    const c = held.data ? coverage(held.data, kind) : undefined
    return noDataText(c ?? (data.days.length ? { first: data.days[0].ymd, newest: data.days[data.days.length - 1].ymd } : undefined))
  })

  const option = $derived.by((): Option => {
    const tk = tokens(), paint = cssColor(col), pts = buckets.points
    const values = pts.map(p => p.value)
    // the dashed line is the average of the days, the number a head with an average shows; the mean of the marks would weigh a week of one day like a week of seven
    const mean = stats(inWindow, agg).mean
    const lines = markLines([
      ...(kindOf === 'bar' && inWindow.length > 1 ? averageLine(mean, t(addsUp(agg) ? 'charts.line_daily_average' : 'charts.line_average', { n: F.num(mean, dec) })) : []),
      ...refs.map(r => refLine(r.value, r.label ?? '')),
    ])
    const area = { silent: true, itemStyle: { color: tk.band }, label: { color: tk.ash, fontSize: 11, position: 'insideTopLeft' }, data: bands.map(b => [{ yAxis: b.from, name: b.label ?? '' }, { yAxis: b.to }]) }
    const few = inWindow.length <= 45
    const joined = bridge(values, MAX_GAP[buckets.size])
    const dot = { symbol: 'circle', symbolSize: 6, itemStyle: { color: paint, borderColor: tk.surface, borderWidth: 1.5, opacity: trend ? 0.7 : 1 } }
    const series: object[] = kindOf === 'bar'
      ? [{ id: 'v', type: 'bar', data: values, itemStyle: { color: paint, borderRadius: [3, 3, 0, 0] }, barMaxWidth: 26, barCategoryGap: pts.length > 40 ? '18%' : '30%', markLine: lines, markArea: area }]
      : kindOf === 'range'
        ? [{ id: 'v', type: 'custom', data: pts.map((p, i) => [i, p.min ?? p.value, p.max ?? p.value]), encode: { x: 0, y: [1, 2] }, markLine: lines, markArea: area,
            renderItem: (_: unknown, api: any) => {
              if (api.value(1) == null || Number.isNaN(api.value(1))) return null
              const lo = api.coord([api.value(0), api.value(1)]), hi = api.coord([api.value(0), api.value(2)])
              const w = Math.max(2, Math.min(8, api.size([1, 0])[0] * 0.6)), h = Math.max(lo[1] - hi[1], w)
              return { type: 'rect', transition: ['shape'], shape: { x: lo[0] - w / 2, y: (lo[1] + hi[1]) / 2 - h / 2, width: w, height: h, r: w / 2 }, style: { fill: paint } }
            } }]
        : [
            { id: 'v', type: 'line', data: joined.line.map((v, i) => joined.filled[i] ? { value: v, symbol: 'none' } : v), connectNulls: false, showSymbol: few, ...dot,
              lineStyle: { width: trend ? 1.25 : 2, color: paint, opacity: trend ? 0.45 : 1 }, markLine: lines, markArea: area },
            // the 7-day average stops where the line stops
            { id: 'trend', type: 'line', data: trend ? bridge(rolling(values), MAX_GAP.day).line : [], connectNulls: false, showSymbol: false, lineStyle: { width: 2.5, color: paint }, itemStyle: { color: paint }, silent: true },
            // a value with no neighbour within the gap rule has no line through it: it shows as a point
            { id: 'lone', type: 'line', data: few ? [] : joined.lone, showSymbol: true, ...dot, lineStyle: { width: 0 }, silent: true },
          ]
    const span = kindOf === 'bar' ? null : [
      ...pts.flatMap(p => p.value == null ? [] : kindOf === 'range' ? [p.min ?? p.value, p.max ?? p.value] : [p.value]),
      ...refs.map(r => r.value), ...bands.flatMap(b => [b.from, b.to]),
    ]
    // a share has no value above 100%
    const fit = (a: ReturnType<typeof fitAxis>) => data?.unit === '%' && a.max != null ? { ...a, max: Math.min(a.max, 100) } : a
    return {
      ...base(),
      grid: { left: 8, right: 12, top: 14, bottom: 4, containLabel: true },
      xAxis: bucketAxis(pts, buckets.size, { boundaryGap: kindOf !== 'line' }),
      yAxis: { type: 'value', splitNumber: 3, ...axisChrome(), axisLabel: { ...axisLabel(), formatter: (v: number) => compact(v, dec) },
        ...(span ? { scale: true, ...(span.length ? fit(fitAxis(Math.min(...span), Math.max(...span), dec)) : {}) } : { min: 0 }) },
      tooltip: bucketTip(i => {
        const p = pts[i]
        if (!p) return ''
        const at = tipHead(bucketLabel(p, buckets.size))
        if (p.value == null) return at + tipNone()
        const rows = [at]
        if (kindOf === 'range') rows.push(tipRow(`${F.num(p.min, dec)}–${F.num(p.max, dec)}`, unitText), tipRow(F.num(p.value, dec), t('charts.average')))
        else rows.push(tipRow(F.num(p.value, dec), [unitText, buckets.averaged ? t('charts.daily_average') : buckets.size !== 'day' ? t('charts.average') : ''].filter(Boolean).join(' · ')))
        const tr = trend ? rolling(values)[i] : null
        if (tr != null) rows.push(tipRow(F.num(tr, Math.max(dec, 1)), t('charts.mean_7d')))
        return rows.join('')
      }, kindOf === 'line' ? 'line' : 'shadow'),
      series,
    }
  })
</script>

<ChartFrame title={title === true ? kindTitle(kind) : title || ''} color={col} label={t(head.label)} value={head.value} to={head.to} decimals={dec} unit={unitText}
  when={F.dateRange(win.start, win.end)} {height} {option} ready={!!data} loading={own ? res.loading : loading} error={own ? res.error : ''} {empty} {bare}>
  {#snippet legend()}
    {#if trend}<span><span class="ln" style="background: var({col}); opacity: .45"></span>{t('charts.daily')}</span><span><span class="ln" style="background: var({col}); height: 3px"></span>{t('charts.mean_7d')}</span>{/if}
  {/snippet}
</ChartFrame>
