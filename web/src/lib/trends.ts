// The Trends page, pure: what an id in the address stands for, the list on the
// left, the range a kind opens on, and the comparison with the period before.
import type { DayPoint, HealthKind } from './api'
import { GROUPS, KINDS, kindInfo, kindTitle, groupTitle, unitLabel, type Group, type ColorToken } from './kinds'
import type { RangeId } from './range'
import { RING, ringMetric, type RingMetric } from './trendsRing'
import { t } from './i18n.svelte'
import * as F from './fmt'

/** Kinds that have a section of their own on another page: the list links there in place of a chart here. */
const ELSEWHERE: Record<string, { href: string; label: 'trends.go_sleep' | 'trends.go_workouts' }> = {
  sleep_analysis: { href: '#/sleep/history', label: 'trends.go_sleep' },
  workout: { href: '#/activity/workouts', label: 'trends.go_workouts' },
}
/** Where the link to a kind goes: its Trends page, or the section that shows it better. */
export const kindHref = (kind: string) => ELSEWHERE[kind]?.href ?? `#/trends/${kind}`

export type Selection =
  | { type: 'ring'; metric: RingMetric }
  | { type: 'health'; kind: string; meta: HealthKind }
  | { type: 'elsewhere'; kind: string; href: string; label: 'trends.go_sleep' | 'trends.go_workouts' }
  /** The id is not a ring metric and the list of kinds is still on its way. */
  | { type: 'pending' }
  | { type: 'unknown'; id: string }

export function select(id: string, kinds: HealthKind[] | null): Selection {
  const metric = ringMetric(id)
  if (metric) return { type: 'ring', metric }
  if (ELSEWHERE[id]) return { type: 'elsewhere', kind: id, ...ELSEWHERE[id] }
  if (!kinds) return { type: 'pending' }
  const meta = kinds.find(k => k.kind === id)
  return meta ? { type: 'health', kind: id, meta } : { type: 'unknown', id }
}

export interface ListItem { id: string; title: string; unit: string; href: string; elsewhere: boolean }
export interface ListGroup { id: 'ring' | Group; title: string; color: ColorToken; items: ListItem[] }

/** The list on the left: the ring metrics, then every kind with rows by group, in the order of the catalogue. `query` keeps the items whose title or id holds it. */
export function listGroups(kinds: HealthKind[], query: string): ListGroup[] {
  const q = query.trim().toLowerCase()
  const keep = (i: ListItem) => !q || i.title.toLowerCase().includes(q) || i.id.toLowerCase().includes(q)
  const order = new Map(Object.keys(KINDS).map((kind, i) => [kind, i]))
  const rank = (kind: string) => order.get(kind) ?? order.size
  const groups: ListGroup[] = [{
    id: 'ring', title: t('trends.group_ring'), color: '--ring',
    items: RING.map(m => ({ id: m.id, title: t(`trends.m_${m.id}`), unit: unitLabel(m.unit), href: `#/trends/${m.id}`, elsewhere: false })),
  }]
  for (const group of GROUPS) {
    groups.push({
      id: group, title: groupTitle(group), color: `--c-${group}`,
      items: kinds.filter(k => k.samples > 0 && kindInfo(k.kind).group === group)
        .sort((a, b) => rank(a.kind) - rank(b.kind) || (a.kind < b.kind ? -1 : 1))
        .map(k => ({ id: k.kind, title: kindTitle(k.kind), unit: unitLabel(kindInfo(k.kind).display?.unit ?? k.unit), href: kindHref(k.kind), elsewhere: k.kind in ELSEWHERE })),
    })
  }
  return groups.map(g => ({ ...g, items: g.items.filter(keep) })).filter(g => g.items.length)
}

export interface Comparison { now: number; before: number; direction: 'up' | 'down' | 'same' }
/** The mean of the days with data in a period against the period before, or null when one of the two has no data. `same` means the two read the same at `decimals`. */
export function compare(now: DayPoint[], before: DayPoint[], decimals: number): Comparison | null {
  if (!now.length || !before.length) return null
  const mean = (d: DayPoint[]) => d.reduce((a, p) => a + p.value, 0) / d.length
  const a = mean(now), b = mean(before), unit = 10 ** decimals
  const diff = Math.round(a * unit) - Math.round(b * unit)
  return { now: a, before: b, direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'same' }
}

/** The comparison in plain words. `adds` is true for a kind that adds up over a day: its mean is a daily average. */
export function comparisonText(c: Comparison, range: Exclude<RangeId, 'All'>, adds: boolean, decimals: number, unit: string): string {
  const value = (v: number) => [F.num(v, decimals), unit].filter(Boolean).join(' ')
  return t(`trends.cmp_${c.direction}`, {
    what: t(adds ? 'trends.cmp_daily_average' : 'trends.cmp_average'),
    period: t(`common.period_${range}`), before: t(`common.before_${range}`), now: value(c.now), prev: value(c.before),
  })
}
