// The Connect page. Texts with markup are trusted: they come from this file only.
export const en = {
  sub: 'Link your iPhone and your AI agent to this hub.',
  address_label: 'Hub address that your phone and your agent use',
  local_error: 'This is the server’s own address. Enter the address your phone uses, for example <span class="code">https://myserver.tailnet.ts.net</span>.',
  http_error: 'The iPhone accepts plain <span class="code">http://</span> only for Tailscale names (<span class="code">*.ts.net</span>). Use an <span class="code">https://</span> address.',
  iphone: 'iPhone', step_1: 'Install Open Oura on the iPhone and pair your ring.', step_2: 'Open the Camera app and point it at this code.',
  step_3: 'Tap <b>Open in Open Oura</b>, then <b>Connect</b>.',
  after: 'The app then sends the ring data after every sync. Turn on <b>Include Apple Health data</b> in Settings → Health hub to add the Apple Watch.',
  agent: 'AI agent (MCP)', hide_token: 'Hide token', show_token: 'Show token', copy: 'Copy', copied: 'Copied',
  mcp_label: 'MCP address (Streamable HTTP, the token is in the path)', cursor_label: 'Cursor and other clients (mcpServers)',
  agent_note: 'Claude Desktop and claude.ai: Settings → Connectors → Add custom connector, then paste the MCP address. A hosted agent needs a public <span class="code">https://</span> address (Tailscale Funnel). Ask it: “Call get_status_now and plan my day.”',
  mac: 'Mac (command line)', push_label: 'Push a summary from a Mac that syncs the ring with the oura CLI',
} as const
export const zh = {
  sub: '把你的 iPhone 和 AI 智能体连接到这个 Hub。',
  address_label: '手机和智能体使用的 Hub 地址',
  local_error: '这是服务器自身的地址。请输入手机所用的地址，例如 <span class="code">https://myserver.tailnet.ts.net</span>。',
  http_error: 'iPhone 只对 Tailscale 域名（<span class="code">*.ts.net</span>）接受明文 <span class="code">http://</span>。请使用 <span class="code">https://</span> 地址。',
  iphone: 'iPhone', step_1: '在 iPhone 上安装 Open Oura 并配对戒指。', step_2: '打开“相机”，对准这个二维码。',
  step_3: '轻点 <b>Open in Open Oura</b>，然后轻点 <b>Connect</b>。',
  after: '此后 App 会在每次同步后发送戒指数据。在“Settings → Health hub”中打开 <b>Include Apple Health data</b>，即可加入 Apple Watch 的数据。',
  agent: 'AI 智能体（MCP）', hide_token: '隐藏令牌', show_token: '显示令牌', copy: '拷贝', copied: '已拷贝',
  mcp_label: 'MCP 地址（Streamable HTTP，令牌在路径中）', cursor_label: 'Cursor 及其他客户端（mcpServers）',
  agent_note: 'Claude Desktop 和 claude.ai：Settings → Connectors → Add custom connector，然后粘贴 MCP 地址。托管的智能体需要公开的 <span class="code">https://</span> 地址（Tailscale Funnel）。可以这样问它：“Call get_status_now and plan my day.”',
  mac: 'Mac（命令行）', push_label: '在使用 oura CLI 同步戒指的 Mac 上推送摘要',
} satisfies Record<keyof typeof en, string>
