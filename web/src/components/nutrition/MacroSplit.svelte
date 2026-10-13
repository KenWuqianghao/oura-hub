<script lang="ts">
  // The mean split of the period: one bar of 100% for the energy from protein,
  // carbohydrates and fat, then the grams behind it.
  import Num from '../Num.svelte'
  import { kindInfo, kindTitle } from '../../lib/kinds'
  import { macroCss } from '../../lib/nutrition-charts'
  import type { MacroSplit } from '../../lib/nutrition'
  import { t } from '../../lib/i18n.svelte'
  import * as F from '../../lib/fmt'

  let { split, held }: { split: MacroSplit; /** True when the hub holds the kind: a sub-row shows only then. */ held: (kind: string) => boolean } = $props()
  const pct = (share: number | null) => share == null ? null : share * 100
  const summary = $derived(split.rows.map(r => `${kindTitle(r.kind)} ${F.num(pct(r.share))}%`).join(t('common.list_sep')))
</script>

<div class="bar" role="img" aria-label={summary}>
  {#each split.rows as r (r.kind)}
    <i style="width: {pct(r.share) ?? 100 / 3}%; background: {split.kcal == null ? 'var(--fill)' : macroCss(r.kind)}"></i>
  {/each}
</div>
<div class="table-scroll"><table class="t">
  <thead><tr><th></th><th class="r">{t('nutrition.col_grams')}</th><th class="r">{t('nutrition.col_kcal')}</th><th class="r">{t('nutrition.col_share')}</th></tr></thead>
  <tbody>
    {#each split.rows as r (r.kind)}
      <tr>
        <td class="text"><span class="sw" style="background: {macroCss(r.kind)}"></span>{kindTitle(r.kind)}</td>
        <td class="r"><Num value={r.grams} />{r.grams == null ? '' : ' g'}</td>
        <td class="r"><Num value={r.kcal} /></td>
        <td class="r"><b><Num value={pct(r.share)} />%</b></td>
      </tr>
      {#each r.subs.filter(s => held(s.kind)) as s (s.kind)}
        <tr class="sub-row">
          <td class="text">{kindTitle(s.kind)}</td>
          <td class="r"><Num value={s.grams} decimals={kindInfo(s.kind).decimals} />{s.grams == null ? '' : ' g'}</td>
          <td></td><td></td>
        </tr>
      {/each}
    {/each}
  </tbody>
</table></div>

<style>
  .bar { display: flex; gap: 2px; height: 14px; margin: 2px 0 14px; }
  .bar i { display: block; min-width: 2px; transition: width var(--dur-slow) var(--ease), background-color var(--dur) ease; }
  .bar i:first-child { border-radius: 4px 0 0 4px; }
  .bar i:last-child { border-radius: 0 4px 4px 0; }
  .sw { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 8px; vertical-align: -1px; }
  .sub-row td { color: var(--ash); padding-top: 5px; padding-bottom: 5px; font-size: 13px; }
  .sub-row td:first-child { padding-left: 28px; }
</style>
