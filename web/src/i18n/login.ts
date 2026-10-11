export const en = {
  title: 'Sign in to your hub', sub_before: 'The token is the value of ', sub_after: ' on the hub. It stays in this browser.',
  token: 'Hub token', open: 'Open', checking: 'Checking…', bad_token: 'That token was not accepted.', unreachable: 'Could not reach the hub: {message}',
} as const
export const zh = {
  title: '登录你的 Hub', sub_before: '令牌是 Hub 上 ', sub_after: ' 文件的内容，只保存在这个浏览器中。',
  token: 'Hub 令牌', open: '打开', checking: '正在检查…', bad_token: '令牌无效。', unreachable: '无法连接 Hub：{message}',
} satisfies Record<keyof typeof en, string>
