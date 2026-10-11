// One Apple Health kind for the Trends page: the range through the shared loader,
// and the period before it for the comparison. The two arrive as one value, so the
// chart, the facts, the sentence, and the table change in the same moment.
import { api, type DayPoint } from './api'
import { loadDaily, type Daily } from './health.svelte'
import { kindInfo } from './kinds'
import { windowBefore, windowOf, type RangeId } from './range'

export interface KindTrend { kind: string; range: RangeId; series: Daily; before: DayPoint[] | null }

async function loadBefore(kind: string, range: RangeId): Promise<DayPoint[] | null> {
  const win = windowBefore(range, windowOf(range, []).start)
  if (!win) return null
  const res = await api.healthDaily({ kinds: [kind], start_ymd: win.start, end_ymd: win.end })
  const factor = kindInfo(kind).display?.factor ?? 1
  return (res.kinds[0]?.days ?? []).map(p => ({ ...p, value: p.value * factor }))
}

export async function loadKindTrend(kind: string, range: RangeId): Promise<KindTrend> {
  // the comparison is an extra: when its request fails, the trend still shows
  const [series, before] = await Promise.all([loadDaily(kind, range), loadBefore(kind, range).catch(() => null)])
  return { kind, range, series, before }
}
