<script lang="ts">
  // Under a long table: how many rows show, and a button for the next page.
  import { t } from '../lib/i18n.svelte'
  import { num } from '../lib/fmt'
  let { shown = $bindable(), total, step }: { shown: number; total: number; step: number } = $props()
</script>

{#if total > Math.min(shown, step)}
  <div class="show-more">
    <span class="sub small num">{t('common.shown_of', { n: num(Math.min(shown, total)), total: num(total) })}</span>
    {#if total > shown}<button class="btn" onclick={() => (shown += step)}>{t('common.show_more_n', { n: num(Math.min(step, total - shown)) })}</button>{/if}
  </div>
{/if}

<style>
  .show-more { display: flex; align-items: center; gap: 16px; margin-top: 12px; min-height: 34px; }
</style>
