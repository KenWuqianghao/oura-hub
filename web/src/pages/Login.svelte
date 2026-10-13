<script lang="ts">
  import Seg from '../components/Seg.svelte'
  import { hub, login } from '../lib/store.svelte'
  import { t, i18n, setLocale, type Locale } from '../lib/i18n.svelte'
  let token = $state('')
  let busy = $state(false)
  async function go(e: Event) { e.preventDefault(); busy = true; await login(token); busy = false }
</script>

<div class="wrap" style="max-width: 440px; padding-top: 14vh">
  <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 28px">
    <div class="brand"><span class="mark" aria-hidden="true"></span>Open Oura</div>
    <Seg value={i18n.locale} options={[{ value: 'en', label: 'EN' }, { value: 'zh', label: '中文' }]} label={t('shell.language')} onchange={(l: Locale) => setLocale(l)} />
  </div>
  <h1 class="large-title">{t('login.title')}</h1>
  <p class="sub">{t('login.sub_before')}<span class="code">~/.hub-token</span>{t('login.sub_after')}</p>
  <form onsubmit={go} style="display:flex; flex-direction:column; gap: 10px; margin-top: 20px">
    <label class="small sub" for="token">{t('login.token')}</label>
    <input id="token" class="input" type="password" bind:value={token} autocomplete="current-password" />
    <button class="btn primary" style="justify-content:center; padding: 10px" disabled={busy || !token}>{busy ? t('login.checking') : t('login.open')}</button>
    {#if hub.error}<div class="error" role="alert">{hub.error}</div>{/if}
  </form>
</div>
