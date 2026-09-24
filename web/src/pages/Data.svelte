<script lang="ts">
  import { Database, CircleDot, Watch as WatchIcon } from 'lucide-svelte'
  import CardHeader from '../components/CardHeader.svelte'
  import StatRow from '../components/StatRow.svelte'
  import { hub, logout } from '../lib/store.svelte'
  import * as F from '../lib/fmt'

  const info = $derived(hub.info)
  const s = $derived(hub.summary)
  const kindName = (k: string) => k.replace(/_/g, ' ')
</script>

<div class="page">
  <div class="large-title">Data</div>
  <div class="subtitle">What the hub holds</div>
  <div class="stack">
    <div class="card">
      <CardHeader title="Summary snapshots" icon={Database} tint="var(--readiness)" />
      <StatRow label="Snapshots kept" value={`${info?.snapshots ?? '—'}`} />
      <StatRow label="Latest received" value={hub.receivedAt ? `${F.dateTime(hub.receivedAt)} (${F.ago(hub.receivedAt)})` : '—'} />
      <StatRow label="Built by" value={s?.pushed_by ? `${s.pushed_by.client} ${s.pushed_by.version}` : '—'} />
      <StatRow label="Nights in summary" value={`${s?.nights.length ?? '—'}`} />
    </div>
    <div class="card">
      <CardHeader title="Ring replica" icon={CircleDot} tint="var(--device)" />
      <StatRow label="Serial" value={info?.ring?.serials.join(', ') || '—'} />
      <StatRow label="Raw events" value={`${(info?.ring?.max_event_id ?? 0).toLocaleString()}`} />
    </div>
    <div class="card">
      <CardHeader title="Apple Health samples" icon={WatchIcon} tint="var(--activity)" />
      {#if info?.health?.length}
        {#each info.health as k}
          <StatRow label={kindName(k.kind)} value={`${k.count.toLocaleString()} · ${F.ago(k.newest_end_unix)}`} />
        {/each}
      {:else}
        <div class="label">Nothing pushed yet. Turn on Apple Health in the app's Health hub settings.</div>
      {/if}
    </div>
    <button class="button secondary" onclick={logout}>Sign out of this browser</button>
  </div>
</div>
