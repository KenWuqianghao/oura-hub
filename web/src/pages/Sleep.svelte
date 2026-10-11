<script lang="ts">
  import NightChart from '../components/NightChart.svelte'
  import PageHeader from '../components/PageHeader.svelte'
  import Section from '../components/Section.svelte'
  import KV from '../components/KV.svelte'
  import Empty from '../components/Empty.svelte'
  import SleepHistory from '../components/sleep/SleepHistory.svelte'
  import { hub } from '../lib/store.svelte'
  import { t } from '../lib/i18n.svelte'
  import { nightRows, nightAside } from '../lib/night'
  import * as F from '../lib/fmt'
  import type { Summary, Night } from '../lib/api'

  const s = $derived(hub.summary as Summary)
  const w = $derived(hub.watch)
  let shown = $state(8)
  const nights = $derived([...s.nights].filter(n => n.ymd).sort((a, b) => (a.ymd! < b.ymd! ? 1 : -1)))
  // `#/sleep/history` opens the page at the Apple Health history
  $effect(() => {
    const go = () => { if (location.hash === '#/sleep/history') setTimeout(() => document.getElementById('sleep-history')?.scrollIntoView({ behavior: 'smooth' }), 80) }
    go()
    addEventListener('hashchange', go)
    return () => removeEventListener('hashchange', go)
  })
  const score = (n: Night) => n.sleep_score ?? s.scores?.days?.[F.wakeYmd(n) ?? '']?.sleep?.score ?? null
</script>

<div class="wrap">
  <PageHeader title={t('shell.sleep')} sub={t('sleep.sub', { n: nights.length })}>
    {#if w?.last_sleep}
      {@const ls = w.last_sleep}
      <div class="note" style="margin-top: 14px">{t('sleep.watch_note', { asleep: F.minutesText(ls.asleep_min), in_bed: F.minutesText(ls.in_bed_min), start: F.timeHM(ls.start_unix), end: F.timeHM(ls.end_unix), deep: Math.round(ls.deep_min), core: Math.round(ls.core_min), rem: Math.round(ls.rem_min), awake: Math.round(ls.awake_min) })}</div>
    {/if}
    <p class="small" style="margin: 12px 0 0"><a href="#/sleep/history">{t('sleep.jump')}</a></p>
  </PageHeader>
  {#if !nights.length}
    <div class="section"><Empty title={t('sleep.no_nights_title')} text={t('sleep.no_nights_text')} /></div>
  {/if}
  {#each nights.slice(0, shown) as n (`${n.ymd} ${n.start}`)}
    <Section title={F.dayTitle(F.wakeYmd(n) ?? n.ymd ?? '')} aside={nightAside(n)}>
      <div class="cols cols-1-3">
        <KV rows={nightRows(n, score(n))} />
        <div class="panel"><div class="panel-body"><NightChart night={n} height={440} /></div></div>
      </div>
    </Section>
  {/each}
  {#if nights.length > shown}
    <div class="section"><button class="btn" onclick={() => (shown += 8)}>{t('sleep.show_more')}</button></div>
  {/if}
  <SleepHistory />
</div>
