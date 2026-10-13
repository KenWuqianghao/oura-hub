// The Ask page: a chat with an agent that runs on the hub.
export const en = {
  sub: 'An agent on the hub that uses your own {agent} subscription and the health tools. It reads the same data that these pages show. Its answers are not medical advice.',
  agent_word: 'agent', agent: 'Agent', in_conversation: 'in conversation', ready: 'ready', not_installed: 'not installed',
  not_installed_tip: 'Not installed on the hub. {hint}.', install_hint: 'Install {agent} on the hub and sign in: {hint}.',
  new_conversation: 'New conversation', try: 'Try',
  q_plan: 'Plan my day: training, caffeine cutoff, bedtime, one thing to watch.',
  q_sleep: 'How did I sleep last night, and how does it compare with my baseline?',
  q_week: 'Compare this week with last week: sleep, HRV, resting heart rate, steps.',
  q_watch: 'What does my Apple Watch say today, and does it agree with the ring?',
  q_sick: 'Is there any sign I am getting sick?',
  empty_title: 'Ask about your sleep, your recovery, or what to do today.', empty_text: 'The agent calls the tools of the hub and answers in your language.',
  placeholder: 'Ask {agent}…', no_agent: 'No agent is installed on the hub', send: 'Send', agent_error: 'The agent reported an error.',
} as const
export const zh = {
  sub: '运行在 Hub 上的智能体，使用你自己的 {agent} 订阅和健康工具。它读取的数据与这些页面显示的相同。它的回答不构成医疗建议。',
  agent_word: '智能体', agent: '智能体', in_conversation: '对话中', ready: '就绪', not_installed: '未安装',
  not_installed_tip: 'Hub 上尚未安装。{hint}。', install_hint: '请在 Hub 上安装 {agent} 并登录：{hint}。',
  new_conversation: '新对话', try: '试试这些',
  q_plan: '帮我安排今天：训练、最晚喝咖啡的时间、就寝时间，以及一件需要留意的事。',
  q_sleep: '我昨晚睡得怎么样？和我的基线相比如何？',
  q_week: '对比本周和上周：睡眠、心率变异性、静息心率、步数。',
  q_watch: '我的 Apple Watch 今天的数据怎么样？和戒指一致吗？',
  q_sick: '有没有我快要生病的迹象？',
  empty_title: '问问你的睡眠、恢复情况，或者今天该做什么。', empty_text: '智能体会调用 Hub 的工具，并用你的语言回答。',
  placeholder: '向 {agent} 提问…', no_agent: 'Hub 上没有安装智能体', send: '发送', agent_error: '智能体报告了一个错误。',
} satisfies Record<keyof typeof en, string>
