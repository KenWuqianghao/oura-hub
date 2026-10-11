<script module lang="ts">
  export type KVRow = readonly [label: string, value: string | number | null | undefined] | false | null | undefined
</script>

<script lang="ts">
  // A label and value table. A row is [label, value]; a null value shows a dash,
  // and a row that is false, null, or undefined is left out, so `cond && [..]` works.
  // Rows that need markup go in the children as `.k` and `.v` elements.
  import type { Snippet } from 'svelte'
  let { rows = [], children }: { rows?: readonly KVRow[]; children?: Snippet } = $props()
</script>

<dl class="kv">
  {#each rows as row}
    {#if row}<dt class="k">{row[0]}</dt><dd class="v">{row[1] ?? '—'}</dd>{/if}
  {/each}
  {@render children?.()}
</dl>
