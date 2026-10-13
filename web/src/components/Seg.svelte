<script lang="ts" generics="T extends string | number">
  // A segmented control: one choice of a few, with a thumb that slides to the choice.
  import { thumb } from '../lib/motion'
  let { value = $bindable(), options, label, onchange }:
    { value: T; options: readonly { value: T; label: string; title?: string }[]; label: string; onchange?: (value: T) => void } = $props()

  function pick(v: T) { if (v !== value) { value = v; onchange?.(v) } }
  function onkey(e: KeyboardEvent) {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const i = options.findIndex(o => o.value === value)
    const next = options[(i + step + options.length) % options.length]
    pick(next.value)
    const group = e.currentTarget as HTMLElement
    queueMicrotask(() => group.querySelector<HTMLElement>('[aria-checked="true"]')?.focus())
  }
</script>

<div class="seg" role="radiogroup" aria-label={label} tabindex="-1" use:thumb={[value, options]} onkeydown={onkey}>
  <span class="thumb" aria-hidden="true"></span>
  {#each options as o (o.value)}
    <button type="button" role="radio" aria-checked={o.value === value} tabindex={o.value === value ? 0 : -1} title={o.title} onclick={() => pick(o.value)}>{o.label}</button>
  {/each}
</div>

<style>
  .seg { position: relative; display: inline-flex; padding: 2px; border-radius: 9px; background: var(--fill); outline: none; }
  .thumb { position: absolute; top: 2px; bottom: 2px; left: 0; width: var(--thumb-w, 0); transform: translateX(var(--thumb-x, 0)); border-radius: 7px; background: var(--raised); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 0 0 0.5px rgba(0, 0, 0, 0.04); pointer-events: none; }
  .seg:global([data-ready]) .thumb { transition: transform var(--dur) var(--ease), width var(--dur) var(--ease); }
  .seg:global([data-empty]) .thumb { opacity: 0; }
  button { position: relative; border: 0; background: transparent; padding: 4px 12px; min-width: 36px; border-radius: 7px; font-size: 13px; font-weight: 500; line-height: 18px; color: var(--ash); cursor: pointer; white-space: nowrap; font-variant-numeric: tabular-nums; transition: color var(--dur-fast) ease, transform var(--dur-fast) var(--ease); }
  button:hover { color: var(--ink); }
  button:active { transform: scale(0.97); }
  button[aria-checked="true"] { color: var(--ink); font-weight: 600; }
  @media (prefers-color-scheme: dark) { .thumb { background: #636366; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3); } }
</style>
