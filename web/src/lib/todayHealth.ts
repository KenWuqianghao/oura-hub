// The Apple Health side of the Today page: the totals of the selected day and of
// the day before it, the food log of the day, and the workouts that start on it.
import { api, type HealthWorkout } from './api'
import { kindInfo } from './kinds'
import { addDays, dayStartMs } from './fmt'

/** The rows of the Apple Health table, in order. Each is a kind of `get_health_daily`. */
export const DAY_KINDS = ['step_count', 'active_energy', 'exercise_time', 'stand_hour', 'distance_walking_running', 'flights_climbed', 'time_in_daylight'] as const
export type DayKind = typeof DAY_KINDS[number]
export const FOOD_KINDS = ['dietary_energy_consumed', 'dietary_protein', 'dietary_carbohydrates', 'dietary_fat_total'] as const
export type FoodKind = typeof FOOD_KINDS[number]

export type Totals = Record<DayKind, number | null>
export interface DayHealth {
  day: string
  totals: Totals
  before: Totals
  /** Null when the day has no logged energy: most days have no food log. */
  food: Record<FoodKind, number | null> | null
  workouts: HealthWorkout[]
}

export async function loadDayHealth(day: string): Promise<DayHealth> {
  const start = dayStartMs(day) / 1000, yesterday = addDays(day, -1)
  const [daily, workouts] = await Promise.all([
    api.healthDaily({ kinds: [...DAY_KINDS, ...FOOD_KINDS], start_ymd: yesterday, end_ymd: day }),
    api.workouts({ start_unix: start, end_unix: dayStartMs(addDays(day, 1)) / 1000 - 1, limit: 200 }),
  ])
  const value = (kind: string, ymd: string) => {
    const p = daily.kinds.find(s => s.kind === kind)?.days.find(d => d.ymd === ymd)
    return p ? p.value * (kindInfo(kind).display?.factor ?? 1) : null
  }
  const pick = <K extends string>(kinds: readonly K[], ymd: string) => Object.fromEntries(kinds.map(k => [k, value(k, ymd)])) as Record<K, number | null>
  const food = pick(FOOD_KINDS, day)
  return {
    day, totals: pick(DAY_KINDS, day), before: pick(DAY_KINDS, yesterday),
    food: food.dietary_energy_consumed != null ? food : null,
    workouts: [...workouts.workouts].sort((a, b) => a.start_unix - b.start_unix),
  }
}
