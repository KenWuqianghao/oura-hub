<script lang="ts">
  // The sentence that opens the Activity page: the average steps of the range
  // against the period of the same length before it.
  import { api } from '../../lib/api'
  import { daily, resource } from '../../lib/health.svelte'
  import { windowBefore, windowOf, type RangeId } from '../../lib/range'
  import { compare } from '../../lib/activity'
  import { t } from '../../lib/i18n.svelte'
  import * as F from '../../lib/fmt'

  let { range }: { range: RangeId } = $props()
  const now = daily(() => 'step_count', () => range)
  const before = resource(async () => {
    const r = range, win = windowBefore(r, windowOf(r, []).start)
    const days = win ? (await api.healthDaily({ kinds: ['step_count'], start_ymd: win.start, end_ymd: win.end })).kinds[0]?.days ?? [] : []
    return { range: r, days }
  })
  // the sentence changes only when the two halves of one range are there
  const pair = $derived(now.data && before.data && now.data.range === before.data.range ? { range: now.data.range, now: now.data.days, before: before.data.days } : null)
  let shown = $state<NonNullable<typeof pair>>()
  $effect(() => { if (pair) shown = pair })

  const text = $derived.by(() => {
    if (!shown) return ''
    const win = windowOf(shown.range, shown.now)
    const days = shown.now.filter(d => d.ymd >= win.start && d.ymd <= win.end)
    const c = compare(days, shown.before)
    if (c.mean == null) return t('activity.lead_none', { period: t(`common.period_${shown.range}`) })
    const vars = { n: F.num(c.mean), period: t(`common.period_${shown.range}`), before: t(`common.before_${shown.range}`), diff: F.num(Math.abs(c.diff ?? 0)) }
    return c.diff == null ? t('activity.lead_only', vars) : !c.diff ? t('activity.lead_same', vars) : t(c.diff > 0 ? 'activity.lead_more' : 'activity.lead_less', vars)
  })
  const basis = $derived.by(() => {
    if (!shown) return ''
    const win = windowOf(shown.range, shown.now)
    const n = shown.now.filter(d => d.ymd >= win.start && d.ymd <= win.end).length
    if (!n) return ''
    return shown.range === 'All' ? t('activity.basis_all', { n: F.num(n), since: F.fullDateOf(F.parseYmd(win.start) ?? new Date()) })
      : shown.before.length ? t('activity.basis_both', { n: F.num(n), m: F.num(shown.before.length) }) : t('activity.basis_now', { n: F.num(n) })
  })
</script>

<p class="lede">{text || ' '}</p>
<p class="sub small basis">{basis || ' '}</p>

<style>
  .lede { max-width: 40ch; min-height: 2.7em; }
  .basis { margin: 8px 0 0; }
</style>
