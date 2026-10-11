// One ring night as label and value rows, for the Today page and the Sleep page.
import type { Night } from './api'
import type { KVRow } from '../components/KV.svelte'
import { t } from './i18n.svelte'
import * as F from './fmt'

const pct = (v: number | null | undefined) => v != null ? `${Math.round(v)} %` : null
const mins = (v: number | null | undefined) => v != null ? `${Math.round(v)} ${t('common.min')}` : null

export function nightRows(n: Night, sleepScore: number | null | undefined = n.sleep_score): KVRow[] {
  const stages = ([['deep', n.deep_pct], ['core', n.light_pct], ['rem', n.rem_pct], ['awake', n.wake_pct]] as const)
    .filter(([, v]) => v != null).map(([k, v]) => t(`common.pct_${k}`, { n: Math.round(v!) })).join(t('common.list_sep'))
  return [
    [t('common.in_bed'), n.in_bed_h != null ? F.hoursText(n.in_bed_h) : null],
    [t('common.asleep'), n.metrics?.asleep_min != null ? F.minutesText(n.metrics.asleep_min) : null],
    [t('common.efficiency'), pct(n.efficiency)],
    [t('common.sleep_score'), sleepScore != null ? Math.round(sleepScore) : null],
    [t('common.stages'), stages || null],
    [t('common.fell_asleep_in'), mins(n.metrics?.sol_min)],
    [t('common.waso'), mins(n.metrics?.waso_min)],
    [t('common.awakenings'), n.metrics?.awakenings],
    [t('common.cycles'), n.metrics?.cycles],
    n.metrics?.rem_latency_min != null && [t('common.first_rem_after'), mins(n.metrics.rem_latency_min)],
    [t('common.hrv'), n.hrv_ms != null ? `${Math.round(n.hrv_ms)} ms` : null],
    [t('common.lowest_heart_rate'), n.rhr != null ? `${Math.round(n.rhr)} bpm` : null],
    [t('common.skin_temp'), n.skin_temp != null ? `${F.num(n.skin_temp, 1)} °C` : null],
    [t('common.blood_oxygen'), pct(n.spo2_mean)],
  ]
}
/** "04:22 – 12:32 · bedtime adjusted" */
export const nightAside = (n: Night) => `${n.start} – ${n.end}${n.bedtime_adjusted ? ` · ${t('common.bedtime_adjusted')}` : ''}`
