<script lang="ts">
  // One score opened up: one bar per contributor, its input and its weight. The
  // source of every curve is named, so the score is not a horoscope.
  import type { Score } from '../lib/api'
  import { scoreBand } from '../lib/fmt'
  let { title, score, tint }: { title: string; score: Score | null | undefined; tint: string } = $props()
  const contributors = $derived((score?.contributors ?? []) as { key: string; name: string; score: number; weight: number; value: number | null; unit?: string; source?: string; provisional?: boolean }[])
</script>

<div class="stack" style="gap: 10px">
  <div style="display:flex; justify-content: space-between; align-items: baseline">
    <div style="font-weight: 600; color: {tint}">{title}</div>
    {#if score}<div class="caption" style="color: {scoreBand(score.score).color}">{Math.round(score.score)} · {scoreBand(score.score).label}{score.provisional ? ' · provisional' : ''}</div>{/if}
  </div>
  {#if !score}
    <div class="caption">No score for this day yet.</div>
  {:else}
    {#each contributors as c}
      <div>
        <div style="display:flex; justify-content: space-between; font-size: 14px; gap: 8px">
          <span>{c.name}<span class="caption"> · weight {Math.round(c.weight * 100)}%</span></span>
          <span class="tabular">{c.value != null ? `${Number.isInteger(c.value) ? c.value : c.value.toFixed(1)} ${c.unit ?? ''}` : ''} <b>{Math.round(c.score)}</b></span>
        </div>
        <div class="bar" style="margin-top: 4px"><i style="width: {Math.max(0, Math.min(100, c.score))}%; background: {tint}"></i></div>
        {#if c.source}<div class="caption" style="margin-top: 3px">{c.source}</div>{/if}
      </div>
    {/each}
  {/if}
</div>
