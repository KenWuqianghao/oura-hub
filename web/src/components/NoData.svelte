<script lang="ts">
  // The one state for a period with nothing in it: the sentence names the dates
  // that do have data, and a button goes to the first range that reaches them.
  import { noDataText, type Coverage } from '../lib/health.svelte'
  import { t } from '../lib/i18n.svelte'
  import type { RangeId } from '../lib/range'
  let { span, reach, onreach }: {
    /** The dates the hub has. `null`: none at all. `undefined`: not known. */
    span: Coverage | null | undefined
    /** The range that reaches the data, when it is not the range on screen. */
    reach?: RangeId
    onreach?: (range: RangeId) => void
  } = $props()
</script>

<span class="no-data">{noDataText(span)}{#if reach && onreach} <button class="btn" onclick={() => onreach(reach)}>{t(`common.range_${reach}_title`)}</button>{/if}</span>

<style>
  .btn { margin-left: 6px; padding: 3px 10px; font-size: 13px; vertical-align: 1px; }
</style>
