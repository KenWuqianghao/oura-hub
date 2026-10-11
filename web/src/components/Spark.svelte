<script lang="ts">
  // A sparkline: the shape of a series in the space of a word. No axes, no labels;
  // the value beside it carries the number.
  let { values, type = 'line', color = 'var(--ash)', width = 96, height = 24 }:
    { values: (number | null)[]; type?: 'line' | 'bar'; color?: string; width?: number; height?: number } = $props()
  const shape = $derived.by(() => {
    const present = values.filter((v): v is number => v != null)
    if (!present.length) return null
    const hi = Math.max(...present), lo = type === 'bar' ? Math.min(0, ...present) : Math.min(...present)
    const span = hi - lo || 1, pad = 2, n = values.length
    const y = (v: number) => pad + (1 - (v - lo) / span) * (height - 2 * pad)
    if (type === 'bar') {
      const step = width / n, w = Math.max(1, Math.min(6, step - 1))
      return { bars: values.map((v, i) => v == null ? null : { x: i * step + (step - w) / 2, y: Math.min(y(v), height - 1.5), w, h: Math.max(1.5, height - y(v)) }).filter(b => b != null) }
    }
    const x = (i: number) => n === 1 ? width / 2 : 3 + (i / (n - 1)) * (width - 6)
    const pts = values.map((v, i) => v == null ? null : [x(i), y(v)] as const).filter(p => p != null)
    return { path: pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' '), last: pts[pts.length - 1] }
  })
</script>

<svg {width} {height} viewBox="0 0 {width} {height}" aria-hidden="true" style="display:block; flex: none">
  {#if shape?.bars}
    {#each shape.bars as b}<rect x={b.x} y={b.y} width={b.w} height={b.h} rx="1" fill={color} />{/each}
  {:else if shape?.last}
    <path d={shape.path} fill="none" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    <circle cx={shape.last[0]} cy={shape.last[1]} r="2.5" fill={color} />
  {/if}
</svg>
