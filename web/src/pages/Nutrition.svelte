<script lang="ts">
  import PageHeader from '../components/PageHeader.svelte'
  import Section from '../components/Section.svelte'
  import RangePicker from '../components/RangePicker.svelte'
  import MetricChart from '../components/MetricChart.svelte'
  import KV from '../components/KV.svelte'
  import Num from '../components/Num.svelte'
  import Empty from '../components/Empty.svelte'
  import ErrorNote from '../components/ErrorNote.svelte'
  import Skeleton from '../components/Skeleton.svelte'
  import ChartFigure from '../components/nutrition/ChartFigure.svelte'
  import MacroSplit from '../components/nutrition/MacroSplit.svelte'
  import NutrientTable from '../components/nutrition/NutrientTable.svelte'
  import LogCalendar from '../components/nutrition/LogCalendar.svelte'
  import { dailyAll, refreshHealth } from '../lib/health.svelte'
  import { bucketize, windowOf, type RangeId } from '../lib/range'
  import { kindTitle } from '../lib/kinds'
  import { ENERGY, BURNED_KINDS, DIET_KINDS, MACROS, NUTRIENTS, within, meanOf, defaultRange, burnedOnLoggedDays, balance, macroEnergy, macroSplit, nutrientRows, logCalendar, type Series } from '../lib/nutrition'
  import { energyOption, macroOption, macroCss } from '../lib/nutrition-charts'
  import type { DailySeries } from '../lib/api'
  import { t } from '../lib/i18n.svelte'
  import * as F from '../lib/fmt'

  // The whole food log comes in one request, so a change of range needs no load:
  // charts morph and numbers tween at once. Energy burned is two heavy kinds; it
  // comes after, and the page does not wait for it.
  const diet = dailyAll(() => [...DIET_KINDS], () => 'All')
  const out = dailyAll(() => [...BURNED_KINDS], () => 'All')
  const today = F.todayYmd()
  const byKind = $derived(new Map((diet.data ?? []).map(s => [s.kind, s])))
  const series: Series = kind => byKind.get(kind)?.days ?? []
  const unit = (kind: string) => byKind.get(kind)?.unit ?? ''
  // without the range of the load: `MetricChart` then follows the range control
  const plain = (kind: string): DailySeries | undefined => { const s = byKind.get(kind); return s && { kind: s.kind, agg: s.agg, unit: s.unit, days: s.days } }
  const held = (kind: string) => series(kind).length > 0
  const dateOf = (ymd: string) => F.fullDateOf(F.dayStartMs(ymd))
  const span = (kind: string) => ({ first: dateOf(series(kind)[0].ymd), last: dateOf(series(kind).at(-1)!.ymd) })

  const logged = $derived(series(ENERGY))
  let picked = $state<RangeId | null>(null)
  const range = $derived(picked ?? defaultRange(logged, today))
  const win = $derived(windowOf(range, [...logged]))
  const when = $derived(F.dateRange(win.start, win.end))
  const days = $derived(within(logged, win))
  const bucket = (d: ReturnType<typeof within>) => bucketize(d, 'sum', win.start, win.end)

  const burnedDays = $derived(out.data ? burnedOnLoggedDays(logged, out.data[0].days, out.data[1].days) : [])
  const burned = $derived(within(burnedDays, win))
  const bal = $derived(balance(days, burned))
  const energy = $derived(energyOption(bucket(days), bucket(burned)))

  const macroDays = $derived(macroEnergy(series))
  const macros = $derived(macroOption({ dietary_protein: bucket(within(macroDays.dietary_protein, win)), dietary_carbohydrates: bucket(within(macroDays.dietary_carbohydrates, win)), dietary_fat_total: bucket(within(macroDays.dietary_fat_total, win)) }))
  const split = $derived(macroSplit(series, win))

  const rows = $derived(nutrientRows(series, win, held))
  const micro = $derived(NUTRIENTS.filter(n => n.group !== 'other' && held(n.kind)).flatMap(n => series(n.kind)).map(d => d.ymd).sort())
  const absent = $derived(NUTRIENTS.filter(n => !held(n.kind)).map(n => kindTitle(n.kind)))
  const calendar = $derived(logCalendar(logged, today))
</script>

<div class="wrap">
  <PageHeader title={t('shell.nutrition')} sub={t('nutrition.sub')}>
    {#snippet right()}<RangePicker value={range} onchange={v => (picked = v)} />{/snippet}
    {#if diet.data && logged.length}
      <p class="lede lead">
        {#if days.length > 1}{t('nutrition.lead', { n: F.num(days.length), date: dateOf(days.at(-1)!.ymd), kcal: F.num(meanOf(days)) })}
        {:else if days.length}{t('nutrition.lead_one', { date: dateOf(days[0].ymd), kcal: F.num(days[0].value) })}
        {:else}{t('nutrition.lead_none', { date: dateOf(logged.at(-1)!.ymd) })}{/if}
      </p>
    {:else if !diet.data && !diet.error}
      <div class="lead"><Skeleton height={28} lines={2} /></div>
    {/if}
  </PageHeader>

  {#if diet.error && !diet.data}
    <div class="section"><ErrorNote message={diet.error} retry={refreshHealth} /></div>
  {:else if diet.data && !logged.length}
    <div class="section"><Empty title={t('nutrition.no_log_title')} text={t('nutrition.no_log_text')} /></div>
  {:else}
    <Section title={t('nutrition.energy')}>
      <div class="cols cols-2-1">
        <ChartFigure name={t('nutrition.energy_name')} ink="--c-nutrition-ink" label={t('nutrition.per_logged_day')} {when} height={260} option={energy} ready={!!diet.data} empty={diet.data && !days.length ? t('common.no_data_range') : ''}>
          {#snippet value()}<Num value={meanOf(days)} /><small>kcal</small>{/snippet}
          {#snippet legend()}<span><span class="sw" style="background: var(--c-nutrition)"></span>{t('nutrition.legend_intake')}</span><span><span class="ln marker"></span>{t('nutrition.legend_burned')}</span>{/snippet}
        </ChartFigure>
        <div>
          <p class="say">
            {#if !out.data}{out.error || t('nutrition.burned_loading')}
            {:else if !bal}{t('nutrition.balance_none')}
            {:else}{t(bal.intake >= bal.burned ? 'nutrition.balance_more' : 'nutrition.balance_less', { n: F.num(bal.days), in: F.num(bal.intake), out: F.num(bal.burned), diff: F.num(Math.abs(bal.intake - bal.burned)) })}{/if}
          </p>
          <KV rows={[
            [t('nutrition.kv_logged'), F.num(days.length)],
            [t('nutrition.kv_intake'), days.length ? `${F.num(meanOf(days))} kcal` : null],
            [t('nutrition.kv_both'), out.data ? F.num(bal?.days ?? 0) : null],
            [t('nutrition.kv_burned'), bal ? `${F.num(bal.burned)} kcal` : null],
            [t('nutrition.kv_diff'), bal ? `${F.signed(bal.intake - bal.burned)} kcal` : null],
          ]} />
          <p class="small sub note-text">{t('nutrition.burned_note')}</p>
        </div>
      </div>
    </Section>

    <Section title={t('nutrition.macros')}>
      <div class="cols cols-2-1">
        <ChartFigure name={t('nutrition.macros_name')} ink="--c-nutrition-ink" label={t('nutrition.macros_label')} {when} height={260} option={macros} ready={!!diet.data} empty={diet.data && !split.days ? t('common.no_data_range') : ''}>
          {#snippet value()}<Num value={split.kcal} /><small>kcal</small>{/snippet}
          {#snippet legend()}{#each MACROS as m (m.kind)}<span><span class="sw" style="background: {macroCss(m.kind)}"></span>{kindTitle(m.kind)}</span>{/each}{/snippet}
        </ChartFigure>
        <div>
          <div class="eyebrow">{t('nutrition.split')} <span class="aside">{t('nutrition.split_days', { n: F.num(split.days) })}</span></div>
          <MacroSplit {split} {held} />
          <p class="small sub note-text">{t('nutrition.factors')}</p>
        </div>
      </div>
    </Section>

    <Section title={t('nutrition.micros')}>
      <p class="sub source">{t('nutrition.source')}</p>
      {#if diet.data && micro.length && !rows.some(r => r.nutrient.group !== 'other' && r.days)}
        <p class="note">{t('nutrition.micros_none', { first: dateOf(micro[0]), last: dateOf(micro.at(-1)!) })}</p>
      {/if}
      {#if diet.data}
        <div class="cols nutrients">
          <NutrientTable groups={['minerals', 'other']} {rows} {unit} />
          <NutrientTable groups={['vitamins']} {rows} {unit} />
        </div>
        <p class="small sub note-text">{t('nutrition.no_ref_note')}{absent.length ? ` ${t('nutrition.not_in_log', { list: absent.join(t('common.list_sep')) })}` : ''}</p>
      {:else}
        <Skeleton height={18} lines={12} />
      {/if}
    </Section>

    <Section title={t('nutrition.water_caffeine')}>
      <div class="cols cols-2">
        {#each ['dietary_water', 'dietary_caffeine'] as kind (kind)}
          {#if !diet.data}
            <Skeleton height={300} />
          {:else if within(series(kind), win).length}
            <MetricChart {kind} {range} series={plain(kind)} height={180} />
          {:else}
            <p class="note">{held(kind) ? t('nutrition.kind_none', { kind: kindTitle(kind), ...span(kind) }) : t('nutrition.kind_never', { kind: kindTitle(kind) })}</p>
          {/if}
        {/each}
      </div>
    </Section>

    <Section title={t('nutrition.calendar')}>
      {#if diet.data}
        <p class="sub source">{calendar.mode === 'year'
          ? t('nutrition.cal_year', { recent: F.num(calendar.recentLogged), year: calendar.year, n: F.num(calendar.logged) })
          : t('nutrition.cal_recent', { n: F.num(calendar.logged) })}</p>
        <LogCalendar {calendar} />
      {:else}
        <Skeleton height={150} />
      {/if}
    </Section>
  {/if}
</div>

<style>
  .lead { max-width: 46ch; min-height: 2.7em; margin-top: 18px; }
  .say { margin: 4px 0 14px; font-size: 17px; line-height: 1.4; min-height: 4.2em; }
  .source { margin: 0 0 16px; max-width: 96ch; }
  .note-text { margin: 14px 0 0; max-width: 72ch; }
  .note { margin: 0 0 16px; align-self: center; }
  .nutrients { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  @media (max-width: 1240px) { .nutrients { grid-template-columns: minmax(0, 1fr); gap: 0; } }
  .marker { background: var(--c-activity); height: 3px; vertical-align: 3px; }
</style>
