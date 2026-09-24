<script lang="ts">
  import { ChevronRight } from 'lucide-svelte'
  let { title, tint = 'var(--text)', detail = '', chevron = false, icon }: { title: string; tint?: string; detail?: string; chevron?: boolean; icon?: any } = $props()
  const Icon = $derived(icon)
</script>

<div class="card-header">
  <div class="title" style="color: {tint}">
    {#if Icon}<Icon size={18} strokeWidth={2.2} />{/if}
    <span>{title}</span>
  </div>
  {#if detail}<span class="detail">{detail}</span>{/if}
  {#if chevron}<ChevronRight class="chevron" size={16} />{/if}
</div>
