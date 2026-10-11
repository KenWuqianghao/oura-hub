<script lang="ts">
  // The sentence that opens the Heart page: the newest resting heart rate and the
  // newest HRV, each against its own mean over the range.
  import { dailyAll } from '../../lib/health.svelte'
  import { windowOf, type RangeId } from '../../lib/range'
  import { against } from '../../lib/heart'
  import { t } from '../../lib/i18n.svelte'
  import * as F from '../../lib/fmt'

  let { range }: { range: RangeId } = $props()
  const res = dailyAll(() => ['resting_heart_rate', 'hrv_sdnn'], () => range)
  const text = $derived.by(() => {
    if (!res.data) return ''
    const period = t(`common.period_${res.data[0].range}`)
    return (['rhr', 'hrv'] as const).map((id, i) => {
      const s = res.data![i], win = windowOf(s.range, s.days)
      const a = against(s.days.filter(d => d.ymd >= win.start && d.ymd <= win.end))
      if (!a) return t(`heart.lead_${id}_none`, { period })
      const vars = { v: F.num(a.latest.value), mean: F.num(a.mean), d: F.num(Math.abs(a.diff)), period, day: F.monthDay(a.latest.ymd) }
      return t(`heart.lead_${id}_${a.diff > 0 ? 'above' : a.diff < 0 ? 'below' : 'same'}`, vars)
    }).join(t('heart.lead_join'))
  })
</script>

<p class="lede">{text || ' '}</p>

<style>
  .lede { max-width: 56ch; min-height: 2.7em; }
</style>
