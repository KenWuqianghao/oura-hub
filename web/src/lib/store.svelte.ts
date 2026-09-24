// Page state: the token, the latest summary, the Apple Health picture, load status.
import { api, getToken, setToken, type Summary, type Watch, type HealthInfo, ApiError } from './api'

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
    hub.receivedAt = summary?.received_at ?? 0
    hub.watch = watch
    hub.info = info
  } catch (e: any) {
    hub.error = e.message
  } finally {
    hub.loading = false
  }
}
