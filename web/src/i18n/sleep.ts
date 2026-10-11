// The Sleep page.
export const en = {
  sub: '{n} nights from the ring. Each night: the hypnogram from the on-device model, then heart rate, HRV, skin temperature, blood oxygen, and movement on the same hours. Hover for the values at any minute.',
  watch_note: 'Apple Watch, last sleep: {asleep} asleep of {in_bed} in bed ({start} – {end}) · deep {deep} · core {core} · REM {rem} · awake {awake} min.',
  no_nights_title: 'No nights yet.', no_nights_text: 'Wear your ring tonight and sync in the morning.', show_more: 'Show more nights',
} as const
export const zh = {
  sub: '戒指记录了 {n} 晚。每晚先是设备端模型给出的睡眠分期图，随后是同一时间轴上的心率、心率变异性、皮肤温度、血氧和活动量。将指针移到图上，可查看任意一分钟的数值。',
  watch_note: 'Apple Watch 最近一次睡眠：卧床 {in_bed}，睡着 {asleep}（{start} – {end}）· 深睡 {deep} · 核心 {core} · 快速眼动 {rem} · 清醒 {awake} 分钟。',
  no_nights_title: '还没有睡眠记录。', no_nights_text: '今晚戴上戒指，早上同步一次。', show_more: '显示更多夜晚',
} satisfies Record<keyof typeof en, string>
