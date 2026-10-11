<script lang="ts">
  // A quiet block in the place of content that is loading. Give it the size of the
  // content, so the page does not jump when the content arrives.
  let { height = 16, width = '100%', lines = 1, gap = 10 }: { height?: number; width?: string; lines?: number; gap?: number } = $props()
</script>

{#each { length: lines } as _, i}
  <div class="skeleton" aria-hidden="true" style="height: {height}px; width: {lines > 1 && i === lines - 1 ? '60%' : width}; margin-top: {i ? gap : 0}px"></div>
{/each}
