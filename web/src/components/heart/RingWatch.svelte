<script lang="ts">
  // The ring's lowest heart rate of each night against the Watch's resting heart
  // rate of the same day, on one axis. The window starts at the ring's first night.
  import ChartFrame from '../ChartFrame.svelte'
  import { api, type Trends } from '../../lib/api'
  import { loadDaily, resource, noDataText } from '../../lib/health.svelte'
  import { windowOf, type RangeId } from '../../lib/range'
  import { lowestPerDay, paired } from '../../lib/heart'
  import { ringWatchOption } from '../../lib/heart-charts'
  import { t } from '../../lib/i18n.svelte'
  import * as F from '../../lib/fmt'

  let { range, height = 240 }: { range: RangeId; height?: number } = $props()
  // `days` of get_trends counts sleep periods, not calendar days: ask for all of them and cut by date
  const ringAll = api.tool<Trends>('get_trends', { metric: 'rhr', days: 4000 })
  const res = resource(async () => {
    const r = range
    const [ring, watch] = await Promise.all([ringAll, loadDaily('resting_heart_rate', r)])
    return { range: r, ring: lowestPerDay(ring.points), watch: watch.days }
  })
  const view = $derived.by(() => {
    if (!res.data) return null
    const { ring, watch } = res.data, asked = windowOf(res.data.range, ring.length ? [{ ymd: ring[0].ymd, value: 0, n: 0 }] : [])
    const start = ring.length && ring[0].ymd > asked.start ? ring[0].ymd : asked.start
    const inRing = ring.filter(p => p.ymd >= start), inWatch = watch.filter(p => p.ymd >= start)
    return { start, end: asked.end, clipped: start > asked.start, ring: inRing, watch: inWatch, both: paired(inRing, inWatch) }
  })
  const option = $derived(view ? ringWatchOption(view.ring, view.watch, view.start, view.end) : null)
  const sentence = $derived.by(() => {
    const b = view?.both
    if (!view) return ''
    if (!b) return t('heart.pair_none')
    const d = Math.round(b.ring) - Math.round(b.watch), vars = { days: F.num(b.days), ring: F.num(b.ring), watch: F.num(b.watch), d: F.num(Math.abs(d)) }
    return t(d < 0 ? 'heart.pair_below' : d > 0 ? 'heart.pair_above' : 'heart.pair_same', vars)
  })
</script>

<p class="say">{sentence || ' '}</p>
<ChartFrame when={view ? `${F.dateRange(view.start, view.end)}${view.clipped ? ` · ${t('heart.from_first_night')}` : ''}` : ' '} {height} option={option ?? undefined} ready={!!option} loading={res.loading} error={res.error}
  empty={view && !view.ring.length && !view.watch.length ? noDataText(undefined) : ''} note={t('heart.pair_note')}>
  {#snippet legend()}<span><span class="ln" style="background: var(--ring)"></span>{t('heart.ring_low')}</span><span><span class="ln" style="background: var(--watch)"></span>{t('heart.watch_rest')}</span>{/snippet}
</ChartFrame>
