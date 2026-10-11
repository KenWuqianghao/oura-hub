<script lang="ts">
  // Sparse kinds as a dense table: what the period holds, the latest value with its
  // date, and how far the record goes. A kind with nothing in the period still
  // shows where its data is.
  import Num from '../Num.svelte'
  import Spark from '../Spark.svelte'
  import Skeleton from '../Skeleton.svelte'
  import type { DailySeries } from '../../lib/api'
  import { bucketize, type RangeId, windowOf } from '../../lib/range'
  import { kindInfo, kindTitle, unitLabel } from '../../lib/kinds'
  import { kindFacts } from '../../lib/body'
  import { t, intlTag } from '../../lib/i18n.svelte'
  import * as F from '../../lib/fmt'

  let { kinds, range, series, ready, measure = t('body.col_measure') }: {
    kinds: readonly string[]; range: RangeId
    /** The whole record of a kind; undefined when the hub has no rows of it. */
    series: (kind: string) => DailySeries | undefined
    ready: boolean
    /** The head of the first column. */
    measure?: string
  } = $props()
  const date = (ymd: string) => F.fullDateOf(F.dayStartMs(ymd))
  const month = (ymd: string) => new Intl.DateTimeFormat(intlTag(), { year: 'numeric', month: 'short' }).format(F.dayStartMs(ymd))
  const months = (a: string, b: string) => month(a) === month(b) ? month(a) : `${month(a)} – ${month(b)}`
  const rows = $derived(kinds.flatMap(kind => {
    const s = series(kind)
    if (!s?.days.length) return []
    const win = windowOf(range, s.days), f = kindFacts(s, win)
    return [{ ...f, info: kindInfo(kind), unit: unitLabel(f.unit), marks: bucketize(f.inWindow, s.agg, win.start, win.end).points.map(p => p.value) }]
  }))
  const missing = $derived(ready ? kinds.filter(k => !series(k)?.days.length).map(kindTitle) : [])
</script>

{#if !ready}
  <Skeleton height={18} lines={kinds.length + 1} gap={14} />
{:else}
  {#if rows.length}
    <div class="table-scroll"><table class="t">
      <thead><tr><th>{measure}</th><th colspan="2">{t('body.col_period')}</th><th>{t('body.col_latest')}</th><th>{t('body.col_record')}</th></tr></thead>
      <tbody>
        {#each rows as r (r.kind)}
          <tr>
            <td class="name">{kindTitle(r.kind)}</td>
            <td class="spark"><Spark values={r.marks} type={r.info.chart === 'bar' ? 'bar' : 'line'} color="var({r.info.color})" width={88} height={22} /></td>
            <td>
              {#if r.value == null}<span class="muted">{t('body.none_short')}</span>
              {:else}
                {@const dec = r.counts ? 0 : r.info.decimals}
                {@const spread = r.spot && r.inWindow.length > 1}
                <b>{#if spread}<Num value={r.low} decimals={dec} />–<Num value={r.high} decimals={dec} />{:else}<Num value={r.value} decimals={dec} />{/if}</b>
                <span class="u">{r.unit}{t('body.sep')}{t(r.inWindow.length === 1 ? 'body.one_day' : r.sums ? 'body.total_on_days' : spread ? 'body.n_days' : 'body.mean_of_days', { n: F.num(r.inWindow.length) })}</span>
              {/if}
            </td>
            <td>{#if r.counts}{date(r.latest!.ymd)}{:else}{F.num(r.latest!.value, r.info.decimals)} <span class="u">{r.unit}{t('body.sep')}{date(r.latest!.ymd)}</span>{/if}</td>
            <td class="u">{t('body.record', { n: F.num(r.days), range: months(r.first!.ymd, r.latest!.ymd) })}</td>
          </tr>
        {/each}
      </tbody>
    </table></div>
  {/if}
  {#if missing.length}<p class="small muted missing">{t('body.not_on_hub', { list: missing.join(t('common.list_sep')) })}</p>{/if}
{/if}

<style>
  .name { font-weight: 500; }
  .spark { width: 88px; padding-right: 0; }
  .u { color: var(--ash); font-size: 13px; }
  .missing { margin: 10px 0 0; }
</style>
