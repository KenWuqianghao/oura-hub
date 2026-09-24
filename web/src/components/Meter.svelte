<script lang="ts">
  // A score: the number, its band, and the last seven days as small bars.
  import { scoreBand, bandOf } from '../lib/fmt'
  let { name, score, days, note = '', provisional = false }: { name: string; score: number | null; days: (number | null)[]; note?: string; provisional?: boolean } = $props()
</script>

<div class="meter">
  <div class="score" class:none={score == null}>{score == null ? '—' : Math.round(score)}</div>
  <div>
    <div style="display:flex; align-items:baseline; gap: 8px">
      <span class="name">{name}</span>
      {#if score != null}<span class="pill {bandOf(score)}">{scoreBand(score).label}</span>{/if}
    </div>
    {#if note || provisional}<div class="band">{[note, provisional ? 'early estimate' : ''].filter(Boolean).join(' · ')}</div>{/if}
    <div class="bars" aria-hidden="true">
      {#each days as d, i}
        <i style="height: {d == null ? 3 : Math.max(3, Math.round((d / 100) * 26))}px" class:today={i === days.length - 1} title={d == null ? '' : `${Math.round(d)}`}></i>
      {/each}
    </div>
  </div>
</div>
