<script lang="ts">
  import { onMount } from 'svelte'
  import { Heart, BedDouble, TrendingUp, Database, RefreshCw } from 'lucide-svelte'
  import Login from './pages/Login.svelte'
  import Summary from './pages/Summary.svelte'
  import Sleep from './pages/Sleep.svelte'
  import Trends from './pages/Trends.svelte'
  import Data from './pages/Data.svelte'
  import { hub, check, load } from './lib/store.svelte'

  // hash routes: #/, #/sleep, #/trends/<metric>, #/data
  let route = $state(location.hash.replace(/^#\/?/, ''))
  const go = (r: string) => { location.hash = '#/' + r }
  onMount(() => {
    const onHash = () => { route = location.hash.replace(/^#\/?/, ''); window.scrollTo(0, 0) }
    addEventListener('hashchange', onHash)
    check()
    // refresh when the tab comes back, so an open page stays current
    const onVis = () => { if (document.visibilityState === 'visible' && hub.authed) load() }
    document.addEventListener('visibilitychange', onVis)
    return () => { removeEventListener('hashchange', onHash); document.removeEventListener('visibilitychange', onVis) }
  })
  const tab = $derived(route.split('/')[0] || 'summary')
  const tabs = [
    { id: 'summary', title: 'Summary', icon: Heart },
    { id: 'sleep', title: 'Sleep', icon: BedDouble },
    { id: 'trends', title: 'Trends', icon: TrendingUp },
    { id: 'data', title: 'Data', icon: Database },
  ]
</script>

{#if hub.checking}
  <div class="page" style="padding-top:64px" ><div class="muted">Opening…</div></div>
{:else if !hub.authed}
  <Login />
{:else if hub.error && !hub.summary}
  <div class="page" style="padding-top:64px"><div class="error">{hub.error}</div><button class="button secondary" style="margin-top:12px" onclick={load}>Try again</button></div>
{:else if !hub.summary}
  <div class="page" style="padding-top:64px">
    <div class="large-title">Open Oura</div>
    <div class="body">The hub is up, but no summary has been pushed yet. Open the app on your phone, go to Settings → Health hub, and tap Send Now.</div>
  </div>
{:else}
  {#if tab === 'sleep'}<Sleep />
  {:else if tab === 'trends'}<Trends metric={route.split('/')[1] || 'hrv_ms'} />
  {:else if tab === 'data'}<Data />
  {:else}<Summary {go} />{/if}
  <button title="Refresh" onclick={load} style="position:fixed; top: 12px; right: 12px; border:0; background: var(--card); color: var(--secondary); border-radius: 999px; width: 36px; height: 36px; display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow: 0 1px 4px rgba(0,0,0,.12)">
    <RefreshCw size={16} style={hub.loading ? 'animation: spin 1s linear infinite' : ''} />
  </button>
  <nav class="tabbar">
    {#each tabs as t}
      {@const Icon = t.icon}
      <button class:active={tab === t.id} onclick={() => go(t.id === 'summary' ? '' : t.id)}><Icon size={24} />{t.title}</button>
    {/each}
  </nav>
{/if}

<style>
  @keyframes spin { to { transform: rotate(360deg) } }
</style>
