<script lang="ts">
  let { parts, size = '', color = 'var(--text)' }: { parts: [string, string][]; size?: '' | 'large' | 'small'; color?: string } = $props()
</script>

<div class="big {size}" style="color: {color}">
  {#each parts as [v, u]}
    <span class="value">{v}</span>{#if u}<span class="unit">{u}</span>{/if}
  {/each}
</div>
