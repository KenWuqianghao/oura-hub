export const en = {
  title: 'Sign in to your hub', sub_before: 'The token is the content of ', sub_after: ' on the hub. Only this browser keeps it.',
  token: 'Hub token', open: 'Open', checking: 'Checking…', bad_token: 'The hub did not accept this token.', unreachable: 'The browser cannot connect to the hub: {message}',
} as const
export const zh = {
  title: '登录你的 Hub', sub_before: '令牌是 Hub 上 ', sub_after: ' 文件的内容，只保存在这个浏览器中。',
  token: 'Hub 令牌', open: '打开', checking: '正在检查…', bad_token: 'Hub 不接受这个令牌。', unreachable: '无法连接 Hub：{message}',
} satisfies Record<keyof typeof en, string>
