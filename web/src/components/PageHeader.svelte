<script lang="ts">
  // The head of a page: a large title, one line under it, and room on the right
  // for a control. It is the first section of the page.
  import type { Snippet } from 'svelte'
  let { title, sub = '', right, children }: { title: string; sub?: string; right?: Snippet; children?: Snippet } = $props()
</script>

<header class="section">
  <div class="page-head">
    <div class="text">
      <h1 class="large-title">{title}</h1>
      {#if sub}<p class="sub">{sub}</p>{/if}
    </div>
    {@render right?.()}
  </div>
  {@render children?.()}
</header>
