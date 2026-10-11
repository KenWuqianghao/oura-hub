<script lang="ts">
  // A sound level over a time range: the mean of each day as a line, the lowest and
  // the highest sample of the day as a capsule behind it, and one reference line.
  import ChartFigure from '../nutrition/ChartFigure.svelte'
  import Num from '../Num.svelte'
  import type { DailySeries } from '../../lib/api'
  import { bucketize, windowOf, type RangeId } from '../../lib/range'
  import { kindInfo, kindTitle } from '../../lib/kinds'
  import { levelOption } from '../../lib/body-charts'
  import { daysAbove } from '../../lib/body'
  import { t } from '../../lib/i18n.svelte'
  import * as F from '../../lib/fmt'

  let { kind, range, series, ref, height = 220 }: { kind: string; range: RangeId; /** The whole record of the kind; null while it loads. */ series: DailySeries | null; /** The level of the reference line, in dB. */ ref: number; height?: number } = $props()
  const info = $derived(kindInfo(kind))
  const win = $derived(windowOf(range, series?.days ?? []))
  const days = $derived((series?.days ?? []).filter(d => d.ymd >= win.start && d.ymd <= win.end))
  const mean = $derived(days.length ? days.reduce((a, d) => a + d.value, 0) / days.length : null)
  const option = $derived(levelOption(bucketize(days, 'mean', win.start, win.end), info.color, ref))
  const empty = $derived(!series || days.length ? '' : series.days.length
    ? t('body.none_in_period', { first: F.fullDateOf(F.dayStartMs(series.days[0].ymd)), last: F.fullDateOf(F.dayStartMs(series.days.at(-1)!.ymd)) })
    : t('body.never'))
</script>

<ChartFigure name={kindTitle(kind)} ink="{info.color}-ink" label={t('body.level_label')} when={F.dateRange(win.start, win.end)} {height} {option} ready={!!series} {empty}
  note={days.length ? t('body.days_above', { n: F.num(daysAbove(days, ref)), m: F.num(days.length), level: F.num(ref) }) : ''}>
  {#snippet value()}<Num value={mean} /><small>dB</small>{/snippet}
  {#snippet legend()}<span><span class="ln" style="background: var({info.color})"></span>{t('body.legend_mean')}</span><span><span class="sw cap" style="background: var({info.color})"></span>{t('body.legend_low_high')}</span>{/snippet}
</ChartFigure>

<style>
  .cap { opacity: 0.3; width: 6px; height: 12px; }
</style>
