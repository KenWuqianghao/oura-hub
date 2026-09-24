<script lang="ts">
  // A small multiple: one metric per day with the personal baseline as a hairline
  // and a ±band, crosshair synced with its siblings.
  import { chart, base, tokens, axisChrome, fmtDay } from '../lib/charts'
  let { points, baseline = null, unit = '', decimals = 0, color = 'var(--signal)', height = 150, group = 'small' }:
    { points: { ymd: string; value: number }[]; baseline?: number | null; unit?: string; decimals?: number; color?: string; height?: number; group?: string } = $props()
  const option = $derived.by(() => {
    const t = tokens()
    const col = color.startsWith('var(') ? getComputedStyle(document.documentElement).getPropertyValue(color.slice(4, -1)).trim() : color
    const data = points.map(p => [new Date(p.ymd + 'T00:00:00').getTime(), p.value])
    return {
      ...base(),
      grid: { left: 40, right: 10, top: 12, bottom: 24 },
      xAxis: { type: 'time', minInterval: 86400000, ...axisChrome(), splitLine: { show: false }, axisLabel: { color: t.ash, fontFamily: t.mono, fontSize: 11, formatter: (v: number) => fmtDay(v), hideOverlap: true } },
      yAxis: { type: 'value', scale: true, ...axisChrome(), splitNumber: 3, axisLabel: { color: t.ash, fontFamily: t.mono, fontSize: 11 } },
      tooltip: { ...(base().tooltip as object), formatter: (params: any[]) => { const p = Array.isArray(params) ? params[0] : params; return `<div style="color:${t.ash};font-family:${t.mono};font-size:11px">${fmtDay(p.value[0])}</div><div><b>${(p.value[1] as number).toFixed(decimals)}</b> <span style="color:${t.ash}">${unit}</span></div>` } },
      series: [{
        type: 'line', data, showSymbol: data.length <= 45, symbolSize: 6, symbol: 'circle',
        lineStyle: { width: 2, color: col }, itemStyle: { color: col, borderColor: t.surface, borderWidth: 2 },
        markLine: baseline != null ? { silent: true, symbol: 'none', lineStyle: { color: t.ash, width: 1, type: 'solid' }, label: { show: false }, data: [{ yAxis: baseline }] } : undefined,
        markArea: baseline != null ? { silent: true, itemStyle: { color: t.band }, data: [[{ yAxis: baseline * 0.95 }, { yAxis: baseline * 1.05 }]] } : undefined,
      }],
    }
  })
</script>

{#if points.length > 1}
  <div use:chart={{ option, group }} style="height: {height}px; width: 100%"></div>
{:else}
  <div class="empty small" style="height: {height}px; display:flex; align-items:center">Not enough days yet.</div>
{/if}
