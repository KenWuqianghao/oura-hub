<script lang="ts">
  // The list of everything the hub holds: the ring metrics, then every Apple Health
  // kind with rows, by group. A filter on top; the list scrolls in its own column.
  // At phone width it folds under a button that names the current choice.
  import { ChevronDown, ArrowUpRight } from 'lucide-svelte'
  import Skeleton from '../Skeleton.svelte'
  import ErrorNote from '../ErrorNote.svelte'
  import type { HealthKind } from '../../lib/api'
  import { listGroups } from '../../lib/trends'
  import { t } from '../../lib/i18n.svelte'

  let { kinds, error = '', selected, current }: { kinds: HealthKind[] | null; error?: string; selected: string; current: string } = $props()
  let query = $state('')
  let open = $state(false)
  let scroller = $state<HTMLElement>()
  const groups = $derived(listGroups(kinds ?? [], query))

  $effect(() => { void selected; open = false })
  // a deep link can point far down the list: bring the choice into view, inside the column only
  $effect(() => {
    void selected; void kinds
    const el = scroller, a = el?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!el || !a) return
    const top = a.offsetTop - el.offsetTop
    if (top < el.scrollTop || top + a.offsetHeight > el.scrollTop + el.clientHeight) el.scrollTop = top - el.clientHeight / 3
  })
</script>

<aside class="trend-list" class:open>
  <button class="toggle btn" aria-expanded={open} onclick={() => (open = !open)}><span>{current || t('trends.choose')}</span><ChevronDown size={16} /></button>
  <div class="body">
    <input class="input" type="search" placeholder={t('trends.filter')} aria-label={t('trends.filter')} bind:value={query} />
    <nav class="scroll" aria-label={t('trends.list')} bind:this={scroller}>
      {#each groups as g (g.id)}
        <div class="group" style="color: var({g.color}-ink)">{g.title}</div>
        {#each g.items as i (i.id)}
          <a href={i.href} aria-current={i.id === selected ? 'page' : undefined}>
            <span class="title">{i.title}</span>
            {#if i.elsewhere}<ArrowUpRight size={13} />{:else}<span class="u">{i.unit}</span>{/if}
          </a>
        {/each}
      {/each}
      {#if error}<div class="pad"><ErrorNote message={error} /></div>
      {:else if !kinds}<div class="pad"><Skeleton lines={6} height={18} gap={14} /></div>
      {:else if !groups.length}<div class="none">{t('trends.no_match', { query: query.trim() })}</div>{/if}
    </nav>
  </div>
</aside>

<style>
  .trend-list { position: sticky; top: 76px; min-width: 0; }
  .toggle { display: none; }
  .body { display: flex; flex-direction: column; max-height: calc(100vh - 100px); }
  .input { padding: 7px 10px; border-radius: 9px; font-size: 14px; flex: none; }
  .scroll { overflow-y: auto; overscroll-behavior: contain; margin: 6px -10px 0; padding: 0 10px 12px; scrollbar-width: thin; scrollbar-color: var(--fill-strong) transparent; position: relative; }
  .group { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; padding: 14px 0 6px; }
  :global(:lang(zh)) .group { font-size: 13px; letter-spacing: 0; text-transform: none; }
  a { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; padding: 6px 10px; margin: 0 -10px; border-radius: 8px; color: var(--ink); transition: background-color var(--dur-fast) ease, transform var(--dur-fast) var(--ease); }
  a:hover { background: var(--fill); text-decoration: none; }
  a:active { transform: scale(0.985); }
  a[aria-current="page"] { background: var(--fill); font-weight: 600; }
  .title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .u { color: var(--mute); font-size: 12px; font-weight: 400; white-space: nowrap; }
  a :global(svg) { color: var(--mute); flex: none; align-self: center; }
  .pad { padding: 14px 0; }
  .none { padding: 16px 0; color: var(--ash); font-size: 14px; }
  @media (max-width: 860px) {
    .trend-list { position: static; }
    .toggle { display: flex; width: 100%; justify-content: space-between; padding: 10px 14px; font-weight: 600; }
    .toggle :global(svg) { transition: transform var(--dur) var(--ease); }
    .open .toggle :global(svg) { transform: rotate(180deg); }
    .body { display: none; max-height: none; margin-top: 10px; }
    .open .body { display: flex; }
    .scroll { max-height: 56vh; }
  }
</style>
