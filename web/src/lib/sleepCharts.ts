// The two charts of the sleep history: time asleep as bars stacked by stage, and
// bedtime to wake time as one floating bar per mark on a clock axis.
import { base, tokens, axisChrome, axisLabel, bucketAxis, bucketLabel, bucketTip, averageLine, refLine, markLines, tipHead, tipRow, tipNone, type Option } from './charts'
import { SEGMENTS, type Marks, type NightBucket, type ScheduleBucket, type Segment, type StageBucket } from './sleepHistory'
import { t, type Key } from './i18n.svelte'
import * as F from './fmt'

export const SEGMENT_LABEL: Record<Segment, Key> = {
  deep: 'common.deep', core: 'common.core', rem: 'common.rem', unstaged: 'sleep.unstaged', awake: 'common.awake', inBedOnly: 'sleep.in_bed_only',
}
/** The segments that a set of marks draws: the legend lists these only. */
export const segmentsIn = (m: Marks<StageBucket>): Segment[] => SEGMENTS.filter(s => m.points.some(p => (p.minutes?.[s] ?? 0) > 0))

/** "23:40" from hours on the clock axis of a night (hours from the midnight of the wake day). */
export const clock = (hours: number) => F.clockOf(new Date(2024, 0, 2, 0, Math.round(hours * 60)))

/** The head of a tooltip: the day, or the bucket with its number of nights. */
const head = (b: NightBucket, m: Marks<NightBucket>) =>
  tipHead(bucketLabel(b, m.size) + (m.size === 'day' ? '' : ` · ${t('sleep.mean_of_nights', { n: b.n })}`))
const grid = { left: 8, right: 12, top: 14, bottom: 4, containLabel: true }
const alpha = (hex: string, a: number) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})` }

/** How each segment is painted. A stage is a solid step of the sleep ramp; time with no stage is hollow, so it never reads as a stage. */
export function segmentStyle(s: Segment): { color: string; borderColor?: string; borderWidth?: number } {
  const tk = tokens()
  switch (s) {
    case 'deep': return { color: tk.deep }
    case 'core': return { color: tk.core }
    case 'rem': return { color: tk.rem }
    case 'awake': return { color: tk.awake }
    case 'unstaged': return { color: alpha(tk.sleep, 0.26), borderColor: alpha(tk.sleep, 0.6), borderWidth: 1 }
    case 'inBedOnly': return { color: 'transparent', borderColor: tk.ash, borderWidth: 1 }
  }
}

export function stagesOption(m: Marks<StageBucket>, meanAsleep: number | null): Option {
  const HOUR = 60
  const top = Math.max(8 * HOUR, ...m.points.map(p => p.minutes ? SEGMENTS.reduce((a, s) => a + p.minutes![s], 0) : 0))
  return {
    ...base(),
    grid,
    xAxis: bucketAxis(m.points, m.size),
    yAxis: { type: 'value', min: 0, max: Math.ceil(top / (2 * HOUR)) * 2 * HOUR, interval: 2 * HOUR, ...axisChrome(), axisLabel: { ...axisLabel(), formatter: (v: number) => v ? `${v / HOUR} ${t('common.hr')}` : '0' } },
    tooltip: bucketTip(i => {
      const p = m.points[i]
      if (!p) return ''
      if (!p.minutes) return head(p, m) + tipNone()
      const min = p.minutes, asleep = min.deep + min.core + min.rem + min.unstaged
      return head(p, m) + (asleep > 0 ? tipRow(F.minutesText(asleep), t('common.asleep')) : '')
        + [...SEGMENTS].reverse().filter(s => min[s] > 0).map(s => tipRow(F.minutesText(min[s]), t(SEGMENT_LABEL[s]))).join('')
    }),
    series: SEGMENTS.map((s, i) => ({
      id: s, type: 'bar', stack: 'night', barMaxWidth: 22, barCategoryGap: m.points.length > 40 ? '18%' : '30%',
      // a zero would still draw the outline of a hollow segment
      data: m.points.map(p => p.minutes?.[s] || null), itemStyle: segmentStyle(s),
      ...(i === 0 ? { markLine: markLines(averageLine(meanAsleep, t('charts.line_average', { n: F.minutesText(meanAsleep ?? 0) }))) } : {}),
    })),
  }
}

export function scheduleOption(m: Marks<ScheduleBucket>, meanBed: number | null, meanWake: number | null): Option {
  const tk = tokens()
  const beds = m.points.flatMap(p => p.schedule ? [p.schedule.bed] : []), wakes = m.points.flatMap(p => p.schedule ? [p.schedule.wake] : [])
  const even = (v: number, round: (x: number) => number) => round(v / 2) * 2
  const min = beds.length ? even(Math.min(...beds) - 0.5, Math.floor) : -2, max = wakes.length ? even(Math.max(...wakes) + 0.5, Math.ceil) : 10
  return {
    ...base(),
    grid,
    xAxis: bucketAxis(m.points, m.size),
    // evening on top, the next afternoon at the bottom: a night reads downward, as on a calendar
    yAxis: { type: 'value', inverse: true, min, max, interval: 2, ...axisChrome(), axisLabel: { ...axisLabel(), formatter: clock } },
    tooltip: bucketTip(i => {
      const p = m.points[i]
      if (!p) return ''
      if (!p.schedule) return head(p, m) + tipNone()
      return head(p, m) + tipRow(clock(p.schedule.bed), t('sleep.bedtime')) + tipRow(clock(p.schedule.wake), t('sleep.wake_time'))
    }),
    series: [{
      id: 'night', type: 'custom', data: m.points.map((p, i) => [i, p.schedule?.bed ?? NaN, p.schedule?.wake ?? NaN]), encode: { x: 0, y: [1, 2] },
      renderItem: (_: unknown, api: any) => {
        if (Number.isNaN(api.value(1))) return null
        const a = api.coord([api.value(0), api.value(1)]), b = api.coord([api.value(0), api.value(2)])
        const w = Math.max(2, Math.min(14, api.size([1, 0])[0] * 0.62)), r = Math.min(w / 2, 4)
        return { type: 'rect', transition: ['shape'], shape: { x: a[0] - w / 2, y: a[1], width: w, height: Math.max(b[1] - a[1], 2), r }, style: { fill: tk.sleep } }
      },
      markLine: markLines([
        ...(meanBed != null ? [refLine(meanBed, `${t('sleep.bedtime')} ${clock(meanBed)}`, { dashed: true })] : []),
        ...(meanWake != null ? [refLine(meanWake, `${t('sleep.wake_time')} ${clock(meanWake)}`, { dashed: true, position: 'insideEndBottom' })] : []),
      ]),
    }],
  }
}
