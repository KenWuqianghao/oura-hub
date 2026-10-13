<script module lang="ts">
  /** One fact: a number (with `to` for a low and a high end) or a text, and a note after it. */
  export interface Fact { label: string; value?: number | null; to?: number | null; decimals?: number; unit?: string; text?: string; note?: string }
</script>

<script lang="ts">
  // The facts of a trend as a label and value table. The rows stay when a value is
  // missing, so a range change tweens the numbers and moves nothing.
  import Num from '../Num.svelte'
  let { facts, dim = false }: { facts: Fact[]; dim?: boolean } = $props()
</script>

<dl class="kv facts" class:dim>
  {#each facts as f (f.label)}
    <dt class="k">{f.label}</dt>
    <dd class="v">
      {#if f.text != null}{f.text}{:else}<Num value={f.value} decimals={f.decimals ?? 0} />{#if f.to != null}–<Num value={f.to} decimals={f.decimals ?? 0} />{/if}{#if f.unit}&nbsp;{f.unit}{/if}{/if}
      {#if f.note}<span class="note-text">{f.note}</span>{/if}
    </dd>
  {/each}
</dl>

<style>
  .facts { transition: opacity var(--dur) ease; }
  .facts.dim { opacity: 0.55; }
  .note-text { display: block; font-size: 13px; color: var(--ash); }
</style>
