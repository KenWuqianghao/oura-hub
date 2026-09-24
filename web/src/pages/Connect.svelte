<script lang="ts">
  import { renderSVG } from 'uqr'
  import { Copy, Check, Eye, EyeOff } from 'lucide-svelte'
  import { hub } from '../lib/store.svelte'

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
      <pre class="num">{masked(text)}</pre>
      <button class="btn quiet" title="Copy" onclick={() => copy(id, text)}>
        {#if copied === id}<Check size={16} />{:else}<Copy size={16} />{/if}
      </button>
    </div>
  </div>
{/snippet}

<div class="wrap">
  <div class="section"><h1>Connect</h1><p class="sub">Link your iPhone and your AI agent to this hub.</p></div>

  <div class="section stack" style="gap: 8px">
    <div class="eyebrow">Hub address that your phone and your agent use</div>
    <input class="input" bind:value={base} spellcheck="false" autocomplete="off" />
    {#if local}<div class="error">This is the server's own address. Enter the address your phone uses, for example <span class="num">https://myserver.tailnet.ts.net</span>.</div>{/if}
    {#if plainHttp}<div class="error">The iPhone accepts plain <span class="num">http://</span> only for Tailscale names (<span class="num">*.ts.net</span>). Use an <span class="num">https://</span> address.</div>{/if}
  </div>

  <div class="section cols cols-1-2">
    <div>
      <div class="eyebrow">iPhone</div>
      {#if qr}<div class="qr">{@html qr}</div>{/if}
      <ol class="steps">
        <li>Install Open Oura on the iPhone and pair your ring.</li>
        <li>Open the Camera app and point it at this code.</li>
        <li>Tap <b>Open in Open Oura</b>, then <b>Connect</b>.</li>
      </ol>
      <p class="small sub">The app then sends the ring data after every sync. Turn on <b>Include Apple Health data</b> in Settings → Health hub to add the Apple Watch.</p>
    </div>
    <div class="stack">
      <div class="eyebrow">AI agent (MCP)
        <span class="spacer"></span>
        <button class="btn quiet" onclick={() => reveal = !reveal}>
          {#if reveal}<EyeOff size={14} /> Hide token{:else}<Eye size={14} /> Show token{/if}
        </button>
      </div>
      {@render field('mcp', 'MCP address (Streamable HTTP, the token is in the path)', mcp)}
      {@render field('claude', 'Claude Code', claudeCmd)}
      {@render field('json', 'Cursor, Grok Bot, and other clients (mcpServers)', json)}
      <p class="small sub">Claude Desktop and claude.ai: Settings → Connectors → Add custom connector, then paste the MCP address. A hosted agent needs a public <span class="num">https://</span> address (Tailscale Funnel). Ask it: “Call get_status_now and plan my day.”</p>
    </div>
  </div>

  <div class="section">
    <div class="eyebrow">Mac (command line)</div>
    {@render field('push', 'Push a summary from a Mac that syncs the ring with the oura CLI', pushCmd)}
  </div>
</div>

<style>
  .qr { background: #fff; border-radius: 10px; padding: 12px; width: min(240px, 100%); margin-bottom: 16px; }
  .qr :global(svg) { display: block; width: 100%; height: auto; }
  .steps { margin: 0 0 12px; padding-left: 20px; display: flex; flex-direction: column; gap: 6px; }
  .field { display: flex; flex-direction: column; gap: 6px; }
  .code-row { display: flex; gap: 8px; align-items: flex-start; }
  .code-row pre { flex: 1; margin: 0; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--rule); background: var(--surface); font-size: 13px; white-space: pre-wrap; word-break: break-all; min-width: 0; }
</style>
