<script lang="ts">
  import { onMount } from 'svelte'
  import { RefreshCw, LogOut, Database, Cable } from 'lucide-svelte'
  import Login from './pages/Login.svelte'
  import Summary from './pages/Summary.svelte'
  import Sleep from './pages/Sleep.svelte'
  import Activity from './pages/Activity.svelte'
  import Heart from './pages/Heart.svelte'
  import Nutrition from './pages/Nutrition.svelte'
  import Body from './pages/Body.svelte'
  import Trends from './pages/Trends.svelte'
  import Data from './pages/Data.svelte'
  import Ask from './pages/Ask.svelte'
  import Connect from './pages/Connect.svelte'
  import Kit from './pages/Kit.svelte'
  import Seg from './components/Seg.svelte'
  import Skeleton from './components/Skeleton.svelte'
  import ErrorNote from './components/ErrorNote.svelte'
  import { hub, check, load, logout, adoptHashToken } from './lib/store.svelte'
  import { t, i18n, setLocale, type Key, type Locale } from './lib/i18n.svelte'
  import { thumb, transition } from './lib/motion'
  import { ago } from './lib/fmt'

  // Hash routes: #/<tab>[/<param>]. `summary` marks a page that shows the ring
  // summary; every other page renders without one.
  const TABS = {
    today: { title: 'shell.today', nav: true, summary: true },
    sleep: { title: 'shell.sleep', nav: true, summary: true },
    activity: { title: 'shell.activity', nav: true, summary: false },
    heart: { title: 'shell.heart', nav: true, summary: false },
    nutrition: { title: 'shell.nutrition', nav: true, summary: false },
    body: { title: 'shell.body', nav: true, summary: false },
    trends: { title: 'shell.trends', nav: true, summary: false },
    ask: { title: 'shell.ask', nav: true, summary: false },
    data: { title: 'shell.data', nav: false, summary: false },
    connect: { title: 'shell.connect', nav: false, summary: false },
    kit: { title: 'shell.connect', nav: false, summary: false },
  } as const satisfies Record<string, { title: Key; nav: boolean; summary: boolean }>
  type Tab = keyof typeof TABS
  const isTab = (s: string): s is Tab => Object.hasOwn(TABS, s)
  const NAV = (Object.keys(TABS) as Tab[]).filter(id => TABS[id].nav)
  const href = (id: Tab) => id === 'today' ? '#/' : `#/${id}`

  adoptHashToken()
  const read = () => location.hash.replace(/^#\/?/, '')
  let route = $state(read())
  const first = $derived(route.split('/')[0])
  const tab: Tab = $derived(isTab(first) ? first : 'today')
  const param = $derived(route.split('/')[1] ?? '')

  onMount(() => {
    const onHash = () => {
      const next = read(), same = next.split('/')[0] === first
      if (same) route = next
      else transition(() => { route = next; window.scrollTo(0, 0) })
    }
    addEventListener('hashchange', onHash)
    check()
    const onVis = () => { if (document.visibilityState === 'visible' && hub.authed) load() }
    document.addEventListener('visibilitychange', onVis)
    const timer = setInterval(() => { if (hub.authed && document.visibilityState === 'visible') load() }, 10 * 60 * 1000)
    return () => { removeEventListener('hashchange', onHash); document.removeEventListener('visibilitychange', onVis); clearInterval(timer) }
  })
  const updated = $derived(hub.receivedAt ? ago(hub.receivedAt) : '')
</script>

{#if hub.checking}
  <div class="wrap" aria-busy="true" aria-label={t('common.opening')}><Skeleton height={34} width="280px" /><div style="height: 28px"></div><Skeleton height={392} /></div>
{:else if !hub.authed}
  <Login />
{:else}
  <header class="topbar">
    <div class="topbar-inner">
      <a class="brand" href="#/"><span class="mark" aria-hidden="true"></span>Open Oura</a>
      <nav class="nav" aria-label={t('shell.sections')} use:thumb={[tab, i18n.locale]}>
        <span class="nav-pill" aria-hidden="true"></span>
        {#each NAV as id}<a href={href(id)} aria-current={tab === id ? 'page' : undefined}>{t(TABS[id].title)}</a>{/each}
      </nav>
      <div class="right">
        {#if updated}<span class="updated">{t('shell.updated', { ago: updated })}</span>{/if}
        <a class="btn quiet icon" href="#/data" aria-current={tab === 'data' ? 'page' : undefined} title={t('shell.data_tip')} aria-label={t('shell.data')}><Database size={16} /></a>
        <a class="btn quiet icon" href="#/connect" aria-current={tab === 'connect' ? 'page' : undefined} title={t('shell.connect_tip')} aria-label={t('shell.connect')}><Cable size={16} /></a>
        <span class="lang"><Seg value={i18n.locale} options={[{ value: 'en', label: 'EN' }, { value: 'zh', label: '中文' }]} label={t('shell.language')} onchange={(l: Locale) => setLocale(l)} /></span>
        <button class="btn quiet icon" title={updated ? t('shell.refresh_tip', { ago: updated }) : t('shell.refresh')} aria-label={t('shell.refresh')} onclick={load}><RefreshCw size={16} class={hub.loading ? 'spinning' : ''} /></button>
        <button class="btn quiet icon" title={t('shell.sign_out_tip')} aria-label={t('shell.sign_out')} onclick={logout}><LogOut size={16} /></button>
      </div>
    </div>
  </header>
  <main>
    {#if TABS[tab].summary && !hub.summary}
      <div class="wrap">
        {#if hub.error}
          <ErrorNote message={hub.error} retry={load} />
        {:else if hub.loading}
          <div class="section"><Skeleton height={34} width="320px" /><div style="height: 14px"></div><Skeleton height={20} lines={2} width="46%" /></div>
          <div class="section flush"><Skeleton height={440} /></div>
        {:else}
          <div class="section"><h1 class="large-title">{t('shell.nothing_title')}</h1><p class="sub" style="max-width: 60ch">{t('shell.nothing_before')}<a href="#/connect">{t('shell.connect')}</a>{t('shell.nothing_after')}</p></div>
        {/if}
      </div>
    {:else if tab === 'today'}<Summary />
    {:else if tab === 'sleep'}<Sleep />
    {:else if tab === 'activity'}<Activity />
    {:else if tab === 'heart'}<Heart />
    {:else if tab === 'nutrition'}<Nutrition />
    {:else if tab === 'body'}<Body />
    {:else if tab === 'trends'}<Trends metric={param || 'hrv_ms'} />
    {:else if tab === 'ask'}<Ask />
    {:else if tab === 'data'}<Data />
    {:else if tab === 'kit'}<Kit />
    {:else}<Connect />{/if}
  </main>
{/if}

<style>
  .lang { margin: 0 6px; display: inline-flex; }
  .btn.icon[aria-current="page"] { background: var(--fill); color: var(--ink); }
  .right :global(.spinning) { animation: spin 0.9s linear infinite; }
</style>
