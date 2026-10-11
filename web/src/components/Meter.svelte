<script lang="ts">
  // A score: the number, its band, and the last seven days as small bars.
  import Num from './Num.svelte'
  import { scoreBand, scoreTone } from '../lib/fmt'
  import { t } from '../lib/i18n.svelte'
  let { name, score, days, note = '', provisional = false }: { name: string; score: number | null; days: (number | null)[]; note?: string; provisional?: boolean } = $props()
</script>

<div class="meter">
  <div class="score" class:none={score == null}><Num value={score} /></div>
  <div>
    <div style="display:flex; align-items:baseline; gap: 8px; flex-wrap: wrap">
      <span class="name">{name}</span>
      {#if score != null}<span class="pill {scoreTone(score)}">{scoreBand(score)}</span>{/if}
    </div>
    <div class="band">{[note, provisional ? t('today.early_estimate') : ''].filter(Boolean).join(' · ') || ' '}</div>
    <div class="bars" aria-hidden="true">
      {#each days as d, i}
        <i style="height: {d == null ? 3 : Math.max(3, Math.round((d / 100) * 26))}px" class:today={i === days.length - 1}></i>
      {/each}
    </div>
  </div>
</div>
