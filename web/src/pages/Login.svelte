<script lang="ts">
  import { hub, login } from '../lib/store.svelte'
  let token = $state('')
  let busy = $state(false)
  async function go(e: Event) { e.preventDefault(); busy = true; await login(token); busy = false }
</script>

<div class="content" style="max-width: 460px; margin: 10vh auto 0">
  <div class="large-title">Open Oura</div>
  <div class="subtitle">Your ring and your watch, on your own server.</div>
  <form class="stack" onsubmit={go}>
    <input class="input" type="password" placeholder="Hub token" bind:value={token} autocomplete="current-password" />
    <button class="button" disabled={busy || !token}>{busy ? 'Checking…' : 'Open'}</button>
    {#if hub.error}<div class="error">{hub.error}</div>{/if}
    <div class="caption">The token is the value of <code>~/.hub-token</code> on the hub. It stays in this browser.</div>
  </form>
</div>
