<script lang="ts">
  // One line for the kinds of a section that have no data in the range: it names
  // the dates each kind does have, and says which kinds the hub does not hold at all.
  // The line keeps its height when it is empty, so a range change does not move the page.
  import { healthKinds, coverage } from '../lib/health.svelte'
  import { kindTitle } from '../lib/kinds'
  import { windowOf, type RangeId } from '../lib/range'
  import { t } from '../lib/i18n.svelte'
  import * as F from '../lib/fmt'

  let { kinds, range, chartsShowAll = false }: { kinds: string[]; range: RangeId; /** The page draws such a kind over all its dates: the line says so. */ chartsShowAll?: boolean } = $props()
  const held = healthKinds()
  const text = $derived.by(() => {
    if (!held.data) return ''
    const start = range === 'All' ? '' : windowOf(range, []).start
    const stale: string[] = [], none: string[] = []
    for (const kind of kinds) {
      const c = coverage(held.data, kind)
      if (!c) none.push(kindTitle(kind))
      else if (c.newest < start) stale.push(t('common.kind_span', { kind: kindTitle(kind), span: F.dateRange(c.first, c.newest) }))
    }
    const sep = t('common.list_sep')
    return [stale.length ? t(chartsShowAll ? 'common.out_of_period_all' : 'common.out_of_period', { list: stale.join(sep) }) : '', none.length ? t('common.not_held', { list: none.join(sep) }) : ''].filter(Boolean).join(' ')
  })
</script>

<p class="sub small" style="margin: 12px 0 0; min-height: 19px">{text}</p>
