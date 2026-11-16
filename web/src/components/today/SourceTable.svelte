<script lang="ts">
  import Num from '../Num.svelte'
  import type { Scores, SleepDebt, Summary, WatchSummary } from '../../lib/api'
  import { t, i18n } from '../../lib/i18n.svelte'
  import * as F from '../../lib/fmt'

  let { ring, watch, day }: { ring: Summary; watch: WatchSummary | null; day: string } = $props()

  const note = (hit: { day: string; provisional: boolean }) => [
    hit.day !== day ? t('today.from_day', { day: i18n.locale === 'en' ? F.dayLabel(hit.day).toLowerCase() : F.dayLabel(hit.day) }) : '',
    hit.provisional ? t('today.early_estimate') : '',
  ].filter(Boolean).join(' · ')
</script>

{#snippet score(src: { scores?: Scores | null } | null, kind: F.ScoreKind)}
  {@const hit = src ? F.latestScore(src, kind, day) : null}
  {#if hit}
    <b><Num value={hit.score} /></b> <span class="pill {F.scoreTone(hit.score)}">{F.scoreBand(hit.score)}</span>
    {#if note(hit)}<div class="small sub">{note(hit)}</div>{/if}
  {:else}—{/if}
{/snippet}

{#snippet debt(d: SleepDebt | null | undefined)}
  {#if d}
    {d.valid ? `${F.minutesText(d.debt_min)} · ` : ''}<span class="pill {F.debtTone(d.state)}">{d.valid ? F.debtLabel(d.state) : t('today.debt_days', { n: d.valid_days ?? 0 })}</span>
  {:else}—{/if}
{/snippet}

<div class="table-scroll"><table class="t sources">
  <thead><tr><th></th><th>{t('today.ring')}</th><th>{t('today.watch')}</th></tr></thead>
  <tbody>
    {#each F.SCORE_KINDS as kind (kind)}
      <tr><td>{F.scoreTitle(kind)}</td><td>{@render score(ring, kind)}</td><td>{#if kind !== 'activity'}{@render score(watch, kind)}{/if}</td></tr>
    {/each}
    <tr><td>{t('today.sleep_debt')}</td><td>{@render debt(ring.sleep_debt)}</td><td>{@render debt(watch?.sleep_debt)}</td></tr>
    <tr>
      <td>{t('today.vo2_max')}</td>
      <td>{#if ring.fitness?.vo2max != null}{F.num(ring.fitness.vo2max, 1)} ml/kg/min <div class="small sub">{t('today.estimate')}</div>{:else}—{/if}</td>
      <td>{#if watch?.fitness}{F.num(watch.fitness.vo2max, 1)} ml/kg/min{#if watch.fitness.date}<div class="small sub">{F.monthDay(watch.fitness.date)}</div>{/if}{:else}—{/if}</td>
    </tr>
  </tbody>
</table></div>

<style>
  .sources { margin-top: 14px; }
  .sources td { white-space: normal; vertical-align: top; }
  .sources th:not(:first-child), .sources td:not(:first-child) { width: 38%; }
</style>
