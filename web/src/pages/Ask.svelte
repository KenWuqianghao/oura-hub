<script lang="ts">
  // The built-in agent: a chat over the hub's own data, run by one of the user's
  // agent CLIs on the hub. The reply streams as server-sent events.
  import { onMount } from 'svelte'
  import { Sparkles, Send, Wrench, RotateCcw } from 'lucide-svelte'
  import CardHeader from '../components/CardHeader.svelte'
  import { getToken } from '../lib/api'

  type Msg = { role: 'user' | 'assistant'; text: string; tools: { name: string; input: any; result?: string }[]; error?: string; thinking?: string }
  type ProviderInfo = { id: string; title: string; available: boolean; path: string | null; login_hint: string }

  let providers = $state<ProviderInfo[]>([])
  let provider = $state(localStorage.getItem('oura-hub.agent') ?? 'claude')
  let sessions = $state<Record<string, string>>(JSON.parse(localStorage.getItem('oura-hub.agent-sessions') ?? '{}'))
  let messages = $state<Msg[]>([])
  let input = $state('')
  let busy = $state(false)
  let error = $state('')
  let box: HTMLDivElement | undefined = $state()

  const quick = [
    'Plan my day: training, caffeine cutoff, bedtime, one thing to watch.',
    'How did I sleep last night, and how does it compare with my baseline?',
    'Compare this week with last week: sleep, HRV, resting heart rate, steps.',
    'What does my Apple Watch say today, and does it agree with the ring?',
    'Is there any sign I am getting sick?',
  ]
  const current = $derived(providers.find(p => p.id === provider))

  onMount(async () => {
    try {
      const r = await fetch('/api/agent/providers', { headers: { authorization: `Bearer ${getToken()}` } })
      const d = await r.json()
      providers = d.providers ?? []
      if (!providers.find(p => p.id === provider && p.available)) {
        const first = providers.find(p => p.available)
        if (first) provider = first.id
      }
    } catch (e: any) { error = e.message }
  })
  $effect(() => { localStorage.setItem('oura-hub.agent', provider) })

  function reset() { delete sessions[provider]; sessions = { ...sessions }; localStorage.setItem('oura-hub.agent-sessions', JSON.stringify(sessions)); messages = [] }

  async function ask(text: string) {
    const prompt = text.trim()
    if (!prompt || busy) return
    input = ''
    error = ''
    messages = [...messages, { role: 'user', text: prompt, tools: [] }, { role: 'assistant', text: '', tools: [] }]
    busy = true
    const idx = messages.length - 1
    try {
      const res = await fetch('/api/agent/ask', {
        method: 'POST',
        headers: { authorization: `Bearer ${getToken()}`, 'content-type': 'application/json' },
        body: JSON.stringify({ provider, prompt, session: sessions[provider] ?? null }),
      })
      if (!res.ok || !res.body) { const t = await res.text(); throw new Error(t || res.statusText) }
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      let final: string | null = null
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        let i
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, i); buf = buf.slice(i + 2)
          const line = chunk.split('\n').find(l => l.startsWith('data:'))
          if (!line) continue
          let ev: any
          try { ev = JSON.parse(line.slice(5)) } catch { continue }
          const m = messages[idx]
          if (ev.kind === 'session') { sessions = { ...sessions, [provider]: ev.id }; localStorage.setItem('oura-hub.agent-sessions', JSON.stringify(sessions)) }
          else if (ev.kind === 'text') m.text = m.text ? m.text + '\n\n' + ev.text : ev.text
          else if (ev.kind === 'thinking') m.thinking = ev.text
          else if (ev.kind === 'tool') m.tools.push({ name: ev.name, input: ev.input })
          else if (ev.kind === 'tool_result') { const last = [...m.tools].reverse().find(t => !t.result); if (last) last.result = ev.text }
          else if (ev.kind === 'done') { if (ev.session) { sessions = { ...sessions, [provider]: ev.session }; localStorage.setItem('oura-hub.agent-sessions', JSON.stringify(sessions)) } if (ev.text) final = ev.text; if (ev.is_error) m.error = ev.text ?? 'The agent reported an error.' }
          else if (ev.kind === 'error') m.error = ev.message
          messages = [...messages]
          box?.scrollTo({ top: box.scrollHeight })
        }
      }
      if (final && !messages[idx].text) messages[idx].text = final
      messages = [...messages]
    } catch (e: any) {
      messages[idx].error = e.message
      messages = [...messages]
    }
    busy = false
  }
  const toolName = (n: string) => n.replace(/^mcp__health__|^health__/, '')
</script>

<div class="page">
  <div class="large-title">Ask</div>
  <div class="subtitle">An agent on the hub, running your own {current?.title ?? 'agent'} subscription, with the health tools attached. It reads the same data these pages show.</div>
  <div class="grid">
    <div class="span3 stack">
      <div class="card">
        <CardHeader title="Agent" icon={Sparkles} tint="var(--accent)" />
        <div class="metric-list">
          {#each providers as p}
            <button class:active={provider === p.id} disabled={!p.available} onclick={() => (provider = p.id)} title={p.available ? p.path ?? '' : `Not installed on the hub. ${p.login_hint}.`}>
              <span>{p.title}</span><span class="caption">{p.available ? (sessions[p.id] ? 'in conversation' : 'ready') : 'not installed'}</span>
            </button>
          {/each}
        </div>
        {#if current && !current.available}<div class="caption">Install {current.title} on the hub and sign in: {current.login_hint}.</div>{/if}
        <button class="button secondary" onclick={reset} disabled={busy}><RotateCcw size={14} style="vertical-align:-2px" /> New conversation</button>
      </div>
      <div class="card">
        <CardHeader title="Try" icon={Send} tint="var(--secondary)" />
        <div class="metric-list">
          {#each quick as q}<button onclick={() => ask(q)} disabled={busy || !current?.available}><span style="white-space: normal">{q}</span></button>{/each}
        </div>
      </div>
    </div>
    <div class="span9 card" style="min-height: 70vh; display:flex; flex-direction: column">
      <div bind:this={box} style="flex: 1; overflow: auto; display:flex; flex-direction: column; gap: 14px; padding-right: 4px">
        {#if !messages.length}
          <div class="muted" style="margin: auto; text-align: center; max-width: 480px">
            Ask about your sleep, your recovery, or what to do today. The agent calls the hub's tools and answers in your language. Answers are not medical advice.
          </div>
        {/if}
        {#each messages as m}
          {#if m.role === 'user'}
            <div style="align-self: flex-end; max-width: 75%; background: var(--accent); color: #fff; padding: 10px 14px; border-radius: 18px 18px 4px 18px; font-size: 16px; white-space: pre-wrap">{m.text}</div>
          {:else}
            <div style="align-self: flex-start; max-width: 85%; display:flex; flex-direction: column; gap: 8px">
              {#if m.tools.length}
                <div style="display:flex; flex-wrap: wrap; gap: 6px">
                  {#each m.tools as t}
                    <span class="pill" style="background: var(--fill); color: var(--secondary)" title={JSON.stringify(t.input)}><Wrench size={12} /> {toolName(t.name)}{t.result ? '' : ' …'}</span>
                  {/each}
                </div>
              {/if}
              {#if m.thinking && !m.text}<div class="caption">{m.thinking}</div>{/if}
              {#if m.text}
                <div style="background: var(--fill); padding: 12px 16px; border-radius: 18px 18px 18px 4px; font-size: 16px; line-height: 1.5; white-space: pre-wrap">{m.text}</div>
              {:else if !m.error}
                <div class="caption">{busy ? 'Thinking…' : ''}</div>
              {/if}
              {#if m.error}<div class="error">{m.error}</div>{/if}
            </div>
          {/if}
        {/each}
      </div>
      <form style="display:flex; gap: 10px; margin-top: 14px" onsubmit={e => { e.preventDefault(); ask(input) }}>
        <input class="input" placeholder={current?.available ? `Ask ${current.title}…` : 'No agent is installed on the hub'} bind:value={input} disabled={busy || !current?.available} />
        <button class="button" style="width: auto; padding: 0 18px" disabled={busy || !input.trim() || !current?.available}><Send size={18} /></button>
      </form>
      {#if error}<div class="error" style="margin-top: 10px">{error}</div>{/if}
    </div>
  </div>
</div>
