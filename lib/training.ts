import { curatedFreeExerciseIds, freeExerciseRecordBySourceId } from './exercise-library.ts';
import { curatedDatasetExerciseIds, datasetExerciseDefinitionById } from './exercises-dataset-library.ts';

export type TrainingGoal = 'fat_loss' | 'strength' | 'hypertrophy' | 'endurance' | 'circuit' | 'functional';
export type TrainingLevel = 'beginner' | 'intermediate';
export type Equipment = 'bodyweight' | 'dumbbell' | 'gym' | 'mixed';
export type TrainingDayCount = 2 | 3 | 4 | 5 | 6;
export type ExerciseRole = 'T1' | 'T2' | 'T3' | 'conditioning' | 'recovery';
export type MainLiftKey = 'bench' | 'squat' | 'deadlift' | 'overheadPress' | 'legPress';
export type MainLiftOneRm = Record<MainLiftKey,number>;

export type TrainingProfile = {
  goal: TrainingGoal;
  level: TrainingLevel;
  equipment: Equipment;
  daysPerWeek: TrainingDayCount;
  sessionMinutes: number;
  weightKg: number;
  mainLift1RM: MainLiftOneRm;
  startDate: string;
  sex?: 'male' | 'female';
  age?: number;
  heightCm?: number;
  dailyActivity?: 'sedentary' | 'light' | 'active';
  sleepHours?: number;
  readiness?: 1 | 2 | 3 | 4 | 5;
  painAreas?: string[];
  cardioActivities?: string[];
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
  images?: string[];
  thumbnail?: string;
  animation?: string;
  attribution?: string;
  source?: 'curated' | 'free-exercise-db' | 'exercises-dataset';
  sourceId?: string;
  level?: string;
  category?: string;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
};

export type ExercisePrescription = ExerciseDefinition & {
  role: ExerciseRole;
  sets: number;
  reps: string;
  restSeconds: number;
  targetRpe: number;
  progressionNote: string;
  suggestedWeightKg?: number;
  loadPercent1RM?: number;
  weightBasis?: string;
};

export type SessionExerciseOverride = {
  exerciseId: string;
  definition?: ExerciseDefinition;
  role: ExerciseRole;
  sets: number;
  reps: string;
  restSeconds: number;
  targetRpe: number;
  suggestedWeightKg?: number;
};

export type DailySessionOverride = {
  date: string;
  exercises: SessionExerciseOverride[];
  updatedAt: number;
};

export type TrainingSession = {
  id: string;
  date: string;
  title: string;
  focus: string;
  week: number;
  phase: '基础' | '积累' | '强化' | '评估' | '减载';
  split: string;
  objective: string;
  evidenceIds: string[];
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
  plannedSets?: number;
  setLogs?: ExerciseSetLog[];
};

export type ExerciseSetLog = {
  setNumber: number;
  completed: boolean;
  weightKg: number;
  reps: string;
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

export type PlanVersion = {
  id: string;
  version: number;
  createdAt: number;
  effectiveFrom: string;
  profile: TrainingProfile;
  reason: string;
  evidenceIds: string[];
  previousVersionId?: string;
};

export type PlanProposal = {
  id: string;
  createdAt: number;
  status: 'pending' | 'accepted' | 'rejected';
  changeType: 'dose' | 'structure';
  summary: string;
  rationale: string[];
  evidenceIds: string[];
  before: TrainingProfile;
  after: TrainingProfile;
  effectiveFrom: string;
};

export type CalendarSession = TrainingSession & {
  planVersionId: string;
  status: 'planned' | 'completed' | 'missed' | 'recovery';
};

export const goalLabels: Record<TrainingGoal,string> = {
  fat_loss:'减脂', strength:'力量', hypertrophy:'增肌', endurance:'耐力', circuit:'循环', functional:'功能性',
};

export const mainLiftLabels:Record<MainLiftKey,string>={
  bench:'杠铃卧推',squat:'深蹲',deadlift:'硬拉',overheadPress:'站姿推举',legPress:'腿举机',
};

export const defaultProfile: TrainingProfile = {
  goal:'strength', level:'beginner', equipment:'gym', daysPerWeek:3,
  sessionMinutes:60, weightKg:65, startDate:new Date().toISOString().slice(0,10),
  mainLift1RM:{bench:0,squat:0,deadlift:0,overheadPress:0,legPress:0},
  dailyActivity:'light',
  sleepHours:7.5, readiness:3, painAreas:[], cardioActivities:[],
};

export const exerciseCatalog: Record<string,ExerciseDefinition> = {
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
  bird_dog:{ id:'bird_dog',name:'鸟狗式',englishName:'Bird Dog',target:'核心 · 对侧稳定',equipment:['bodyweight','dumbbell','gym'],images:['/generated-exercises/bird-dog-gymvisual-style.png'],source:'curated',
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

for(const [exerciseId,sourceId] of Object.entries(curatedFreeExerciseIds)){
  const exercise=exerciseCatalog[exerciseId],source=freeExerciseRecordBySourceId[sourceId];
  if(exercise&&source?.images.length)exerciseCatalog[exerciseId]={...exercise,images:source.images,source:'free-exercise-db',sourceId};
}
for(const [exerciseId,sourceId] of Object.entries(curatedDatasetExerciseIds)){
  const exercise=exerciseCatalog[exerciseId],source=datasetExerciseDefinitionById[`logpress:${sourceId}`];
  if(exercise&&source)exerciseCatalog[exerciseId]={...exercise,thumbnail:source.thumbnail,animation:source.animation,attribution:source.attribution,source:'exercises-dataset',sourceId};
}

const catalog = exerciseCatalog;

type RecipeItem = { id:string; role:ExerciseRole };
type SessionRecipe = { title:string; focus:string; objective:string; met:number; circuit?:boolean; items:RecipeItem[] };

const recipe = (title:string,focus:string,objective:string,items:Array<[string,ExerciseRole]>,met=5.5,circuit=false):SessionRecipe => ({
  title,focus,objective,met,circuit,items:items.map(([id,role])=>({id,role})),
});

const splitRecipes:Record<TrainingDayCount,SessionRecipe[]> = {
  2:[
    recipe('全身 A｜蹲推主导','腿举 · 推胸 · 下拉','全身力量基础与动作技术',[['leg_press','T1'],['bench','T1'],['lat_pulldown','T2'],['leg_curl','T3'],['dead_bug','T3']]),
    recipe('全身 B｜髋拉主导','髋铰链 · 划船 · 肩推','覆盖全身主要动作模式',[['rdl','T1'],['cable_row','T1'],['press','T2'],['leg_extension','T3'],['side_plank','T3']]),
  ],
  3:[
    recipe('推｜胸肩肱三头','卧推 · 肩推 · 夹胸','集中完成上肢推举力量与增肌训练',[['bench','T1'],['press','T2'],['chest_fly','T3'],['triceps','T3'],['dead_bug','T3']]),
    recipe('拉｜背部与握力','下拉 · 划船 · 携带','集中完成垂直拉、水平拉和握力训练',[['lat_pulldown','T1'],['cable_row','T2'],['row','T3'],['carry','T3'],['side_plank','T3']]),
    recipe('腿｜下肢与臀腿','腿举 · 髋铰链 · 屈伸','集中完成下肢蹲推、髋铰链和屈伸训练',[['leg_press','T1'],['rdl','T2'],['leg_curl','T3'],['leg_extension','T3'],['bridge','T3']]),
  ],
  4:[
    recipe('下肢 A｜力量','腿举 · 髋铰链','下肢高质量主项输出',[['leg_press','T1'],['rdl','T2'],['leg_curl','T3'],['leg_extension','T3'],['dead_bug','T3']]),
    recipe('上肢 A｜力量','卧推 · 下拉 · 划船','上肢推拉力量与肩胛控制',[['bench','T1'],['lat_pulldown','T2'],['cable_row','T2'],['triceps','T3'],['side_plank','T3']]),
    recipe('下肢 B｜容量与单腿','单腿 · 后侧链 · 携带','下肢训练量和单侧稳定',[['lunge','T1'],['leg_curl','T2'],['leg_extension','T3'],['bridge','T3'],['carry','conditioning']],6),
    recipe('上肢 B｜容量','肩推 · 胸背辅助','上肢增肌容量与躯干稳定',[['press','T1'],['cable_row','T2'],['chest_fly','T2'],['triceps','T3'],['plank','T3']]),
  ],
  5:[
    recipe('下肢 A｜力量','腿举 · 髋铰链','下肢主项力量',[['leg_press','T1'],['rdl','T2'],['leg_curl','T3'],['dead_bug','T3']]),
    recipe('上肢 A｜力量','卧推 · 下拉','上肢推拉力量',[['bench','T1'],['lat_pulldown','T2'],['cable_row','T2'],['triceps','T3']]),
    recipe('功能体能｜低技术门槛','携带 · 循环 · 抗旋转','工作容量、搬运和核心稳定',[['carry','T1'],['leg_press','T2'],['cable_row','T2'],['side_plank','T3'],['walk','conditioning']],6.5,true),
    recipe('下肢 B｜容量','单腿 · 屈伸 · 后侧链','下肢增肌容量与稳定',[['lunge','T1'],['leg_curl','T2'],['leg_extension','T3'],['bridge','T3']]),
    recipe('上肢 B｜容量','肩推 · 胸背辅助','上肢增肌容量',[['press','T1'],['cable_row','T2'],['chest_fly','T2'],['triceps','T3']]),
  ],
  6:[
    recipe('推 A｜力量','胸 · 肩 · 肱三头','水平推主项力量',[['bench','T1'],['press','T2'],['chest_fly','T3'],['triceps','T3']]),
    recipe('拉 A｜力量','背 · 肱二头 · 握力','垂直拉和水平拉力量',[['lat_pulldown','T1'],['cable_row','T2'],['row','T3'],['carry','T3']]),
    recipe('腿 A｜力量','腿举 · 后侧链','下肢主项力量',[['leg_press','T1'],['rdl','T2'],['leg_curl','T3'],['dead_bug','T3']]),
    recipe('推 B｜容量','肩 · 胸 · 肱三头','上肢推增肌容量',[['press','T1'],['bench','T2'],['chest_fly','T3'],['triceps','T3']]),
    recipe('拉 B｜容量','背部 · 肩胛 · 核心','上肢拉增肌容量',[['cable_row','T1'],['lat_pulldown','T2'],['row','T3'],['side_plank','T3']]),
    recipe('腿 B｜容量','单腿 · 股四头 · 臀腿','下肢增肌容量与单侧稳定',[['lunge','T1'],['leg_extension','T2'],['leg_curl','T2'],['bridge','T3']]),
  ],
};

const weekdaySets: Record<TrainingDayCount,number[]> = {
  2:[1,4], 3:[1,3,5], 4:[1,2,4,6], 5:[1,2,3,5,6], 6:[1,2,3,4,5,6],
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
  if(!['gym','mixed'].includes(profile.equipment)&&gymFallbacks[id])id=gymFallbacks[id];
  if (profile.equipment==='bodyweight') {
    if (id==='squat') return 'body_squat';
    if (id==='row') return 'bird_dog';
    if (id==='rdl') return 'bridge';
    if (id==='press') return 'pushup';
    if (id==='carry') return 'plank';
  }
  if (id==='swing' && !['gym','mixed'].includes(profile.equipment)) return 'rdl';
  return id;
}

export function phaseForWeek(week:number,level:TrainingLevel='intermediate',fatigueSignals=0):TrainingSession['phase'] {
  if (level==='beginner') return fatigueSignals>=2 ? '减载' : '基础';
  const cycleWeek=((Math.max(1,week)-1)%8)+1;
  if(fatigueSignals>=2 && cycleWeek>=4)return '减载';
  if(cycleWeek<=3)return '积累';
  if(cycleWeek===4||cycleWeek===8)return '评估';
  return '强化';
}

export function fatigueSignalCount(profile:TrainingProfile,logs:WorkoutLog[]) {
  const recent=[...logs].sort((a,b)=>b.completedAt-a.completedAt).slice(0,3);
  let signals=0;
  if(recent.length>=2&&recent.slice(0,2).every((log)=>log.completion<.75))signals++;
  if(recent.filter((log)=>log.averageRpe>=9).length>=2)signals++;
  if(recent.some((log)=>/关节|疼|痛|刺|不适/.test(log.note)))signals++;
  if((profile.sleepHours??7.5)<6.5)signals++;
  if((profile.readiness??3)<=2)signals++;
  if((profile.painAreas?.length??0)>0)signals++;
  return signals;
}

function doseFor(goal:TrainingGoal,role:ExerciseRole,phase:TrainingSession['phase']) {
  const strength=goal==='strength';
  const hypertrophy=goal==='hypertrophy';
  const endurance=['endurance','circuit'].includes(goal);
  const conditioning=role==='conditioning';
  let sets=conditioning?1:role==='T1'?4:role==='T2'?3:2;
  let reps=conditioning?'12–20 分钟':role==='T1'?(strength?'4–6 次':hypertrophy?'6–10 次':'8–12 次'):role==='T2'?(strength?'6–10 次':'8–12 次'):'10–15 次';
  let restSeconds=conditioning?60:role==='T1'?(strength?150:120):role==='T2'?90:60;
  let targetRpe=role==='T3'?8:8;
  if(endurance&&!conditioning){reps='12–18 次';restSeconds=45;sets=Math.max(2,sets-1);}
  if(goal==='functional'&&role==='T1'){reps='6–8 次';sets=3;}
  if(goal==='fat_loss'&&!conditioning){reps='8–12 次';restSeconds=Math.min(restSeconds,75);}
  if(phase==='积累'&&role!=='conditioning')sets+=role==='T1'?0:1;
  if(phase==='强化'&&role==='T1'){sets+=1;reps=strength?'3–5 次':'5–8 次';targetRpe=8.5;}
  if(phase==='评估'){sets=Math.max(2,sets-1);targetRpe=7.5;}
  if(phase==='减载'){sets=Math.max(1,Math.ceil(sets*.55));targetRpe=6;restSeconds=Math.max(60,restSeconds);}
  return {sets,reps,restSeconds,targetRpe};
}

function progressionFor(exerciseId:string,role:ExerciseRole,logs:WorkoutLog[]) {
  const recent=[...logs].sort((a,b)=>b.completedAt-a.completedAt)
    .flatMap((log)=>log.exercises.filter((item)=>item.exerciseId===exerciseId)).slice(0,2);
  if(recent.length===2&&recent.every((item)=>exerciseLogRpe(item)>=9||item.completedSets<2))return '连续两次未达最低目标：下次降重 5%–10%，再逐步爬升。';
  if(recent.length===2&&recent.every((item)=>exerciseLogRpe(item)<=8&&item.completedSets>=2))return role==='T1'?'完成目标后加重 2%–5%；若次数下降则保持重量。':'先做到次数区间上限，再加最小配重。';
  return role==='T1'?'保留约 2 次余力；完成全部目标组次后再加重。':'使用双重进阶：先加次数，再加最小配重。';
}

const oneRmBasis:Partial<Record<string,{key:MainLiftKey;factor:number;label:string}>>={
  bench:{key:'bench',factor:1,label:'卧推 1RM'},
  squat:{key:'squat',factor:1,label:'深蹲 1RM'},
  leg_press:{key:'legPress',factor:1,label:'腿举机 1RM'},
  rdl:{key:'deadlift',factor:.72,label:'硬拉 1RM 换算'},
  press:{key:'overheadPress',factor:1,label:'推举 1RM'},
};

function roundLoad(value:number,exerciseId:string) {
  const step=exerciseId==='leg_press'?5:2.5;
  return Math.max(step,Math.round(value/step)*step);
}

function percentFor(goal:TrainingGoal,role:ExerciseRole,phase:TrainingSession['phase']) {
  let percent=goal==='strength'?(role==='T1' ? .72 : .64):goal==='hypertrophy'?(role==='T1' ? .66 : .58):.6;
  if(phase==='积累')percent-=.02;
  if(phase==='强化')percent+=goal==='strength'?.08:.04;
  if(phase==='评估')percent-=.04;
  if(phase==='减载')percent=.52;
  return Math.min(.85,Math.max(.45,percent));
}

function weightPrescription(profile:TrainingProfile,exerciseId:string,role:ExerciseRole,phase:TrainingSession['phase'],sets:number,logs:WorkoutLog[]) {
  if(['conditioning','recovery'].includes(role))return {};
  const recent=[...logs].sort((a,b)=>b.completedAt-a.completedAt)
    .flatMap((log)=>log.exercises.filter((item)=>item.exerciseId===exerciseId&&exerciseLogWeight(item)>0)).slice(0,2);
  const last=recent[0];
  const failed=(item:ExerciseLog)=>exerciseLogRpe(item)>=9.5||item.completedSets<Math.max(1,item.plannedSets??sets);
  const completed=(item:ExerciseLog)=>exerciseLogRpe(item)<=8&&item.completedSets>=Math.max(1,item.plannedSets??sets);
  if(recent.length===2&&recent.every(failed)){
    const lastWeight=exerciseLogWeight(last),suggestedWeightKg=roundLoad(lastWeight*.925,exerciseId);
    return {suggestedWeightKg,weightBasis:`连续两次未完成，较上次最高工作组 ${lastWeight} kg 回退约 7.5%`};
  }
  if(recent.length===2&&recent.every(completed)){
    const increase=role==='T1'?1.025:1.02;
    const lastWeight=exerciseLogWeight(last),suggestedWeightKg=roundLoad(lastWeight*increase,exerciseId);
    return {suggestedWeightKg,weightBasis:`连续两次完成且逐组 RPE 合格，由最高工作组 ${lastWeight} kg 小幅加重`};
  }
  if(last){
    const lastWeight=exerciseLogWeight(last);
    return {suggestedWeightKg:roundLoad(lastWeight,exerciseId),weightBasis:failed(last)?`上次未完成，先保持最高工作组 ${lastWeight} kg 复测`:`沿用上次最高工作组 ${lastWeight} kg`};
  }
  const basis=oneRmBasis[exerciseId];
  const oneRm=basis?(profile.mainLift1RM?.[basis.key]??0):0;
  if(!basis||oneRm<=0)return {weightBasis:'暂无 1RM 或历史重量；首组从 RPE 6–7 的保守重量校准'};
  const percent=percentFor(profile.goal,role,phase);
  const suggestedWeightKg=roundLoad(oneRm*basis.factor*percent,exerciseId);
  return {suggestedWeightKg,loadPercent1RM:Math.round(percent*basis.factor*100),weightBasis:`按${basis.label}与${phase}阶段计算`};
}

function completedSetLogs(item:ExerciseLog) {
  return item.setLogs?.filter((set)=>set.completed)??[];
}

function exerciseLogWeight(item:ExerciseLog) {
  const sets=completedSetLogs(item);
  return sets.length?Math.max(...sets.map((set)=>set.weightKg)):item.weightKg;
}

function exerciseLogRpe(item:ExerciseLog) {
  const sets=completedSetLogs(item);
  return sets.length?Math.max(...sets.map((set)=>set.rpe)):item.rpe;
}

function recoverySession(profile:TrainingProfile,date:string,week:number):TrainingSession {
  const duration=Math.min(30,Math.max(15,Math.round(profile.sessionMinutes*.5)));
  return {
    id:`${date}-recovery`,date,title:'主动恢复',focus:'轻松步行 · 关节活动',objective:'促进恢复，不补做漏掉的高强度训练',week,phase:phaseForWeek(week,profile.level),split:splitLabel(profile.daysPerWeek),evidenceIds:['acsm-2026'],durationMinutes:duration,
    estimatedCalories:estimateCalories(3,profile.weightKg,duration),circuit:false,recovery:true,
    adjustment:'今天是计划恢复日；轻松活动即可，不需要补做高强度训练。',
    exercises:[
      {...catalog.walk,role:'recovery',sets:1,reps:`${duration-5} 分钟`,restSeconds:30,targetRpe:3,progressionNote:'保持能轻松交谈的强度。'},
      {...catalog.bird_dog,role:'recovery',sets:2,reps:'每侧 6 次',restSeconds:30,targetRpe:4,progressionNote:'只增加动作控制，不追求力竭。'},
    ],
  };
}

export function estimateCalories(met:number,weightKg:number,minutes:number) {
  return Math.round(Math.max(1,met)*3.5*Math.max(30,weightKg)/200*Math.max(1,minutes));
}

export function splitLabel(days:TrainingDayCount) {
  return ({2:'每周二练 · 全身 A/B',3:'每周三练 · 推/拉/腿',4:'上下肢二分化 × 2',5:'上下肢四练 + 功能体能',6:'推/拉/腿 × 2'})[days];
}

export function splitSchedule(days:TrainingDayCount) {
  return splitRecipes[days].map((item)=>({
    title:item.title,
    focus:item.focus,
    exercises:item.items.map(({id,role})=>({id,role,name:catalog[id].name})),
  }));
}

export function createCustomExercise(value:string|ExerciseDefinition):ExercisePrescription {
  const exercise=typeof value==='string'?catalog[value]:value;
  if(!exercise)throw new Error(`未知动作：${value}`);
  return {...exercise,role:'T3',sets:3,reps:'8–12 次',restSeconds:60,targetRpe:8,
    progressionNote:'本日临时加入：先在目标次数范围内完成，再根据 RPE 调整重量。',
    weightBasis:'用户临时加入；本次重量由首组 RPE 6–7 校准'};
}

export function applySessionOverride(session:TrainingSession,override?:DailySessionOverride):TrainingSession {
  if(!override||override.date!==session.date)return session;
  const exercises=override.exercises.flatMap((item)=>{
    const definition=item.definition??catalog[item.exerciseId];
    if(!definition)return [];
    const original=session.exercises.find((exercise)=>exercise.id===item.exerciseId);
    return [{
      ...definition,
      role:item.role,
      sets:Math.min(12,Math.max(1,Math.round(item.sets))),
      reps:item.reps.trim()||'8–12 次',
      restSeconds:Math.min(600,Math.max(15,Math.round(item.restSeconds))),
      targetRpe:Math.min(10,Math.max(1,item.targetRpe)),
      ...(item.suggestedWeightKg!==undefined?{suggestedWeightKg:Math.max(0,item.suggestedWeightKg)}:{}),
      progressionNote:original?.progressionNote??'本日临时加入：先在目标次数范围内完成，再根据 RPE 调整重量。',
      weightBasis:item.suggestedWeightKg!==undefined?'用户为本日手动设置重量':original?.weightBasis??'本次重量由首组 RPE 6–7 校准',
    }];
  });
  return {...session,title:session.recovery?'自定义训练':session.title,recovery:false,exercises,focus:exercises.map((item)=>item.name).join(' · '),
    adjustment:'本日动作和组次由你手动修改；只覆盖这一天，不改变周期模板或其他日期。'};
}

export function buildSession(profile:TrainingProfile,dateValue:Date,logs:WorkoutLog[]):TrainingSession {
  const date=localDate(dateValue);
  const elapsed=daysBetween(profile.startDate,date);
  const week=Math.floor(elapsed/7)+1;
  const weekdays=weekdaySets[profile.daysPerWeek];
  const weekday=dateValue.getDay();
  if (!weekdays.includes(weekday)) return recoverySession(profile,date,week);

  const slot=weekdays.indexOf(weekday);
  const list=splitRecipes[profile.daysPerWeek];
  const selected=list[slot%list.length];
  const signals=fatigueSignalCount(profile,logs);
  const phase=phaseForWeek(week,profile.level,signals);
  const deload=phase==='减载';
  const duration=Math.max(20,Math.round(profile.sessionMinutes*(deload?.65:phase==='评估'?.85:1)));
  const maxItems=duration<40?4:selected.items.length;
  const exercises=selected.items.slice(0,maxItems).map(({id:rawId,role}) => {
    const id=equipmentVariant(rawId,profile);
    const definition=catalog[id];
    const dose=doseFor(profile.goal,role,phase);
    const weight=weightPrescription(profile,id,role,phase,dose.sets,logs);
    return {...definition,role,...dose,...weight,progressionNote:progressionFor(id,role,logs)};
  });
  const adjustment=deload
    ? `检测到 ${signals} 项累计疲劳信号，生成主动减载建议：保留动作，工作组数降低约 30%–50%，目标 RPE 6。`
    : profile.level==='beginner'
      ? '新手采用主项线性进阶、辅助动作双重进阶；不机械安排整周减载，单动作连续失败两次才降重。'
      : phase==='评估'
        ? '本周为评估检查点：减少少量训练量并核对 e1RM、RPE、完成率和恢复；没有累计疲劳就不自动减载。'
        : `当前为${phase}阶段；按 RPE/RIR 和最近两次动作表现决定保持、加重或单动作回退。`;
  return {
    id:`${date}-${profile.goal}-${slot}`,date,title:selected.title,focus:selected.focus,objective:selected.objective,week,phase,split:splitLabel(profile.daysPerWeek),evidenceIds:['acsm-2026',profile.goal==='hypertrophy'?'iusca-2021':'autoreg-2021'],
    durationMinutes:duration,estimatedCalories:estimateCalories(selected.met,profile.weightKg,duration),
    circuit:Boolean(selected.circuit||profile.goal==='circuit'),recovery:false,adjustment,exercises,
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

function nextMonday(dateValue:Date) {
  const value=new Date(dateValue);
  const days=(8-value.getDay())%7||7;
  value.setDate(value.getDate()+days);
  return localDate(value);
}

export function createPlanProposal(before:TrainingProfile,after:TrainingProfile,summary:string,rationale:string[],changeType:'dose'|'structure',now=new Date()):PlanProposal {
  return {
    id:`proposal-${now.getTime()}`,createdAt:now.getTime(),status:'pending',changeType,summary,rationale,
    evidenceIds:['acsm-2026','autoreg-2021',...(rationale.some((item)=>item.includes('减载'))?['deload-2022']:[])],
    before,after,effectiveFrom:changeType==='structure'?nextMonday(now):localDate(now),
  };
}

export function acceptPlanProposal(proposal:PlanProposal,versions:PlanVersion[],now=Date.now()) {
  const previous=versions.at(-1);
  const version:PlanVersion={
    id:`plan-v${(previous?.version??0)+1}-${now}`,version:(previous?.version??0)+1,createdAt:now,
    effectiveFrom:proposal.effectiveFrom,profile:proposal.after,reason:proposal.summary,evidenceIds:proposal.evidenceIds,
    previousVersionId:previous?.id,
  };
  return {proposal:{...proposal,status:'accepted' as const},version,versions:[...versions,version]};
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
