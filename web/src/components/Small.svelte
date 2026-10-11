<script lang="ts">
  // A small multiple: one metric per day with the personal baseline as a hairline
  // and a ±5% band, crosshair synced with its siblings.
  import { chart, base, tokens, color as cssColor, axisChrome, axisLabel, compact, tipHead, tipRow } from '../lib/charts'
  import { withBreaks } from '../lib/range'
  import { t } from '../lib/i18n.svelte'
  import * as F from '../lib/fmt'
  let { points, baseline = null, unit = '', decimals = 0, color = '--ring', height = 150, group = 'small' }:
    { points: { ymd: string; value: number }[]; baseline?: number | null; unit?: string; decimals?: number; color?: string; height?: number; group?: string } = $props()
  const option = $derived.by(() => {
    const tk = tokens(), col = cssColor(color)
    const data = withBreaks(points, F.dayStartMs)
    return {
      ...base(),
      grid: { left: 40, right: 10, top: 12, bottom: 24 },
      xAxis: { type: 'time', minInterval: 86400000, ...axisChrome(), splitLine: { show: false }, axisLabel: { ...axisLabel(), formatter: (v: number) => F.monthDayOf(v), hideOverlap: true } },
      yAxis: { type: 'value', scale: true, ...axisChrome(), splitNumber: 3, axisLabel: { ...axisLabel(), formatter: (v: number) => compact(v, decimals) } },
      tooltip: { ...(base().tooltip as object), formatter: (params: any) => { const p = Array.isArray(params) ? params[0] : params; return tipHead(F.monthDayOf(p.value[0])) + tipRow(F.num(p.value[1], decimals), unit) } },
      series: [{
        id: 'v', type: 'line', data, connectNulls: false, showSymbol: points.length <= 45, symbolSize: 6, symbol: 'circle',
        lineStyle: { width: 2, color: col }, itemStyle: { color: col, borderColor: tk.surface, borderWidth: 2 },
        markLine: { silent: true, symbol: 'none', animation: false, lineStyle: { color: tk.ash, width: 1, type: 'solid' }, label: { show: false }, data: baseline != null ? [{ yAxis: baseline }] : [] },
        markArea: { silent: true, itemStyle: { color: tk.band }, data: baseline != null ? [[{ yAxis: baseline * 0.95 }, { yAxis: baseline * 1.05 }]] : [] },
      }],
    }
  })
</script>

{#if points.length > 1}
  <div use:chart={{ option, group }} style="height: {height}px; width: 100%"></div>
{:else}
  <div class="empty small" style="height: {height}px; display:flex; align-items:center">{t('charts.not_enough')}</div>
{/if}
