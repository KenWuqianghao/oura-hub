<script lang="ts">
  // A section of a page: a hairline, a small label with an optional aside and a
  // control on the right, then the content.
  import type { Snippet } from 'svelte'
  let { title = '', aside = '', right, flush = false, children }: { title?: string; aside?: string; right?: Snippet; flush?: boolean; children: Snippet } = $props()
</script>

<section class="section" class:flush>
  {#if title || right}
    <div class="eyebrow">
      {#if title}<span>{title}</span>{/if}
      {#if aside}<span class="aside">{aside}</span>{/if}
      {#if right}<span class="spacer"></span>{@render right()}{/if}
    </div>
  {/if}
  {@render children()}
</section>
