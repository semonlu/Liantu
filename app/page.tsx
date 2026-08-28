'use client';
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from 'react';
import { assessDailyNutrition, enrichModelMeal, Meal, parseModelJson, recalculateMeal } from '@/lib/nutrition';
import { bigModelRequest, chooseNativeImage, isNativeApp } from '@/lib/native-bridge';
import { protocolLabels, providerPresets } from '@/lib/model-provider';
import type { ModelConnection, ProviderProtocol } from '@/lib/model-provider';
import { exerciseMedia } from '@/lib/exercise-media';
import type { ExerciseMedia } from '@/lib/exercise-media';
import {
  acceptPlanProposal, buildSession, createPlanProposal, defaultProfile, Equipment, ExerciseDefinition, ExerciseLog, goalLabels,
  PlanProposal, PlanVersion, recoveryRecommendations, splitLabel, TrainingDayCount, TrainingGoal, TrainingProfile, TrainingSession, WorkoutLog,
} from '@/lib/training';

type Tab = 'today' | 'plan' | 'nutrition' | 'body' | 'settings';
type Settings = ModelConnection & { target:number };
type BodyMetric = { id:string;date:string;weightKg:number;bodyFatPercent:number;muscleMassKg:number;visceralFat:number;bmr:number;source:'report'|'manual';confidence:number;note:string;createdAt:number;reportType?:'body_composition'|'checkup' };
type CoachPlan = { goal:TrainingGoal;daysPerWeek:TrainingDayCount;sessionMinutes:number;cycle:string;deload:string;rationale:string[];nutritionFocus:string;changeType?:'dose'|'structure' };

const SETTINGS_KEY='calorielens.settings.v1';
const MEALS_KEY='calorielens.meals.v1';
const PROFILE_KEY='liantu.profile.v2';
const LOGS_KEY='liantu.workouts.v1';
const BODY_KEY='liantu.body-metrics.v1';
const PLAN_VERSIONS_KEY='liantu.plan-versions.v1';
const PLAN_PROPOSALS_KEY='liantu.plan-proposals.v1';
const ONBOARDING_KEY='liantu.onboarding.v1';

const defaultSettings:Settings={
  providerId:'zhipu',protocol:'openai_chat',endpoint:'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  model:'glm-5v-turbo',apiKey:'',customHeaders:'',target:2000,
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

const proxy=bigModelRequest;

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
  const [coachPlan,setCoachPlan]=useState<PlanProposal|null>(null);
  const [planVersions,setPlanVersions]=useState<PlanVersion[]>([]);
  const [planProposals,setPlanProposals]=useState<PlanProposal[]>([]);
  const [showOnboarding,setShowOnboarding]=useState(false);
  const [installOpen,setInstallOpen]=useState(false);
  const [ready,setReady]=useState(false);
  const [activeSession,setActiveSession]=useState<TrainingSession|null>(null);
  const [activeLogs,setActiveLogs]=useState<ExerciseLog[]>([]);
  const [workoutNote,setWorkoutNote]=useState('');
  const [detail,setDetail]=useState<ExerciseDefinition|null>(null);
  const [media,setMedia]=useState<ExerciseMedia|null>(null);
  const [recoveryAfter,setRecoveryAfter]=useState<TrainingSession|null>(null);
  const [calendarMonth,setCalendarMonth]=useState(()=>new Date(now.getFullYear(),now.getMonth(),1));
  const [selectedPlanDate,setSelectedPlanDate]=useState(localDateKey(now));
  const [bodyImageData,setBodyImageData]=useState('');
  const [reportType,setReportType]=useState<'body_composition'|'checkup'>('body_composition');
  const [pendingBody,setPendingBody]=useState<Omit<BodyMetric,'id'|'createdAt'>>({date:localDateKey(new Date()),weightKg:0,bodyFatPercent:0,muscleMassKg:0,visceralFat:0,bmr:0,source:'manual',confidence:100,note:''});

  useEffect(()=>{
    if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>undefined);
    queueMicrotask(()=>{
      try{
        const savedSettings=localStorage.getItem(SETTINGS_KEY),savedMeals=localStorage.getItem(MEALS_KEY);
        const savedProfile=localStorage.getItem(PROFILE_KEY),savedLogs=localStorage.getItem(LOGS_KEY),savedBody=localStorage.getItem(BODY_KEY);
        const savedVersions=localStorage.getItem(PLAN_VERSIONS_KEY),savedProposals=localStorage.getItem(PLAN_PROPOSALS_KEY);
        if(savedSettings)setSettings({...defaultSettings,...JSON.parse(savedSettings)});
        if(savedMeals)setMeals(JSON.parse(savedMeals));
        const loadedProfile:TrainingProfile=savedProfile?{...defaultProfile,...JSON.parse(savedProfile)}:defaultProfile;
        if(savedProfile)setProfile(loadedProfile);
        if(savedLogs)setLogs(JSON.parse(savedLogs));
        if(savedBody)setBodyMetrics(JSON.parse(savedBody));
        if(savedVersions)setPlanVersions(JSON.parse(savedVersions));
        else setPlanVersions([{id:`plan-v1-${Date.now()}`,version:1,createdAt:Date.now(),effectiveFrom:loadedProfile.startDate,profile:loadedProfile,reason:'首次规则计划',evidenceIds:['acsm-2026','autoreg-2021']}]);
        if(savedProposals)setPlanProposals(JSON.parse(savedProposals));
        if(!localStorage.getItem(ONBOARDING_KEY))setShowOnboarding(true);
      }catch{setNotice('部分本机记录无法读取，已使用默认设置');}
      setReady(true);
    });
  },[]);
  useEffect(()=>{if(ready)localStorage.setItem(MEALS_KEY,JSON.stringify(meals));},[meals,ready]);
  useEffect(()=>{if(ready)localStorage.setItem(LOGS_KEY,JSON.stringify(logs));},[logs,ready]);
  useEffect(()=>{if(ready)localStorage.setItem(PROFILE_KEY,JSON.stringify(profile));},[profile,ready]);
  useEffect(()=>{if(ready)localStorage.setItem(BODY_KEY,JSON.stringify(bodyMetrics));},[bodyMetrics,ready]);
  useEffect(()=>{if(ready)localStorage.setItem(PLAN_VERSIONS_KEY,JSON.stringify(planVersions));},[planVersions,ready]);
  useEffect(()=>{if(ready)localStorage.setItem(PLAN_PROPOSALS_KEY,JSON.stringify(planProposals));},[planProposals,ready]);
  useEffect(()=>{
    let cancelled=false;
    queueMicrotask(()=>{
      if(cancelled)return;
      setMedia(null);
      const local=detail?exerciseMedia[detail.id]:null;
      if(local){setMedia(local);return;}
      if(!detail?.wgerId)return;
      fetch(`/api/wger?id=${detail.wgerId}`).then(async(response)=>{
        if(!response.ok)throw new Error('动作媒体加载失败');
        return {...await response.json() as Omit<ExerciseMedia,'source'>,source:'wger'} as ExerciseMedia;
      }).then((value)=>{if(!cancelled)setMedia(value);}).catch(()=>{if(!cancelled)setMedia(null);});
    });
    return ()=>{cancelled=true;};
  },[detail]);

  const todayKey=localDateKey(now);
  const todayMeals=useMemo(()=>meals.filter((meal)=>localDateKey(meal.timestamp)===todayKey),[meals,todayKey]);
  const totals=useMemo(()=>todayMeals.reduce((sum,meal)=>({
    calories:sum.calories+meal.calories,protein:sum.protein+meal.protein,carbs:sum.carbs+meal.carbs,fat:sum.fat+meal.fat,
  }),{calories:0,protein:0,carbs:0,fat:0}),[todayMeals]);
  const profileAt=useMemo(()=>{
    return (date:string)=>{
      const eligible=planVersions.filter((version)=>version.effectiveFrom<=date).sort((a,b)=>a.effectiveFrom.localeCompare(b.effectiveFrom)||a.version-b.version);
      return eligible.at(-1)?.profile??profile;
    };
  },[planVersions,profile]);
  const todayEffectiveProfile=profileAt(todayKey);
  const todaySession=useMemo(()=>buildSession(todayEffectiveProfile,now,logs),[todayEffectiveProfile,now,logs]);
  const calendar=useMemo(()=>{
    const first=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth(),1);
    const start=new Date(first);start.setDate(first.getDate()-((first.getDay()+6)%7));
    return Array.from({length:42},(_,index)=>{const date=new Date(start);date.setDate(start.getDate()+index);const dateProfile=profileAt(localDateKey(date));return {date,profile:dateProfile,session:buildSession(dateProfile,date,logs),inMonth:date.getMonth()===calendarMonth.getMonth()};});
  },[calendarMonth,profileAt,logs]);
  const selectedProfile=profileAt(selectedPlanDate);
  const selectedSession=useMemo(()=>buildSession(selectedProfile,new Date(`${selectedPlanDate}T12:00:00`),logs),[selectedProfile,selectedPlanDate,logs]);
  const todayLogs=useMemo(()=>logs.filter((log)=>log.date===todayKey),[logs,todayKey]);
  const sortedBody=useMemo(()=>[...bodyMetrics].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt),[bodyMetrics]);
  const latestBody=sortedBody[0];
  const burned=todayLogs.reduce((sum,log)=>sum+log.caloriesBurned,0);
  const netBudget=settings.target+burned-totals.calories;
  const nutritionProgress=Math.min(100,totals.calories/Math.max(1,settings.target)*100);
  const dailyNutrition=useMemo(()=>assessDailyNutrition({totals,calorieTarget:settings.target,weightKg:todayEffectiveProfile.weightKg,goal:todayEffectiveProfile.goal,hasTraining:!todaySession.recovery}),[totals,settings.target,todayEffectiveProfile,todaySession.recovery]);

  const saveSettings=()=>{localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));setNotice('设置已保存在这台设备');};
  const selectProvider=(id:string)=>{
    const preset=providerPresets.find((item)=>item.id===id);if(!preset)return;
    setModels([]);setSettings({...settings,providerId:preset.id,protocol:preset.protocol,endpoint:preset.endpoint,model:preset.model,apiKey:'',customHeaders:''});
  };
  const requireConnection=(needsModel=true)=>{
    if(!settings.endpoint.trim()||(needsModel&&!settings.model.trim())){setTab('settings');setNotice(needsModel?'请先填写接口地址和模型名称':'请先填写接口地址');return false;}
    return true;
  };
  const choosePhoto=async(file?:File)=>{
    if(!file)return;setBusy('正在处理照片…');setNotice('');setCurrentMeal(null);
    try{setImageData(await imageToData(file));}catch(error){setNotice(error instanceof Error?error.message:'无法读取图片');}finally{setBusy('');}
  };
  const choosePhotoNative=async(target:'meal'|'report')=>{
    setBusy('正在打开相机或相册…');setNotice('');
    try{const data=await chooseNativeImage();if(target==='meal'){setImageData(data);setCurrentMeal(null);}else setBodyImageData(data);}catch(error){setNotice(error instanceof Error?error.message:'无法读取图片');}finally{setBusy('');}
  };
  const analyze=async()=>{
    if(!imageData)return setNotice('请先拍照或选择一张照片');
    if(!requireConnection())return;
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
    if(!requireConnection(false))return;
    setBusy('正在获取模型列表…');setNotice('');
    try{const payload=await proxy({action:'models',...settings});setModels(payload.models||[]);setNotice(`已获取 ${payload.models?.length||0} 个模型`);}catch(error){setNotice(error instanceof Error?error.message:'获取失败');}finally{setBusy('');}
  };
  const probe=async()=>{
    if(!requireConnection())return;
    setBusy('正在验证图片能力…');setNotice('');
    try{const payload=await proxy({action:'probe',...settings,imageData:imageData||testImageData()});setNotice(`图片测试通过：${(payload.content||'').slice(0,120)}`);}catch(error){setNotice(error instanceof Error?error.message:'测试失败');}finally{setBusy('');}
  };
  const askCoach=async()=>{
    if(!requireConnection())return;
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
    if(!bodyImageData)return setNotice('请先选择报告截图');
    if(!requireConnection())return;
    setBusy(reportType==='body_composition'?'正在读取日期和体成分数据…':'正在读取体检报告中的明确字段…');setNotice('');
    try{
      const payload=await proxy({action:'bodyReport',reportType,...settings,imageData:bodyImageData});
      const raw=JSON.parse((payload.content||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'')) as Record<string,unknown>;
      const number=(key:string)=>Math.max(0,Number(raw[key])||0);
      setPendingBody({date:/^\d{4}-\d{2}-\d{2}$/.test(String(raw.date||''))?String(raw.date):todayKey,
        weightKg:number('weightKg'),bodyFatPercent:number('bodyFatPercent'),muscleMassKg:number('muscleMassKg'),
        visceralFat:number('visceralFat'),bmr:number('bmr'),source:'report',confidence:Math.min(100,Math.max(0,number('confidence'))),note:String(raw.note||raw.visibleFindings||'')});
      setNotice('识别完成，请核对数值和测量日期后保存');
    }catch(error){setNotice(error instanceof Error?error.message:'报告识别失败');}finally{setBusy('');}
  };
  const saveBodyMetric=()=>{
    if(!pendingBody.weightKg&&!pendingBody.bodyFatPercent&&!pendingBody.muscleMassKg&&!pendingBody.note.trim())return setNotice('请至少填写一项测量值或报告备注');
    const record:BodyMetric={...pendingBody,id:crypto.randomUUID(),createdAt:Date.now(),reportType};
    setBodyMetrics((items)=>[record,...items]);setBodyImageData('');
    setPendingBody({...pendingBody,source:'manual',confidence:100,note:''});
    setNotice(`已按 ${record.date} 保存体成分记录，综合计划会自动读取`);
  };
  const generateCoachPlan=async()=>{
    if(!requireConnection())return;
    setBusy('正在综合训练、饮食与体成分趋势制定计划…');setNotice('');
    try{
      const payload=await proxy({action:'plan',...settings,profile,currentSession:todaySession,recentLogs:logs.slice(0,8),nutrition:{...totals,target:settings.target,burned},bodyMetrics:sortedBody.slice(0,8)});
      const raw=JSON.parse((payload.content||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'')) as CoachPlan;
      if(!Object.keys(goalLabels).includes(raw.goal)||![2,3,4,5,6].includes(raw.daysPerWeek))throw new Error('模型返回的计划参数无效');
      const after={...profile,goal:raw.goal,daysPerWeek:raw.daysPerWeek,sessionMinutes:Math.min(120,Math.max(20,Number(raw.sessionMinutes)||60))};
      const changeType=raw.changeType??(after.goal!==profile.goal||after.daysPerWeek!==profile.daysPerWeek?'structure':'dose');
      const proposal=createPlanProposal(profile,after,`${goalLabels[after.goal]} · ${splitLabel(after.daysPerWeek)}`,[...(Array.isArray(raw.rationale)?raw.rationale:[]),`周期：${raw.cycle}`,`减载：${raw.deload}`,`饮食：${raw.nutritionFocus}`],changeType,now);
      setCoachPlan(proposal);setPlanProposals((items)=>[proposal,...items]);
    }catch(error){setNotice(error instanceof Error?error.message:'综合计划生成失败');}finally{setBusy('');}
  };
  const applyCoachPlan=()=>{
    if(!coachPlan)return;
    const accepted=acceptPlanProposal(coachPlan,planVersions);
    setProfile(coachPlan.after);setPlanVersions(accepted.versions);
    setPlanProposals((items)=>items.map((item)=>item.id===coachPlan.id?accepted.proposal:item));setCoachPlan(null);
    setNotice(`已接受调整，从 ${accepted.version.effectiveFrom} 起更新未完成日历；过去记录保持不变。`);
  };
  const rejectCoachPlan=()=>{
    if(!coachPlan)return;
    setPlanProposals((items)=>items.map((item)=>item.id===coachPlan.id?{...item,status:'rejected'}:item));setCoachPlan(null);
    setNotice('已保持原计划，日历和训练参数没有变化。');
  };
  const undoLastPlan=()=>{
    if(planVersions.length<2)return setNotice('当前没有可撤销的上一版本');
    const previous=planVersions.at(-2)!;
    const proposal=createPlanProposal(profile,previous.profile,'撤销上一版本并恢复此前计划',['保留所有历史训练，仅调整未来未完成日历'],'structure',now);
    const accepted=acceptPlanProposal(proposal,planVersions);
    setProfile(previous.profile);setPlanVersions(accepted.versions);setPlanProposals((items)=>[accepted.proposal,...items]);
    setNotice(`已建立撤销版本，从 ${accepted.version.effectiveFrom} 起恢复此前计划。`);
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

  const stageManualPlan=(after:TrainingProfile,summary:string)=>{
    const proposal=createPlanProposal(profile,after,summary,['由用户主动修改计划参数，应用前显示差异'],'structure',now);
    setCoachPlan(proposal);setPlanProposals((items)=>[proposal,...items]);setNotice('修改已放入待确认建议；接受后才会更新未来日历。');
  };
  const finishOnboarding=(destination?:Tab)=>{
    localStorage.setItem(ONBOARDING_KEY,'completed');
    setShowOnboarding(false);
    setPlanVersions((items)=>items.length?[{...items[0],profile,effectiveFrom:todayKey},...items.slice(1)]:items);
    if(destination)setTab(destination);
    setNotice(destination==='body'?'基础计划已生成；报告可识别也可跳过。':'基础计划已生成，之后可随时提出并确认调整。');
  };

  const titles:Record<Tab,string>={today:'今日训练',plan:'训练计划',nutrition:'热量镜',body:'身体趋势',settings:'我的设置'};
  return <main className="app-shell">
    <header className="topbar"><div><p className="eyebrow">练途 · TRAIN WITH A PLAN</p><h1>{titles[tab]}</h1></div>{tab!=='today'&&<button className="text-button" onClick={()=>setTab('today')}>完成</button>}</header>
    {notice&&<div className="notice" role="status"><span>{notice}</span><button onClick={()=>setNotice('')} aria-label="关闭提示">×</button></div>}
    {busy&&<div className="busy" role="status"><i/><span>{busy}</span></div>}

    {tab==='today'&&<>
      <section className="plan-identity"><div><p className="section-kicker">你的规则计划</p><h2>{goalLabels[todayEffectiveProfile.goal]} · {todaySession.split}</h2><p>第 {todaySession.week} 周 · {todaySession.phase}阶段 · {todayEffectiveProfile.equipment==='bodyweight'?'徒手':todayEffectiveProfile.equipment==='dumbbell'?'哑铃':'健身房器械优先'}</p></div><button onClick={()=>setTab('plan')}>计划依据 ›</button></section>
      <section className="training-hero">
        <div className="training-date"><span>{dateTitle(now)}</span><em>第 {todaySession.week} 周 · {goalLabels[todayEffectiveProfile.goal]}</em></div>
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
      <section className="prescription-card"><div className="prescription-head"><div><p className="section-kicker">当前训练处方</p><h2>{goalLabels[todayEffectiveProfile.goal]} · {todaySession.split}</h2></div><span>规则编译</span></div><div className="prescription-flow"><div><b>目标</b><span>{goalLabels[todayEffectiveProfile.goal]}</span></div><i>→</i><div><b>结构</b><span>T1 / T2 / T3</span></div><i>→</i><div><b>反馈</b><span>RPE + 完成率</span></div></div><ul><li>每周 {todayEffectiveProfile.daysPerWeek} 练，按日历明确训练目标和周期阶段</li><li>新手使用线性与双重进阶，不固定整周减载</li><li>中级按积累、评估、强化组织；至少两项疲劳信号才建议减载</li><li>所有 AI 变化先成为待确认建议，拒绝后日历完全不变</li></ul></section>
      <section className="cycle-map"><div className="section-row"><div><p className="section-kicker">系统安排周期</p><h2>{todayEffectiveProfile.level==='beginner'?'新手持续进阶':'8 周中级训练块'}</h2></div><span>当前：{todaySession.phase}</span></div><div>{Array.from({length:8},(_,index)=>{const weekNumber=index+1;const phase=todayEffectiveProfile.level==='beginner'?'基础':weekNumber<=3?'积累':weekNumber===4||weekNumber===8?'评估':'强化';const current=((todaySession.week-1)%8)+1===weekNumber;return <article key={weekNumber} className={`${phase} ${current?'current':''}`}><b>W{weekNumber}</b><small>{phase}</small></article>;})}</div><p>{todayEffectiveProfile.level==='beginner'?'每个动作连续两次失败才降重 5%–10%；没有固定第 8 周减载。':'第 4、8 周是检查点，不是自动减载周；只有表现、RPE、疼痛、睡眠或压力至少两项异常时才提出主动减载。'}</p></section>
      <section className="goal-card"><p className="section-kicker">训练目标</p><h2>计划首先围绕什么？</h2><div className="goal-grid">{(Object.keys(goalLabels) as TrainingGoal[]).map((goal)=><button key={goal} className={profile.goal===goal?'active':''} onClick={()=>stageManualPlan({...profile,goal},`训练目标改为${goalLabels[goal]}`)}>{goalLabels[goal]}</button>)}</div></section>
      <section className="training-modes"><article><span>力</span><div><b>力量训练</b><small>T1 主项高质量输出，按 RPE 渐进</small></div></article><article><span>耐</span><div><b>耐力训练</b><small>稳态有氧与低技术门槛间歇</small></div></article><article><span>循</span><div><b>循环训练</b><small>器械推、拉、腿组合并控制休息</small></div></article><article><span>功</span><div><b>功能性训练</b><small>单腿、搬运、髋铰链与躯干稳定</small></div></article><article className="deload"><span>减</span><div><b>主动减载</b><small>只在累计疲劳满足规则时提出，仍需你确认</small></div></article></section>
      <section className="calendar-card"><header><button aria-label="上个月" onClick={()=>setCalendarMonth(new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()-1,1))}>‹</button><div><p className="section-kicker">计划版本日历</p><h2>{calendarMonth.toLocaleDateString('zh-CN',{year:'numeric',month:'long'})}</h2></div><button aria-label="下个月" onClick={()=>setCalendarMonth(new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+1,1))}>›</button></header><div className="calendar-weekdays">{['一','二','三','四','五','六','日'].map((item)=><span key={item}>{item}</span>)}</div><div className="calendar-grid">{calendar.map(({date,profile:dateProfile,session,inMonth})=>{const key=localDateKey(date);return <button key={key} className={`${inMonth?'':'outside'} ${key===todayKey?'today':''} ${key===selectedPlanDate?'selected':''} ${session.recovery?'rest':'train'}`} onClick={()=>setSelectedPlanDate(key)}><b>{date.getDate()}</b><small>{session.phase}</small><em>{session.recovery?'恢复':goalLabels[dateProfile.goal]}</em></button>;})}</div><div className="phase-legend"><span><i className="base"/>基础</span><span><i className="build"/>积累</span><span><i className="peak"/>强化</span><span><i className="base"/>评估</span><span><i className="deload"/>减载</span></div></section>
      <section className="selected-day-card"><div className="section-row"><div><p className="section-kicker">{selectedPlanDate} · {selectedSession.phase}阶段</p><h2>{selectedSession.title}</h2></div><span>{selectedSession.recovery?'恢复日':`${selectedSession.durationMinutes} 分钟`}</span></div><p><b>当天目标：</b>{selectedSession.objective}</p><p>{selectedSession.focus}</p><div>{selectedSession.exercises.map((exercise)=><button key={exercise.id} onClick={()=>setDetail(exercise)}><ExerciseThumb exercise={exercise}/><span><b>{exercise.role} · {exercise.name}</b><small>{exercise.sets} 组 × {exercise.reps} · 目标 RPE {exercise.targetRpe}</small></span><i>›</i></button>)}</div>{selectedPlanDate===todayKey&&<button className="primary-action action-button" onClick={()=>beginWorkout(selectedSession)}>开始今天训练</button>}</section>
      <section className="plan-settings"><p className="section-kicker">提出计划变更</p><div className="segment-row"><span>每周训练</span><div>{([2,3,4,5,6] as TrainingDayCount[]).map((days)=><button key={days} className={profile.daysPerWeek===days?'active':''} onClick={()=>stageManualPlan({...profile,daysPerWeek:days},`改为${splitLabel(days)}`)}>{days} 天</button>)}</div></div><div className="segment-row"><span>器械条件</span><div>{([['bodyweight','徒手'],['dumbbell','哑铃'],['gym','健身房']] as [Equipment,string][]).map(([value,label])=><button key={value} className={profile.equipment===value?'active':''} onClick={()=>stageManualPlan({...profile,equipment:value},`器械条件改为${label}`)}>{label}</button>)}</div></div><button className="secondary-action action-button" onClick={undoLastPlan}>撤销上一计划版本</button></section>
      <section className="ai-plan-card"><div className="coach-orb">AI</div><div><p className="section-kicker">综合制定计划</p><h2>训练 + 饮食 + 体成分</h2><p>读取最近训练完成度、RPE、热量镜记录和八电极报告趋势，生成可核对再应用的计划参数。</p><button onClick={generateCoachPlan}>生成综合计划</button></div></section>
      {coachPlan&&<section className="proposal-card"><div className="section-row"><div><p className="section-kicker">待确认计划差异</p><h2>{goalLabels[coachPlan.before.goal]} → {goalLabels[coachPlan.after.goal]}</h2></div><span>{coachPlan.changeType==='structure'?'下周生效':'下次训练'}</span></div><p><b>分化：</b>{splitLabel(coachPlan.before.daysPerWeek)} → {splitLabel(coachPlan.after.daysPerWeek)}</p><p><b>时长：</b>{coachPlan.before.sessionMinutes} → {coachPlan.after.sessionMinutes} 分钟</p><p><b>生效日期：</b>{coachPlan.effectiveFrom}</p><ul>{coachPlan.rationale.map((item)=><li key={item}>{item}</li>)}</ul><div className="two-buttons"><button className="secondary-action action-button" onClick={rejectCoachPlan}>保持原计划</button><button className="primary-action action-button" onClick={applyCoachPlan}>应用调整</button></div></section>}
      {planVersions.length>0&&<section className="history-card"><div className="section-row"><div><p className="section-kicker">计划版本</p><h2>变更可追溯</h2></div><span>{planVersions.length} 个版本</span></div>{[...planVersions].reverse().slice(0,4).map((version)=><article key={version.id}><div><b>v{version.version} · {version.reason}</b><small>从 {version.effectiveFrom} 生效</small></div><span>{splitLabel(version.profile.daysPerWeek)}</span></article>)}</section>}
    </section>}

    {tab==='nutrition'&&<>
      <section className="nutrition-summary"><div className="calorie-ring" style={{'--progress':`${nutritionProgress*3.6}deg`} as React.CSSProperties}><span>今日已记录</span><strong>{fixed(totals.calories)}</strong><small>/ {settings.target} kcal</small></div><div className="macro-list"><div><i className="protein"/><span>蛋白质</span><b>{fixed(totals.protein,1)}g</b></div><div><i className="carbs"/><span>碳水</span><b>{fixed(totals.carbs,1)}g</b></div><div><i className="fat"/><span>脂肪</span><b>{fixed(totals.fat,1)}g</b></div></div></section>
      <section className="proposal-card"><div className="section-row"><div><p className="section-kicker">今天怎么继续吃</p><h2>{dailyNutrition.status==='over'?'后续餐做减法':dailyNutrition.status==='insufficient'?'后续餐补足缺口':'今日接近目标'}</h2></div><span>{dailyNutrition.caloriesRemaining>=0?'还可':'超出'} {Math.abs(dailyNutrition.caloriesRemaining)} kcal</span></div><p>蛋白质目标 {dailyNutrition.proteinTarget}g，仍差 {Math.max(0,dailyNutrition.proteinRemaining)}g；碳水目标 {dailyNutrition.carbsTarget}g，仍差 {Math.max(0,dailyNutrition.carbsRemaining)}g。</p><ul>{dailyNutrition.nextMealAdvice.map((item)=><li key={item}>{item}</li>)}</ul><p className="rule-note">{dailyNutrition.recoveryImpact}</p></section>
      {!currentMeal&&<section className="capture-card">{imageData?<img className="photo-preview" src={imageData} alt="待分析的餐食照片"/>:<div className="camera-mark">⌾</div>}<p className="section-kicker">热量镜 v0.3.5 · 本地营养优先</p><h2>{imageData?'照片已准备好':'拍下这一餐'}</h2><p className="muted">按餐具尺寸、体积、密度中位值估重；识别后可逐项校正克数、倍率和调味料。</p>{isNativeApp()?<button className={imageData?'secondary-action action-button':'primary-action action-button'} onClick={()=>choosePhotoNative('meal')}>{imageData?'重新选择照片':'拍照或选择照片'}</button>:<label className={imageData?'secondary-action':'primary-action'}><input type="file" accept="image/*" capture="environment" onChange={(event)=>choosePhoto(event.target.files?.[0])}/>{imageData?'重新选择照片':'拍照或选择照片'}</label>}{imageData&&<button className="primary-action action-button" onClick={analyze}>开始分析</button>}</section>}
      {currentMeal&&<ResultCard meal={currentMeal} imageData={imageData} updateGrams={updateGrams} saveMeal={saveMeal} reset={()=>{setCurrentMeal(null);setImageData('');}}/>}
      <Diary meals={meals} onDelete={(id)=>setMeals((items)=>items.filter((meal)=>meal.id!==id))}/>
    </>}

    {tab==='body'&&<section className="body-stack">
      <section className="body-overview"><div><p className="section-kicker">最新体成分</p><h2>{latestBody?latestBody.date:'等待首次记录'}</h2></div>{latestBody?<div className="body-metrics"><article><span>体重</span><b>{fixed(latestBody.weightKg,1)}<small> kg</small></b></article><article><span>体脂率</span><b>{fixed(latestBody.bodyFatPercent,1)}<small> %</small></b></article><article><span>肌肉量</span><b>{fixed(latestBody.muscleMassKg,1)}<small> kg</small></b></article></div>:<p>上传八电极体成分报告截图，或直接手工录入。</p>}</section>
      <section className="report-card"><div className="segment-row"><span>报告类型</span><div><button className={reportType==='body_composition'?'active':''} onClick={()=>setReportType('body_composition')}>八电极体成分</button><button className={reportType==='checkup'?'active':''} onClick={()=>setReportType('checkup')}>常规体检</button></div></div>{bodyImageData?<img src={bodyImageData} alt="待识别的报告"/>:<div className="report-placeholder"><span>▤</span><div><b>{reportType==='body_composition'?'识别八电极体成分报告':'识别常规体检报告'}</b><small>{reportType==='body_composition'?'读取日期、体重、体脂率、肌肉量等明确字段':'只摘录截图中明确可见的日期和检查结果，保存前由你核对'}</small></div></div>}{isNativeApp()?<button className="secondary-action action-button" onClick={()=>choosePhotoNative('report')}>{bodyImageData?'重新选择截图':'拍照或选择报告'}</button>:<label className="secondary-action"><input type="file" accept="image/*" onChange={(event)=>chooseBodyReport(event.target.files?.[0])}/>{bodyImageData?'重新选择截图':'选择报告截图'}</label>}{bodyImageData&&<button className="primary-action action-button" onClick={analyzeBodyReport}>大模型识别报告</button>}</section>
      <section className="body-form"><div className="section-row"><div><p className="section-kicker">核对或手工录入</p><h2>按测量日期保存</h2></div>{pendingBody.source==='report'&&<span>识别置信度 {pendingBody.confidence}%</span>}</div><label>测量日期<input type="date" value={pendingBody.date} onChange={(event)=>setPendingBody({...pendingBody,date:event.target.value})}/></label><div className="form-grid"><label>体重（kg）<input type="number" inputMode="decimal" value={pendingBody.weightKg||''} onChange={(event)=>setPendingBody({...pendingBody,weightKg:Math.max(0,Number(event.target.value)||0)})}/></label><label>体脂率（%）<input type="number" inputMode="decimal" value={pendingBody.bodyFatPercent||''} onChange={(event)=>setPendingBody({...pendingBody,bodyFatPercent:Math.max(0,Number(event.target.value)||0)})}/></label><label>肌肉量（kg）<input type="number" inputMode="decimal" value={pendingBody.muscleMassKg||''} onChange={(event)=>setPendingBody({...pendingBody,muscleMassKg:Math.max(0,Number(event.target.value)||0)})}/></label><label>内脏脂肪等级<input type="number" inputMode="decimal" value={pendingBody.visceralFat||''} onChange={(event)=>setPendingBody({...pendingBody,visceralFat:Math.max(0,Number(event.target.value)||0)})}/></label><label>基础代谢（kcal）<input type="number" value={pendingBody.bmr||''} onChange={(event)=>setPendingBody({...pendingBody,bmr:Math.max(0,Number(event.target.value)||0)})}/></label></div><label>备注<input value={pendingBody.note} onChange={(event)=>setPendingBody({...pendingBody,note:event.target.value})} placeholder="设备、测量状态或需要关注的变化"/></label><button className="primary-action action-button" onClick={saveBodyMetric}>保存这次测量</button></section>
      {sortedBody.length>0&&<section className="body-history"><p className="section-kicker">历史趋势</p>{sortedBody.map((record,index)=>{const previous=sortedBody[index+1];const change=previous?record.weightKg-previous.weightKg:0;return <article key={record.id}><div><b>{record.date}</b><small>{record.source==='report'?'报告识别':'手工录入'}</small></div><span>{fixed(record.weightKg,1)} kg {previous&&<em className={change>0?'up':change<0?'down':''}>{change>0?'+':''}{fixed(change,1)}</em>}</span><span>{fixed(record.bodyFatPercent,1)}% 体脂</span><span>{fixed(record.muscleMassKg,1)} kg 肌肉</span><button onClick={()=>setBodyMetrics((items)=>items.filter((item)=>item.id!==record.id))}>删除</button></article>;})}</section>}
    </section>}

    {tab==='settings'&&<section className="settings-stack">
      <div className="settings-card"><p className="section-kicker">个人训练参数</p><h2>用于计划与消耗估算</h2><div className="form-grid"><label>体重（kg）<input type="number" min="30" max="250" value={profile.weightKg} onChange={(event)=>setProfile({...profile,weightKg:Math.max(30,Number(event.target.value)||65)})}/></label><label>单次时长（分钟）<input type="number" min="20" max="120" value={profile.sessionMinutes} onChange={(event)=>setProfile({...profile,sessionMinutes:Math.max(20,Number(event.target.value)||45)})}/></label></div><div className="segment-row"><span>训练水平</span><div><button className={profile.level==='beginner'?'active':''} onClick={()=>setProfile({...profile,level:'beginner'})}>初学</button><button className={profile.level==='intermediate'?'active':''} onClick={()=>setProfile({...profile,level:'intermediate'})}>进阶</button></div></div></div>
      <div className="settings-card model-settings"><div className="section-row"><div><p className="section-kicker">模型连接</p><h2>供应商与本地端口</h2></div><span>{protocolLabels[settings.protocol]}</span></div><div className="provider-grid">{providerPresets.map((preset)=><button key={preset.id} className={settings.providerId===preset.id?'active':''} onClick={()=>selectProvider(preset.id)}><b>{preset.name}</b><small>{preset.subtitle}</small></button>)}</div><div className="form-grid"><label>连接协议<select value={settings.protocol} onChange={(event)=>setSettings({...settings,providerId:'custom',protocol:event.target.value as ProviderProtocol})}>{(Object.keys(protocolLabels) as ProviderProtocol[]).map((protocol)=><option key={protocol} value={protocol}>{protocolLabels[protocol]}</option>)}</select></label><label>模型名称<input list="models" value={settings.model} onChange={(event)=>setSettings({...settings,model:event.target.value})} placeholder="可手工输入模型 ID"/></label></div><datalist id="models">{models.map((model)=><option key={model} value={model}/>)}</datalist><label>Base URL / 完整端点<input value={settings.endpoint} onChange={(event)=>setSettings({...settings,providerId:'custom',endpoint:event.target.value})} placeholder="https://… 或 APK 内 http://192.168…:11434"/></label><label>API 密钥（本地模型可留空）<input type="password" autoComplete="off" placeholder="仅保存在这台设备" value={settings.apiKey} onChange={(event)=>setSettings({...settings,apiKey:event.target.value})}/></label><details className="advanced-settings"><summary>高级：自定义请求头</summary><label>JSON 请求头<textarea value={settings.customHeaders} onChange={(event)=>setSettings({...settings,customHeaders:event.target.value})} placeholder={'{"HTTP-Referer":"https://example.com","X-Title":"练途"}'}/></label><p>用于网关、反向代理或供应商附加鉴权；自定义值会覆盖协议默认请求头。</p></details><div className="two-buttons"><button className="secondary-action action-button" onClick={fetchModels}>刷新模型列表</button><button className="secondary-action action-button" onClick={probe}>测试视觉连接</button></div><p className="field-help">支持 OpenAI Chat、Responses、Anthropic Messages、Gemini GenerateContent 与 Ollama 原生协议。{isNativeApp()?'APK 可直连本机或局域网 HTTP 端口。':'网页版自定义代理仅允许 HTTPS；本机和局域网端口请使用 APK。'} 没有模型连接时，训练计划、日历和日志仍可离线使用。</p></div>
      <div className="settings-card"><p className="section-kicker">每日能量目标</p><label>基础摄入目标（kcal）<input type="number" min="500" max="10000" value={settings.target} onChange={(event)=>setSettings({...settings,target:Math.max(500,Number(event.target.value)||2000)})}/></label><button className="primary-action action-button" onClick={saveSettings}>保存全部设置</button></div>
      <button className="install-card" onClick={()=>setInstallOpen(true)}><span>＋</span><div><b>安装到手机主屏幕</b><small>像普通 App 一样打开练途</small></div><i>›</i></button>
    </section>}

    <nav className="bottom-nav" aria-label="主导航"><button className={tab==='today'?'active':''} onClick={()=>setTab('today')}><span>▶</span>今日</button><button className={tab==='plan'?'active':''} onClick={()=>setTab('plan')}><span>▦</span>计划</button><button className={tab==='nutrition'?'active':''} onClick={()=>setTab('nutrition')}><span>◉</span>热量镜</button><button className={tab==='body'?'active':''} onClick={()=>setTab('body')}><span>⌁</span>身体</button><button className={tab==='settings'?'active':''} onClick={()=>setTab('settings')}><span>⚙</span>我的</button></nav>

    {activeSession&&<WorkoutSheet session={activeSession} logs={activeLogs} note={workoutNote} update={updateActive} setNote={setWorkoutNote} close={()=>setActiveSession(null)} finish={finishWorkout} showDetail={setDetail}/>}
    {detail&&<ExerciseSheet exercise={detail} media={media} close={()=>setDetail(null)}/>}
    {recoveryAfter&&<RecoverySheet session={recoveryAfter} close={()=>setRecoveryAfter(null)}/>}
    {installOpen&&<div className="modal-backdrop" onClick={()=>setInstallOpen(false)}><section className="install-sheet" onClick={(event)=>event.stopPropagation()}><span className="sheet-handle"/><p className="section-kicker">安装练途</p><h2>添加到主屏幕</h2><ol><li><b>1</b><span>使用 Safari 或 Chrome 打开当前网址</span></li><li><b>2</b><span>点击“分享”或浏览器菜单</span></li><li><b>3</b><span>选择“添加到主屏幕”或“安装应用”</span></li></ol><button className="primary-action action-button" onClick={()=>setInstallOpen(false)}>知道了</button></section></div>}
    {showOnboarding&&<div className="workout-overlay onboarding-overlay"><section className="workout-sheet onboarding-sheet"><header><div><small>首次使用 · 可随时修改</small><b>先回答几个问题，再安排训练</b></div><button onClick={()=>finishOnboarding()}>跳过</button></header><div className="onboarding-copy"><p>计划由本地规则引擎生成；接入大模型和上传报告都是可选项。任何 AI 调整都要你再次确认。</p></div><div className="settings-card"><p className="section-kicker">1 · 目标与经验</p><div className="goal-grid">{(Object.keys(goalLabels) as TrainingGoal[]).map((goal)=><button key={goal} className={profile.goal===goal?'active':''} onClick={()=>setProfile({...profile,goal})}>{goalLabels[goal]}</button>)}</div><div className="segment-row"><span>训练经验</span><div><button className={profile.level==='beginner'?'active':''} onClick={()=>setProfile({...profile,level:'beginner'})}>新手 / 恢复</button><button className={profile.level==='intermediate'?'active':''} onClick={()=>setProfile({...profile,level:'intermediate'})}>中级</button></div></div></div><div className="settings-card"><p className="section-kicker">2 · 时间与器械</p><div className="segment-row"><span>每周训练</span><div>{([2,3,4,5,6] as TrainingDayCount[]).map((days)=><button key={days} className={profile.daysPerWeek===days?'active':''} onClick={()=>setProfile({...profile,daysPerWeek:days})}>{days} 天</button>)}</div></div><div className="segment-row"><span>器械</span><div>{([['bodyweight','徒手'],['dumbbell','哑铃'],['gym','健身房']] as [Equipment,string][]).map(([value,label])=><button key={value} className={profile.equipment===value?'active':''} onClick={()=>setProfile({...profile,equipment:value})}>{label}</button>)}</div></div><label>单次可用时间（分钟）<input type="number" min="20" max="120" value={profile.sessionMinutes} onChange={(event)=>setProfile({...profile,sessionMinutes:Math.min(120,Math.max(20,Number(event.target.value)||60))})}/></label></div><div className="settings-card"><p className="section-kicker">3 · 恢复与限制</p><div className="form-grid"><label>平均睡眠（小时）<input type="number" min="3" max="12" step="0.5" value={profile.sleepHours??7.5} onChange={(event)=>setProfile({...profile,sleepHours:Math.min(12,Math.max(3,Number(event.target.value)||7.5))})}/></label><label>当前体重（kg）<input type="number" min="30" max="250" value={profile.weightKg} onChange={(event)=>setProfile({...profile,weightKg:Math.min(250,Math.max(30,Number(event.target.value)||65))})}/></label></div><label>疼痛或不适部位<input value={(profile.painAreas??[]).join('、')} onChange={(event)=>setProfile({...profile,painAreas:event.target.value.split(/[、,，]/).map((item)=>item.trim()).filter(Boolean)})} placeholder="没有可留空；例如右膝、肩前侧"/></label><label>现有心肺活动<input value={(profile.cardioActivities??[]).join('、')} onChange={(event)=>setProfile({...profile,cardioActivities:event.target.value.split(/[、,，]/).map((item)=>item.trim()).filter(Boolean)})} placeholder="例如跑步、骑车、球类"/></label></div><div className="settings-card"><p className="section-kicker">4 · 可选大模型</p><label>API 密钥<input type="password" autoComplete="off" value={settings.apiKey} onChange={(event)=>setSettings({...settings,apiKey:event.target.value})} placeholder="可跳过，之后在我的设置中填写"/></label></div><div className="two-buttons"><button className="secondary-action action-button" onClick={()=>finishOnboarding('body')}>先生成计划，再上传报告</button><button className="primary-action action-button" onClick={()=>finishOnboarding('today')}>生成基础计划</button></div></section></div>}
  </main>;
}

function WorkoutSheet({session,logs,note,update,setNote,close,finish,showDetail}:{session:TrainingSession;logs:ExerciseLog[];note:string;update:(id:string,patch:Partial<ExerciseLog>)=>void;setNote:(value:string)=>void;close:()=>void;finish:()=>void;showDetail:(value:ExerciseDefinition)=>void}) {
  const completed=logs.reduce((sum,item)=>sum+item.completedSets,0),planned=session.exercises.reduce((sum,item)=>sum+item.sets,0);
  return <div className="workout-overlay"><section className="workout-sheet"><header><button onClick={close}>取消</button><div><small>{session.phase}阶段 · 正在训练</small><b>{session.title}</b></div><span>{completed}/{planned} 组</span></header><div className="workout-progress"><i style={{width:`${completed/planned*100}%`}}/></div><div className="workout-exercises">{session.exercises.map((exercise)=>{const log=logs.find((item)=>item.exerciseId===exercise.id)!;return <article key={exercise.id}><button className="exercise-info" onClick={()=>showDetail(exercise)}><ExerciseThumb exercise={exercise}/><div><b>{exercise.role} · {exercise.name}</b><small>{exercise.sets} 组 × {exercise.reps} · RPE {exercise.targetRpe} · 休 {exercise.restSeconds} 秒</small></div><span>示范 ›</span></button><p className="rule-note">{exercise.progressionNote}</p><div className="set-counter"><button onClick={()=>update(exercise.id,{completedSets:Math.max(0,log.completedSets-1)})}>−</button><strong>{log.completedSets}<small> / {exercise.sets} 组</small></strong><button onClick={()=>update(exercise.id,{completedSets:Math.min(exercise.sets,log.completedSets+1)})}>＋</button></div><div className="log-fields"><label>重量 kg<input type="number" inputMode="decimal" min="0" value={log.weightKg} onChange={(event)=>update(exercise.id,{weightKg:Math.max(0,Number(event.target.value)||0)})}/></label><label>实际次数<input value={log.reps} onChange={(event)=>update(exercise.id,{reps:event.target.value})}/></label><label>RPE<input type="number" min="1" max="10" value={log.rpe} onChange={(event)=>update(exercise.id,{rpe:Math.min(10,Math.max(1,Number(event.target.value)||7))})}/></label></div></article>;})}</div><label className="workout-note">训练备注<textarea value={note} onChange={(event)=>setNote(event.target.value)} placeholder="例如：睡眠不足、右膝感觉良好…"/></label><button className="finish-workout" onClick={finish}>完成训练并查看拉伸恢复</button></section></div>;
}

function ExerciseThumb({exercise}:{exercise:ExerciseDefinition}) {
  const fallback=exerciseMedia[exercise.id]?.image||'';
  const [source,setSource]=useState(fallback);
  useEffect(()=>{
    let cancelled=false;
    queueMicrotask(()=>{
      if(cancelled)return;
      if(exerciseMedia[exercise.id]||!exercise.wgerId){setSource(fallback);return;}
      fetch(`/api/wger?id=${exercise.wgerId}`).then(async(response)=>{
        if(!response.ok)throw new Error('动作图片加载失败');
        return await response.json() as ExerciseMedia;
      }).then((item)=>{if(!cancelled)setSource(item.image||fallback);}).catch(()=>{if(!cancelled)setSource(fallback);});
    });
    return ()=>{cancelled=true;};
  },[exercise.id,exercise.wgerId,fallback]);
  return <span className="exercise-thumb">{source?<img src={source} alt=""/>:<i>肌</i>}</span>;
}

function RecoverySheet({session,close}:{session:TrainingSession;close:()=>void}) {
  const items=recoveryRecommendations(session);
  return <div className="workout-overlay recovery-overlay"><section className="recovery-sheet"><header><div><small>训练完成</small><h2>拉伸与恢复建议</h2></div><button onClick={close}>完成</button></header><p className="recovery-intro">根据本次 {session.title} 的主要训练肌群生成。三种方式任选其一，也可以先徒手拉伸再选择一种工具放松。</p>{items.map((item)=><article key={item.area}><div className="recovery-area"><span>◎</span><b>{item.area}</b></div><div><b>纯动作</b><p>{item.stretch}</p></div><div><b>泡沫轴</b><p>{item.foam}</p></div><div><b>筋膜枪</b><p>{item.massageGun}</p></div></article>)}<button className="primary-action action-button" onClick={close}>完成本次恢复</button></section></div>;
}

function ExerciseSheet({exercise,media,close}:{exercise:ExerciseDefinition;media:ExerciseMedia|null;close:()=>void}) {
  return <div className="modal-backdrop detail-layer" onClick={close}><section className="exercise-sheet" onClick={(event)=>event.stopPropagation()}><span className="sheet-handle"/>{media?.video?<video controls playsInline src={media.video}/>:media?.image?<><img src={media.image} alt={`${exercise.name}动作示范`}/>{media.source==='ai'&&<small className="ai-media-tag">AI 生成动作示意</small>}</>:<div className="movement-placeholder"><span>↕</span><small>动作示范加载中或暂无媒体</small></div>}<p className="section-kicker">{exercise.target}</p><h2>{exercise.name}</h2><p className="english-name">{exercise.englishName}</p><ol>{exercise.cues.map((cue,index)=><li key={cue}><b>{index+1}</b><span>{cue}</span></li>)}</ol><p className="easier"><b>需要降低难度：</b>{exercise.easier}</p>{media?.image&&<p className="attribution">{media.source==='ai'?<>动作媒体：AI 生成 · 练途项目原创资产</>:<>动作媒体：{media.author||'wger 社区'} · <a href={media.licenseUrl} target="_blank" rel="noreferrer">{media.license}</a> · 来源 wger</>}</p>}<button className="primary-action action-button" onClick={close}>返回训练</button></section></div>;
}

function ResultCard({meal,imageData,updateGrams,saveMeal,reset}:{meal:Meal;imageData:string;updateGrams:(id:string,value:string)=>void;saveMeal:()=>void;reset:()=>void}) {
  return <section className="result-card"><div className="result-head">{imageData&&<img src={imageData} alt="已分析的餐食"/>}<div><p className="section-kicker">热量镜 v0.3.5 · 置信度 {meal.confidence}%</p><h2>{meal.mealName}</h2><strong>{fixed(meal.calories)} kcal</strong><span>蛋白质 {fixed(meal.protein,1)}g · 碳水 {fixed(meal.carbs,1)}g · 脂肪 {fixed(meal.fat,1)}g</span></div></div><p className="rule-note">本地营养数据优先；修改克数或分量倍率后在本机重新计算。</p><div className="food-list">{meal.items.map((item)=><article key={item.id} className={`food-row ${item.sourceType==='model'?'model-estimate':''}`}><div className="food-title"><div><b>{item.name}</b>{item.sourceType==='model'&&<em>模型估算</em>}</div><strong>{fixed(item.calories,1)} kcal</strong></div><div className="grams-control"><label>克数<input type="number" inputMode="decimal" min="0" value={Number(item.grams.toFixed(1))} onChange={(event)=>updateGrams(item.id,event.target.value)}/></label><span>{fixed(item.caloriesPer100)} kcal/100g</span></div><div className="portion-buttons">{[.5,1,1.5,2].map((multiplier)=><button key={multiplier} onClick={()=>updateGrams(item.id,String(Math.round(item.grams*multiplier*10)/10))}>×{multiplier}</button>)}</div><small>来源：{item.nutritionSource}</small></article>)}</div><p className="assumptions"><b>估算依据</b>{meal.assumptions}</p><div className="two-buttons"><button className="secondary-action action-button" onClick={reset}>重新拍照</button><button className="primary-action action-button" onClick={saveMeal}>记入今天</button></div></section>;
}

function Diary({meals,onDelete}:{meals:Meal[];onDelete:(id:string)=>void}) {
  if(!meals.length)return <section className="empty-card compact-empty"><span>◉</span><h2>还没有饮食记录</h2><p>拍照分析后，摄入会同步到训练首页。</p></section>;
  return <section className="diary-list nutrition-diary"><p className="section-kicker">饮食日记</p>{meals.slice(0,10).map((meal)=><article key={meal.id} className="diary-card"><div><small>{new Date(meal.timestamp).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</small><h2>{meal.mealName}</h2><p>{fixed(meal.protein,1)}g 蛋白质 · {meal.items.filter((item)=>item.grams>0).length} 个分项</p></div><div><strong>{fixed(meal.calories)}<small> kcal</small></strong><button onClick={()=>onDelete(meal.id)}>删除</button></div></article>)}</section>;
}
