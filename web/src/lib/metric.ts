// The one number that stands for a kind over a range, and its label.
import type { Agg, DayPoint } from './api'
import type { ChartType } from './kinds'
import type { Key } from './i18n.svelte'
import { addsUp, stats } from './range'

/** `auto`: a range chart shows its range, a kind that adds up shows the daily average, a `last` kind shows the latest value, a `mean` kind shows the average. */
export type StatChoice = 'auto' | 'average' | 'latest' | 'total' | 'range'
/** `to` is set for a range: the value is the low end and `to` the high end. */
export interface Headline { label: Key; value: number | null; to?: number | null }

export function headline(days: DayPoint[], agg: Agg, chart: ChartType, choice: StatChoice = 'auto'): Headline {
  const s = stats(days, agg)
  const pick = choice !== 'auto' ? choice : chart === 'range' ? 'range' : agg === 'last' ? 'latest' : 'average'
  switch (pick) {
    case 'range': return { label: 'common.stat_range', value: s.min, to: s.max }
    case 'latest': return { label: 'common.stat_latest', value: s.latest?.value ?? null }
    case 'total': return { label: 'common.stat_total', value: s.total }
    case 'average': return { label: addsUp(agg) ? 'common.stat_daily_average' : 'common.stat_average', value: s.mean }
  }
}
