// The top bar and the states around a page.
export const en = {
  sections: 'Sections', today: 'Today', sleep: 'Sleep', activity: 'Activity', heart: 'Heart', nutrition: 'Nutrition', body: 'Body', trends: 'Trends', ask: 'Ask',
  data: 'Data', data_tip: 'Data: what the hub has', connect: 'Connect', connect_tip: 'Connect your iPhone and your agent',
  language: 'Language', refresh: 'Refresh', refresh_tip: 'Refresh. Updated {ago}', sign_out: 'Sign out', sign_out_tip: 'Sign out of this browser', updated: 'updated {ago}',
  nothing_title: 'Nothing here yet', nothing_before: 'The hub is running, but it has no ring summary yet. Open ', nothing_after: ' and scan the code with your iPhone, or tap Send Now in the Health hub settings of the app.',
} as const
export const zh = {
  sections: '栏目', today: '今天', sleep: '睡眠', activity: '活动', heart: '心脏', nutrition: '营养', body: '身体', trends: '趋势', ask: '提问',
  data: '数据', data_tip: '数据：Hub 中有哪些内容', connect: '连接', connect_tip: '连接你的 iPhone 和智能体',
  language: '语言', refresh: '刷新', refresh_tip: '刷新。更新于 {ago}', sign_out: '退出登录', sign_out_tip: '在此浏览器中退出登录', updated: '更新于 {ago}',
  nothing_title: '这里还没有内容', nothing_before: 'Hub 已在运行，但还没有收到戒指摘要。打开“', nothing_after: '”，用 iPhone 扫描二维码，或在 App 的“Health hub”设置中轻点“Send Now”。',
} satisfies Record<keyof typeof en, string>
