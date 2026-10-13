<script lang="ts">
  // The head of a trend: the title in the ink of its family, one line about it,
  // and the range control on the right.
  import type { Snippet } from 'svelte'
  let { title, ink, about = '', children }: { title: string; ink: string; about?: string; children?: Snippet } = $props()
</script>

<div class="trend-head">
  <div class="text">
    <h2 style="color: var({ink})">{title}</h2>
    {#if about}<p class="sub">{about}</p>{/if}
  </div>
  {@render children?.()}
</div>

<style>
  .trend-head { display: flex; align-items: flex-start; gap: 12px 24px; flex-wrap: wrap; }
  .text { flex: 1 1 320px; min-width: 0; }
  h2 { font-size: 24px; font-weight: 700; letter-spacing: -0.02em; margin: 0; }
  :global(:lang(zh)) h2 { letter-spacing: 0; }
  .sub { margin: 4px 0 0; max-width: 68ch; }
</style>
