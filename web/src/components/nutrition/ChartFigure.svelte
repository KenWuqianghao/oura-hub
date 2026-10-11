<script lang="ts">
  // The frame of a chart that `MetricChart` cannot draw: the same head (name, label,
  // number, period, legend) over a plot of fixed height, so a page of mixed charts
  // reads as one set. The caller builds the ECharts option.
  import type { Snippet } from 'svelte'
  import Skeleton from '../Skeleton.svelte'
  import { chart, type Option } from '../../lib/charts'

  let { name, ink, label, when = '', height = 220, option, ready = true, loading = false, error = '', empty = '', note, value, legend }: {
    name: string
    /** The text colour of the name: a `--c-<family>-ink` token. */
    ink: string
    label: string
    when?: string
    height?: number
    option: Option
    /** False until the first data is there: the plot shows a skeleton. */
    ready?: boolean
    loading?: boolean
    error?: string
    /** Text over the plot when the period has nothing to draw. */
    empty?: string
    /** One sentence under the plot. Its line is kept when the text is empty, so the figure does not change height. */
    note?: string
    value: Snippet
    legend?: Snippet
  } = $props()
</script>

<figure class="panel fig" aria-busy={loading}>
  <figcaption>
    <div class="name" style="color: var({ink})">{name}</div>
    <div class="label">{label}</div>
    <div class="value">{@render value()}</div>
    <div class="when"><span>{when}</span>{#if legend}<span class="legend">{@render legend()}</span>{/if}</div>
  </figcaption>
  <div class="plot" style="height: {height}px">
    {#if error && !ready}
      <div class="state error-text">{error}</div>
    {:else if !ready}
      <Skeleton {height} />
    {:else}
      <div use:chart={{ option }} class="canvas" class:dim={loading} style="height: {height}px"></div>
      {#if empty}<div class="state">{empty}</div>{/if}
    {/if}
  </div>
  {#if note !== undefined}<p class="note-line">{note}</p>{/if}
</figure>

<style>
  .fig { margin: 0; padding: 16px 10px 10px; }
  figcaption { padding: 0 8px 6px; }
  .name { font-weight: 600; font-size: 15px; margin-bottom: 8px; }
  .label { font-size: 12px; font-weight: 600; color: var(--ash); letter-spacing: 0.05em; text-transform: uppercase; }
  :global(:lang(zh)) .label { font-size: 13px; letter-spacing: 0; text-transform: none; }
  .value { font-family: var(--round); font-size: 28px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.2; white-space: nowrap; }
  .value :global(small) { font-family: var(--font); font-size: 14px; font-weight: 500; color: var(--ash); letter-spacing: 0; margin-left: 3px; }
  .when { font-size: 13px; color: var(--ash); display: flex; flex-wrap: wrap; gap: 2px 16px; justify-content: space-between; min-height: 19px; }
  .plot { position: relative; }
  .canvas { width: 100%; transition: opacity var(--dur) ease; }
  .canvas.dim { opacity: 0.55; }
  .state { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; text-align: center; padding: 0 24px; color: var(--mute); font-size: 13px; pointer-events: none; }
  .error-text { color: var(--alert); }
  .note-line { margin: 8px 8px 2px; font-size: 13px; color: var(--ash); min-height: 19px; }
</style>
