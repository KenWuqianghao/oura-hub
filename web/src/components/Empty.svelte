<script lang="ts">
  // Nothing to show yet: say what is missing and what to do about it.
  import type { Snippet } from 'svelte'
  let { title, text = '', children }: { title: string; text?: string; children?: Snippet } = $props()
</script>

<div class="empty"><b>{title}</b>{text}{@render children?.()}</div>
