<script lang="ts">
  let { score, tint, size = 84, lineWidth = 9 }: { score: number | null; tint: string; size?: number; lineWidth?: number } = $props()
  const r = $derived((size - lineWidth) / 2)
  const c = $derived(2 * Math.PI * r)
  const frac = $derived(Math.min(1, Math.max(0, (score ?? 0) / 100)))
</script>

<svg width={size} height={size} viewBox="0 0 {size} {size}" aria-hidden="true">
  <circle cx={size / 2} cy={size / 2} {r} fill="none" stroke={tint} stroke-opacity="0.16" stroke-width={lineWidth} />
  <circle cx={size / 2} cy={size / 2} {r} fill="none" stroke={tint} stroke-width={lineWidth} stroke-linecap="round"
    stroke-dasharray="{c}" stroke-dashoffset="{c * (1 - frac)}" transform="rotate(-90 {size / 2} {size / 2})"
    style="transition: stroke-dashoffset 0.9s cubic-bezier(.2,.8,.2,1)" />
  <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle"
    style="font-family: var(--font-rounded); font-weight: 600; font-size: {size >= 120 ? 34 : 22}px; fill: {score == null ? 'var(--secondary)' : 'var(--text)'}">
    {score == null ? '—' : Math.round(score)}
  </text>
</svg>
