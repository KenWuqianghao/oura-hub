// The Apple Health loader. Components ask for one kind and one range; requests made
// in the same moment go to the hub as one `get_health_daily` call, and a result is
// kept for the session. A kind with very many rows takes about a second on the hub,
// so each heavy kind travels alone and never holds back the light ones.
import { api, type DailySeries, type SleepNight, type HealthWorkout, type HealthKind } from './api'
import { kindInfo } from './kinds'
import { rangeDays, type RangeId } from './range'

const HEAVY = new Set(['heart_rate', 'active_energy', 'basal_energy', 'physical_effort', 'step_count'])
const BATCH = 60

/** A daily series with the range it was loaded for: while the next range loads, a chart still knows what it shows. */
export type Daily = DailySeries & { range: RangeId }
type Waiter = { resolve: (s: Daily) => void; reject: (e: unknown) => void }
const cache = new Map<string, Promise<unknown>>()
const queue = new Map<RangeId, Map<string, Waiter>>()
let flushing = false

/** Bumps when the cache is cleared, so every resource loads again. */
const state = $state({ version: 0 })
export function refreshHealth() { cache.clear(); state.version++ }

function display(s: DailySeries, range: RangeId): Daily {
  const d = kindInfo(s.kind).display
  if (!d) return { ...s, range }
  const f = (v: number | undefined) => v == null ? v : v * d.factor
  return { ...s, range, unit: d.unit, days: s.days.map(p => ({ ...p, value: p.value * d.factor, min: f(p.min), max: f(p.max) })) }
}

async function send(range: RangeId, kinds: string[], waiters: Map<string, Waiter>) {
  try {
    const res = await api.healthDaily({ kinds, days: rangeDays(range) })
    const got = new Map(res.kinds.map(s => [s.kind, s]))
    for (const kind of kinds) waiters.get(kind)!.resolve(display(got.get(kind) ?? { kind, agg: 'mean', unit: '', days: [] }, range))
  } catch (e) {
    for (const kind of kinds) { cache.delete(`daily|${range}|${kind}`); waiters.get(kind)!.reject(e) }
  }
}
function flush() {
  flushing = false
  for (const [range, waiters] of queue) {
    const light = [...waiters.keys()].filter(k => !HEAVY.has(k))
    for (let i = 0; i < light.length; i += BATCH) send(range, light.slice(i, i + BATCH), waiters)
    for (const kind of waiters.keys()) if (HEAVY.has(kind)) send(range, [kind], waiters)
  }
  queue.clear()
}

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  let p = cache.get(key) as Promise<T> | undefined
  if (!p) { p = load(); cache.set(key, p); p.catch(() => { if (cache.get(key) === p) cache.delete(key) }) }
  return p
}

/** One value per day of one kind over a range, in the display unit of the kind. Days with data only, oldest first. */
export function loadDaily(kind: string, range: RangeId): Promise<Daily> {
  return cached(`daily|${range}|${kind}`, () => new Promise<Daily>((resolve, reject) => {
    if (!queue.has(range)) queue.set(range, new Map())
    queue.get(range)!.set(kind, { resolve, reject })
    if (!flushing) { flushing = true; setTimeout(flush, 0) }
  }))
}
/** Apple Health nights over a range, oldest first. */
export const loadSleep = (range: RangeId): Promise<SleepNight[]> => cached(`sleep|${range}`, async () => (await api.healthSleep({ days: rangeDays(range) })).nights)
/** Workouts over a range, newest first. */
export const loadWorkouts = (range: RangeId): Promise<HealthWorkout[]> => cached(`workouts|${range}`, async () => (await api.workouts({ days: rangeDays(range), limit: 2000 })).workouts)
/** Every kind the hub holds, with its sample count, first and newest time, aggregation, and unit. */
export const loadKinds = (): Promise<HealthKind[]> => cached('kinds', async () => (await api.healthKinds()).kinds)

/** A value that loads, for a component. `data` keeps the last result while the next one loads, so a chart can morph. */
export interface Resource<T> { readonly loading: boolean; readonly error: string; readonly data: T | null }
/** `load` runs again when a state or a prop it reads changes. Call it in a component's script. */
export function resource<T>(load: () => Promise<T>): Resource<T> {
  const r = $state({ loading: true, error: '', data: null as T | null })
  $effect(() => {
    void state.version
    let live = true
    r.loading = true
    load().then(
      data => { if (live) { r.data = data; r.error = ''; r.loading = false } },
      (e: unknown) => { if (live) { r.error = e instanceof Error ? e.message : String(e); r.loading = false } },
    )
    return () => { live = false }
  })
  return r
}

/** Call these in a component's script. The arguments are functions so the resource follows a prop or a state. */
export const daily = (kind: () => string, range: () => RangeId): Resource<Daily> => resource(() => loadDaily(kind(), range()))
/** Several kinds as one resource: `data` is in the order of `kinds` and arrives when the slowest kind is there. */
export const dailyAll = (kinds: () => string[], range: () => RangeId): Resource<Daily[]> => resource(() => Promise.all(kinds().map(k => loadDaily(k, range()))))
export const sleepNights = (range: () => RangeId): Resource<SleepNight[]> => resource(() => loadSleep(range()))
export const workouts = (range: () => RangeId): Resource<HealthWorkout[]> => resource(() => loadWorkouts(range()))
export const healthKinds = (): Resource<HealthKind[]> => resource(loadKinds)
