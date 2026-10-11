// The Data page: what the hub holds.
export const en = {
  sub: 'What the hub holds, and how fresh it is.',
  snapshots: 'Summary snapshots', snapshots_kept: 'Snapshots kept', latest_received: 'Latest received', built_by: 'Built by', nights_in_summary: 'Nights in summary', activity_days: 'Activity days',
  snapshots_note: 'The phone builds the summary after every ring sync and pushes it when its content changed. The hub keeps the last 500.',
  replica: 'Ring replica', serial: 'Serial', raw_events: 'Raw events', readings: 'Readings',
  replica_note: 'Every raw ring event the phone drained, in the same SQLite schema the desktop client uses. A full backup: <span class="code">oura dashboard --db oura.db</span> runs on it.',
  this_hub: 'This hub', address: 'Address', tools: 'Tools', hub_note: 'An agent with the token reads the same data these pages show.', sign_out: 'Sign out of this browser',
  samples_title: 'Apple Health samples', samples_n: '{n} samples', kind: 'Kind', samples: 'Samples', first: 'First', newest: 'Newest',
  samples_note: 'Pushed by the phone from HealthKit with anchored queries; the app’s own export is excluded. The Watch writes heart rate, HRV, sleep, workouts, and the daily counters; other apps’ samples arrive too, with their source name.',
  none_title: 'Nothing pushed yet.', none_text: 'Turn on Apple Health in the app’s Health hub settings.',
} as const
export const zh = {
  sub: 'Hub 中保存的内容，以及数据的新旧程度。',
  snapshots: '摘要快照', snapshots_kept: '保留的快照', latest_received: '最近收到', built_by: '生成方', nights_in_summary: '摘要中的夜晚', activity_days: '活动天数',
  snapshots_note: '每次戒指同步后，手机都会生成摘要，并在内容有变化时推送。Hub 保留最近 500 份。',
  replica: '戒指数据副本', serial: '序列号', raw_events: '原始事件', readings: '读数',
  replica_note: '手机从戒指取回的全部原始事件，采用与桌面客户端相同的 SQLite 结构。这是一份完整备份：可直接运行 <span class="code">oura dashboard --db oura.db</span>。',
  this_hub: '此 Hub', address: '地址', tools: '工具', hub_note: '持有令牌的智能体读取的数据与这些页面显示的相同。', sign_out: '在此浏览器中退出登录',
  samples_title: 'Apple Health 样本', samples_n: '{n} 个样本', kind: '类型', samples: '样本数', first: '最早', newest: '最新',
  samples_note: '由手机通过锚点查询从 HealthKit 推送，不包含本 App 自己写入的数据。手表写入心率、心率变异性、睡眠、体能训练和每日计数；其他 App 的样本也会一并到达，并带有来源名称。',
  none_title: '还没有推送任何数据。', none_text: '请在 App 的“Health hub”设置中打开 Apple Health。',
} satisfies Record<keyof typeof en, string>
