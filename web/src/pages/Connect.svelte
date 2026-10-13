<script lang="ts">
  import { renderSVG } from 'uqr'
  import { Copy, Check, Eye, EyeOff } from 'lucide-svelte'
  import { hub } from '../lib/store.svelte'
  import PageHeader from '../components/PageHeader.svelte'
  import { t } from '../lib/i18n.svelte'

  // The address the phone and the agent use. It is this page's address unless the
  // user opened the hub on the server itself (localhost), where it must be edited.
  let base = $state(location.origin)
  let reveal = $state(false)
  let copied = $state('')

  const clean = $derived(base.trim().replace(/\/+$/, ''))
  const host = $derived.by(() => { try { return new URL(clean).hostname } catch { return '' } })
  const local = $derived(/^(localhost|127\.|0\.0\.0\.0|\[?::1\]?)/.test(host))
  const plainHttp = $derived(clean.startsWith('http://') && !host.endsWith('.ts.net') && !local)
  const valid = $derived(/^https?:\/\/[^/\s]+/.test(clean))

  const link = $derived(`openoura://hub?url=${encodeURIComponent(clean)}&token=${encodeURIComponent(hub.token)}`)
  const qr = $derived(valid ? renderSVG(link, { border: 2, ecc: 'M' }) : '')

  const mcp = $derived(`${clean}/mcp/${hub.token}`)
  const claudeCmd = $derived(`claude mcp add --transport http health ${mcp}`)
  const json = $derived(JSON.stringify({ mcpServers: { health: { url: mcp } } }, null, 2))
  const pushCmd = $derived(`OURA_HUB_TOKEN=${hub.token} oura push --to ${clean}`)

  // The token shows only on request, so the page is safe on a shared screen.
  const masked = (s: string) => reveal ? s : s.split(hub.token).join('•'.repeat(12))

  async function copy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Plain HTTP (a tailnet address) is not a secure context: no clipboard API.
      const t = document.createElement('textarea')
      t.value = text; document.body.appendChild(t); t.select()
      document.execCommand('copy'); t.remove()
    }
    copied = id
    setTimeout(() => { if (copied === id) copied = '' }, 1500)
  }
</script>

{#snippet field(id: string, label: string, text: string)}
  <div class="field">
    <div class="small sub">{label}</div>
    <div class="code-row">
      <pre class="code">{masked(text)}</pre>
      <button class="btn quiet icon" title={t(copied === id ? 'connect.copied' : 'connect.copy')} aria-label={t('connect.copy')} onclick={() => copy(id, text)}>
        {#if copied === id}<Check size={16} />{:else}<Copy size={16} />{/if}
      </button>
    </div>
  </div>
{/snippet}

<div class="wrap">
  <PageHeader title={t('shell.connect')} sub={t('connect.sub')} />

  <div class="section stack" style="gap: 8px">
    <label class="eyebrow" for="hub-address">{t('connect.address_label')}</label>
    <input id="hub-address" class="input code" bind:value={base} spellcheck="false" autocomplete="off" />
    {#if local}<div class="error">{@html t('connect.local_error')}</div>{/if}
    {#if plainHttp}<div class="error">{@html t('connect.http_error')}</div>{/if}
  </div>

  <div class="section cols cols-1-2">
    <div>
      <div class="eyebrow">{t('connect.iphone')}</div>
      {#if qr}<div class="qr">{@html qr}</div>{/if}
      <ol class="steps">
        <li>{t('connect.step_1')}</li>
        <li>{t('connect.step_2')}</li>
        <li>{@html t('connect.step_3')}</li>
      </ol>
      <p class="small sub">{@html t('connect.after')}</p>
    </div>
    <div class="stack">
      <div class="eyebrow">{t('connect.agent')}
        <span class="spacer"></span>
        <button class="btn quiet" onclick={() => reveal = !reveal}>
          {#if reveal}<EyeOff size={14} /> {t('connect.hide_token')}{:else}<Eye size={14} /> {t('connect.show_token')}{/if}
        </button>
      </div>
      {@render field('mcp', t('connect.mcp_label'), mcp)}
      {@render field('claude', 'Claude Code', claudeCmd)}
      {@render field('json', t('connect.cursor_label'), json)}
      <p class="small sub">{@html t('connect.agent_note')}</p>
    </div>
  </div>

  <div class="section">
    <div class="eyebrow">{t('connect.mac')}</div>
    {@render field('push', t('connect.push_label'), pushCmd)}
  </div>
</div>

<style>
  .qr { background: #fff; border-radius: 12px; padding: 12px; width: min(240px, 100%); margin-bottom: 16px; }
  .qr :global(svg) { display: block; width: 100%; height: auto; }
  .steps { margin: 0 0 12px; padding-left: 20px; display: flex; flex-direction: column; gap: 6px; }
  .field { display: flex; flex-direction: column; gap: 6px; }
  .code-row { display: flex; gap: 8px; align-items: flex-start; }
  .code-row pre { flex: 1; margin: 0; padding: 10px 12px; border-radius: 10px; background: var(--surface); font-size: 13px; white-space: pre-wrap; word-break: break-all; min-width: 0; }
</style>
