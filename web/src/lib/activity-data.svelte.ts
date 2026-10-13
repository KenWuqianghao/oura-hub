// The workouts of a range, with the range they were loaded for and the window they
// cover: while the next range loads, the chart and the tables still agree.
import type { HealthWorkout } from './api'
import { loadWorkouts, resource, type Resource } from './health.svelte'
import { todayYmd } from './fmt'
import { windowOf, type RangeId } from './range'
import { uniqueWorkouts } from './activity'

export interface RangedWorkouts { range: RangeId; start: string; end: string; list: HealthWorkout[]; /** Rows the hub holds twice, left out of `list`. */ repeats: number }
/** Call it in a component's script. Newest first. "All" starts at the day of the first workout. */
export const rangedWorkouts = (range: () => RangeId): Resource<RangedWorkouts> => resource(async () => {
  const r = range(), { list, repeats } = uniqueWorkouts(await loadWorkouts(r))
  const first = list.length ? todayYmd(new Date(list[list.length - 1].start_unix * 1000)) : todayYmd()
  return { range: r, ...windowOf(r, [{ ymd: first, value: 0, n: 0 }]), list, repeats }
})
