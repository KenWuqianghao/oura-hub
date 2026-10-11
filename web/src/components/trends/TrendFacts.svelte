<script module lang="ts">
  /** One fact: a number (with `to` for a low and a high end) or a text, and a line under it. */
  export interface Fact { label: string; value?: number | null; to?: number | null; decimals?: number; unit?: string; text?: string; note?: string }
</script>

<script lang="ts">
  // The facts of a trend on one row: a small label, the value, and a line under it.
  // Every cell keeps its height when a value or a note is missing, so a range
  // change tweens the numbers and moves nothing.
  import Num from '../Num.svelte'
  let { facts, dim = false }: { facts: Fact[]; dim?: boolean } = $props()
</script>

<dl class="facts" class:dim>
  {#each facts as f (f.label)}
    <div>
      <dt>{f.label}</dt>
      <dd>
        {#if f.text != null}{f.text}{:else}<Num value={f.value} decimals={f.decimals ?? 0} />{#if f.to != null}–<Num value={f.to} decimals={f.decimals ?? 0} />{/if}{#if f.unit}<small>{f.unit}</small>{/if}{/if}
        <span class="under">{f.note ?? ''}</span>
      </dd>
    </div>
  {/each}
</dl>

<style>
  .facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(132px, 1fr)); gap: 0 24px; margin: 0; transition: opacity var(--dur) ease; }
  .facts.dim { opacity: 0.55; }
  .facts > div { padding: 12px 0; border-bottom: 0.5px solid var(--rule-strong); min-width: 0; }
  dt { font-size: 13px; color: var(--ash); }
  dd { margin: 2px 0 0; font-size: 17px; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
  dd small { font-size: 13px; font-weight: 400; color: var(--ash); margin-left: 4px; }
  .under { display: block; font-size: 13px; font-weight: 400; color: var(--mute); min-height: 19px; white-space: normal; }
</style>
