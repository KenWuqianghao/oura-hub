// The language of the page: English or Simplified Chinese. `t()` reads the locale
// state, so every template and every derived chart option follows a change.
import { dict, type Key, type Locale } from '../i18n'
export type { Key, Locale }

const STORE = 'oura-hub.locale'
const isLocale = (v: unknown): v is Locale => v === 'en' || v === 'zh'
const save = (l: Locale) => { try { localStorage.setItem(STORE, l) } catch { /* private mode */ } }

function initial(): Locale {
  const url = new URL(location.href)
  const asked = url.searchParams.get('lang')
  if (isLocale(asked)) {
    save(asked)
    url.searchParams.delete('lang')
    history.replaceState(null, '', url.pathname + url.search + url.hash)
    return asked
  }
  let saved: string | null = null
  try { saved = localStorage.getItem(STORE) } catch { /* private mode */ }
  if (isLocale(saved)) return saved
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

export const i18n = $state({ locale: initial() })
const htmlLang = () => { document.documentElement.lang = i18n.locale === 'zh' ? 'zh-Hans' : 'en' }
htmlLang()

export function setLocale(l: Locale) { i18n.locale = l; save(l); htmlLang() }

/** The BCP 47 tag for `Intl`: the browser's own English variant, or zh-CN. */
export const intlTag = (): string => i18n.locale === 'zh' ? 'zh-CN' : navigator.language.toLowerCase().startsWith('en') ? navigator.language : 'en-US'

export const has = (key: string): key is Key => Object.hasOwn(dict.en, key)

/** The text of a key in the current language. `{name}` in the text takes `vars.name`. `{name:day|days}` gives the first word when `vars.name` is 1 and the second word for all other counts. */
export function t(key: Key, vars?: Record<string, string | number>): string {
  const s = dict[i18n.locale][key]
  if (!vars) return s
  return s.replace(/\{(\w+)(?::([^|}]*)\|([^}]*))?\}/g, (_, name: string, one?: string, many?: string) =>
    one === undefined ? String(vars[name] ?? '') : String(vars[name]) === '1' ? one : many ?? '')
}
