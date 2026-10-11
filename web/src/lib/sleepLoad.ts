// The Apple Health nights of a range and of the period before it, as one value:
// the lead sentence, the charts, the facts, and the table change in the same moment.
import { api, type SleepNight } from './api'
import { loadSleep } from './health.svelte'
import { windowOf, type RangeId } from './range'
import { windowBefore } from './trends'

export interface SleepHistory { range: RangeId; nights: SleepNight[]; before: SleepNight[] | null }

async function loadBefore(range: RangeId): Promise<SleepNight[] | null> {
  const win = windowBefore(range, windowOf(range, []).start)
  return win ? (await api.healthSleep({ start_ymd: win.start, end_ymd: win.end })).nights : null
}

export async function loadSleepHistory(range: RangeId): Promise<SleepHistory> {
  // the comparison is an extra: when its request fails, the history still shows
  const [nights, before] = await Promise.all([loadSleep(range), loadBefore(range).catch(() => null)])
  return { range, nights, before }
}
