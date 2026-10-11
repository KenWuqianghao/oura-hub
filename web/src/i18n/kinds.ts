// Titles and one-line descriptions for every Apple Health kind, the kind groups, and
// workout activities. One row: [title en, title zh, about en, about zh].
const KINDS = {
  active_energy: ['Active energy', '活动能量', 'Energy you burn by moving, above what your body uses at rest.', '活动所消耗的能量，不含静息消耗。'],
  basal_energy: ['Resting energy', '静息能量', 'Energy your body uses at rest to keep itself running.', '身体在静息状态下维持运转所消耗的能量。'],
  step_count: ['Steps', '步数', 'Steps per day from the best single source, so the phone and the Watch are not added together.', '每日步数，取单一最佳来源，手机与手表不重复累加。'],
  distance_walking_running: ['Walking + running distance', '步行 + 跑步距离', 'Distance you cover on foot in a day.', '每日步行与跑步的总距离。'],
  distance_cycling: ['Cycling distance', '骑行距离', 'Distance you ride in a day.', '每日骑行的距离。'],
  distance_paddle_sports: ['Paddle sports distance', '桨类运动距离', 'Distance you cover in paddle sports.', '桨类运动中行进的距离。'],
  exercise_time: ['Exercise minutes', '锻炼分钟数', 'Minutes of movement at or above a brisk walk.', '达到或超过快走强度的活动分钟数。'],
  stand_time: ['Stand minutes', '站立分钟数', 'Minutes you spend on your feet.', '处于站立状态的分钟数。'],
  stand_hour: ['Stand hours', '站立小时数', 'Hours in which you stood and moved for at least one minute.', '站立并活动至少一分钟的小时数。'],
  flights_climbed: ['Flights climbed', '已爬楼层', 'One flight is about 3 metres of climb.', '一层约等于上升 3 米。'],
  time_in_daylight: ['Time in daylight', '日光下时间', 'Minutes outdoors in daylight, from the Watch light sensor.', '在户外日光下的分钟数，由手表的环境光传感器测得。'],
  physical_effort: ['Physical effort', '体能消耗', 'How hard your body works, as energy per kilogram per hour.', '身体的用力程度，以每千克体重每小时消耗的能量表示。'],
  workout: ['Workouts', '体能训练', 'Minutes of recorded workouts per day.', '每日记录的体能训练分钟数。'],
  estimated_workout_effort_score: ['Workout effort', '训练强度', 'The Watch estimate of how hard a workout was, from 1 to 10.', '手表对训练强度的估计，范围 1 至 10。'],
  running_speed: ['Running speed', '跑步速度', 'Your speed while you run.', '跑步时的速度。'],
  paddle_sports_speed: ['Paddle sports speed', '桨类运动速度', 'Your speed in paddle sports.', '桨类运动时的速度。'],
  heart_rate: ['Heart rate', '心率', 'Beats per minute through the day. The bar shows the lowest and the highest value.', '全天每分钟心跳次数，柱条显示当日最低值与最高值。'],
  resting_heart_rate: ['Resting heart rate', '静息心率', 'Your heart rate when you are still and relaxed. Lower usually means fitter.', '安静放松时的心率，通常越低代表心肺功能越好。'],
  walking_heart_rate_average: ['Walking heart rate average', '步行平均心率', 'Your average heart rate during steady walks.', '平稳步行时的平均心率。'],
  hrv_sdnn: ['Heart rate variability', '心率变异性', 'SDNN from short Watch readings through the day. It is not the ring’s nightly RMSSD.', '手表全天短时测量得到的 SDNN，与戒指夜间的 RMSSD 不同。'],
  heart_rate_recovery_one_minute: ['Cardio recovery', '心率恢复', 'How far your heart rate falls in the first minute after a workout.', '训练结束后第一分钟内心率下降的幅度。'],
  vo2_max: ['Cardio fitness', '有氧适能', 'VO₂ max: the most oxygen your body can use in exercise. The Watch estimates it on outdoor walks and runs.', '最大摄氧量：运动时身体所能利用的最大氧气量，由手表在户外步行和跑步时估算。'],
  low_heart_rate_event: ['Low heart rate notifications', '低心率通知', 'Times the Watch saw your heart rate stay below your limit.', '手表检测到心率持续低于设定阈值的次数。'],
  electrocardiogram: ['ECG', '心电图', 'Average heart rate of each ECG recording.', '每次心电图记录的平均心率。'],
  blood_pressure_systolic: ['Systolic blood pressure', '收缩压', 'Pressure in your arteries when the heart beats.', '心脏收缩时动脉内的压力。'],
  blood_pressure_diastolic: ['Diastolic blood pressure', '舒张压', 'Pressure in your arteries between beats.', '两次心跳之间动脉内的压力。'],
  respiratory_rate: ['Respiratory rate', '呼吸频率', 'Breaths per minute, measured during sleep.', '睡眠期间测得的每分钟呼吸次数。'],
  oxygen_saturation: ['Blood oxygen', '血氧', 'Share of your red blood cells that carry oxygen.', '血液中携氧红细胞所占的比例。'],
  sleep_analysis: ['Sleep records', '睡眠记录', 'Minutes of all sleep rows, time in bed and time awake included. The Sleep page shows the nights.', '所有睡眠记录的总分钟数，包含卧床与清醒时间。各晚详情见“睡眠”页。'],
  body_mass: ['Weight', '体重', 'Your body weight.', '你的体重。'],
  body_mass_index: ['Body mass index', '身高体重指数', 'Weight divided by height squared.', '体重除以身高的平方。'],
  body_fat_percentage: ['Body fat', '体脂率', 'Share of your weight that is fat.', '脂肪占体重的比例。'],
  lean_body_mass: ['Lean body mass', '去脂体重', 'Your weight without the fat.', '除去脂肪后的体重。'],
  height: ['Height', '身高', 'Your height.', '你的身高。'],
  wrist_temperature: ['Wrist temperature', '手腕温度', 'Wrist temperature during sleep, from the Watch.', '睡眠期间由手表测得的手腕温度。'],
  body_temperature: ['Body temperature', '体温', 'Body temperature readings.', '体温测量值。'],
  blood_glucose: ['Blood glucose', '血糖', 'Sugar in your blood.', '血液中的葡萄糖浓度。'],
  walking_speed: ['Walking speed', '步行速度', 'Your speed on level ground.', '在平地上步行的速度。'],
  walking_step_length: ['Step length', '步长', 'Distance between your front foot and your back foot when you walk.', '步行时前后脚之间的距离。'],
  walking_double_support_percentage: ['Double support time', '双脚支撑时间', 'Share of a walk with both feet on the ground. Lower means better balance.', '步行时双脚同时着地的时间占比，越低代表平衡越好。'],
  walking_asymmetry_percentage: ['Walking asymmetry', '步行不对称性', 'Share of a walk in which one foot moves faster than the other.', '步行时一只脚比另一只脚快的时间占比。'],
  stair_ascent_speed: ['Stair speed: up', '上楼梯速度', 'How fast you climb stairs.', '上楼梯的速度。'],
  stair_descent_speed: ['Stair speed: down', '下楼梯速度', 'How fast you go down stairs.', '下楼梯的速度。'],
  apple_walking_steadiness: ['Walking steadiness', '步行稳定性', 'Apple’s estimate of your stability when you walk.', 'Apple 对你步行稳定程度的评估。'],
  six_minute_walk_test_distance: ['Six-minute walk', '六分钟步行', 'Estimated distance you can walk in six minutes.', '估算你在六分钟内可以步行的距离。'],
  headphone_audio_exposure: ['Headphone audio levels', '耳机音量', 'Sound level of your headphones.', '耳机播放的声音强度。'],
  environmental_audio_exposure: ['Environmental sound levels', '环境音量', 'Sound level around you, from the Watch microphone.', '周围环境的声音强度，由手表麦克风测得。'],
  environmental_sound_reduction: ['Environmental sound reduction', '环境降噪', 'How much your AirPods reduce the sound around you.', 'AirPods 为你降低的环境音量。'],
  audio_exposure_event: ['Noise notifications', '噪声通知', 'Times the sound around you was loud enough to affect hearing.', '环境声音大到可能影响听力的次数。'],
  mindful_session: ['Mindful minutes', '正念分钟数', 'Minutes of recorded mindfulness sessions.', '记录的正念练习分钟数。'],
  handwashing_event: ['Handwashing', '洗手', 'Handwashes of 20 seconds or longer.', '持续 20 秒或以上的洗手次数。'],
  constipation: ['Constipation', '便秘', 'Days on which you logged constipation.', '记录有便秘的日子。'],
  dietary_energy_consumed: ['Dietary energy', '膳食能量', 'Energy in the food and drink you logged.', '所记录饮食中的能量。'],
  dietary_water: ['Water', '水', 'Water you logged.', '记录的饮水量。'],
  dietary_carbohydrates: ['Carbohydrates', '碳水化合物', 'Carbohydrates in the food you logged.', '所记录饮食中的碳水化合物。'],
  dietary_protein: ['Protein', '蛋白质', 'Protein in the food you logged.', '所记录饮食中的蛋白质。'],
  dietary_fat_total: ['Total fat', '总脂肪', 'All fat in the food you logged.', '所记录饮食中的全部脂肪。'],
  dietary_fat_saturated: ['Saturated fat', '饱和脂肪', 'Saturated fat in the food you logged.', '所记录饮食中的饱和脂肪。'],
  dietary_fat_monounsaturated: ['Monounsaturated fat', '单不饱和脂肪', 'Monounsaturated fat in the food you logged.', '所记录饮食中的单不饱和脂肪。'],
  dietary_fat_polyunsaturated: ['Polyunsaturated fat', '多不饱和脂肪', 'Polyunsaturated fat in the food you logged.', '所记录饮食中的多不饱和脂肪。'],
  dietary_fiber: ['Fiber', '膳食纤维', 'Fiber in the food you logged.', '所记录饮食中的膳食纤维。'],
  dietary_sugar: ['Sugar', '糖', 'Sugar in the food and drink you logged.', '所记录饮食中的糖。'],
  dietary_cholesterol: ['Cholesterol', '胆固醇', 'Cholesterol in the food you logged.', '所记录饮食中的胆固醇。'],
  dietary_sodium: ['Sodium', '钠', 'Sodium in the food you logged. Most of it comes from salt.', '所记录饮食中的钠，主要来自食盐。'],
  dietary_potassium: ['Potassium', '钾', 'Potassium in the food you logged.', '所记录饮食中的钾。'],
  dietary_calcium: ['Calcium', '钙', 'Calcium in the food you logged.', '所记录饮食中的钙。'],
  dietary_iron: ['Iron', '铁', 'Iron in the food you logged.', '所记录饮食中的铁。'],
  dietary_magnesium: ['Magnesium', '镁', 'Magnesium in the food you logged.', '所记录饮食中的镁。'],
  dietary_phosphorus: ['Phosphorus', '磷', 'Phosphorus in the food you logged.', '所记录饮食中的磷。'],
  dietary_zinc: ['Zinc', '锌', 'Zinc in the food you logged.', '所记录饮食中的锌。'],
  dietary_copper: ['Copper', '铜', 'Copper in the food you logged.', '所记录饮食中的铜。'],
  dietary_manganese: ['Manganese', '锰', 'Manganese in the food you logged.', '所记录饮食中的锰。'],
  dietary_selenium: ['Selenium', '硒', 'Selenium in the food you logged.', '所记录饮食中的硒。'],
  dietary_iodine: ['Iodine', '碘', 'Iodine in the food you logged.', '所记录饮食中的碘。'],
  dietary_chloride: ['Chloride', '氯', 'Chloride in the food you logged.', '所记录饮食中的氯。'],
  dietary_chromium: ['Chromium', '铬', 'Chromium in the food you logged.', '所记录饮食中的铬。'],
  dietary_molybdenum: ['Molybdenum', '钼', 'Molybdenum in the food you logged.', '所记录饮食中的钼。'],
  dietary_vitamin_a: ['Vitamin A', '维生素 A', 'Vitamin A in the food you logged.', '所记录饮食中的维生素 A。'],
  dietary_vitamin_c: ['Vitamin C', '维生素 C', 'Vitamin C in the food you logged.', '所记录饮食中的维生素 C。'],
  dietary_vitamin_d: ['Vitamin D', '维生素 D', 'Vitamin D in the food you logged.', '所记录饮食中的维生素 D。'],
  dietary_vitamin_e: ['Vitamin E', '维生素 E', 'Vitamin E in the food you logged.', '所记录饮食中的维生素 E。'],
  dietary_vitamin_k: ['Vitamin K', '维生素 K', 'Vitamin K in the food you logged.', '所记录饮食中的维生素 K。'],
  dietary_vitamin_b6: ['Vitamin B6', '维生素 B6', 'Vitamin B6 in the food you logged.', '所记录饮食中的维生素 B6。'],
  dietary_vitamin_b12: ['Vitamin B12', '维生素 B12', 'Vitamin B12 in the food you logged.', '所记录饮食中的维生素 B12。'],
  dietary_thiamin: ['Thiamin (B1)', '硫胺素（B1）', 'Thiamin in the food you logged.', '所记录饮食中的硫胺素。'],
  dietary_riboflavin: ['Riboflavin (B2)', '核黄素（B2）', 'Riboflavin in the food you logged.', '所记录饮食中的核黄素。'],
  dietary_niacin: ['Niacin (B3)', '烟酸（B3）', 'Niacin in the food you logged.', '所记录饮食中的烟酸。'],
  dietary_pantothenic_acid: ['Pantothenic acid (B5)', '泛酸（B5）', 'Pantothenic acid in the food you logged.', '所记录饮食中的泛酸。'],
  dietary_folate: ['Folate', '叶酸', 'Folate in the food you logged.', '所记录饮食中的叶酸。'],
  dietary_biotin: ['Biotin', '生物素', 'Biotin in the food you logged.', '所记录饮食中的生物素。'],
  dietary_caffeine: ['Caffeine', '咖啡因', 'Caffeine in the drinks and food you logged.', '所记录饮食中的咖啡因。'],
} as const satisfies Record<string, readonly [string, string, string, string]>

const GROUPS = {
  activity: ['Activity', '健身记录'], heart: ['Heart', '心脏'], respiratory: ['Respiratory', '呼吸'], sleep: ['Sleep', '睡眠'],
  nutrition: ['Nutrition', '营养'], body: ['Body measurements', '身体测量'], mobility: ['Mobility', '活动能力'], hearing: ['Hearing', '听力'],
  mindfulness: ['Mindfulness', '正念'], other: ['Other data', '其他数据'],
} as const

const ACTIVITIES = {
  walking: ['Walking', '步行'], running: ['Running', '跑步'], cycling: ['Cycling', '骑行'], hiking: ['Hiking', '徒步'], swimming: ['Swimming', '游泳'],
  strength_training: ['Strength training', '力量训练'], functional_strength_training: ['Functional strength training', '功能性力量训练'],
  elliptical: ['Elliptical', '椭圆机'], basketball: ['Basketball', '篮球'], cross_training: ['Cross training', '交叉训练'], rowing: ['Rowing', '划船'],
  flexibility: ['Flexibility', '柔韧性训练'], workout: ['Workout', '体能训练'], other: ['Other', '其他'], unknown: ['Workout', '体能训练'],
} as const

export type KnownKind = keyof typeof KINDS
type Dict = { [K in KnownKind]: string } & { [K in KnownKind as `${K}_about`]: string }
  & { [G in keyof typeof GROUPS as `group_${G}`]: string } & { [A in keyof typeof ACTIVITIES as `act_${A}`]: string }

function build(lang: 0 | 1): Dict {
  const out: Record<string, string> = {}
  for (const [k, row] of Object.entries(KINDS)) { out[k] = row[lang]; out[`${k}_about`] = row[lang + 2] }
  for (const [g, row] of Object.entries(GROUPS)) out[`group_${g}`] = row[lang]
  for (const [a, row] of Object.entries(ACTIVITIES)) out[`act_${a}`] = row[lang]
  return out as Dict
}
export const en = build(0)
export const zh = build(1)
