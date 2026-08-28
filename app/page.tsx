'use client';
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from 'react';
import { enrichModelMeal, Meal, parseModelJson, recalculateMeal } from '@/lib/nutrition';
import {
  buildSession, defaultProfile, Equipment, ExerciseDefinition, ExerciseLog, goalLabels,
  recoveryRecommendations, TrainingGoal, TrainingProfile, TrainingSession, WorkoutLog,
} from '@/lib/training';

type Tab = 'today' | 'plan' | 'nutrition' | 'body' | 'settings';
type Settings = { endpoint:string; model:string; apiKey:string; target:number };
type WgerMedia = { image?:string; video?:string; author:string; license:string; licenseUrl:string; description:string };
type BodyMetric = { id:string;date:string;weightKg:number;bodyFatPercent:number;muscleMassKg:number;visceralFat:number;bmr:number;source:'report'|'manual';confidence:number;note:string;createdAt:number };
type CoachPlan = { goal:TrainingGoal;daysPerWeek:3|4|5;sessionMinutes:number;cycle:string;deload:string;rationale:string[];nutritionFocus:string };

const SETTINGS_KEY='calorielens.settings.v1';
const MEALS_KEY='calorielens.meals.v1';
const PROFILE_KEY='liantu.profile.v2';
const LOGS_KEY='liantu.workouts.v1';
const BODY_KEY='liantu.body-metrics.v1';

const defaultSettings:Settings={
  endpoint:'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  model:'glm-5v-turbo',apiKey:'',target:2000,
};

const localExerciseMedia:Record<string,WgerMedia>={
  leg_press:{image:'/exercises/wger/leg-press.png',author:'wger community',license:'CC-BY-SA 4',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/deed.en',description:''},
  bench:{image:'/exercises/wger/bench-press.png',author:'Everkinetic',license:'CC-BY-SA 3',licenseUrl:'https://creativecommons.org/licenses/by-sa/3.0/deed.en',description:''},
  lat_pulldown:{image:'/exercises/wger/lat-pulldown.jpg',author:'Franpol',license:'CC-BY-SA 4',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/deed.en',description:''},
  leg_curl:{image:'/exercises/wger/leg-curl.jpg',author:'Everkinetic',license:'CC-BY-SA 3',licenseUrl:'https://creativecommons.org/licenses/by-sa/3.0/deed.en',description:''},
  leg_extension:{image:'/exercises/wger/leg-extension.jpg',author:'Franpol',license:'CC-BY-SA 4',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/deed.en',description:''},
  cable_row:{image:'/exercises/wger/cable-row.jpg',author:'Franpol',license:'CC-BY-SA 4',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/deed.en',description:''},
  press:{image:'/exercises/wger/shoulder-press.jpg',author:'Everkinetic',license:'CC-BY-SA 3',licenseUrl:'https://creativecommons.org/licenses/by-sa/3.0/deed.en',description:''},
  triceps:{image:'/exercises/wger/triceps-pushdown.jpg',author:'anto.kreegyr',license:'CC-BY-SA 4',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/deed.en',description:''},
  chest_fly:{image:'/exercises/wger/chest-fly.png',author:'wger community',license:'CC-BY-SA 4',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/deed.en',description:''},
};

const localDateKey=(time:number|Date) => {
  const date=time instanceof Date?time:new Date(time);
  const year=date.getFullYear(),month=String(date.getMonth()+1).padStart(2,'0'),day=String(date.getDate()).padStart(2,'0');
  return `${year}-${month}-${day}`;
};
const dateTitle=(date:Date) => date.toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'});
const fixed=(value:number,digits=0) => value.toLocaleString('zh-CN',{maximumFractionDigits:digits,minimumFractionDigits:digits});

async function imageToData(file:File) {
  const objectUrl=URL.createObjectURL(file);
  try {
    const image=await new Promise<HTMLImageElement>((resolve,reject)=>{
      const value=new Image(); value.onload=()=>resolve(value); value.onerror=()=>reject(new Error('无法读取这张图片')); value.src=objectUrl;
    });
    const scale=Math.min(1,1024/Math.max(image.width,image.height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(image.width*scale)); canvas.height=Math.max(1,Math.round(image.height*scale));
    canvas.getContext('2d')?.drawImage(image,0,0,canvas.width,canvas.height);
    return canvas.toDataURL('image/jpeg',.84);
  } finally { URL.revokeObjectURL(objectUrl); }
}

function testImageData() {
  const canvas=document.createElement('canvas'); canvas.width=360; canvas.height=220;
  const context=canvas.getContext('2d'); if(!context)return '';
  context.fillStyle='#df554d';context.fillRect(0,0,180,220);context.fillStyle='#3e77cf';context.fillRect(180,0,180,220);
  context.fillStyle='white';context.font='bold 28px sans-serif';context.fillText('视觉测试',118,122);
  return canvas.toDataURL('image/jpeg',.86);
}

async function proxy(body:Record<string,unknown>) {
  const response=await fetch('/api/bigmodel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const payload=await response.json() as {error?:string;content?:string;models?:string[]};
  if(!response.ok)throw new Error(payload.error||'请求失败，请稍后重试');
  return payload;
}

export default function Home() {
  const now=useMemo(()=>new Date(),[]);
  const [tab,setTab]=useState<Tab>('today');
  const [settings,setSettings]=useState<Settings>(defaultSettings);
  const [profile,setProfile]=useState<TrainingProfile>(defaultProfile);
  const [meals,setMeals]=useState<Meal[]>([]);
  const [logs,setLogs]=useState<WorkoutLog[]>([]);
  const [bodyMetrics,setBodyMetrics]=useState<BodyMetric[]>([]);
  const [imageData,setImageData]=useState('');
  const [currentMeal,setCurrentMeal]=useState<Meal|null>(null);
  const [models,setModels]=useState<string[]>([]);
  const [busy,setBusy]=useState('');
  const [notice,setNotice]=useState('');
  const [coachNote,setCoachNote]=useState('');
  const [coachPlan,setCoachPlan]=useState<CoachPlan|null>(null);
  const [installOpen,setInstallOpen]=useState(false);
  const [ready,setReady]=useState(false);
  const [activeSession,setActiveSession]=useState<TrainingSession|null>(null);
  const [activeLogs,setActiveLogs]=useState<ExerciseLog[]>([]);
  const [workoutNote,setWorkoutNote]=useState('');
  const [detail,setDetail]=useState<ExerciseDefinition|null>(null);
  const [media,setMedia]=useState<WgerMedia|null>(null);
  const [recoveryAfter,setRecoveryAfter]=useState<TrainingSession|null>(null);
  const [calendarMonth,setCalendarMonth]=useState(()=>new Date(now.getFullYear(),now.getMonth(),1));
  const [selectedPlanDate,setSelectedPlanDate]=useState(localDateKey(now));
  const [bodyImageData,setBodyImageData]=useState('');
  const [pendingBody,setPendingBody]=useState<Omit<BodyMetric,'id'|'createdAt'>>({date:localDateKey(new Date()),weightKg:0,bodyFatPercent:0,muscleMassKg:0,visceralFat:0,bmr:0,source:'manual',confidence:100,note:''});

  useEffect(()=>{
    if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>undefined);
    queueMicrotask(()=>{
      try{
        const savedSettings=localStorage.getItem(SETTINGS_KEY),savedMeals=localStorage.getItem(MEALS_KEY);
        const savedProfile=localStorage.getItem(PROFILE_KEY),savedLogs=localStorage.getItem(LOGS_KEY),savedBody=localStorage.getItem(BODY_KEY);
        if(savedSettings)setSettings({...defaultSettings,...JSON.parse(savedSettings)});
        if(savedMeals)setMeals(JSON.parse(savedMeals));
        if(savedProfile)setProfile({...defaultProfile,...JSON.parse(savedProfile)});
        if(savedLogs)setLogs(JSON.parse(savedLogs));
        if(savedBody)setBodyMetrics(JSON.parse(savedBody));
      }catch{setNotice('部分本机记录无法读取，已使用默认设置');}
      setReady(true);
    });
  },[]);
  useEffect(()=>{if(ready)localStorage.setItem(MEALS_KEY,JSON.stringify(meals));},[meals,ready]);
  useEffect(()=>{if(ready)localStorage.setItem(LOGS_KEY,JSON.stringify(logs));},[logs,ready]);
  useEffect(()=>{if(ready)localStorage.setItem(PROFILE_KEY,JSON.stringify(profile));},[profile,ready]);
  useEffect(()=>{if(ready)localStorage.setItem(BODY_KEY,JSON.stringify(bodyMetrics));},[bodyMetrics,ready]);
  useEffect(()=>{
    setMedia(null);
    const local=detail?localExerciseMedia[detail.id]:null;
    if(local){setMedia(local);return;}
    if(detail?.id==='dead_bug')return;
    if(!detail?.wgerId)return;
    fetch(`/api/wger?id=${detail.wgerId}`).then(async(response)=>{
      if(!response.ok)throw new Error('动作媒体加载失败');
      return await response.json() as WgerMedia;
    }).then((value)=>setMedia(value)).catch(()=>setMedia(null));
  },[detail]);

  const todayKey=localDateKey(now);
  const todayMeals=useMemo(()=>meals.filter((meal)=>localDateKey(meal.timestamp)===todayKey),[meals,todayKey]);
  const totals=useMemo(()=>todayMeals.reduce((sum,meal)=>({
    calories:sum.calories+meal.calories,protein:sum.protein+meal.protein,carbs:sum.carbs+meal.carbs,fat:sum.fat+meal.fat,
  }),{calories:0,protein:0,carbs:0,fat:0}),[todayMeals]);
  const todaySession=useMemo(()=>buildSession(profile,now,logs),[profile,now,logs]);
  const calendar=useMemo(()=>{
    const first=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth(),1);
    const start=new Date(first);start.setDate(first.getDate()-((first.getDay()+6)%7));
    return Array.from({length:42},(_,index)=>{const date=new Date(start);date.setDate(start.getDate()+index);return {date,session:buildSession(profile,date,logs),inMonth:date.getMonth()===calendarMonth.getMonth()};});
  },[calendarMonth,profile,logs]);
  const selectedSession=useMemo(()=>buildSession(profile,new Date(`${selectedPlanDate}T12:00:00`),logs),[profile,selectedPlanDate,logs]);
  const todayLogs=useMemo(()=>logs.filter((log)=>log.date===todayKey),[logs,todayKey]);
  const sortedBody=useMemo(()=>[...bodyMetrics].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt),[bodyMetrics]);
  const latestBody=sortedBody[0];
  const burned=todayLogs.reduce((sum,log)=>sum+log.caloriesBurned,0);
  const netBudget=settings.target+burned-totals.calories;
  const nutritionProgress=Math.min(100,totals.calories/Math.max(1,settings.target)*100);

  const saveSettings=()=>{localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));setNotice('设置已保存在这台设备');};
  const choosePhoto=async(file?:File)=>{
    if(!file)return;setBusy('正在处理照片…');setNotice('');setCurrentMeal(null);
    try{setImageData(await imageToData(file));}catch(error){setNotice(error instanceof Error?error.message:'无法读取图片');}finally{setBusy('');}
  };
  const analyze=async()=>{
    if(!imageData)return setNotice('请先拍照或选择一张照片');
    if(!settings.apiKey.trim()){setTab('settings');return setNotice('请先填写 API 密钥');}
    setBusy('正在识别食物并计算营养…');setNotice('');
    try{
      const payload=await proxy({action:'analyze',...settings,imageData});
      const meal=enrichModelMeal(parseModelJson(payload.content||''));
      if(meal.calories<=0)throw new Error('本地数据库和模型估算均未得到可计算结果');
      setCurrentMeal(meal);
    }catch(error){setNotice(error instanceof Error?error.message:'分析失败，请重试');}finally{setBusy('');}
  };
  const updateGrams=(id:string,value:string)=>{
    if(!currentMeal)return;const grams=Math.max(0,Number.parseFloat(value)||0);
    setCurrentMeal(recalculateMeal(currentMeal,currentMeal.items.map((item)=>item.id===id?{...item,grams}:item)));
  };
  const saveMeal=()=>{if(!currentMeal)return;setMeals((items)=>[{...currentMeal,timestamp:Date.now()},...items]);setCurrentMeal(null);setImageData('');setNotice('已记入今天，训练能量页已同步');};
  const fetchModels=async()=>{
    setBusy('正在获取模型列表…');setNotice('');
    try{const payload=await proxy({action:'models',...settings});setModels(payload.models||[]);setNotice(`已获取 ${payload.models?.length||0} 个模型`);}catch(error){setNotice(error instanceof Error?error.message:'获取失败');}finally{setBusy('');}
  };
  const probe=async()=>{
    setBusy('正在验证图片能力…');setNotice('');
    try{const payload=await proxy({action:'probe',...settings,imageData:imageData||testImageData()});setNotice(`图片测试通过：${(payload.content||'').slice(0,120)}`);}catch(error){setNotice(error instanceof Error?error.message:'测试失败');}finally{setBusy('');}
  };
  const askCoach=async()=>{
    if(!settings.apiKey.trim()){setTab('settings');return setNotice('请先填写 API 密钥');}
    setBusy('教练正在结合训练和饮食记录…');setNotice('');
    try{
      const payload=await proxy({action:'coach',...settings,profile,session:todaySession,nutrition:{...totals,target:settings.target,burned},recentLogs:logs.slice(0,5),bodyMetrics:sortedBody.slice(0,6)});
      setCoachNote(payload.content||'暂无建议');
    }catch(error){setNotice(error instanceof Error?error.message:'教练建议生成失败');}finally{setBusy('');}
  };
  const chooseBodyReport=async(file?:File)=>{
    if(!file)return;setBusy('正在处理体成分报告…');setNotice('');
    try{setBodyImageData(await imageToData(file));}catch(error){setNotice(error instanceof Error?error.message:'无法读取报告图片');}finally{setBusy('');}
  };
  const analyzeBodyReport=async()=>{
    if(!bodyImageData)return setNotice('请先选择八电极体成分报告截图');
    if(!settings.apiKey.trim()){setTab('settings');return setNotice('请先填写 API 密钥');}
    setBusy('正在读取报告中的日期和体成分数据…');setNotice('');
    try{
      const payload=await proxy({action:'bodyReport',...settings,imageData:bodyImageData});
      const raw=JSON.parse((payload.content||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'')) as Record<string,unknown>;
      const number=(key:string)=>Math.max(0,Number(raw[key])||0);
      setPendingBody({date:/^\d{4}-\d{2}-\d{2}$/.test(String(raw.date||''))?String(raw.date):todayKey,
        weightKg:number('weightKg'),bodyFatPercent:number('bodyFatPercent'),muscleMassKg:number('muscleMassKg'),
        visceralFat:number('visceralFat'),bmr:number('bmr'),source:'report',confidence:Math.min(100,Math.max(0,number('confidence'))),note:String(raw.note||'')});
      setNotice('识别完成，请核对数值和测量日期后保存');
    }catch(error){setNotice(error instanceof Error?error.message:'报告识别失败');}finally{setBusy('');}
  };
  const saveBodyMetric=()=>{
    if(!pendingBody.weightKg&&!pendingBody.bodyFatPercent&&!pendingBody.muscleMassKg)return setNotice('请至少填写体重、体脂率或肌肉量中的一项');
    const record:BodyMetric={...pendingBody,id:crypto.randomUUID(),createdAt:Date.now()};
    setBodyMetrics((items)=>[record,...items]);setBodyImageData('');
    setPendingBody({...pendingBody,source:'manual',confidence:100,note:''});
    setNotice(`已按 ${record.date} 保存体成分记录，综合计划会自动读取`);
  };
  const generateCoachPlan=async()=>{
    if(!settings.apiKey.trim()){setTab('settings');return setNotice('请先填写 API 密钥');}
    setBusy('正在综合训练、饮食与体成分趋势制定计划…');setNotice('');
    try{
      const payload=await proxy({action:'plan',...settings,profile,currentSession:todaySession,recentLogs:logs.slice(0,8),nutrition:{...totals,target:settings.target,burned},bodyMetrics:sortedBody.slice(0,8)});
      const raw=JSON.parse((payload.content||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'')) as CoachPlan;
      if(!Object.keys(goalLabels).includes(raw.goal)||![3,4,5].includes(raw.daysPerWeek))throw new Error('模型返回的计划参数无效');
      setCoachPlan({...raw,sessionMinutes:Math.min(120,Math.max(20,Number(raw.sessionMinutes)||45)),rationale:Array.isArray(raw.rationale)?raw.rationale:[]});
    }catch(error){setNotice(error instanceof Error?error.message:'综合计划生成失败');}finally{setBusy('');}
  };
  const applyCoachPlan=()=>{
    if(!coachPlan)return;
    setProfile({...profile,goal:coachPlan.goal,daysPerWeek:coachPlan.daysPerWeek,sessionMinutes:coachPlan.sessionMinutes,startDate:todayKey});
    setNotice('综合计划已应用，今天和本周安排已重新生成');
  };

  const beginWorkout=(session=todaySession)=>{
    setActiveSession(session);setWorkoutNote('');
    setActiveLogs(session.exercises.map((exercise)=>({exerciseId:exercise.id,completedSets:0,reps:exercise.reps,weightKg:0,rpe:7})));
  };
  const updateActive=(exerciseId:string,patch:Partial<ExerciseLog>)=>setActiveLogs((items)=>items.map((item)=>item.exerciseId===exerciseId?{...item,...patch}:item));
  const finishWorkout=()=>{
    if(!activeSession)return;
    const planned=activeSession.exercises.reduce((sum,item)=>sum+item.sets,0);
    const completed=activeLogs.reduce((sum,item)=>sum+item.completedSets,0);
    if(completed===0)return setNotice('至少完成一组后再保存训练');
    const used=activeLogs.filter((item)=>item.completedSets>0);
    const completion=Math.min(1,completed/Math.max(1,planned));
    const averageRpe=used.reduce((sum,item)=>sum+item.rpe,0)/used.length;
    const duration=Math.max(5,Math.round(activeSession.durationMinutes*completion));
    const log:WorkoutLog={id:crypto.randomUUID(),date:todayKey,sessionId:activeSession.id,title:activeSession.title,
      durationMinutes:duration,caloriesBurned:Math.round(activeSession.estimatedCalories*completion),completion,averageRpe,
      exercises:activeLogs,note:workoutNote,completedAt:Date.now()};
    setLogs((items)=>[log,...items]);setRecoveryAfter(activeSession);setActiveSession(null);setNotice(`训练已保存，估算消耗 ${log.caloriesBurned} kcal；下一次计划已重新计算`);
  };

  const titles:Record<Tab,string>={today:'今日训练',plan:'训练计划',nutrition:'热量镜',body:'身体趋势',settings:'我的设置'};
  return <main className="app-shell">
    <header className="topbar"><div><p className="eyebrow">练途 · TRAIN WITH A PLAN</p><h1>{titles[tab]}</h1></div>{tab!=='today'&&<button className="text-button" onClick={()=>setTab('today')}>完成</button>}</header>
    {notice&&<div className="notice" role="status"><span>{notice}</span><button onClick={()=>setNotice('')} aria-label="关闭提示">×</button></div>}
    {busy&&<div className="busy" role="status"><i/><span>{busy}</span></div>}

    {tab==='today'&&<>
      <section className="plan-identity"><div><p className="section-kicker">你的自适应计划</p><h2>{goalLabels[profile.goal]} · {profile.daysPerWeek} 练 / 周</h2><p>第 {todaySession.week} 周 · {profile.level==='beginner'?'基础期':'进阶期'} · {profile.equipment==='bodyweight'?'徒手':profile.equipment==='dumbbell'?'哑铃':'健身房'}</p></div><button onClick={()=>setTab('plan')}>计划依据 ›</button></section>
      <section className="training-hero">
        <div className="training-date"><span>{dateTitle(now)}</span><em>第 {todaySession.week} 周 · {goalLabels[profile.goal]}</em></div>
        <p className="section-kicker">{todaySession.recovery?'恢复安排':'今天练什么'}</p><h2>{todaySession.title}</h2><p>{todaySession.focus}</p>
        <div className="training-metrics"><span><b>{todaySession.durationMinutes}</b> 分钟</span><span><b>{todaySession.exercises.length}</b> 个动作</span><span><b>≈{todaySession.estimatedCalories}</b> kcal</span></div>
        <button className="training-start" onClick={()=>beginWorkout()}>{todayLogs.length?'再练一次':'开始训练'}<span>→</span></button>
      </section>
      <section className="energy-card">
        <div className="section-row"><div><p className="section-kicker">能量联动</p><h2>摄入与消耗</h2></div><button onClick={()=>setTab('nutrition')}>打开热量镜</button></div>
        <div className="energy-equation"><span><b>{fixed(totals.calories)}</b>已摄入</span><i>−</i><span><b>{burned}</b>训练消耗</span><i>=</i><span className="net"><b>{fixed(totals.calories-burned)}</b>净摄入</span></div>
        <div className="energy-bar"><i style={{width:`${Math.min(100,totals.calories/Math.max(1,settings.target+burned)*100)}%`}}/></div>
        <p>按当前目标还可安排约 <strong>{fixed(netBudget)} kcal</strong>；训练消耗为基于体重、时长和 MET 的估算值。</p>
      </section>
      <section className="session-list-card"><div className="section-row"><div><p className="section-kicker">本次内容</p><h2>{todaySession.circuit?'按轮循环':'按顺序完成'}</h2></div><span>{todaySession.exercises.reduce((sum,item)=>sum+item.sets,0)} 组</span></div>
        <div className="exercise-preview-list">{todaySession.exercises.map((exercise,index)=><button key={exercise.id} onClick={()=>setDetail(exercise)}><ExerciseThumb exercise={exercise}/><span>{String(index+1).padStart(2,'0')}</span><div><b>{exercise.name}</b><small>{exercise.sets} 组 × {exercise.reps} · 休息 {exercise.restSeconds} 秒</small></div><i>›</i></button>)}</div>
      </section>
      <section className="adjust-card"><div className="coach-orb">↗</div><div><p className="section-kicker">自适应计划</p><h2>为什么今天这样练</h2><p>{todaySession.adjustment}</p>{coachNote&&<blockquote>{coachNote}</blockquote>}<button onClick={askCoach}>用大模型分析今天记录</button></div></section>
      {logs.length>0&&<section className="history-card"><div className="section-row"><div><p className="section-kicker">最近训练</p><h2>完成记录</h2></div></div>{logs.slice(0,3).map((log)=><article key={log.id}><div><b>{log.title}</b><small>{new Date(log.completedAt).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</small></div><span>{Math.round(log.completion*100)}% · RPE {fixed(log.averageRpe,1)}</span></article>)}</section>}
    </>}

    {tab==='plan'&&<section className="plan-stack">
      <section className="prescription-card"><div className="prescription-head"><div><p className="section-kicker">当前训练处方</p><h2>{goalLabels[profile.goal]}基础 · 第 {todaySession.week} 周</h2></div><span>动态</span></div><div className="prescription-flow"><div><b>目标</b><span>{goalLabels[profile.goal]}</span></div><i>→</i><div><b>结构</b><span>力量 + 耐力</span></div><i>→</i><div><b>反馈</b><span>每次调整</span></div></div><ul><li>每天按实时日期分配训练或主动恢复</li><li>低完成度或 RPE ≥ 8.8 时自动减组并缩短时长</li><li>连续两次完成度 ≥ 90% 且 RPE ≤ 7.5 时增加主动作训练量</li><li>饮食与体成分趋势进入大模型综合计划分析</li></ul></section>
      <section className="cycle-map"><div className="section-row"><div><p className="section-kicker">系统安排周期</p><h2>8 周训练循环</h2></div><span>当前：{todaySession.phase}</span></div><div>{Array.from({length:8},(_,index)=>{const weekNumber=index+1;const phase=weekNumber<=2?'基础':weekNumber<=5?'积累':weekNumber<=7?'强化':'减载';const current=((todaySession.week-1)%8)+1===weekNumber;return <article key={weekNumber} className={`${phase} ${current?'current':''}`}><b>W{weekNumber}</b><small>{phase}</small></article>;})}</div><p>基础期建立动作与负荷；积累期增加主要器械动作训练量；强化期集中主项；第 8 周自动减载后进入下一循环。</p></section>
      <section className="goal-card"><p className="section-kicker">训练目标</p><h2>计划首先围绕什么？</h2><div className="goal-grid">{(Object.keys(goalLabels) as TrainingGoal[]).map((goal)=><button key={goal} className={profile.goal===goal?'active':''} onClick={()=>setProfile({...profile,goal})}>{goalLabels[goal]}</button>)}</div></section>
      <section className="training-modes"><article><span>力</span><div><b>力量训练</b><small>蹲、推、拉、髋伸，按 RPE 渐进</small></div></article><article><span>耐</span><div><b>耐力训练</b><small>稳态有氧与短间歇交替</small></div></article><article><span>循</span><div><b>循环训练</b><small>全身动作连续完成，控制组间休息</small></div></article><article><span>功</span><div><b>功能性训练</b><small>单腿、携带、抗旋转与移动能力</small></div></article><article className="deload"><span>减</span><div><b>自动减载</b><small>高疲劳或低完成度时减少训练量，不作为长期目标</small></div></article></section>
      <section className="calendar-card"><header><button aria-label="上个月" onClick={()=>setCalendarMonth(new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()-1,1))}>‹</button><div><p className="section-kicker">周期日历</p><h2>{calendarMonth.toLocaleDateString('zh-CN',{year:'numeric',month:'long'})}</h2></div><button aria-label="下个月" onClick={()=>setCalendarMonth(new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+1,1))}>›</button></header><div className="calendar-weekdays">{['一','二','三','四','五','六','日'].map((item)=><span key={item}>{item}</span>)}</div><div className="calendar-grid">{calendar.map(({date,session,inMonth})=>{const key=localDateKey(date);return <button key={key} className={`${inMonth?'':'outside'} ${key===todayKey?'today':''} ${key===selectedPlanDate?'selected':''} ${session.recovery?'rest':'train'}`} onClick={()=>setSelectedPlanDate(key)}><b>{date.getDate()}</b><small>{session.phase}</small><em>{session.recovery?'恢复':goalLabels[profile.goal]}</em></button>;})}</div><div className="phase-legend"><span><i className="base"/>基础</span><span><i className="build"/>积累</span><span><i className="peak"/>强化</span><span><i className="deload"/>减载</span></div></section>
      <section className="selected-day-card"><div className="section-row"><div><p className="section-kicker">{selectedPlanDate} · {selectedSession.phase}期</p><h2>{selectedSession.title}</h2></div><span>{selectedSession.recovery?'恢复日':`${selectedSession.durationMinutes} 分钟`}</span></div><p>{selectedSession.focus}</p><div>{selectedSession.exercises.map((exercise)=><button key={exercise.id} onClick={()=>setDetail(exercise)}><ExerciseThumb exercise={exercise}/><span><b>{exercise.name}</b><small>{exercise.sets} 组 × {exercise.reps}</small></span><i>›</i></button>)}</div>{selectedPlanDate===todayKey&&<button className="primary-action action-button" onClick={()=>beginWorkout(selectedSession)}>开始今天训练</button>}</section>
      <section className="plan-settings"><p className="section-kicker">计划参数</p><div className="segment-row"><span>每周训练</span><div>{([3,4,5] as const).map((days)=><button key={days} className={profile.daysPerWeek===days?'active':''} onClick={()=>setProfile({...profile,daysPerWeek:days})}>{days} 天</button>)}</div></div><div className="segment-row"><span>器械条件</span><div>{([['bodyweight','徒手'],['dumbbell','哑铃'],['gym','健身房']] as [Equipment,string][]).map(([value,label])=><button key={value} className={profile.equipment===value?'active':''} onClick={()=>setProfile({...profile,equipment:value})}>{label}</button>)}</div></div></section>
      <section className="ai-plan-card"><div className="coach-orb">AI</div><div><p className="section-kicker">综合制定计划</p><h2>训练 + 饮食 + 体成分</h2><p>读取最近训练完成度、RPE、热量镜记录和八电极报告趋势，生成可核对再应用的计划参数。</p><button onClick={generateCoachPlan}>生成综合计划</button></div></section>
      {coachPlan&&<section className="proposal-card"><div className="section-row"><div><p className="section-kicker">待应用建议</p><h2>{goalLabels[coachPlan.goal]} · {coachPlan.daysPerWeek} 练 / 周</h2></div><span>{coachPlan.sessionMinutes} 分钟</span></div><p><b>周期：</b>{coachPlan.cycle}</p><p><b>减载：</b>{coachPlan.deload}</p><ul>{coachPlan.rationale.map((item)=><li key={item}>{item}</li>)}</ul><p><b>饮食重点：</b>{coachPlan.nutritionFocus}</p><button className="primary-action action-button" onClick={applyCoachPlan}>应用到我的计划</button></section>}
    </section>}

    {tab==='nutrition'&&<>
      <section className="nutrition-summary"><div className="calorie-ring" style={{'--progress':`${nutritionProgress*3.6}deg`} as React.CSSProperties}><span>今日已记录</span><strong>{fixed(totals.calories)}</strong><small>/ {settings.target} kcal</small></div><div className="macro-list"><div><i className="protein"/><span>蛋白质</span><b>{fixed(totals.protein,1)}g</b></div><div><i className="carbs"/><span>碳水</span><b>{fixed(totals.carbs,1)}g</b></div><div><i className="fat"/><span>脂肪</span><b>{fixed(totals.fat,1)}g</b></div></div></section>
      {!currentMeal&&<section className="capture-card">{imageData?<img className="photo-preview" src={imageData} alt="待分析的餐食照片"/>:<div className="camera-mark">⌾</div>}<p className="section-kicker">热量镜 · 本地营养优先</p><h2>{imageData?'照片已准备好':'拍下这一餐'}</h2><p className="muted">识别食物后逐项校正克数，记录会立即进入训练能量页。</p><label className={imageData?'secondary-action':'primary-action'}><input type="file" accept="image/*" capture="environment" onChange={(event)=>choosePhoto(event.target.files?.[0])}/>{imageData?'重新选择照片':'拍照或选择照片'}</label>{imageData&&<button className="primary-action action-button" onClick={analyze}>开始分析</button>}</section>}
      {currentMeal&&<ResultCard meal={currentMeal} imageData={imageData} updateGrams={updateGrams} saveMeal={saveMeal} reset={()=>{setCurrentMeal(null);setImageData('');}}/>}
      <Diary meals={meals} onDelete={(id)=>setMeals((items)=>items.filter((meal)=>meal.id!==id))}/>
    </>}

    {tab==='body'&&<section className="body-stack">
      <section className="body-overview"><div><p className="section-kicker">最新体成分</p><h2>{latestBody?latestBody.date:'等待首次记录'}</h2></div>{latestBody?<div className="body-metrics"><article><span>体重</span><b>{fixed(latestBody.weightKg,1)}<small> kg</small></b></article><article><span>体脂率</span><b>{fixed(latestBody.bodyFatPercent,1)}<small> %</small></b></article><article><span>肌肉量</span><b>{fixed(latestBody.muscleMassKg,1)}<small> kg</small></b></article></div>:<p>上传八电极体成分报告截图，或直接手工录入。</p>}</section>
      <section className="report-card">{bodyImageData?<img src={bodyImageData} alt="待识别的体成分报告"/>:<div className="report-placeholder"><span>▤</span><div><b>识别八电极体成分报告</b><small>读取截图中明确显示的日期、体重、体脂率、肌肉量等字段</small></div></div>}<label className="secondary-action"><input type="file" accept="image/*" onChange={(event)=>chooseBodyReport(event.target.files?.[0])}/>{bodyImageData?'重新选择截图':'选择报告截图'}</label>{bodyImageData&&<button className="primary-action action-button" onClick={analyzeBodyReport}>大模型识别报告</button>}</section>
      <section className="body-form"><div className="section-row"><div><p className="section-kicker">核对或手工录入</p><h2>按测量日期保存</h2></div>{pendingBody.source==='report'&&<span>识别置信度 {pendingBody.confidence}%</span>}</div><label>测量日期<input type="date" value={pendingBody.date} onChange={(event)=>setPendingBody({...pendingBody,date:event.target.value})}/></label><div className="form-grid"><label>体重（kg）<input type="number" inputMode="decimal" value={pendingBody.weightKg||''} onChange={(event)=>setPendingBody({...pendingBody,weightKg:Math.max(0,Number(event.target.value)||0)})}/></label><label>体脂率（%）<input type="number" inputMode="decimal" value={pendingBody.bodyFatPercent||''} onChange={(event)=>setPendingBody({...pendingBody,bodyFatPercent:Math.max(0,Number(event.target.value)||0)})}/></label><label>肌肉量（kg）<input type="number" inputMode="decimal" value={pendingBody.muscleMassKg||''} onChange={(event)=>setPendingBody({...pendingBody,muscleMassKg:Math.max(0,Number(event.target.value)||0)})}/></label><label>内脏脂肪等级<input type="number" inputMode="decimal" value={pendingBody.visceralFat||''} onChange={(event)=>setPendingBody({...pendingBody,visceralFat:Math.max(0,Number(event.target.value)||0)})}/></label><label>基础代谢（kcal）<input type="number" value={pendingBody.bmr||''} onChange={(event)=>setPendingBody({...pendingBody,bmr:Math.max(0,Number(event.target.value)||0)})}/></label></div><label>备注<input value={pendingBody.note} onChange={(event)=>setPendingBody({...pendingBody,note:event.target.value})} placeholder="设备、测量状态或需要关注的变化"/></label><button className="primary-action action-button" onClick={saveBodyMetric}>保存这次测量</button></section>
      {sortedBody.length>0&&<section className="body-history"><p className="section-kicker">历史趋势</p>{sortedBody.map((record,index)=>{const previous=sortedBody[index+1];const change=previous?record.weightKg-previous.weightKg:0;return <article key={record.id}><div><b>{record.date}</b><small>{record.source==='report'?'报告识别':'手工录入'}</small></div><span>{fixed(record.weightKg,1)} kg {previous&&<em className={change>0?'up':change<0?'down':''}>{change>0?'+':''}{fixed(change,1)}</em>}</span><span>{fixed(record.bodyFatPercent,1)}% 体脂</span><span>{fixed(record.muscleMassKg,1)} kg 肌肉</span><button onClick={()=>setBodyMetrics((items)=>items.filter((item)=>item.id!==record.id))}>删除</button></article>;})}</section>}
    </section>}

    {tab==='settings'&&<section className="settings-stack">
      <div className="settings-card"><p className="section-kicker">个人训练参数</p><h2>用于计划与消耗估算</h2><div className="form-grid"><label>体重（kg）<input type="number" min="30" max="250" value={profile.weightKg} onChange={(event)=>setProfile({...profile,weightKg:Math.max(30,Number(event.target.value)||65)})}/></label><label>单次时长（分钟）<input type="number" min="20" max="120" value={profile.sessionMinutes} onChange={(event)=>setProfile({...profile,sessionMinutes:Math.max(20,Number(event.target.value)||45)})}/></label></div><div className="segment-row"><span>训练水平</span><div><button className={profile.level==='beginner'?'active':''} onClick={()=>setProfile({...profile,level:'beginner'})}>初学</button><button className={profile.level==='intermediate'?'active':''} onClick={()=>setProfile({...profile,level:'intermediate'})}>进阶</button></div></div></div>
      <div className="settings-card"><p className="section-kicker">大模型 API</p><h2>连接智谱视觉与教练</h2><label>接口地址<input value={settings.endpoint} onChange={(event)=>setSettings({...settings,endpoint:event.target.value})}/></label><label>API 密钥<input type="password" autoComplete="off" placeholder="仅保存在这台设备" value={settings.apiKey} onChange={(event)=>setSettings({...settings,apiKey:event.target.value})}/></label><label>模型名称<input list="models" value={settings.model} onChange={(event)=>setSettings({...settings,model:event.target.value})}/></label><datalist id="models">{models.map((model)=><option key={model} value={model}/>)}</datalist><div className="two-buttons"><button className="secondary-action action-button" onClick={fetchModels}>获取模型</button><button className="secondary-action action-button" onClick={probe}>测试视觉</button></div><p className="field-help">API 用于餐食识别与训练记录解读；没有 API 时，日期计划、日志和规则调整仍可正常工作。</p></div>
      <div className="settings-card"><p className="section-kicker">每日能量目标</p><label>基础摄入目标（kcal）<input type="number" min="500" max="10000" value={settings.target} onChange={(event)=>setSettings({...settings,target:Math.max(500,Number(event.target.value)||2000)})}/></label><button className="primary-action action-button" onClick={saveSettings}>保存全部设置</button></div>
      <button className="install-card" onClick={()=>setInstallOpen(true)}><span>＋</span><div><b>安装到手机主屏幕</b><small>像普通 App 一样打开练途</small></div><i>›</i></button>
    </section>}

    <nav className="bottom-nav" aria-label="主导航"><button className={tab==='today'?'active':''} onClick={()=>setTab('today')}><span>▶</span>今日</button><button className={tab==='plan'?'active':''} onClick={()=>setTab('plan')}><span>▦</span>计划</button><button className={tab==='nutrition'?'active':''} onClick={()=>setTab('nutrition')}><span>◉</span>热量镜</button><button className={tab==='body'?'active':''} onClick={()=>setTab('body')}><span>⌁</span>身体</button><button className={tab==='settings'?'active':''} onClick={()=>setTab('settings')}><span>⚙</span>我的</button></nav>

    {activeSession&&<WorkoutSheet session={activeSession} logs={activeLogs} note={workoutNote} update={updateActive} setNote={setWorkoutNote} close={()=>setActiveSession(null)} finish={finishWorkout} showDetail={setDetail}/>}
    {detail&&<ExerciseSheet exercise={detail} media={media} close={()=>setDetail(null)}/>}
    {recoveryAfter&&<RecoverySheet session={recoveryAfter} close={()=>setRecoveryAfter(null)}/>}
    {installOpen&&<div className="modal-backdrop" onClick={()=>setInstallOpen(false)}><section className="install-sheet" onClick={(event)=>event.stopPropagation()}><span className="sheet-handle"/><p className="section-kicker">安装练途</p><h2>添加到主屏幕</h2><ol><li><b>1</b><span>使用 Safari 或 Chrome 打开当前网址</span></li><li><b>2</b><span>点击“分享”或浏览器菜单</span></li><li><b>3</b><span>选择“添加到主屏幕”或“安装应用”</span></li></ol><button className="primary-action action-button" onClick={()=>setInstallOpen(false)}>知道了</button></section></div>}
  </main>;
}

function WorkoutSheet({session,logs,note,update,setNote,close,finish,showDetail}:{session:TrainingSession;logs:ExerciseLog[];note:string;update:(id:string,patch:Partial<ExerciseLog>)=>void;setNote:(value:string)=>void;close:()=>void;finish:()=>void;showDetail:(value:ExerciseDefinition)=>void}) {
  const completed=logs.reduce((sum,item)=>sum+item.completedSets,0),planned=session.exercises.reduce((sum,item)=>sum+item.sets,0);
  return <div className="workout-overlay"><section className="workout-sheet"><header><button onClick={close}>取消</button><div><small>{session.phase}期 · 正在训练</small><b>{session.title}</b></div><span>{completed}/{planned} 组</span></header><div className="workout-progress"><i style={{width:`${completed/planned*100}%`}}/></div><div className="workout-exercises">{session.exercises.map((exercise)=>{const log=logs.find((item)=>item.exerciseId===exercise.id)!;return <article key={exercise.id}><button className="exercise-info" onClick={()=>showDetail(exercise)}><ExerciseThumb exercise={exercise}/><div><b>{exercise.name}</b><small>{exercise.sets} 组 × {exercise.reps} · 休 {exercise.restSeconds} 秒</small></div><span>示范 ›</span></button><div className="set-counter"><button onClick={()=>update(exercise.id,{completedSets:Math.max(0,log.completedSets-1)})}>−</button><strong>{log.completedSets}<small> / {exercise.sets} 组</small></strong><button onClick={()=>update(exercise.id,{completedSets:Math.min(exercise.sets,log.completedSets+1)})}>＋</button></div><div className="log-fields"><label>重量 kg<input type="number" inputMode="decimal" min="0" value={log.weightKg} onChange={(event)=>update(exercise.id,{weightKg:Math.max(0,Number(event.target.value)||0)})}/></label><label>实际次数<input value={log.reps} onChange={(event)=>update(exercise.id,{reps:event.target.value})}/></label><label>RPE<input type="number" min="1" max="10" value={log.rpe} onChange={(event)=>update(exercise.id,{rpe:Math.min(10,Math.max(1,Number(event.target.value)||7))})}/></label></div></article>;})}</div><label className="workout-note">训练备注<textarea value={note} onChange={(event)=>setNote(event.target.value)} placeholder="例如：睡眠不足、右膝感觉良好…"/></label><button className="finish-workout" onClick={finish}>完成训练并查看拉伸恢复</button></section></div>;
}

function ExerciseThumb({exercise}:{exercise:ExerciseDefinition}) {
  const fallback=localExerciseMedia[exercise.id]?.image||(exercise.id==='dead_bug'?'/exercises/dead-bug.png':'');
  const [source,setSource]=useState(fallback);
  useEffect(()=>{
    if(exercise.id==='dead_bug'||localExerciseMedia[exercise.id])return setSource(fallback);
    if(!exercise.wgerId)return setSource(fallback);
    fetch(`/api/wger?id=${exercise.wgerId}`).then(async(response)=>{
      if(!response.ok)throw new Error('动作图片加载失败');
      return await response.json() as WgerMedia;
    }).then((item)=>setSource(item.image||fallback)).catch(()=>setSource(fallback));
  },[exercise.id,exercise.wgerId,fallback]);
  return <span className="exercise-thumb">{source?<img src={source} alt=""/>:<i>肌</i>}</span>;
}

function RecoverySheet({session,close}:{session:TrainingSession;close:()=>void}) {
  const items=recoveryRecommendations(session);
  return <div className="workout-overlay recovery-overlay"><section className="recovery-sheet"><header><div><small>训练完成</small><h2>拉伸与恢复建议</h2></div><button onClick={close}>完成</button></header><p className="recovery-intro">根据本次 {session.title} 的主要训练肌群生成。三种方式任选其一，也可以先徒手拉伸再选择一种工具放松。</p>{items.map((item)=><article key={item.area}><div className="recovery-area"><span>◎</span><b>{item.area}</b></div><div><b>纯动作</b><p>{item.stretch}</p></div><div><b>泡沫轴</b><p>{item.foam}</p></div><div><b>筋膜枪</b><p>{item.massageGun}</p></div></article>)}<button className="primary-action action-button" onClick={close}>完成本次恢复</button></section></div>;
}

function ExerciseSheet({exercise,media,close}:{exercise:ExerciseDefinition;media:WgerMedia|null;close:()=>void}) {
  const generated=exercise.id==='dead_bug'?'/exercises/dead-bug.png':'';
  return <div className="modal-backdrop detail-layer" onClick={close}><section className="exercise-sheet" onClick={(event)=>event.stopPropagation()}><span className="sheet-handle"/>{media?.video?<video controls playsInline src={media.video}/>:media?.image?<img src={media.image} alt={`${exercise.name}动作示范`}/>:generated?<><img src={generated} alt={`${exercise.name} AI 动作示意`}/><small className="ai-media-tag">AI 生成动作示意</small></>:<div className="movement-placeholder"><span>↕</span><small>动作示范加载中或暂无媒体</small></div>}<p className="section-kicker">{exercise.target}</p><h2>{exercise.name}</h2><p className="english-name">{exercise.englishName}</p><ol>{exercise.cues.map((cue,index)=><li key={cue}><b>{index+1}</b><span>{cue}</span></li>)}</ol><p className="easier"><b>需要降低难度：</b>{exercise.easier}</p>{media?.image&&<p className="attribution">动作媒体：{media.author||'wger 社区'} · <a href={media.licenseUrl} target="_blank" rel="noreferrer">{media.license}</a> · 来源 wger</p>}<button className="primary-action action-button" onClick={close}>返回训练</button></section></div>;
}

function ResultCard({meal,imageData,updateGrams,saveMeal,reset}:{meal:Meal;imageData:string;updateGrams:(id:string,value:string)=>void;saveMeal:()=>void;reset:()=>void}) {
  return <section className="result-card"><div className="result-head">{imageData&&<img src={imageData} alt="已分析的餐食"/>}<div><p className="section-kicker">置信度 {meal.confidence}%</p><h2>{meal.mealName}</h2><strong>{fixed(meal.calories)} kcal</strong><span>蛋白质 {fixed(meal.protein,1)}g · 碳水 {fixed(meal.carbs,1)}g · 脂肪 {fixed(meal.fat,1)}g</span></div></div><p className="rule-note">本地营养数据优先；修改克数后由网页重新计算。</p><div className="food-list">{meal.items.map((item)=><article key={item.id} className={`food-row ${item.sourceType==='model'?'model-estimate':''}`}><div className="food-title"><div><b>{item.name}</b>{item.sourceType==='model'&&<em>模型估算</em>}</div><strong>{fixed(item.calories,1)} kcal</strong></div><div className="grams-control"><label>克数<input type="number" inputMode="decimal" min="0" value={Number(item.grams.toFixed(1))} onChange={(event)=>updateGrams(item.id,event.target.value)}/></label><span>{fixed(item.caloriesPer100)} kcal/100g</span></div><small>来源：{item.nutritionSource}</small></article>)}</div><p className="assumptions"><b>估算依据</b>{meal.assumptions}</p><div className="two-buttons"><button className="secondary-action action-button" onClick={reset}>重新拍照</button><button className="primary-action action-button" onClick={saveMeal}>记入今天</button></div></section>;
}

function Diary({meals,onDelete}:{meals:Meal[];onDelete:(id:string)=>void}) {
  if(!meals.length)return <section className="empty-card compact-empty"><span>◉</span><h2>还没有饮食记录</h2><p>拍照分析后，摄入会同步到训练首页。</p></section>;
  return <section className="diary-list nutrition-diary"><p className="section-kicker">饮食日记</p>{meals.slice(0,10).map((meal)=><article key={meal.id} className="diary-card"><div><small>{new Date(meal.timestamp).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</small><h2>{meal.mealName}</h2><p>{fixed(meal.protein,1)}g 蛋白质 · {meal.items.filter((item)=>item.grams>0).length} 个分项</p></div><div><strong>{fixed(meal.calories)}<small> kcal</small></strong><button onClick={()=>onDelete(meal.id)}>删除</button></div></article>)}</section>;
}
