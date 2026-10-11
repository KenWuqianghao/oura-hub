<script lang="ts">
  import PageHeader from '../components/PageHeader.svelte'
  import Section from '../components/Section.svelte'
  import KV from '../components/KV.svelte'
  import Empty from '../components/Empty.svelte'
  import { hub, logout } from '../lib/store.svelte'
  import { api } from '../lib/api'
  import { t } from '../lib/i18n.svelte'
  import { kindTitle, kindInfo, groupTitle, kindHref } from '../lib/kinds'
  import * as F from '../lib/fmt'
  const info = $derived(hub.info)
  const s = $derived(hub.summary)
  const kinds = $derived([...(info?.health ?? [])].sort((a, b) => b.count - a.count))
  const total = $derived(kinds.reduce((a, k) => a + k.count, 0))
  // a newest sample from another year needs its year: "Jun 13 05:24" alone reads as this year
  const newest = (unix: number) => `${new Date(unix * 1000).getFullYear() === new Date().getFullYear() ? F.dateTime(unix) : F.fullDateOf(unix * 1000)} · ${F.ago(unix)}`
  let tools = $state<string[]>([])
  $effect(() => { api.toolNames().then(names => { tools = names }, () => { tools = [] }) })
</script>

<div class="wrap">
  <PageHeader title={t('shell.data')} sub={t('data.sub')} />
  <div class="section cols cols-3">
    <div>
      <div class="eyebrow">{t('data.snapshots')}</div>
      <KV rows={[
        [t('data.snapshots_kept'), info?.snapshots != null ? F.num(info.snapshots) : null],
        [t('data.latest_received'), hub.receivedAt ? `${F.dateTime(hub.receivedAt)} · ${F.ago(hub.receivedAt)}` : null],
        [t('data.built_by'), s?.pushed_by ? `${s.pushed_by.client} ${s.pushed_by.version}` : null],
        [t('data.nights_in_summary'), s?.nights.length],
        [t('data.activity_days'), s ? Object.keys(s.activity_daily ?? {}).length : null],
      ]} />
      <p class="small sub">{t('data.snapshots_note')}</p>
    </div>
    <div>
      <div class="eyebrow">{t('data.replica')}</div>
      <KV rows={[
        [t('data.serial'), info?.ring?.serials.join(', ') || null],
        [t('data.raw_events'), F.num(info?.ring?.max_event_id ?? 0)],
        [t('data.readings'), F.num(info?.ring?.max_reading_id ?? 0)],
      ]} />
      <p class="small sub">{@html t('data.replica_note')}</p>
    </div>
    <div>
      <div class="eyebrow">{t('data.this_hub')}</div>
      <KV rows={[[t('data.address'), location.host]]}>
        <dt class="k">MCP</dt><dd class="v code">{location.origin}/mcp/&lt;token&gt;</dd>
        <dt class="k">{t('data.tools')}</dt><dd class="v code">{tools.length ? tools.join(' · ') : '—'}</dd>
      </KV>
      <p class="small sub">{t('data.hub_note')}</p>
      <button class="btn" onclick={logout}>{t('data.sign_out')}</button>
    </div>
  </div>
  <Section title={t('data.samples_title')} aside={total ? t('data.samples_n', { n: F.num(total) }) : ''}>
    {#if kinds.length}
      <div class="table-scroll" style="max-width: 880px"><table class="t">
        <thead><tr><th>{t('data.kind')}</th><th>{t('data.group')}</th><th class="r">{t('data.samples')}</th><th class="r">{t('data.first')}</th><th class="r">{t('data.newest')}</th></tr></thead>
        <tbody>{#each kinds as k (k.kind)}<tr><td class="text"><a href={kindHref(k.kind)} style="color: inherit">{kindTitle(k.kind)}</a></td><td style="color: var(--c-{kindInfo(k.kind).group}-ink)">{groupTitle(kindInfo(k.kind).group)}</td><td class="r">{F.num(k.count)}</td><td class="r">{k.first_start_unix != null ? F.fullDateOf(k.first_start_unix * 1000) : '—'}</td><td class="r">{newest(k.newest_end_unix)}</td></tr>{/each}</tbody>
      </table></div>
      <p class="small sub" style="max-width: 880px">{t('data.samples_note')}</p>
    {:else}
      <Empty title={t('data.none_title')} text={t('data.none_text')} />
    {/if}
  </Section>
</div>
