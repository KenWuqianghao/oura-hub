<script lang="ts">
  // A duration as a tweened number: "5 hr 12 min" in the head of a chart.
  import Num from './Num.svelte'
  import { t } from '../lib/i18n.svelte'
  let { minutes }: { minutes: number | null } = $props()
  const total = $derived(minutes == null ? null : Math.max(0, Math.round(minutes)))
</script>

{#if total == null}—{:else}{#if total >= 60}<Num value={Math.floor(total / 60)} /><small>{t('common.hr')}</small>{/if}<Num value={total % 60} /><small>{t('common.min')}</small>{/if}
