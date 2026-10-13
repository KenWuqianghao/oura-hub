<script lang="ts">
  // One kind on one line, for a dense list of secondary kinds: the title, a
  // sparkline of the range, the number that stands for the range, and a link to
  // the kind's own trend. Rows that mount together load in one request.
  import { ChevronRight } from 'lucide-svelte'
  import Num from './Num.svelte'
  import Spark from './Spark.svelte'
  import { daily, noDataText } from '../lib/health.svelte'
  import { kindHref, kindInfo, kindTitle, unitLabel } from '../lib/kinds'
  import { bucketize, windowOf, type RangeId } from '../lib/range'
  import { headline, type StatChoice } from '../lib/metric'
  import { t } from '../lib/i18n.svelte'

  let { kind, range = 'M', stat = 'auto', href }: { kind: string; range?: RangeId; stat?: StatChoice; href?: string } = $props()
  const res = daily(() => kind, () => range)
  const info = $derived(kindInfo(kind))
  const data = $derived(res.data?.kind === kind ? res.data : null)
  const win = $derived(windowOf(data?.range ?? range, data?.days ?? []))
  const inWindow = $derived((data?.days ?? []).filter(d => d.ymd >= win.start && d.ymd <= win.end))
  const head = $derived(headline(inWindow, data?.agg ?? 'mean', info.chart, stat))
  const values = $derived(bucketize(inWindow, data?.agg ?? 'mean', win.start, win.end).points.map(p => p.value))
</script>

<a class="metric-row" href={href ?? kindHref(kind)} aria-busy={res.loading}>
  <span class="title">{kindTitle(kind)}</span>
  <span class="what">{res.error ? res.error : data && !inWindow.length ? noDataText(undefined) : t(head.label)}</span>
  <Spark {values} type={info.chart === 'bar' ? 'bar' : 'line'} color="var({info.color})" />
  <span class="value"><Num value={head.value} decimals={info.decimals} />{#if head.to != null}–<Num value={head.to} decimals={info.decimals} />{/if}{#if data?.unit}<small>{unitLabel(data.unit)}</small>{/if}</span>
  <ChevronRight size={14} />
</a>

<style>
  .metric-row { display: grid; grid-template-columns: minmax(0, auto) minmax(0, 1fr) 96px minmax(88px, auto) 14px; align-items: center; gap: 12px; padding: 9px 10px; margin: 0 -10px; border-radius: 8px; color: var(--ink); position: relative; transition: background-color var(--dur-fast) ease, transform var(--dur-fast) var(--ease); }
  .metric-row:hover { background: var(--fill); text-decoration: none; }
  .metric-row:active { transform: scale(0.99); }
  .metric-row + :global(.metric-row)::before { content: ""; position: absolute; left: 10px; right: 10px; top: 0; border-top: 0.5px solid var(--rule-strong); }
  .metric-row:hover::before, .metric-row:hover + :global(.metric-row)::before { opacity: 0; }
  .title { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .what { color: var(--mute); font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .value { text-align: right; font-weight: 600; white-space: nowrap; }
  .value small { font-weight: 400; color: var(--ash); margin-left: 4px; font-size: 13px; }
  .metric-row :global(svg:last-child) { color: var(--mute); }
  @media (max-width: 560px) { .metric-row { grid-template-columns: minmax(0, 1fr) 64px auto 14px; } .what { display: none; } .metric-row :global(svg:not(:last-child)) { width: 64px; } }
</style>
