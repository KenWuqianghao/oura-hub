<script lang="ts">
  // The frame of every chart on the site: a head (title, the label of the number,
  // the number with its unit, the dates, a legend) over a plot of fixed height, and
  // one line of note under it. `MetricChart` fills it for an Apple Health kind; a
  // page fills it with its own ECharts option, or with any markup as children.
  // Every part of the head keeps its line when its text is empty, so a change of
  // range moves nothing.
  import type { Snippet } from 'svelte'
  import Num from './Num.svelte'
  import Skeleton from './Skeleton.svelte'
  import { chart, type Option } from '../lib/charts'
  import type { ColorToken } from '../lib/kinds'

  let { title = '', color, label = '', value, to, decimals = 0, unit = '', number, aside, when = '', legend, height = 220, option, group, ready = true, loading = false, error = '', empty = '', note, bare = false, children }: {
    title?: string
    /** The family of the chart. The title takes its ink (`<token>-ink`). */
    color?: ColorToken
    /** What the number is: "Daily average", "Latest", "Range". */
    label?: string
    /** The number of the head. It tweens when it changes. With `to`, the head shows a range. */
    value?: number | null
    to?: number | null
    decimals?: number
    unit?: string
    /** In place of `value`, for a number that is not one number: a duration, two clock times. */
    number?: Snippet
    /** Beside the number, in small type. */
    aside?: Snippet
    /** The dates the chart covers. */
    when?: string
    legend?: Snippet
    height?: number
    /** The chart. Without it, `children` fill the plot. */
    option?: Option
    /** Charts of one group share the crosshair. */
    group?: string
    /** False until the first data is there: the plot shows a skeleton. */
    ready?: boolean
    /** True while newer data loads: the plot dims and keeps what it shows. */
    loading?: boolean
    error?: string
    /** Text over the plot when the period has nothing to draw. */
    empty?: string
    /** One sentence under the plot. Give an empty string to keep its line. */
    note?: string
    /** Without the panel surface, for a chart inside another panel. */
    bare?: boolean
    children?: Snippet
  } = $props()
</script>

<figure class="chart-frame" class:panel={!bare} aria-busy={loading}>
  <figcaption>
    {#if title}<div class="title" style:color={color ? `var(${color}-ink)` : undefined}>{title}</div>{/if}
    {#if label}<div class="label">{label}</div>{/if}
    {#if number || value !== undefined}
      <div class="value">
        {#if number}{@render number()}{:else}<Num {value} {decimals} />{#if to !== undefined}–<Num value={to} {decimals} />{/if}{#if unit}<small>{unit}</small>{/if}{/if}
        {#if aside}<span class="aside">{@render aside()}</span>{/if}
      </div>
    {/if}
    {#if when || legend}<div class="when"><span>{when}</span>{#if legend}<span class="legend">{@render legend()}</span>{/if}</div>{/if}
  </figcaption>
  <div class="plot" style="height: {height}px">
    {#if error && !ready}
      <div class="state error-text">{error}</div>
    {:else if !ready}
      <Skeleton {height} />
    {:else}
      {#if option}<div use:chart={{ option, group }} class="canvas" class:dim={loading} style="height: {height}px"></div>{:else}<div class="canvas" class:dim={loading}>{@render children?.()}</div>{/if}
      {#if empty}<div class="state">{empty}</div>{/if}
    {/if}
  </div>
  {#if note !== undefined}<p class="note-line">{note}</p>{/if}
</figure>

<style>
  .chart-frame { margin: 0; min-width: 0; }
  .chart-frame.panel { padding: 16px 10px 10px; }
  figcaption { padding: 0 8px 6px; }
  .title { font-weight: 600; font-size: 15px; margin-bottom: 8px; }
  .label { font-size: 12px; font-weight: 600; color: var(--ash); letter-spacing: 0.05em; text-transform: uppercase; }
  :global(:lang(zh)) .label { font-size: 13px; letter-spacing: 0; text-transform: none; }
  .value { font-family: var(--round); font-size: 28px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.2; white-space: nowrap; }
  :global(:lang(zh)) .value { letter-spacing: 0; }
  .value :global(small) { font-family: var(--font); font-size: 14px; font-weight: 500; color: var(--ash); letter-spacing: 0; margin: 0 2px 0 4px; }
  .aside { font-family: var(--font); font-size: 14px; font-weight: 400; color: var(--ash); letter-spacing: 0; margin-left: 16px; }
  .aside :global(b) { color: var(--ink); font-weight: 600; }
  .when { font-size: 13px; color: var(--ash); display: flex; flex-wrap: wrap; gap: 4px 16px; justify-content: space-between; min-height: 19px; }
  .plot { position: relative; }
  .canvas { width: 100%; transition: opacity var(--dur) ease; }
  .canvas.dim { opacity: 0.55; }
  .state { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; text-align: center; padding: 0 24px; color: var(--ash); font-size: 13px; pointer-events: none; }
  .error-text { color: var(--alert); }
  .note-line { margin: 8px 8px 2px; font-size: 13px; color: var(--ash); min-height: 19px; }
  @media (max-width: 560px) { .aside { display: block; margin: 0; white-space: normal; } }
</style>
