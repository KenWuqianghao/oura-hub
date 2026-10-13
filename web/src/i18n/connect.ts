// The Connect page. Texts with markup are trusted: they come from this file only.
export const en = {
  sub: 'Connect your iPhone and your AI agent to this hub.',
  address_label: 'Hub address that your iPhone and your agent use',
  local_error: 'This is the address of the server itself. Enter the address that your iPhone uses, for example <span class="code">https://myserver.tailnet.ts.net</span>.',
  http_error: 'The iPhone accepts plain <span class="code">http://</span> only for Tailscale names (<span class="code">*.ts.net</span>). Use an <span class="code">https://</span> address.',
  iphone: 'iPhone', step_1: 'Install Open Oura on the iPhone and pair your ring.', step_2: 'Open the Camera app and point it at this code.',
  step_3: 'Tap <b>Open in Open Oura</b>, then <b>Connect</b>.',
  after: 'The app then sends the ring data after each sync. To add the Apple Watch data, turn on <b>Include Apple Health data</b> in Settings → Health hub.',
  agent: 'AI agent (MCP)', hide_token: 'Hide token', show_token: 'Show token', copy: 'Copy', copied: 'Copied',
  mcp_label: 'MCP address (Streamable HTTP, the token is in the path)', cursor_label: 'Cursor and other clients (mcpServers)',
  agent_note: 'Claude Desktop and claude.ai: Settings → Connectors → Add custom connector, then paste the MCP address. A hosted agent must have a public <span class="code">https://</span> address (Tailscale Funnel). Ask it: “Call get_status_now and plan my day.”',
  mac: 'Mac (command line)', push_label: 'Send a summary from a Mac that syncs the ring with the oura CLI',
} as const
export const zh = {
  sub: '把你的 iPhone 和 AI 智能体连接到这个 Hub。',
  address_label: 'iPhone 和智能体使用的 Hub 地址',
  local_error: '这是服务器自身的地址。请输入 iPhone 所用的地址，例如 <span class="code">https://myserver.tailnet.ts.net</span>。',
  http_error: 'iPhone 只对 Tailscale 域名（<span class="code">*.ts.net</span>）接受明文 <span class="code">http://</span>。请使用 <span class="code">https://</span> 地址。',
  iphone: 'iPhone', step_1: '在 iPhone 上安装 Open Oura 并配对戒指。', step_2: '打开“相机”，对准这个二维码。',
  step_3: '轻点 <b>Open in Open Oura</b>，然后轻点 <b>Connect</b>。',
  after: '此后 App 会在每次同步后发送戒指数据。要加入 Apple Watch 的数据，请在“Settings → Health hub”中打开 <b>Include Apple Health data</b>。',
  agent: 'AI 智能体（MCP）', hide_token: '隐藏令牌', show_token: '显示令牌', copy: '复制', copied: '已复制',
  mcp_label: 'MCP 地址（Streamable HTTP，令牌在路径中）', cursor_label: 'Cursor 及其他客户端（mcpServers）',
  agent_note: 'Claude Desktop 和 claude.ai：Settings → Connectors → Add custom connector，然后粘贴 MCP 地址。托管的智能体需要公开的 <span class="code">https://</span> 地址（Tailscale Funnel）。可以这样问它：“Call get_status_now and plan my day.”',
  mac: 'Mac（命令行）', push_label: '从使用 oura CLI 同步戒指的 Mac 发送摘要',
} satisfies Record<keyof typeof en, string>
