<script lang="ts">
  // Low heart rate notifications and ECG recordings, all of them, newest first.
  // The section is left out when the hub holds neither.
  import Section from '../Section.svelte'
  import { api, type HealthSample } from '../../lib/api'
  import { resource } from '../../lib/health.svelte'
  import { kindTitle } from '../../lib/kinds'
  import { heartEvents } from '../../lib/heart'
  import { t, intlTag } from '../../lib/i18n.svelte'
  import * as F from '../../lib/fmt'

  const all = (kind: string) => api.tool<{ samples: HealthSample[] }>('get_health_samples', { kind, start_unix: 0, end_unix: Math.ceil(Date.now() / 1000) + 86_400, limit: 500 }).then(r => r.samples)
  const res = resource(async () => heartEvents(...await Promise.all([all('low_heart_rate_event'), all('electrocardiogram')])))
  const when = (unix: number) => new Intl.DateTimeFormat(intlTag(), { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(unix * 1000)
</script>

{#if res.data?.length}
  <Section title={t('heart.events')} aside={t('heart.events_aside')}>
    <div class="table-scroll"><table class="t">
      <thead><tr><th>{t('heart.col_when')}</th><th>{t('heart.col_event')}</th><th class="r">{t('common.heart_rate')}</th><th>{t('heart.col_result')}</th><th>{t('heart.col_source')}</th></tr></thead>
      <tbody>
        {#each res.data as e}
          <tr>
            <td>{when(e.at)}</td>
            <td>{e.type === 'low' ? t('heart.event_low') : kindTitle('electrocardiogram')}</td>
            <td class="r">{e.type === 'ecg' && e.bpm != null ? `${F.num(e.bpm)} bpm` : '—'}</td>
            <td>{e.type === 'ecg' ? t(`heart.ecg_${e.result}`) : t('heart.low_for', { time: F.minutesText(e.minutes) })}</td>
            <td class="src">{e.source}</td>
          </tr>
        {/each}
      </tbody>
    </table></div>
  </Section>
{/if}

<style>
  .src { color: var(--ash); }
</style>
