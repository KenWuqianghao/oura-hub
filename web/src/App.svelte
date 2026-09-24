<script lang="ts">
  import { onMount } from 'svelte'
  import { Heart, BedDouble, TrendingUp, Database, RefreshCw, LogOut, Sparkles } from 'lucide-svelte'
  import Login from './pages/Login.svelte'
  import Summary from './pages/Summary.svelte'
  import Sleep from './pages/Sleep.svelte'
  import Trends from './pages/Trends.svelte'
  import Data from './pages/Data.svelte'
  import Ask from './pages/Ask.svelte'
  import { hub, check, load, logout } from './lib/store.svelte'
  import { ago } from './lib/fmt'

  // hash routes: #/, #/sleep, #/trends/<metric>, #/data
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
    { id: 'summary', title: 'Summary', icon: Heart },
    { id: 'sleep', title: 'Sleep', icon: BedDouble },
    { id: 'trends', title: 'Trends', icon: TrendingUp },
    { id: 'ask', title: 'Ask', icon: Sparkles },
    { id: 'data', title: 'Data', icon: Database },
  ]
</script>

{#if hub.checking}
  <div class="content"><div class="muted">Opening…</div></div>
{:else if !hub.authed}
  <Login />
{:else}
  <div class="shell">
    <aside class="sidebar">
      <div class="brand">Open Oura</div>
      {#each tabs as t}
        {@const Icon = t.icon}
        <button class="nav" class:active={tab === t.id} onclick={() => go(t.id === 'summary' ? '' : t.id)}><Icon size={18} />{t.title}</button>
      {/each}
      <div class="foot">
        <div class="caption">{hub.receivedAt ? `Summary from ${ago(hub.receivedAt)}` : 'No summary yet'}</div>
        <div style="display:flex; gap: 8px">
          <button class="icon-btn" title="Refresh" onclick={load}><RefreshCw size={16} style={hub.loading ? 'animation: spin 1s linear infinite' : ''} /></button>
          <button class="icon-btn" title="Sign out of this browser" onclick={logout}><LogOut size={16} /></button>
        </div>
      </div>
    </aside>
    <main class="content">
      {#if hub.error && !hub.summary}
        <div class="error">{hub.error}</div>
      {:else if !hub.summary && hub.loading}
        <div class="muted">Loading your data…</div>
      {:else if !hub.summary}
        <div class="large-title">Open Oura</div>
        <div class="body">The hub is up, but no summary has been pushed yet. Open the app on your phone, go to Settings → Health hub, and tap Send Now.</div>
      {:else if tab === 'sleep'}<Sleep />
      {:else if tab === 'trends'}<Trends metric={route.split('/')[1] || 'hrv_ms'} />
      {:else if tab === 'ask'}<Ask />
      {:else if tab === 'data'}<Data />
      {:else}<Summary {go} />{/if}
    </main>
  </div>
{/if}

<style>
  @keyframes spin { to { transform: rotate(360deg) } }
</style>
