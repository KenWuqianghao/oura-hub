<script lang="ts">
  import PageHeader from '../components/PageHeader.svelte'
  import Section from '../components/Section.svelte'
  import RangePicker from '../components/RangePicker.svelte'
  import MetricChart from '../components/MetricChart.svelte'
  import Empty from '../components/Empty.svelte'
  import ErrorNote from '../components/ErrorNote.svelte'
  import Skeleton from '../components/Skeleton.svelte'
  import LevelChart from '../components/body/LevelChart.svelte'
  import KindTable from '../components/body/KindTable.svelte'
  import { dailyAll, refreshHealth } from '../lib/health.svelte'
  import { windowOf, type RangeId } from '../lib/range'
  import { BODY_KINDS, COMPOSITION, MOBILITY_CHARTS, MOBILITY_ROWS, LEVELS, HEARING_ROWS, LOGS, SAFE_LISTENING_DB, weightStory } from '../lib/body'
  import { kindTitle } from '../lib/kinds'
  import type { DailySeries } from '../lib/api'
  import { t } from '../lib/i18n.svelte'
  import * as F from '../lib/fmt'

  let range = $state<RangeId>('Y')
  // every kind here is light, so the whole record comes in one request and a change of range needs no load
  const all = dailyAll(() => [...BODY_KINDS], () => 'All')
  const byKind = $derived(new Map((all.data ?? []).map(s => [s.kind, s])))
  const series = (kind: string): DailySeries | undefined => byKind.get(kind)
  // for a chart: null while the record loads, and an empty series for a kind the hub does not hold
  const charted = (kind: string): DailySeries | null => !all.data ? null : series(kind) ?? { kind, agg: 'mean', unit: '', days: [] }
  const ready = $derived(!!all.data)
  const date = (ymd: string) => F.fullDateOf(F.dayStartMs(ymd))

  const mass = $derived(byKind.get('body_mass')?.days ?? [])
  const weight = $derived(weightStory(mass, windowOf(range, mass)))
  const kg = (v: number) => F.num(v, 1)

  const events = $derived(byKind.get('audio_exposure_event')?.days ?? [])
  const eventsWin = $derived(windowOf(range, events))
  const count = (days: typeof events) => days.reduce((a, d) => a + d.value, 0)
</script>

<div class="wrap">
  <PageHeader title={t('shell.body')} sub={t('body.sub')}>
    {#snippet right()}<RangePicker bind:value={range} />{/snippet}
  </PageHeader>

  {#if all.error && !all.data}
    <div class="section"><ErrorNote message={all.error} retry={refreshHealth} /></div>
  {:else}
    <Section title={t('body.weight')}>
      {#if !ready}
        <div class="lead"><Skeleton height={24} lines={2} /></div>
      {:else if weight.is === 'none'}
        <Empty title={t('body.w_none_title')} text={t('body.w_none_text')} />
      {:else}
        <p class="lede lead">
          {#if weight.is === 'stale'}{t('body.w_stale', { v: kg(weight.latest.value), date: date(weight.latest.ymd) })}
          {:else if weight.is === 'single'}{weight.before
            ? t('body.w_single', { v: kg(weight.latest.value), date: date(weight.latest.ymd), v0: kg(weight.before.value), date0: date(weight.before.ymd) })
            : t('body.w_single_first', { v: kg(weight.latest.value), date: date(weight.latest.ymd) })}
          {:else if Math.abs(weight.delta) < 0.05}{t('body.w_same', { v: kg(weight.latest.value), date: date(weight.latest.ymd), date0: date(weight.from.ymd) })}
          {:else}{t('body.w_change', { v: kg(weight.latest.value), date: date(weight.latest.ymd), delta: kg(Math.abs(weight.delta)), dir: t(weight.delta > 0 ? 'body.more' : 'body.less'), v0: kg(weight.from.value), date0: date(weight.from.ymd) })}{/if}
        </p>
      {/if}
      {#if !ready || weight.is !== 'none'}
        <div class="cols weight">
          <MetricChart kind="body_mass" {range} series={charted('body_mass')} stat="latest" height={240} />
          <KindTable kinds={COMPOSITION} {range} {series} {ready} />
        </div>
      {/if}
    </Section>

    <Section title={t('body.mobility')}>
      <p class="sub about">{t('body.mobility_about')}</p>
      <div class="cols cols-2">
        {#each MOBILITY_CHARTS as kind (kind)}
          <MetricChart {kind} {range} series={charted(kind)} height={200} />
        {/each}
      </div>
      <div class="below"><KindTable kinds={MOBILITY_ROWS} {range} {series} {ready} /></div>
    </Section>

    <Section title={t('body.hearing')}>
      <p class="sub about">{t('body.hearing_about')}</p>
      <div class="cols cols-2">
        {#each LEVELS as kind (kind)}<LevelChart {kind} {range} series={series(kind) ?? null} ref={SAFE_LISTENING_DB} />{/each}
      </div>
      <div class="cols split below">
        <KindTable kinds={HEARING_ROWS} {range} {series} {ready} />
        <div>
          <div class="eyebrow">{kindTitle('audio_exposure_event')} <span class="aside">{t('body.events_aside')}</span></div>
          {#if !ready}
            <Skeleton height={18} lines={4} gap={14} />
          {:else if !events.length}
            <p class="sub">{t('body.events_none')}</p>
          {:else}
            <p class="events-lead">{t('body.events_lead', { n: F.num(count(events.filter(d => d.ymd >= eventsWin.start && d.ymd <= eventsWin.end))), total: F.num(count(events)), first: date(events[0].ymd), last: date(events.at(-1)!.ymd) })}</p>
            <div class="table-scroll"><table class="t">
              <thead><tr><th>{t('body.col_date')}</th><th class="r">{t('body.col_count')}</th></tr></thead>
              <tbody>{#each events.slice(-6).reverse() as d (d.ymd)}<tr><td>{date(d.ymd)}</td><td class="r">{F.num(d.value)}</td></tr>{/each}</tbody>
            </table></div>
          {/if}
        </div>
      </div>
    </Section>

    <Section title={t('body.logs')}>
      <p class="sub about">{t('body.logs_about')}</p>
      <KindTable kinds={LOGS} {range} {series} {ready} measure={t('body.col_log')} />
    </Section>
  {/if}
</div>

<style>
  .lead { max-width: 52ch; min-height: 2.7em; margin: 0 0 20px; }
  .about { margin: 0 0 16px; max-width: 86ch; }
  .below { margin-top: 24px; }
  .events-lead { margin: 0 0 8px; }
  .weight { grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); }
  .split { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); }
  @media (max-width: 1240px) { .weight, .split { grid-template-columns: minmax(0, 1fr); } }
</style>
