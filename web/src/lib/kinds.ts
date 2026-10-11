// The kind catalogue: how each Apple Health kind is grouped, coloured, and drawn.
// Titles and descriptions are in i18n/kinds.ts. The hub sends the unit and the
// aggregation with the data; the loader applies `display` (metres to km) once.
import { t, has } from './i18n.svelte'
import type { KnownKind } from '../i18n/kinds'

export const GROUPS = ['activity', 'heart', 'respiratory', 'sleep', 'nutrition', 'body', 'mobility', 'hearing', 'mindfulness', 'other'] as const
export type Group = typeof GROUPS[number]
export type ChartType = 'bar' | 'line' | 'range'
/** A CSS custom property on :root, light and dark. `--c-<group>` is the mark colour, `--c-<group>-ink` the text colour. */
export type ColorToken = `--c-${Group}` | '--ring' | '--watch'
export interface KindInfo { group: Group; color: ColorToken; decimals: number; chart: ChartType; display?: { unit: string; factor: number } }

const KM = { unit: 'km', factor: 0.001 }, KMH = { unit: 'km/h', factor: 3.6 }, CM = { unit: 'cm', factor: 100 }
const k = (group: Group, chart: ChartType, decimals = 0, display?: KindInfo['display']): KindInfo => ({ group, color: `--c-${group}`, decimals, chart, display })
const food = (decimals = 0) => k('nutrition', 'bar', decimals)

export const KINDS: Record<KnownKind, KindInfo> = {
  active_energy: k('activity', 'bar'), basal_energy: k('activity', 'bar'), step_count: k('activity', 'bar'),
  distance_walking_running: k('activity', 'bar', 1, KM), distance_cycling: k('activity', 'bar', 1, KM), distance_paddle_sports: k('activity', 'bar', 1, KM),
  exercise_time: k('activity', 'bar'), stand_time: k('activity', 'bar'), stand_hour: k('activity', 'bar'), flights_climbed: k('activity', 'bar'),
  time_in_daylight: k('activity', 'bar'), physical_effort: k('activity', 'line', 1), workout: k('activity', 'bar'),
  estimated_workout_effort_score: k('activity', 'line', 1), running_speed: k('activity', 'line', 1, KMH), paddle_sports_speed: k('activity', 'line', 1, KMH),
  heart_rate: k('heart', 'range'), resting_heart_rate: k('heart', 'line'), walking_heart_rate_average: k('heart', 'line'), hrv_sdnn: k('heart', 'line'),
  heart_rate_recovery_one_minute: k('heart', 'line'), vo2_max: k('heart', 'line', 1), low_heart_rate_event: k('heart', 'bar'), electrocardiogram: k('heart', 'line'),
  blood_pressure_systolic: k('heart', 'line'), blood_pressure_diastolic: k('heart', 'line'),
  respiratory_rate: k('respiratory', 'line', 1), oxygen_saturation: k('respiratory', 'range', 1),
  sleep_analysis: k('sleep', 'bar'),
  body_mass: k('body', 'line', 1), body_mass_index: k('body', 'line', 1), body_fat_percentage: k('body', 'line', 1), lean_body_mass: k('body', 'line', 1),
  height: k('body', 'line', 0, CM), wrist_temperature: k('body', 'line', 2), body_temperature: k('body', 'line', 1), blood_glucose: k('body', 'line'),
  walking_speed: k('mobility', 'line', 1, KMH), walking_step_length: k('mobility', 'line', 0, CM), walking_double_support_percentage: k('mobility', 'line', 1),
  walking_asymmetry_percentage: k('mobility', 'line', 1), stair_ascent_speed: k('mobility', 'line', 2), stair_descent_speed: k('mobility', 'line', 2),
  apple_walking_steadiness: k('mobility', 'line'), six_minute_walk_test_distance: k('mobility', 'line'),
  headphone_audio_exposure: k('hearing', 'range'), environmental_audio_exposure: k('hearing', 'range'), environmental_sound_reduction: k('hearing', 'line'),
  audio_exposure_event: k('hearing', 'bar'),
  mindful_session: k('mindfulness', 'bar'), handwashing_event: k('other', 'bar'), constipation: k('other', 'bar'),
  dietary_energy_consumed: food(), dietary_water: food(), dietary_carbohydrates: food(), dietary_protein: food(), dietary_fat_total: food(),
  dietary_fat_saturated: food(1), dietary_fat_monounsaturated: food(1), dietary_fat_polyunsaturated: food(1), dietary_fiber: food(1), dietary_sugar: food(),
  dietary_cholesterol: food(), dietary_sodium: food(), dietary_potassium: food(), dietary_calcium: food(), dietary_iron: food(1), dietary_magnesium: food(),
  dietary_phosphorus: food(), dietary_zinc: food(1), dietary_copper: food(2), dietary_manganese: food(2), dietary_selenium: food(), dietary_iodine: food(),
  dietary_chloride: food(), dietary_chromium: food(), dietary_molybdenum: food(), dietary_vitamin_a: food(), dietary_vitamin_c: food(), dietary_vitamin_d: food(1),
  dietary_vitamin_e: food(1), dietary_vitamin_k: food(), dietary_vitamin_b6: food(2), dietary_vitamin_b12: food(1), dietary_thiamin: food(2), dietary_riboflavin: food(2),
  dietary_niacin: food(1), dietary_pantothenic_acid: food(1), dietary_folate: food(), dietary_biotin: food(), dietary_caffeine: food(),
}

const FALLBACK: KindInfo = k('other', 'line', 1)
const isKnownKind = (kind: string): kind is KnownKind => Object.hasOwn(KINDS, kind)
export const kindInfo = (kind: string): KindInfo => isKnownKind(kind) ? KINDS[kind] : FALLBACK
export const kindsIn = (group: Group): KnownKind[] => (Object.keys(KINDS) as KnownKind[]).filter(kind => KINDS[kind].group === group)

const sentence = (snake: string) => { const s = snake.replace(/_/g, ' ').trim(); return s ? s[0].toUpperCase() + s.slice(1) : snake }
export const kindTitle = (kind: string): string => isKnownKind(kind) ? t(`kinds.${kind}`) : sentence(kind)
export const kindAbout = (kind: string): string => isKnownKind(kind) ? t(`kinds.${kind}_about`) : ''
export const groupTitle = (group: Group): string => t(`kinds.group_${group}`)
/** A workout activity name from the hub ("strength_training", "activity_31") or from the ring summary ("Basketball"). A HealthKit type with no name shows its number, so two such types stay apart. */
export function activityTitle(activity: string): string {
  const id = activity.trim().toLowerCase().replace(/\s+/g, '_'), key = `kinds.act_${id}`
  if (has(key)) return t(key)
  const n = /^activity_(\d+)$/.exec(id)?.[1]
  return n ? t('kinds.act_unknown', { n }) : sentence(activity)
}

/** Kinds that have a section of their own on a page: a link to the kind goes there, not to a chart on Trends. */
export const KIND_SECTION: Record<string, string> = { sleep_analysis: '#/sleep/history', workout: '#/activity/workouts' }
/** Where the link to a kind goes. */
export const kindHref = (kind: string) => KIND_SECTION[kind] ?? `#/trends/${kind}`

const UNIT_WORDS = ['steps', 'flights', 'events', 'effort'] as const
/** A unit of the hub for reading: word units are translated, symbols stay as they are. */
export function unitLabel(unit: string): string {
  return (UNIT_WORDS as readonly string[]).includes(unit) ? t(`common.unit_${unit as typeof UNIT_WORDS[number]}`) : unit
}
