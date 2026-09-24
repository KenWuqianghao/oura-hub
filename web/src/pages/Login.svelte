<script lang="ts">
  import { hub, login } from '../lib/store.svelte'
  let token = $state('')
  let busy = $state(false)
  async function go(e: Event) { e.preventDefault(); busy = true; await login(token); busy = false }
</script>

<div class="wrap" style="max-width: 440px; padding-top: 14vh">
  <div class="brand" style="margin-bottom: 20px"><span class="mark" aria-hidden="true"></span>Open Oura</div>
  <h1>Sign in to your hub</h1>
  <p class="sub">The token is the value of <span class="num">~/.hub-token</span> on the hub. It stays in this browser.</p>
  <form onsubmit={go} style="display:flex; flex-direction:column; gap: 10px; margin-top: 16px">
    <label class="small sub" for="token">Hub token</label>
    <input id="token" class="input" type="password" bind:value={token} autocomplete="current-password" />
    <button class="btn primary" style="justify-content:center; padding: 10px" disabled={busy || !token}>{busy ? 'Checking…' : 'Open'}</button>
    {#if hub.error}<div class="error">{hub.error}</div>{/if}
  </form>
</div>
