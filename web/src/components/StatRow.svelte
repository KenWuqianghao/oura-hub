<script lang="ts">
  let { label, value }: { label: string; value: string } = $props()
</script>

<div class="stat-row"><span class="k">{label}</span><span class="v">{value}</span></div>
