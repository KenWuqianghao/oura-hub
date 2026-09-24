<script lang="ts">
  let { title, text, icon }: { title: string; text: string; icon?: any } = $props()
  const Icon = $derived(icon)
</script>

<div class="empty">
  <div class="icon">{#if Icon}<Icon size={26} />{/if}</div>
  <div><div class="t">{title}</div><div class="s">{text}</div></div>
</div>
