<script lang="ts">
  // A line chart with a few axis labels, for the Trends page.
  import { monthDay } from '../lib/fmt'
  let { points, accent = 'var(--accent)', baseline = null, unit = '', height = 200 }: { points: { ymd: string; value: number }[]; accent?: string; baseline?: number | null; unit?: string; height?: number } = $props()
  const W = 600, L = 0, R = 44, T = 10, B = 22
  const vals = $derived(points.map(p => p.value))
  const lo = $derived(Math.min(...vals, baseline ?? Infinity))
  const hi = $derived(Math.max(...vals, baseline ?? -Infinity))
  const pad = $derived(Math.max(hi - lo, 1e-6) * 0.12)
  const x = (i: number) => L + (i / Math.max(points.length - 1, 1)) * (W - L - R)
  const y = (v: number) => T + (1 - (v - (lo - pad)) / ((hi + pad) - (lo - pad))) * (height - T - B)
  const line = $derived(points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' '))
  const ticks = $derived([hi, (hi + lo) / 2, lo])
  const labels = $derived(points.length > 1 ? [0, Math.floor((points.length - 1) / 2), points.length - 1] : [0])
  const fmt = (v: number) => Math.abs(v) >= 100 ? Math.round(v).toString() : v.toFixed(Math.abs(hi - lo) < 5 ? 1 : 0)
</script>

{#if points.length > 1}
<svg viewBox="0 0 {W} {height}" style="width:100%;height:{height}px;display:block" aria-hidden="true">
  {#each ticks as t}
    <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--separator)" stroke-dasharray="2 4" />
    <text x={W - R + 6} y={y(t) + 4} font-size="11" fill="var(--secondary)">{fmt(t)}{unit ? ' ' + unit : ''}</text>
  {/each}
  {#if baseline != null}
    <line x1={L} x2={W - R} y1={y(baseline)} y2={y(baseline)} stroke="var(--tertiary)" stroke-dasharray="4 4" />
  {/if}
  <path d={line} fill="none" stroke={accent} stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
  {#each points as p, i}
    <circle cx={x(i)} cy={y(p.value)} r={points.length > 40 ? 0 : 2.5} fill={accent} />
  {/each}
  {#each labels as i}
    <text x={x(i)} y={height - 6} font-size="11" fill="var(--secondary)" text-anchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}>{monthDay(points[i].ymd)}</text>
  {/each}
</svg>
{:else}
  <div class="caption">Not enough days yet.</div>
{/if}
