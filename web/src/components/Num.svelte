<script lang="ts">
  // A number that tweens to its next value. Tabular digits, so the text around it
  // does not move. The first value shows at once: a count-up on load delays reading.
  import { Tween } from 'svelte/motion'
  import { cubicOut } from 'svelte/easing'
  import { num } from '../lib/fmt'
  import { theme } from '../lib/theme.svelte'
  let { value, decimals = 0, fallback = '—' }: { value: number | null | undefined; decimals?: number; fallback?: string } = $props()
  const tween = new Tween(0, { easing: cubicOut })
  let shown = false
  $effect(() => {
    if (value == null || !Number.isFinite(value)) { shown = false; return }
    tween.set(value, { duration: shown && !theme.reduced ? 300 : 0 })
    shown = true
  })
</script>

<span class="num">{value == null || !Number.isFinite(value) ? fallback : num(tween.current, decimals)}</span>
