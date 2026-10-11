<script lang="ts">
  // The browser for everything the hub holds. `#/trends/<id>`: a ring metric id or
  // an Apple Health kind id.
  import PageHeader from '../components/PageHeader.svelte'
  import Empty from '../components/Empty.svelte'
  import ErrorNote from '../components/ErrorNote.svelte'
  import Skeleton from '../components/Skeleton.svelte'
  import TrendList from '../components/trends/TrendList.svelte'
  import TrendHead from '../components/trends/TrendHead.svelte'
  import KindTrend from '../components/trends/KindTrend.svelte'
  import RingTrend from '../components/trends/RingTrend.svelte'
  import { untrack } from 'svelte'
  import { hub } from '../lib/store.svelte'
  import { healthKinds } from '../lib/health.svelte'
  import { select } from '../lib/trends'
  import { ringRanges } from '../lib/trendsRing'
  import { kindInfo, kindTitle, kindAbout } from '../lib/kinds'
  import { fitRange, type RangeId } from '../lib/range'
  import { t } from '../lib/i18n.svelte'
  import * as F from '../lib/fmt'

  let { metric = 'hrv_ms' }: { metric?: string } = $props()
  const kinds = healthKinds()
  const sel = $derived(select(metric, kinds.data))
  const ringPoints = $derived(sel.type === 'ring' && hub.summary ? sel.metric.points(hub.summary) : [])
  const ranges = $derived(ringRanges(ringPoints, F.todayYmd()))
  const current = $derived(sel.type === 'ring' ? t(`trends.m_${sel.metric.id}`) : sel.type === 'health' || sel.type === 'elsewhere' ? kindTitle(sel.kind) : '')

  // `picked` is the user's range. A kind opens on it, or on the first longer range
  // that reaches the kind's data, so a kind that stopped years ago does not open empty.
  let picked = $state<RangeId>('M')
  let range = $state<RangeId>('M')
  let fitted = ''
  $effect.pre(() => {
    const key = sel.type === 'health' ? sel.kind : sel.type === 'ring' && ringPoints.length ? sel.metric.id : ''
    if (!key || key === fitted) return
    fitted = key
    const want = untrack(() => picked)
    range = sel.type === 'health' ? fitRange(want, sel.meta.newest_end_unix) : ranges.includes(want) ? want : ranges[ranges.length - 1]
  })
  const pick = (r: RangeId) => { picked = r; range = r }
</script>

<div class="wrap">
  <PageHeader title={t('shell.trends')} sub={t('trends.sub')} />
  <div class="section trends">
    <TrendList kinds={kinds.data} error={kinds.error} selected={metric} {current} />
    <div class="detail">
      {#if sel.type === 'ring'}
        {#if hub.summary}
          <RingTrend metric={sel.metric} points={ringPoints} baseline={sel.metric.baseline?.(hub.summary) ?? null} {range} {ranges} onrange={pick} />
        {:else}
          <TrendHead title={t(`trends.m_${sel.metric.id}`)} ink="--ring-ink" about={t(`trends.m_${sel.metric.id}_about`)} />
          <Empty title={t('trends.no_summary_title')} text={t('trends.no_summary_text')} />
        {/if}
      {:else if sel.type === 'health'}
        <KindTrend kind={sel.kind} meta={sel.meta} {range} onrange={pick} />
      {:else if sel.type === 'elsewhere'}
        <TrendHead title={kindTitle(sel.kind)} ink="{kindInfo(sel.kind).color}-ink" about={kindAbout(sel.kind)} />
        <p class="elsewhere">{t(`${sel.label}_text`)} <a class="btn" href={sel.href}>{t(sel.label)}</a></p>
      {:else if sel.type === 'pending'}
        {#if kinds.error}<ErrorNote message={kinds.error} />{:else}<Skeleton height={30} width="260px" /><div style="height: 20px"></div><Skeleton height={420} />{/if}
      {:else}
        <Empty title={t('trends.unknown_title', { id: sel.id })} text={t('trends.unknown_text')} />
      {/if}
    </div>
  </div>
</div>

<style>
  .trends { display: grid; grid-template-columns: 264px minmax(0, 1fr); gap: 48px; align-items: start; }
  .detail { min-width: 0; }
  .elsewhere { margin: 16px 0 0; max-width: 68ch; }
  .elsewhere .btn { margin-left: 8px; }
  @media (max-width: 1100px) { .trends { grid-template-columns: 220px minmax(0, 1fr); gap: 32px; } }
  @media (max-width: 860px) { .trends { grid-template-columns: minmax(0, 1fr); gap: 20px; } }
</style>
