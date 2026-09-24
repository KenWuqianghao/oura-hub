<script lang="ts">
  import { Database, CircleDot, Watch as WatchIcon, Server } from 'lucide-svelte'
  import CardHeader from '../components/CardHeader.svelte'
  import StatRow from '../components/StatRow.svelte'
  import { hub } from '../lib/store.svelte'
  import * as F from '../lib/fmt'

  const info = $derived(hub.info)
  const s = $derived(hub.summary)
  const kindName = (k: string) => k.replace(/_/g, ' ')
  const total = $derived((info?.health ?? []).reduce((a, k) => a + k.count, 0))
</script>

<div class="page">
  <div class="large-title">Data</div>
  <div class="subtitle">What the hub holds, and how fresh it is</div>
  <div class="grid">
    <div class="card span4">
      <CardHeader title="Summary snapshots" icon={Database} tint="var(--readiness)" />
      <StatRow label="Snapshots kept" value={`${info?.snapshots ?? '—'}`} />
      <StatRow label="Latest received" value={hub.receivedAt ? `${F.dateTime(hub.receivedAt)} (${F.ago(hub.receivedAt)})` : '—'} />
      <StatRow label="Built by" value={s?.pushed_by ? `${s.pushed_by.client} ${s.pushed_by.version}` : '—'} />
      <StatRow label="Nights in summary" value={`${s?.nights.length ?? '—'}`} />
      <StatRow label="Activity days" value={`${Object.keys(s?.activity_daily ?? {}).length}`} />
      <div class="caption">The phone builds the summary after every ring sync and pushes it when its content changed. The hub keeps the last 500.</div>
    </div>
    <div class="card span4">
      <CardHeader title="Ring replica" icon={CircleDot} tint="var(--device)" />
      <StatRow label="Serial" value={info?.ring?.serials.join(', ') || '—'} />
      <StatRow label="Raw events" value={`${(info?.ring?.max_event_id ?? 0).toLocaleString()}`} />
      <StatRow label="Readings" value={`${(info?.ring?.max_reading_id ?? 0).toLocaleString()}`} />
      <div class="caption">Every raw ring event the phone drained, in the same SQLite schema the desktop client uses. A full backup: <code>oura dashboard --db oura.db</code> runs on it.</div>
    </div>
    <div class="card span4">
      <CardHeader title="This hub" icon={Server} tint="var(--accent)" />
      <StatRow label="Address" value={location.host} />
      <StatRow label="MCP endpoint" value={`${location.origin}/mcp/<token>`} />
      <StatRow label="Tools" value="get_status_now · get_sleep · get_trends · get_watch · get_health_samples · get_activity" />
      <div class="caption">An agent with the token reads the same data these pages show.</div>
    </div>
    <div class="card span12">
      <CardHeader title="Apple Health samples" icon={WatchIcon} tint="var(--activity)" detail={total ? `${total.toLocaleString()} samples` : ''} />
      {#if info?.health?.length}
        <table class="plain">
          <thead><tr><th>Kind</th><th>Samples</th><th>Newest</th></tr></thead>
          <tbody>
            {#each info.health as k}
              <tr><td>{kindName(k.kind)}</td><td>{k.count.toLocaleString()}</td><td>{F.dateTime(k.newest_end_unix)} · {F.ago(k.newest_end_unix)}</td></tr>
            {/each}
          </tbody>
        </table>
        <div class="caption">Pushed by the phone from HealthKit with anchored queries; the app's own export is excluded. The Watch writes heart rate, HRV, sleep, workouts, and the daily counters; other apps' samples arrive too, with their source name.</div>
      {:else}
        <div class="label">Nothing pushed yet. Turn on Apple Health in the app's Health hub settings.</div>
      {/if}
    </div>
  </div>
</div>
