<script lang="ts">
  // Nutrients against the FDA Daily Values: the mean per logged day, the days that
  // have the nutrient, the reference, and the mean as a percent of it. The bar stops
  // at 150%; the number does not.
  import Num from '../Num.svelte'
  import { kindInfo, kindTitle } from '../../lib/kinds'
  import type { NutrientGroup, NutrientRow } from '../../lib/nutrition'
  import { t } from '../../lib/i18n.svelte'
  import * as F from '../../lib/fmt'

  let { groups, rows, unit }: { groups: readonly NutrientGroup[]; rows: NutrientRow[]; unit: (kind: string) => string } = $props()
  const CAP = 1.5
  const width = (ratio: number) => `${Math.max(0, Math.min(ratio, CAP)) / CAP * 100}%`
  const refText = (v: number) => F.num(v, Number.isInteger(v) ? 0 : 1)
</script>

<div class="table-scroll"><table class="t">
  <thead><tr>
    <th>{t('nutrition.col_nutrient')}</th><th class="r">{t('nutrition.col_mean')}</th><th class="r">{t('nutrition.col_days')}</th>
    <th class="r">{t('nutrition.col_dv')}</th><th class="r">{t('nutrition.col_pct')}</th><th class="barhead" aria-hidden="true"><span style="left: {100 / CAP}%">100%</span></th>
  </tr></thead>
  {#each groups as group (group)}
    {@const list = rows.filter(r => r.nutrient.group === group)}
    {#if list.length}
      <tbody>
        <tr class="group"><th colspan="6" scope="rowgroup">{t(`nutrition.group_${group}`)}</th></tr>
        {#each list as { nutrient, mean, days, ratio } (nutrient.kind)}
          {@const u = unit(nutrient.kind)}
          {@const limit = nutrient.ref?.role === 'limit'}
          <tr class:none={!days}>
            <td class="name">{kindTitle(nutrient.kind)}{#if limit && ratio != null && ratio > 1} <span class="pill warn">{t('nutrition.above_limit')}</span>{/if}</td>
            <td class="r"><Num value={mean} decimals={kindInfo(nutrient.kind).decimals} />{#if mean != null}&nbsp;<span class="u">{u}</span>{/if}</td>
            <td class="r">{F.num(days)}</td>
            <td class="r">{#if nutrient.ref}{#if limit}<span class="u lim">{t('nutrition.limit')}</span>{/if}{refText(nutrient.ref.value)} <span class="u">{u}</span>{:else}<span class="u">{t('nutrition.no_dv')}</span>{/if}</td>
            <td class="r">{#if nutrient.ref}<b><Num value={ratio == null ? null : ratio * 100} />{ratio == null ? '' : '%'}</b>{/if}</td>
            <td class="barcell">
              {#if nutrient.ref}
                <div class="track" class:limit>
                  {#if ratio != null}
                    <i class="fill" class:capped={ratio > CAP} style="width: {width(limit ? Math.min(ratio, 1) : ratio)}"></i>
                    {#if limit}<i class="excess" class:capped={ratio > CAP} style="left: {100 / CAP}%; width: {width(Math.max(0, Math.min(ratio, CAP) - 1))}"></i>{/if}
                  {/if}
                  <span class="tick" style="left: {100 / CAP}%"></span>
                </div>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    {/if}
  {/each}
</table></div>

<style>
  .group th { padding-top: 18px; color: var(--ink); font-weight: 600; font-size: 14px; }
  tbody:first-of-type .group th { padding-top: 10px; }
  .u { color: var(--ash); font-size: 13px; }
  .none td { color: var(--mute); }
  .lim { margin-right: 5px; }
  .pill { margin-left: 6px; }
  .barcell { width: 22%; }
  :global(table.t) td.barcell { border-radius: 0; }
  .barhead { position: relative; font-size: 11px; }
  .barhead span { position: absolute; bottom: 8px; transform: translateX(-50%); color: var(--mute); }
  .track { position: relative; min-width: 96px; height: 6px; border-radius: 3px; background: var(--fill); }
  .fill, .excess { position: absolute; top: 0; bottom: 0; display: block; transition: width var(--dur-slow) var(--ease); }
  .fill { left: 0; border-radius: 3px; background: var(--c-nutrition); }
  .limit .fill { background: var(--ash); }
  .excess { background: var(--warn); border-radius: 0 3px 3px 0; }
  /* a bar that stops at the cap fades out: the value goes on, the number beside it says how far */
  .capped { border-radius: 3px 0 0 3px; -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 14px), transparent); mask-image: linear-gradient(90deg, #000 calc(100% - 14px), transparent); }
  .excess.capped { border-radius: 0; }
  .tick { position: absolute; top: -3px; bottom: -3px; width: 1px; background: var(--rule-strong); }
</style>
