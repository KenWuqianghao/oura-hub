// Words inside charts: legends, lane labels, tooltips.
export const en = {
  average: 'average', daily_average: 'daily average', line_average: 'Average {n}', line_daily_average: 'Daily average {n}', daily: 'Daily', mean_7d: '7-day average', baseline: 'Baseline {n}',
  day_title: 'The day, hour by hour', day_sub: 'from the evening before · {day}',
  hr_watch: 'Heart rate (watch)', movement_ring: 'Movement (ring)', lane_sleep: 'Sleep',
  no_night: 'No night for this day yet', no_hr: 'No watch heart rate for this day', no_movement: 'No ring movement for this day',
  in_bed: 'In bed', asleep_word: 'sleep', no_stages: 'no stages yet', met_above_rest: 'MET above rest',
  lane_stages: 'Stages', lane_hr: 'Heart rate', lane_hrv: 'HRV', lane_temp: 'Skin temp', lane_spo2: 'Blood O₂', lane_motion: 'Movement', motion_unit: 'movement',
  not_enough: 'Not enough days yet.',
} as const
export const zh = {
  average: '平均', daily_average: '日均', line_average: '平均 {n}', line_daily_average: '日均 {n}', daily: '每日', mean_7d: '7 日平均', baseline: '基线 {n}',
  day_title: '这一天，逐小时', day_sub: '从前一晚开始 · {day}',
  hr_watch: '心率（手表）', movement_ring: '活动量（戒指）', lane_sleep: '睡眠',
  no_night: '这一天还没有睡眠记录', no_hr: '这一天没有手表心率', no_movement: '这一天没有戒指活动数据',
  in_bed: '卧床', asleep_word: '睡眠', no_stages: '暂无睡眠阶段', met_above_rest: 'MET（高于静息）',
  lane_stages: '睡眠阶段', lane_hr: '心率', lane_hrv: '心率变异性', lane_temp: '皮肤温度', lane_spo2: '血氧', lane_motion: '活动量', motion_unit: '活动量',
  not_enough: '天数还不够。',
} satisfies Record<keyof typeof en, string>
