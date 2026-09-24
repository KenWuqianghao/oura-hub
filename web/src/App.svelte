<script lang="ts">
  import { onMount } from 'svelte'
  import { RefreshCw, LogOut } from 'lucide-svelte'
  import Login from './pages/Login.svelte'
  import Summary from './pages/Summary.svelte'
  import Sleep from './pages/Sleep.svelte'
  import Trends from './pages/Trends.svelte'
  import Data from './pages/Data.svelte'
  import Ask from './pages/Ask.svelte'
  import Connect from './pages/Connect.svelte'
  import { hub, check, load, logout, adoptHashToken } from './lib/store.svelte'
  import { ago } from './lib/fmt'

  // hash routes: #/, #/sleep, #/trends/<metric>, #/ask, #/data, #/connect
  adoptHashToken()
  let route = $state(location.hash.replace(/^#\/?/, ''))
  const go = (r: string) => { location.hash = '#/' + r }
  onMount(() => {
    const onHash = () => { route = location.hash.replace(/^#\/?/, ''); window.scrollTo(0, 0) }
    addEventListener('hashchange', onHash)
    check()
    const onVis = () => { if (document.visibilityState === 'visible' && hub.authed) load() }
    document.addEventListener('visibilitychange', onVis)
    const timer = setInterval(() => { if (hub.authed && document.visibilityState === 'visible') load() }, 10 * 60 * 1000)
    return () => { removeEventListener('hashchange', onHash); document.removeEventListener('visibilitychange', onVis); clearInterval(timer) }
  })
  const tab = $derived(route.split('/')[0] || 'summary')
  const tabs = [
    { id: 'summary', title: 'Today' },
    { id: 'sleep', title: 'Sleep' },
    { id: 'trends', title: 'Trends' },
    { id: 'ask', title: 'Ask' },
    { id: 'data', title: 'Data' },
    { id: 'connect', title: 'Connect' },
  ]
</script>

{#if hub.checking}
  <div class="wrap"><div class="muted">Opening…</div></div>
{:else if !hub.authed}
  <Login />
{:else}
  <header class="topbar">
    <div class="topbar-inner">
      <div class="brand"><span class="mark" aria-hidden="true"></span>Open Oura</div>
      <nav class="nav" aria-label="Sections">
        {#each tabs as t}<button class:active={tab === t.id} onclick={() => go(t.id === 'summary' ? '' : t.id)}>{t.title}</button>{/each}
      </nav>
      <div class="right">
        <span>{hub.receivedAt ? `updated ${ago(hub.receivedAt)}` : ''}</span>
        <button class="btn quiet" title="Refresh" aria-label="Refresh" onclick={load}><RefreshCw size={15} style={hub.loading ? 'animation: spin 1s linear infinite' : ''} /></button>
        <button class="btn quiet" title="Sign out of this browser" aria-label="Sign out" onclick={logout}><LogOut size={15} /></button>
      </div>
    </div>
  </header>
  {#if tab === 'connect'}<Connect />
  {:else if hub.error && !hub.summary}
    <div class="wrap"><div class="error">{hub.error}</div></div>
  {:else if !hub.summary && hub.loading}
    <div class="wrap"><div class="skeleton" style="height: 24px; width: 40%"></div><div class="skeleton" style="height: 392px; margin-top: 24px"></div></div>
  {:else if !hub.summary}
    <div class="wrap"><h1>Nothing here yet</h1><p class="sub">The hub is up, but no summary has been pushed. Open <a href="#/connect">Connect</a> and scan the code with your iPhone, or tap Send Now in the app's Health hub settings.</p></div>
  {:else if tab === 'sleep'}<Sleep />
  {:else if tab === 'trends'}<Trends metric={route.split('/')[1] || 'hrv_ms'} />
  {:else if tab === 'ask'}<Ask />
  {:else if tab === 'data'}<Data />
  {:else}<Summary {go} />{/if}
{/if}

<style>
  @keyframes spin { to { transform: rotate(360deg) } }
</style>
