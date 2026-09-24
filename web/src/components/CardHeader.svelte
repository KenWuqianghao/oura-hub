<script lang="ts">
  // A section label with an icon. Kept for pages that still use it (Connect).
  import { ChevronRight } from 'lucide-svelte'
  let { title, tint = 'var(--ink)', detail = '', chevron = false, icon }: { title: string; tint?: string; detail?: string; chevron?: boolean; icon?: any } = $props()
  const Icon = $derived(icon)
</script>

<div style="display:flex; align-items:center; gap: 8px; font-weight: 600">
  <span style="display:flex; align-items:center; gap: 8px; color: {tint}">{#if Icon}<Icon size={16} strokeWidth={2} />{/if}<span>{title}</span></span>
  {#if detail}<span class="sub small" style="margin-left:auto">{detail}</span>{/if}
  {#if chevron}<ChevronRight size={14} class="muted" />{/if}
</div>
