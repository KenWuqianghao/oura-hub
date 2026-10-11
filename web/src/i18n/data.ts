// The Data page: what the hub holds.
export const en = {
  sub: 'The data that the hub has, and when the latest data arrived.',
  snapshots: 'Summary snapshots', snapshots_kept: 'Snapshots kept', latest_received: 'Latest received', built_by: 'Built by', nights_in_summary: 'Nights in summary', activity_days: 'Activity days',
  snapshots_note: 'The iPhone builds the summary after each ring sync and sends it when its content changed. The hub keeps the last 500.',
  replica: 'Ring replica', serial: 'Serial', raw_events: 'Raw events', readings: 'Readings',
  replica_note: 'Each raw ring event that the iPhone read from the ring, in the same SQLite schema that the desktop client uses. It is a full backup: <span class="code">oura dashboard --db oura.db</span> runs on it.',
  this_hub: 'This hub', address: 'Address', tools: 'Tools', hub_note: 'An agent with the token reads the same data that these pages show.', sign_out: 'Sign out of this browser',
  samples_title: 'Apple Health samples', samples_n: '{n} {n:sample|samples}', kind: 'Kind', group: 'Group', samples: 'Samples', first: 'First', newest: 'Latest',
  samples_note: 'The iPhone sends these samples from HealthKit with anchored queries. It leaves out the samples that the app wrote. The Watch writes heart rate, HRV, sleep, workouts, and the daily counters. Samples from other apps arrive too, with the name of their source.',
  none_title: 'No Apple Health data yet.', none_text: 'Turn on Apple Health in the Health hub settings of the app.',
} as const
export const zh = {
  sub: 'Hub 中有哪些数据，以及最新的数据是什么时候收到的。',
  snapshots: '摘要快照', snapshots_kept: '保留的快照', latest_received: '最新收到', built_by: '生成方', nights_in_summary: '摘要中的夜晚数', activity_days: '活动天数',
  snapshots_note: '每次戒指同步后，iPhone 都会生成摘要，并在内容有变化时发送。Hub 保留最近 500 份。',
  replica: '戒指数据副本', serial: '序列号', raw_events: '原始事件', readings: '读数',
  replica_note: 'iPhone 从戒指读取的全部原始事件，采用与桌面客户端相同的 SQLite 结构。这是一份完整备份，可以直接运行 <span class="code">oura dashboard --db oura.db</span>。',
  this_hub: '此 Hub', address: '地址', tools: '工具', hub_note: '持有令牌的智能体读取的数据与这些页面显示的相同。', sign_out: '在此浏览器中退出登录',
  samples_title: 'Apple Health 样本', samples_n: '{n} 个样本', kind: '类型', group: '分组', samples: '样本数', first: '最早', newest: '最新',
  samples_note: '这些样本由 iPhone 通过锚点查询从 HealthKit 发送，不包含本 App 自己写入的样本。手表写入心率、心率变异性、睡眠、体能训练和每日计数。其他 App 的样本也会一并发送，并带有来源名称。',
  none_title: '还没有 Apple Health 数据。', none_text: '请在 App 的“Health hub”设置中打开 Apple Health。',
} satisfies Record<keyof typeof en, string>
