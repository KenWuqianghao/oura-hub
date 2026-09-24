// The hub API. Everything needs the bearer token, kept in localStorage on this device.

const TOKEN_KEY = 'oura-hub.token'

export function getToken(): string {
  try { return localStorage.getItem(TOKEN_KEY) ?? '' } catch { return '' }
}
export function setToken(t: string) {
  try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY) } catch { /* private mode */ }
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('authorization', `Bearer ${getToken()}`)
  if (init.body) headers.set('content-type', 'application/json')
  const res = await fetch(path, { ...init, headers })
  const text = await res.text()
  let data: any = null
  try { data = text ? JSON.parse(text) : null } catch { data = { error: text } }
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `${res.status} ${res.statusText}`)
  return data as T
}

export const api = {
  session: () => request<{ ok: boolean; name: string; version: string }>('/api/session'),
  health: () => request<HealthInfo>('/health'),
  summary: () => request<{ received_at: number; generated_at: number | null; body: Summary }>('/api/summary'),
  tool: <T = any>(name: string, args: Record<string, unknown> = {}) =>
    request<T>(`/api/tool/${name}`, { method: 'POST', body: JSON.stringify(args) }),
}

// ── the summary JSON (the same contract the iOS app and the web dashboard render) ──
export interface Trend { series: number[]; latest: number | null; baseline: number | null; delta_pct: number | null }
export interface LatestVital { latest: number | null; date?: string; hm?: string; at_unix?: number }
export interface NightMetrics { asleep_min?: number; sol_min?: number; rem_latency_min?: number | null; waso_min?: number; awakenings?: number; cycles?: number; frag_index?: number }
export interface Night {
  date?: string; ymd?: string; start?: string; end?: string; start_ds?: number; end_ds?: number
  in_bed_h?: number | null; hrv_ms?: number | null; rhr?: number | null; skin_temp?: number | null; spo2_mean?: number | null
  deep_pct?: number | null; light_pct?: number | null; rem_pct?: number | null; wake_pct?: number | null; efficiency?: number | null
  stages?: number[] | null; stages_full?: number[] | null; metrics?: NightMetrics | null; sleep_score?: number | null
  series?: { hr?: number[]; hrv?: number[]; temp?: number[]; motion?: number[]; spo2?: number[] }
}
export interface DailyStat { active_kcal?: number; total_kcal?: number; steps?: number; distance_m?: number }
export interface SleepDebt { debt_min: number; recent_shortfall_min: number; valid: boolean; need_h: number; valid_days: number; window_days: number; state: string; days?: any[] }
export interface Illness { available: boolean; status: string; traffic_light: string; score?: number; date?: string; days_with_data?: number; biomarkers?: any[] }
export interface Score { score: number; provisional?: boolean; contributors?: any; [k: string]: any }
export interface Workout { start: string; end: string; durationMin: number; label: string; isWorkout: number }
export interface Device { serial?: string; firmware?: string; battery_pct?: number | null; days_of_data?: number; nights?: number; synced?: string; synced_hm?: string; fresh_hours?: number }
export interface Summary {
  generated_at?: number; tz?: number; digest?: string; device?: Device
  nights: Night[]; vitals: { hrv: Trend; rhr: Trend; hr?: LatestVital | null }
  activity_profile: Record<string, number[]>; activity_daily: Record<string, DailyStat>
  profile?: any; cardio?: { vascular_age?: number; chronological_age?: number; pwv_ms?: number; segments?: number } | null
  fitness?: { vo2max?: number } | null; sleep_debt?: SleepDebt | null; illness?: Illness | null
  scores?: { latest?: string; basis?: string; days: Record<string, Record<string, Score>> } | null
  workouts?: Workout[]; pushed_by?: { client: string; version: string }
}

export interface WatchLatest { value: number | null; unit?: string; at_unix?: number; source?: string }
export interface WatchDay { ymd: string; steps: number | null; active_kcal: number | null; exercise_min: number | null; stand_min: number | null; distance_m: number | null; stand_hours: number | null }
export interface Watch {
  available: boolean; note?: string
  freshness?: { newest_sample_unix: number; age_min: number }; sources?: string[]
  today?: WatchDay; yesterday?: WatchDay
  heart_rate_latest?: WatchLatest | null; resting_heart_rate?: WatchLatest | null
  hrv_sdnn?: { latest: WatchLatest | null; mean_7d_ms: number | null }; vo2_max?: WatchLatest | null
  respiratory_rate?: WatchLatest | null; oxygen_saturation?: WatchLatest | null; wrist_temperature?: WatchLatest | null
  last_sleep?: { source?: string; start_unix: number; end_unix: number; in_bed_min: number; asleep_min: number; deep_min: number; core_min: number; rem_min: number; awake_min: number } | null
  workouts_48h?: { activity: string; start_unix: number; end_unix: number; duration_min: number | null; kcal: number | null; distance_m: number | null; source?: string }[]
}

export interface HealthInfo {
  ok: boolean; snapshots?: number; latest_received_at?: number | null; latest_generated_at?: number | null
  ring?: { serials: string[]; max_event_id: number; max_reading_id: number }
  health?: { kind: string; count: number; newest_end_unix: number }[]
}

export interface TrendPoint { ymd: string; value: number }
export interface Trends { metric: string; unit: string; days_requested: number; points: TrendPoint[]; latest: number | null; mean: number | null; baseline: number | null }
export interface HealthSample { uuid: string; kind: string; start_unix: number; end_unix: number; value: number | null; unit?: string; category?: string; source_bundle?: string; source_name?: string; device?: string; metadata?: any }
