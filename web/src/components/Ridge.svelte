<script lang="ts">
  // The day's movement: 96 × 15-min MET-above-rest buckets as an area.
  let { profile, height = 44 }: { profile: number[]; height?: number } = $props()
  const W = 200
  const vals = $derived(profile.map(v => Math.max(0, v)))
  const hi = $derived(Math.max(...vals, 0.5))
  const x = (i: number) => (i / Math.max(vals.length - 1, 1)) * W
  const y = (v: number) => height - (v / hi) * (height - 2)
  const line = $derived(vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' '))
</script>

{#if vals.length > 1}
<svg viewBox="0 0 {W} {height}" preserveAspectRatio="none" style="width:100%;height:{height}px;display:block" aria-hidden="true">
  <path d="{line} L{W},{height} L0,{height} Z" fill="var(--activity)" fill-opacity="0.18" />
  <path d={line} fill="none" stroke="var(--activity)" stroke-width="1.5" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
</svg>
{/if}
