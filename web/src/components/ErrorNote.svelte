<script lang="ts">
  // A failed load: the message, and a way to try again when the caller has one.
  import { t } from '../lib/i18n.svelte'
  let { message, retry }: { message: string; retry?: () => void } = $props()
</script>

<div class="error" role="alert">
  {message}
  {#if retry}<button class="btn quiet" style="margin-left: 8px; padding: 2px 8px" onclick={retry}>{t('common.retry')}</button>{/if}
</div>
