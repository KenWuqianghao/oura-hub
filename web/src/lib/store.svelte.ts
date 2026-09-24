// Page state: the token, the latest summary, the Apple Health picture, load status.
import { api, getToken, setToken, type Summary, type Watch, type HealthInfo, type HealthSample, ApiError } from './api'
import { dayStartMs, todayYmd } from './fmt'

export const hub = $state({
  token: getToken(),
  authed: false,
  checking: true,
  loading: false,
  error: '' as string,
  summary: null as Summary | null,
  receivedAt: 0,
  watch: null as Watch | null,
  info: null as HealthInfo | null,
  day: '' as string,
  dayData: null as null | { day: string; hr: [number, number][]; workouts: { start: number; end: number; label: string; source: string }[] },
  dayLoading: false,
})

export async function login(token: string): Promise<boolean> {
  setToken(token.trim())
  hub.token = token.trim()
  try {
    await api.session()
    hub.authed = true
    hub.error = ''
    await load()
    return true
  } catch (e: any) {
    hub.authed = false
    hub.error = e instanceof ApiError && e.status === 401 ? 'That token was not accepted.' : `Could not reach the hub: ${e.message}`
    return false
  }
}

export function logout() {
  setToken('')
  hub.token = ''
  hub.authed = false
  hub.summary = null
  hub.watch = null
}

export async function check() {
  hub.checking = true
  if (hub.token) {
    try { await api.session(); hub.authed = true; await load() } catch { hub.authed = false }
  }
  hub.checking = false
}

export async function load() {
  hub.loading = true
  hub.error = ''
  try {
    const [summary, watch, info] = await Promise.all([
      api.summary().catch(e => { if (e instanceof ApiError && e.status === 404) return null; throw e }),
      api.tool<Watch>('get_watch').catch(() => null),
      api.health().catch(() => null),
    ])
    hub.summary = summary?.body ?? null
    if (!hub.day) { hub.day = todayYmd(); selectDay(hub.day) } else { selectDay(hub.day) }
    hub.receivedAt = summary?.received_at ?? 0
    hub.watch = watch
    hub.info = info
  } catch (e: any) {
    hub.error = e.message
  } finally {
    hub.loading = false
  }
}

/** Pick the day the page shows. Loads the watch's heart rate and workouts for it. */
export async function selectDay(day: string) {
  hub.day = day
  hub.dayLoading = true
  const H = 3600_000
  const start = dayStartMs(day) - 6 * H
  const end = dayStartMs(day) + 24 * H
  try {
    const [hrRes, wRes] = await Promise.all([
      api.tool<{ samples: HealthSample[] }>('get_health_samples', { kind: 'heart_rate', start_unix: start / 1000, end_unix: end / 1000, limit: 20000 }).catch(() => ({ samples: [] })),
      api.tool<{ samples: HealthSample[] }>('get_health_samples', { kind: 'workout', start_unix: start / 1000 - 12 * 3600, end_unix: end / 1000, limit: 200 }).catch(() => ({ samples: [] })),
    ])
    // one point per minute: the mean of the samples in that minute, oldest first
    const byMin = new Map<number, number[]>()
    for (const smp of hrRes.samples) { if (smp.value == null) continue; const m = Math.floor(smp.end_unix / 60) * 60_000; if (!byMin.has(m)) byMin.set(m, []); byMin.get(m)!.push(smp.value) }
    const hr = [...byMin.entries()].sort((a, b) => a[0] - b[0]).map(([m, vs]) => [m, vs.reduce((a, b) => a + b, 0) / vs.length] as [number, number])
    // a gap over 20 minutes breaks the line
    const withGaps: [number, number][] = []
    for (let i = 0; i < hr.length; i++) { if (i && hr[i][0] - hr[i - 1][0] > 20 * 60_000) withGaps.push([hr[i - 1][0] + 60_000, NaN]); withGaps.push(hr[i]) }
    const workouts = wRes.samples.filter(w => w.end_unix * 1000 >= start && w.start_unix * 1000 <= end).map(w => ({ start: w.start_unix * 1000, end: w.end_unix * 1000, label: (w.category ?? 'workout').replace(/_/g, ' '), source: w.source_name ?? 'Apple Health' }))
    if (hub.day === day) hub.dayData = { day, hr: withGaps, workouts }
  } finally {
    if (hub.day === day) hub.dayLoading = false
  }
}
