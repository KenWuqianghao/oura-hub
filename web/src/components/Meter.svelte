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

<style>
  .meter { display: grid; grid-template-columns: auto 1fr; gap: 14px 16px; align-items: center; padding: 16px 0; }
  .score { font-family: var(--round); font-size: 40px; font-weight: 600; letter-spacing: -0.03em; line-height: 1; min-width: 64px; font-variant-numeric: tabular-nums; }
  :global(:lang(zh)) .score { letter-spacing: 0; }
  .score.none { color: var(--mute); }
  .name { font-weight: 600; }
  .band { font-size: 13px; color: var(--ash); }
  .bars { display: flex; gap: 3px; align-items: flex-end; height: 26px; margin-top: 6px; }
  .bars i { display: block; width: 8px; border-radius: 2px 2px 0 0; background: var(--fill-strong); transition: height var(--dur) var(--ease); }
  .bars i.today { background: var(--ring); }
</style>
