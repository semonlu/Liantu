export type TrainingGoal = 'fat_loss' | 'strength' | 'endurance' | 'circuit' | 'functional';
export type TrainingLevel = 'beginner' | 'intermediate';
export type Equipment = 'bodyweight' | 'dumbbell' | 'gym';

export type TrainingProfile = {
  goal: TrainingGoal;
  level: TrainingLevel;
  equipment: Equipment;
  daysPerWeek: 3 | 4 | 5;
  sessionMinutes: number;
  weightKg: number;
  startDate: string;
};

export type ExerciseDefinition = {
  id: string;
  name: string;
  englishName: string;
  target: string;
  equipment: Equipment[];
  wgerId?: number;
  cues: string[];
  easier: string;
};

export type ExercisePrescription = ExerciseDefinition & {
  sets: number;
  reps: string;
  restSeconds: number;
};

export type TrainingSession = {
  id: string;
  date: string;
  title: string;
  focus: string;
  week: number;
  phase: '基础' | '积累' | '强化' | '减载';
  durationMinutes: number;
  estimatedCalories: number;
  circuit: boolean;
  recovery: boolean;
  adjustment: string;
  exercises: ExercisePrescription[];
};

export type ExerciseLog = {
  exerciseId: string;
  completedSets: number;
  reps: string;
  weightKg: number;
  rpe: number;
};

export type WorkoutLog = {
  id: string;
  date: string;
  sessionId: string;
  title: string;
  durationMinutes: number;
  caloriesBurned: number;
  completion: number;
  averageRpe: number;
  exercises: ExerciseLog[];
  note: string;
  completedAt: number;
};

export type RecoveryRecommendation = {
  area:string;
  stretch:string;
  foam:string;
  massageGun:string;
};

export const goalLabels: Record<TrainingGoal,string> = {
  fat_loss:'减脂', strength:'力量', endurance:'耐力', circuit:'循环', functional:'功能性',
};

export const defaultProfile: TrainingProfile = {
  goal:'strength', level:'beginner', equipment:'gym', daysPerWeek:3,
  sessionMinutes:45, weightKg:65, startDate:new Date().toISOString().slice(0,10),
};

const catalog: Record<string,ExerciseDefinition> = {
  leg_press:{ id:'leg_press',name:'腿举机',englishName:'Leg Press',target:'下肢 · 蹲推',equipment:['gym'],wgerId:371,
    cues:['调整座椅，让膝盖在底部保持舒适角度','脚掌全程贴稳踏板，膝盖跟随脚尖','控制下放，不在顶端锁死膝盖'],easier:'减轻配重并缩小下放幅度' },
  bench:{ id:'bench',name:'杠铃卧推',englishName:'Bench Press',target:'胸肩 · 水平推',equipment:['gym'],wgerId:73,
    cues:['肩胛向后下方稳定，双脚踩稳','杠铃控制下降到胸部舒适位置','前臂接近垂直，稳定推回起点'],easier:'固定器械推胸或轻重量哑铃卧推' },
  lat_pulldown:{ id:'lat_pulldown',name:'反握高位下拉',englishName:'Close-grip Supinated Lat Pulldown',target:'背部 · 垂直拉',equipment:['gym'],wgerId:1127,
    cues:['胸口微抬，肩膀远离耳朵','肘部向身体两侧和下方拉','控制回放，避免借助身体摆动'],easier:'减轻配重并使用中立握把' },
  leg_curl:{ id:'leg_curl',name:'坐姿腿弯举',englishName:'Leg Curls Sitting',target:'大腿后侧 · 屈膝',equipment:['gym'],wgerId:366,
    cues:['膝关节轴线对准器械转轴','大腿固定在座椅上','缓慢弯曲并控制回放'],easier:'减轻配重并缩短活动范围' },
  cable_row:{ id:'cable_row',name:'坐姿绳索划船',englishName:'Seated Cable Row',target:'背部 · 水平拉',equipment:['gym'],wgerId:1117,
    cues:['躯干稳定，胸口自然展开','肘部贴近身体向后拉','肩胛收拢后控制手柄返回'],easier:'减轻配重并使用中立握把' },
  leg_extension:{ id:'leg_extension',name:'腿屈伸',englishName:'Leg Extension',target:'股四头肌 · 伸膝',equipment:['gym'],wgerId:369,
    cues:['膝关节轴线对准器械转轴','伸膝到舒适位置，不用冲击惯性','控制下放，臀部保持贴座'],easier:'减轻配重并缩小伸展幅度' },
  chest_fly:{ id:'chest_fly',name:'蝴蝶机夹胸',englishName:'Machine Chest Fly',target:'胸部 · 水平内收',equipment:['gym'],wgerId:926,
    cues:['背部贴稳靠垫，肩膀保持下沉','双臂沿器械轨迹向中间靠拢','胸前短暂停顿后控制打开'],easier:'减轻配重并缩小打开幅度' },
  triceps:{ id:'triceps',name:'绳索下压',englishName:'Triceps Pushdown',target:'肱三头肌 · 伸肘',equipment:['gym'],wgerId:1185,
    cues:['肘部贴近身体并保持固定','前臂向下伸直，躯干不摆动','控制回到前臂接近平行地面'],easier:'减轻配重' },
  squat:{ id:'squat',name:'高脚杯深蹲',englishName:'Dumbbell Goblet Squat',target:'下肢 · 蹲',equipment:['dumbbell','gym'],wgerId:203,
    cues:['双脚约与肩同宽，脚尖自然外展','膝盖与脚尖方向一致，躯干保持稳定','脚掌均匀发力站起，不急着锁死膝盖'],easier:'徒手坐椅深蹲' },
  body_squat:{ id:'body_squat',name:'徒手深蹲',englishName:'Bodyweight Squat',target:'下肢 · 蹲',equipment:['bodyweight','dumbbell','gym'],wgerId:1312,
    cues:['髋部向后下方坐，胸口保持展开','膝盖跟随脚尖方向','以能稳定控制的深度完成'],easier:'坐椅起立' },
  pushup:{ id:'pushup',name:'俯卧撑',englishName:'Push-Up',target:'胸肩 · 推',equipment:['bodyweight','dumbbell','gym'],wgerId:1551,
    cues:['头、背、髋保持一条直线','肘部约向身体后外侧打开','胸部接近地面后整体推起'],easier:'跪姿或上斜俯卧撑' },
  row:{ id:'row',name:'俯身哑铃划船',englishName:'Bent Over Dumbbell Rows',target:'背部 · 拉',equipment:['dumbbell','gym'],wgerId:81,
    cues:['髋部后移，背部保持自然平直','肘部向髋部方向拉，不耸肩','顶端短暂停顿，再控制下放'],easier:'单臂扶凳划船' },
  dead_bug:{ id:'dead_bug',name:'死虫式',englishName:'Dead Bug',target:'核心 · 抗伸展',equipment:['bodyweight','dumbbell','gym'],wgerId:2505,
    cues:['腰背轻贴地面，肋骨保持下沉','对侧手脚缓慢伸远','腰背将要离地前返回'],easier:'仅移动单侧腿' },
  lunge:{ id:'lunge',name:'反向箭步蹲',englishName:'Reverse Lunges',target:'下肢 · 单腿',equipment:['bodyweight','dumbbell','gym'],wgerId:999,
    cues:['后撤一步并垂直下沉','前脚全脚掌压稳，膝盖跟随脚尖','前腿发力回到站立'],easier:'扶墙小幅后撤箭步蹲' },
  plank:{ id:'plank',name:'平板支撑',englishName:'Plank',target:'核心 · 稳定',equipment:['bodyweight','dumbbell','gym'],wgerId:458,
    cues:['肘部位于肩部下方','收紧腹部和臀部，避免塌腰','保持自然呼吸，不憋气'],easier:'膝盖着地平板支撑' },
  jumping_jack:{ id:'jumping_jack',name:'开合跳',englishName:'Jumping Jacks',target:'全身 · 心肺',equipment:['bodyweight','dumbbell','gym'],wgerId:320,
    cues:['轻柔落地，膝盖保持弹性','手脚同步打开与收回','保持可连续说短句的节奏'],easier:'左右点步开合' },
  mountain:{ id:'mountain',name:'登山跑',englishName:'Mountain Climbers',target:'全身 · 心肺',equipment:['bodyweight','dumbbell','gym'],wgerId:996,
    cues:['双手位于肩部下方','膝盖交替向前，骨盆保持稳定','先保持动作质量，再提高速度'],easier:'慢速交替提膝' },
  bridge:{ id:'bridge',name:'臀桥',englishName:'Glute Bridge',target:'臀腿 · 髋伸',equipment:['bodyweight','dumbbell','gym'],wgerId:265,
    cues:['脚跟靠近臀部，脚掌压稳','收紧臀部抬髋，不用腰部顶起','顶端保持肋骨下沉'],easier:'缩小抬起幅度' },
  bird_dog:{ id:'bird_dog',name:'鸟狗式',englishName:'Bird Dog',target:'核心 · 对侧稳定',equipment:['bodyweight','dumbbell','gym'],wgerId:1572,
    cues:['四点跪姿，脊柱保持中立','对侧手脚向远处延伸','骨盆不旋转，缓慢返回'],easier:'只伸手或只伸腿' },
  rdl:{ id:'rdl',name:'哑铃罗马尼亚硬拉',englishName:'Dumbbell Romanian Deadlift',target:'臀腿 · 髋铰链',equipment:['dumbbell','gym'],wgerId:1652,
    cues:['膝盖微屈，髋部向后移动','重量贴近腿部，背部保持稳定','感到大腿后侧拉伸后夹臀站起'],easier:'徒手髋铰链练习' },
  press:{ id:'press',name:'哑铃肩推',englishName:'Shoulder Press, Dumbbells',target:'肩臂 · 推',equipment:['dumbbell','gym'],wgerId:567,
    cues:['肋骨保持下沉，避免后仰','哑铃从肩部上方垂直推起','控制下放到舒适深度'],easier:'单臂轻重量肩推' },
  swing:{ id:'swing',name:'壶铃摆动',englishName:'Kettlebell Swing',target:'全身 · 爆发髋伸',equipment:['gym'],wgerId:960,
    cues:['动作来自髋部快速伸展，不是手臂抬起','壶铃向后穿过双腿时保持背部稳定','臀部收紧站直，不向后过伸'],easier:'先练徒手髋铰链' },
  carry:{ id:'carry',name:'农夫行走',englishName:'Farmers Walk',target:'全身 · 负重移动',equipment:['dumbbell','gym'],
    cues:['双手持重，肩胛自然下沉','躯干直立，小步稳定前进','全程保持均匀呼吸'],easier:'单手轻重量短距离行走' },
  side_plank:{ id:'side_plank',name:'侧桥',englishName:'Side Plank',target:'核心 · 侧向稳定',equipment:['bodyweight','dumbbell','gym'],wgerId:2509,
    cues:['肘部位于肩部下方','头、肩、髋保持一条直线','避免骨盆向后旋转'],easier:'屈膝侧桥' },
  walk:{ id:'walk',name:'快走或轻松慢跑',englishName:'Brisk Walk or Easy Run',target:'心肺 · 有氧基础',equipment:['bodyweight','dumbbell','gym'],
    cues:['用可持续、能说短句的速度','身体放松，步频自然','结束前逐步降低速度'],easier:'舒适步速散步' },
};

type SessionRecipe = { title:string; focus:string; met:number; circuit?:boolean; items:Array<[string,number,string,number]> };

const recipes: Record<TrainingGoal,SessionRecipe[]> = {
  strength:[
    { title:'全身器械力量 A',focus:'腿举 · 卧推 · 下拉 · 核心',met:5.5,items:[['leg_press',3,'8–10 次',90],['bench',3,'6–10 次',120],['lat_pulldown',3,'8–12 次',90],['leg_curl',3,'10–12 次',75],['dead_bug',3,'每侧 8 次',45]] },
    { title:'全身器械力量 B',focus:'腿部 · 划船 · 肩臂',met:5.5,items:[['leg_extension',3,'10–12 次',75],['cable_row',3,'8–12 次',90],['press',3,'8–10 次',75],['triceps',3,'10–12 次',60],['plank',3,'25–40 秒',45]] },
  ],
  fat_loss:[
    { title:'减脂循环 A',focus:'全身循环 · 中等强度',met:7,circuit:true,items:[['jumping_jack',4,'40 秒',20],['body_squat',4,'12 次',20],['pushup',4,'8 次',20],['mountain',4,'30 秒',60],['plank',3,'30 秒',30]] },
    { title:'器械力量 + 有氧',focus:'力量保留 · 稳态心肺',met:6.5,items:[['leg_press',3,'10 次',60],['cable_row',3,'10 次',60],['chest_fly',3,'10–12 次',60],['walk',1,'20–30 分钟',60]] },
  ],
  endurance:[
    { title:'有氧耐力基础',focus:'低至中等强度持续训练',met:6,items:[['walk',1,'30–45 分钟',60],['bird_dog',2,'每侧 8 次',30],['side_plank',2,'每侧 20 秒',30]] },
    { title:'短间歇耐力',focus:'1 分钟快 + 2 分钟慢',met:8,circuit:true,items:[['jumping_jack',6,'60 秒',120],['mountain',6,'30 秒',60],['body_squat',3,'12 次',30],['dead_bug',3,'每侧 8 次',30]] },
  ],
  circuit:[
    { title:'器械循环 A',focus:'推 · 拉 · 腿 · 短休息',met:7,circuit:true,items:[['leg_press',4,'12 次',30],['chest_fly',4,'10 次',30],['cable_row',4,'10 次',30],['leg_curl',4,'12 次',75]] },
    { title:'器械循环 B',focus:'下肢 · 肩臂 · 核心',met:7,circuit:true,items:[['leg_extension',4,'12 次',30],['lat_pulldown',4,'10 次',30],['press',4,'10 次',30],['triceps',4,'12 次',75]] },
  ],
  functional:[
    { title:'功能性基础 A',focus:'蹲 · 携带 · 抗旋转',met:5.5,items:[['body_squat',3,'10 次',60],['lunge',3,'每侧 8 次',60],['carry',4,'30–45 秒',45],['bird_dog',3,'每侧 8 次',30],['side_plank',3,'每侧 20 秒',30]] },
    { title:'功能性基础 B',focus:'髋铰链 · 推拉 · 稳定',met:5.5,items:[['rdl',3,'10 次',75],['pushup',3,'8–12 次',60],['row',3,'每侧 10 次',60],['bridge',3,'12 次',45],['dead_bug',3,'每侧 8 次',30]] },
  ],
};

const weekdaySets: Record<TrainingProfile['daysPerWeek'],number[]> = {
  3:[1,3,5], 4:[1,2,4,6], 5:[1,2,3,5,6],
};

const localDate = (date:Date) => {
  const year=date.getFullYear(), month=String(date.getMonth()+1).padStart(2,'0'), day=String(date.getDate()).padStart(2,'0');
  return `${year}-${month}-${day}`;
};

function daysBetween(start:string,end:string) {
  const from=new Date(`${start}T12:00:00`), to=new Date(`${end}T12:00:00`);
  return Math.max(0,Math.floor((to.getTime()-from.getTime())/86_400_000));
}

function equipmentVariant(id:string,profile:TrainingProfile) {
  const gymFallbacks:Record<string,string>={leg_press:'squat',bench:'pushup',lat_pulldown:'row',leg_curl:'rdl',cable_row:'row',leg_extension:'lunge',chest_fly:'pushup',triceps:'pushup'};
  if(profile.equipment!=='gym'&&gymFallbacks[id])id=gymFallbacks[id];
  if (profile.equipment==='bodyweight') {
    if (id==='squat') return 'body_squat';
    if (id==='row') return 'bird_dog';
    if (id==='rdl') return 'bridge';
    if (id==='press') return 'pushup';
    if (id==='carry') return 'plank';
  }
  if (id==='swing' && profile.equipment!=='gym') return 'rdl';
  return id;
}

export function phaseForWeek(week:number):TrainingSession['phase'] {
  const cycleWeek=((Math.max(1,week)-1)%8)+1;
  if(cycleWeek<=2)return '基础';
  if(cycleWeek<=5)return '积累';
  if(cycleWeek<=7)return '强化';
  return '减载';
}

function recoverySession(profile:TrainingProfile,date:string,week:number):TrainingSession {
  const duration=Math.min(30,Math.max(15,Math.round(profile.sessionMinutes*.5)));
  return {
    id:`${date}-recovery`,date,title:'主动恢复',focus:'轻松步行 · 关节活动',week,phase:phaseForWeek(week),durationMinutes:duration,
    estimatedCalories:estimateCalories(3,profile.weightKg,duration),circuit:false,recovery:true,
    adjustment:'今天是计划恢复日；轻松活动即可，不需要补做高强度训练。',
    exercises:[
      {...catalog.walk,sets:1,reps:`${duration-5} 分钟`,restSeconds:30},
      {...catalog.bird_dog,sets:2,reps:'每侧 6 次',restSeconds:30},
    ],
  };
}

export function estimateCalories(met:number,weightKg:number,minutes:number) {
  return Math.round(Math.max(1,met)*3.5*Math.max(30,weightKg)/200*Math.max(1,minutes));
}

export function buildSession(profile:TrainingProfile,dateValue:Date,logs:WorkoutLog[]):TrainingSession {
  const date=localDate(dateValue);
  const elapsed=daysBetween(profile.startDate,date);
  const week=Math.floor(elapsed/7)+1;
  const weekdays=weekdaySets[profile.daysPerWeek];
  const weekday=dateValue.getDay();
  if (!weekdays.includes(weekday)) return recoverySession(profile,date,week);

  const slot=weekdays.indexOf(weekday);
  const list=recipes[profile.goal];
  const recipe=list[(slot+week-1)%list.length];
  const recent=[...logs].sort((a,b)=>b.completedAt-a.completedAt).slice(0,2);
  const phase=phaseForWeek(week);
  const underRecovered=recent.length>0 && (recent[0].averageRpe>=8.8 || recent[0].completion<.7);
  const progressing=recent.length===2 && recent.every((log)=>log.completion>=.9 && log.averageRpe<=7.5);
  const levelDelta=profile.level==='intermediate'?1:0;
  const deload=phase==='减载';
  const duration=Math.max(20,Math.round(profile.sessionMinutes*(underRecovered ? .82 : deload ? .72 : 1)));
  const exercises=recipe.items.map(([rawId,baseSets,reps,rest],index) => {
    const id=equipmentVariant(rawId,profile);
    const definition=catalog[id];
    const phaseDelta=phase==='积累'&&index<3?1:0;
    const sets=Math.max(1,baseSets+levelDelta+phaseDelta-(underRecovered||deload?1:0)+(progressing&&!deload&&index<2?1:0));
    return {...definition,sets,reps,restSeconds:rest};
  });
  const adjustment=deload
    ? '进入 8 周周期的减载周：每个动作减少 1 组，总时长下调约 28%，为下一周期恢复训练储备。'
    : underRecovered
    ? '根据最近一次完成度或 RPE，今天每个动作减少 1 组、总时长下调约 18%。'
    : progressing
      ? '最近两次完成度高且主观强度适中，今天前两个主动作各增加 1 组。'
      : '按当前目标、训练频率和器械生成；完成后将根据 RPE 与完成度调整下一次。';
  return {
    id:`${date}-${profile.goal}-${slot}`,date,title:recipe.title,focus:recipe.focus,week,phase,
    durationMinutes:duration,estimatedCalories:estimateCalories(recipe.met,profile.weightKg,duration),
    circuit:Boolean(recipe.circuit),recovery:false,adjustment,exercises,
  };
}

export function weekSessions(profile:TrainingProfile,anchor:Date,logs:WorkoutLog[]) {
  const monday=new Date(anchor);
  const offset=(monday.getDay()+6)%7;
  monday.setDate(monday.getDate()-offset);
  return Array.from({length:7},(_,index)=>{
    const date=new Date(monday); date.setDate(monday.getDate()+index);
    return buildSession(profile,date,logs);
  });
}

export function recoveryRecommendations(session:TrainingSession):RecoveryRecommendation[] {
  const targets=session.exercises.map((exercise)=>exercise.target).join(' ');
  const items:RecoveryRecommendation[]=[];
  if(/下肢|大腿|臀腿|髋/.test(targets))items.push({area:'臀腿与髋',stretch:'髋屈肌伸展 + 坐姿大腿后侧伸展，各 30–45 秒 × 2',foam:'臀肌、股四头肌和大腿后侧，每个区域缓慢滚动 45–60 秒',massageGun:'臀大肌、股四头肌肌腹，每处低档 30–45 秒'});
  if(/胸|肩|推|肱三头/.test(targets))items.push({area:'胸肩与肱三头',stretch:'门框胸肌伸展 + 过头肱三头伸展，各 30 秒 × 2',foam:'上背部横向滚动 60 秒；不直接滚压肩关节',massageGun:'胸大肌外侧、后三角肌和肱三头肌肌腹，每处低档 30 秒'});
  if(/背部|拉/.test(targets))items.push({area:'背阔肌与上背',stretch:'跪姿背阔肌伸展 + 抱臂上背伸展，各 30–45 秒 × 2',foam:'背阔肌外侧和胸椎上背，每个区域 45–60 秒',massageGun:'背阔肌外侧、斜方肌中下束肌腹，每处低档 30 秒'});
  if(/核心/.test(targets))items.push({area:'核心与躯干',stretch:'婴儿式呼吸 5 次 + 温和眼镜蛇式 20 秒 × 2',foam:'仅滚动胸椎上背 45 秒，避免直接滚压腰椎和腹部',massageGun:'不直接作用于腹部；可低档放松臀肌和上背各 30 秒'});
  return items.length?items:[{area:'全身恢复',stretch:'轻松步行 5 分钟后做全身舒展，每个动作 30 秒',foam:'主要训练肌群缓慢滚动，每区 45 秒',massageGun:'主要肌群肌腹使用低档，每区 30 秒'}];
}
