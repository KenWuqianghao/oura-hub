<script lang="ts">
  // A small area + line chart, like the iOS VitalCell sparkline. Pure SVG.
  let { series, accent = 'var(--secondary)', baseline = null, height = 40 }: { series: number[]; accent?: string; baseline?: number | null; height?: number } = $props()
  const W = 200
  const pts = $derived(series.map((v, i) => [i, v] as [number, number]).filter(p => Number.isFinite(p[1])))
  const lo = $derived(pts.length ? Math.min(...pts.map(p => p[1])) : 0)
  const hi = $derived(pts.length ? Math.max(...pts.map(p => p[1])) : 1)
  const pad = $derived(Math.max(hi - lo, 1e-6) * 0.15)
  const x = (i: number) => pts.length > 1 ? (i / (pts.length - 1)) * W : W / 2
  const y = (v: number) => height - ((v - (lo - pad)) / ((hi + pad) - (lo - pad))) * height
  const line = $derived(pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[1]).toFixed(1)}`).join(' '))
  const area = $derived(pts.length ? `${line} L${x(pts.length - 1).toFixed(1)},${height} L0,${height} Z` : '')
  const id = `g${Math.random().toString(36).slice(2, 8)}`
</script>

{#if pts.length > 1}
<svg viewBox="0 0 {W} {height}" preserveAspectRatio="none" style="width:100%;height:{height}px;display:block" aria-hidden="true">
  <defs>
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color={accent} stop-opacity="0.25" />
      <stop offset="1" stop-color={accent} stop-opacity="0" />
    </linearGradient>
  </defs>
  <path d={area} fill="url(#{id})" />
  {#if baseline != null && baseline >= lo - pad && baseline <= hi + pad}
    <line x1="0" x2={W} y1={y(baseline)} y2={y(baseline)} stroke="var(--tertiary)" stroke-dasharray="3 3" vector-effect="non-scaling-stroke" />
  {/if}
  <path d={line} fill="none" stroke={accent} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
  <circle cx={x(pts.length - 1)} cy={y(pts[pts.length - 1][1])} r="3" fill={accent} vector-effect="non-scaling-stroke" />
</svg>
{/if}
