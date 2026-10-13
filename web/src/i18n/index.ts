// The dictionaries, one module per area, merged into one key space: `<area>.<key>`.
import * as common from './common'
import * as shell from './shell'
import * as login from './login'
import * as today from './today'
import * as sleep from './sleep'
import * as trends from './trends'
import * as ask from './ask'
import * as data from './data'
import * as connect from './connect'
import * as charts from './charts'
import * as kinds from './kinds'
import * as activity from './activity'
import * as heart from './heart'
import * as nutrition from './nutrition'
import * as body from './body'

const areas = { common, shell, login, today, sleep, trends, ask, data, connect, charts, kinds, activity, heart, nutrition, body }
type Areas = typeof areas
export type Locale = 'en' | 'zh'
export type Key = { [A in keyof Areas]: `${A}.${keyof Areas[A]['en'] & string}` }[keyof Areas]

function flat(locale: Locale): Record<Key, string> {
  const out: Record<string, string> = {}
  for (const [area, d] of Object.entries(areas)) for (const [k, v] of Object.entries(d[locale])) out[`${area}.${k}`] = v
  return out
}
export const dict: Record<Locale, Record<Key, string>> = { en: flat('en'), zh: flat('zh') }
