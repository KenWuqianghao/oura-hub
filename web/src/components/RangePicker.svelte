<script lang="ts">
  // The time range of a chart: week, month, six months, year, everything.
  import Seg from './Seg.svelte'
  import { t } from '../lib/i18n.svelte'
  import { RANGES, type RangeId } from '../lib/range'
  let { value = $bindable('M'), ranges = RANGES.map(r => r.id), onchange }: { value?: RangeId; ranges?: readonly RangeId[]; onchange?: (value: RangeId) => void } = $props()
  const options = $derived(ranges.map(id => ({ value: id, label: t(`common.range_${id}`), title: t(`common.range_${id}_title`) })))
</script>

<Seg bind:value {options} label={t('common.range')} {onchange} />
