<script lang="ts">
  import { stageColor } from '../lib/fmt'
  let { stages, height = 40, ticks = [] }: { stages: number[]; height?: number; ticks?: [number, string][] } = $props()
  const frac = (s: number) => s === 1 ? 1 : s === 2 ? 0.72 : s === 3 ? 0.48 : 0.28
  // merge runs so the SVG stays small on a 900-epoch night
  const runs = $derived.by(() => {
    const out: { s: number; from: number; len: number }[] = []
    for (let i = 0; i < stages.length; i++) {
      const last = out[out.length - 1]
      if (last && last.s === stages[i]) last.len++
      else out.push({ s: stages[i], from: i, len: 1 })
    }
    return out
  })
</script>

<div>
  <svg viewBox="0 0 {Math.max(stages.length, 1)} 100" preserveAspectRatio="none" style="width:100%;height:{height}px;display:block;border-radius:6px" aria-hidden="true">
    {#each runs as r}
      <rect x={r.from} y={100 - frac(r.s) * 100} width={r.len + 0.4} height={frac(r.s) * 100} fill={stageColor(r.s)} />
    {/each}
    {#each ticks as [frac]}<line x1={frac * stages.length} x2={frac * stages.length} y1="0" y2="100" stroke="var(--card)" stroke-opacity="0.9" vector-effect="non-scaling-stroke" />{/each}
  </svg>
  {#if ticks.length}
    <div style="position: relative; height: 16px; margin-top: 4px">
      {#each ticks as [frac, label]}<span class="caption" style="position:absolute; left: {frac * 100}%; transform: translateX(-50%)">{label}</span>{/each}
    </div>
  {/if}
</div>
