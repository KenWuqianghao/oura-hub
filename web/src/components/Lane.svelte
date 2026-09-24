<script lang="ts">
  // One lane of a night: a labeled line (or bar) series across the in-bed window.
  let { name, series, accent, unit = '', kind = 'line', height = 72, ticks = [], decimals = 0 }:
    { name: string; series: number[]; accent: string; unit?: string; kind?: 'line' | 'bars'; height?: number; ticks?: [number, string][]; decimals?: number } = $props()
  const W = 1000
  const pts = $derived(series.map((v, i) => [i, v] as [number, number]).filter(p => Number.isFinite(p[1])))
  const lo = $derived(pts.length ? Math.min(...pts.map(p => p[1])) : 0)
  const hi = $derived(pts.length ? Math.max(...pts.map(p => p[1])) : 1)
  const pad = $derived(Math.max(hi - lo, 1e-6) * 0.12)
  const x = (i: number) => (i / Math.max(series.length - 1, 1)) * W
  const y = (v: number) => 4 + (1 - (v - (lo - pad)) / ((hi + pad) - (lo - pad))) * (height - 8)
  const line = $derived(pts.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join(' '))
  const mean = $derived(pts.length ? pts.reduce((a, p) => a + p[1], 0) / pts.length : null)
  const f = (v: number | null) => v == null ? '—' : v.toFixed(decimals)
</script>

<div class="lane">
  <div>
    <div class="name" style="color: {accent}">{name}</div>
    <div class="caption">{f(lo)} – {f(hi)} {unit}</div>
  </div>
  <svg viewBox="0 0 {W} {height}" preserveAspectRatio="none" style="width:100%;height:{height}px;display:block" aria-hidden="true">
    {#each ticks as [frac]}<line x1={frac * W} x2={frac * W} y1="0" y2={height} stroke="var(--separator)" vector-effect="non-scaling-stroke" />{/each}
    {#if kind === 'bars'}
      {#each pts as p}<rect x={x(p[0])} y={y(p[1])} width={Math.max(W / series.length - 1, 1)} height={height - y(p[1])} fill={accent} fill-opacity="0.7" />{/each}
    {:else}
      <path d="{line} L{x(pts.length ? pts[pts.length - 1][0] : 0)},{height} L{x(pts.length ? pts[0][0] : 0)},{height} Z" fill={accent} fill-opacity="0.12" />
      <path d={line} fill="none" stroke={accent} stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
    {/if}
  </svg>
  <div class="val">mean {f(mean)}{unit ? ' ' + unit : ''}</div>
</div>
