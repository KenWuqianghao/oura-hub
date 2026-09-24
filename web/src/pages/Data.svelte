<script lang="ts">
  import { hub, logout } from '../lib/store.svelte'
  import * as F from '../lib/fmt'
  const info = $derived(hub.info)
  const s = $derived(hub.summary)
  const total = $derived((info?.health ?? []).reduce((a, k) => a + k.count, 0))
</script>

<div class="wrap">
  <div class="section"><h1>Data</h1><p class="sub">What the hub holds, and how fresh it is.</p></div>
  <div class="section cols cols-3">
    <div>
      <div class="eyebrow">Summary snapshots</div>
      <div class="kv">
        <div class="k">Snapshots kept</div><div class="v">{info?.snapshots ?? '—'}</div>
        <div class="k">Latest received</div><div class="v">{hub.receivedAt ? `${F.dateTime(hub.receivedAt)} · ${F.ago(hub.receivedAt)}` : '—'}</div>
        <div class="k">Built by</div><div class="v">{s?.pushed_by ? `${s.pushed_by.client} ${s.pushed_by.version}` : '—'}</div>
        <div class="k">Nights in summary</div><div class="v">{s?.nights.length ?? '—'}</div>
        <div class="k">Activity days</div><div class="v">{Object.keys(s?.activity_daily ?? {}).length}</div>
      </div>
      <p class="small sub">The phone builds the summary after every ring sync and pushes it when its content changed. The hub keeps the last 500.</p>
    </div>
    <div>
      <div class="eyebrow">Ring replica</div>
      <div class="kv">
        <div class="k">Serial</div><div class="v">{info?.ring?.serials.join(', ') || '—'}</div>
        <div class="k">Raw events</div><div class="v">{(info?.ring?.max_event_id ?? 0).toLocaleString()}</div>
        <div class="k">Readings</div><div class="v">{(info?.ring?.max_reading_id ?? 0).toLocaleString()}</div>
      </div>
      <p class="small sub">Every raw ring event the phone drained, in the same SQLite schema the desktop client uses. A full backup: <span class="num">oura dashboard --db oura.db</span> runs on it.</p>
    </div>
    <div>
      <div class="eyebrow">This hub</div>
      <div class="kv">
        <div class="k">Address</div><div class="v">{location.host}</div>
        <div class="k">MCP</div><div class="v num small">{location.origin}/mcp/&lt;token&gt;</div>
        <div class="k">Tools</div><div class="v small">get_status_now · get_sleep · get_trends · get_watch · get_health_samples · get_activity</div>
      </div>
      <p class="small sub">An agent with the token reads the same data these pages show.</p>
      <button class="btn" onclick={logout}>Sign out of this browser</button>
    </div>
  </div>
  <div class="section">
    <div class="eyebrow">Apple Health samples <span class="aside">{total ? `${total.toLocaleString()} samples` : ''}</span></div>
    {#if info?.health?.length}
      <table class="t" style="max-width: 720px">
        <thead><tr><th>Kind</th><th class="r">Samples</th><th class="r">Newest</th></tr></thead>
        <tbody>{#each info.health as k}<tr><td class="text">{k.kind.replace(/_/g, ' ')}</td><td class="r">{k.count.toLocaleString()}</td><td class="r">{F.dateTime(k.newest_end_unix)} · {F.ago(k.newest_end_unix)}</td></tr>{/each}</tbody>
      </table>
      <p class="small sub">Pushed by the phone from HealthKit with anchored queries; the app's own export is excluded. The Watch writes heart rate, HRV, sleep, workouts, and the daily counters; other apps' samples arrive too, with their source name.</p>
    {:else}
      <div class="empty"><b>Nothing pushed yet.</b>Turn on Apple Health in the app's Health hub settings.</div>
    {/if}
  </div>
</div>
