'use client';
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Browser } from '@capacitor/browser';
import { assessDailyNutrition, calculateBaseCalorieTarget, createManualMeal, enrichModelMeal, Meal, parseModelJson, recalculateMeal } from '@/lib/nutrition';
import { beginChatGptAccountLogin, bigModelRequest, chooseNativeImage, fetchChatGptAccountModels, finishChatGptAccountLogin, isNativeApp, testChatGptAccount } from '@/lib/native-bridge';
import { protocolLabels, providerPresets } from '@/lib/model-provider';
import type { ModelConnection, ProviderProtocol } from '@/lib/model-provider';
import { chatGptCredentialPatch } from '@/lib/openai-chatgpt';
import type { ChatGptDeviceLogin } from '@/lib/openai-chatgpt';
import { exerciseMedia } from '@/lib/exercise-media';
import type { ExerciseMedia } from '@/lib/exercise-media';
import { freeExerciseDefinitions } from '@/lib/exercise-library';
import { datasetExerciseDefinitions } from '@/lib/exercises-dataset-library';
import {
  acceptPlanProposal, applySessionOverride, buildSession, createCustomExercise, createPlanProposal, DailySessionOverride, defaultProfile, Equipment, estimateCalories, ExerciseDefinition, ExerciseLog, ExercisePrescription, exerciseCatalog, goalLabels,
  mainLiftLabels, MainLiftKey, PlanProposal, PlanVersion, recoveryRecommendations, splitLabel, splitSchedule, TrainingDayCount, TrainingGoal, TrainingProfile, TrainingSession, WorkoutLog, ExerciseSetLog,
} from '@/lib/training';

type Tab = 'today' | 'plan' | 'nutrition' | 'coach' | 'body' | 'settings';
type ExerciseNameMode = 'bilingual' | 'zh' | 'en';
type Settings = ModelConnection & {
  target:number;calorieTargetMode:'auto'|'manual';aiNutritionLogging:boolean;aiWorkoutLogging:boolean;exerciseNameMode:ExerciseNameMode;
  chatgptAccessToken:string;chatgptRefreshToken:string;chatgptExpiresAt:number;chatgptAccountId:string;chatgptEmail:string;chatgptPlanType:string;
};
type BodyMetric = { id:string;date:string;weightKg:number;bodyFatPercent:number;muscleMassKg:number;visceralFat:number;bmr:number;source:'report'|'manual';confidence:number;note:string;createdAt:number;reportType?:'body_composition'|'checkup' };
type CoachPlan = { goal?:TrainingGoal;daysPerWeek?:TrainingDayCount;sessionMinutes?:number;cycle?:string;deload?:string;rationale?:string[];nutritionFocus?:string;changeType?:'dose'|'structure' };
type EnergyAdjustment = { id:string;date:string;kcal:number;note:string;createdAt:number };
type ChatWorkoutExercise = {exerciseId?:string;name:string;sets:number;reps:string;weightKg?:number;rpe?:number};
type ChatAction =
  |{type:'profile';weightKg?:number;sleepHours?:number}
  |{type:'energy';kcal:number;note:string}
  |{type:'nutrition';mealName:string;grams?:number;calories:number;protein:number;carbs:number;fat:number}
  |{type:'workout';date:string;title:string;durationMinutes?:number;caloriesBurned?:number;averageRpe?:number;exercises:ChatWorkoutExercise[];note:string}
  |{type:'plan';goal?:TrainingGoal;daysPerWeek?:TrainingDayCount;sessionMinutes?:number;rationale:string};
type ChatMessage = {id:string;role:'user'|'assistant';text:string;createdAt:number;action?:ChatAction;applied?:boolean};
type ManualMealDraft = {mealName:string;grams:string;calories:string;protein:string;carbs:string;fat:string};
type ChatMemory = {summary:string;compressedCount:number;updatedAt:number};

const SETTINGS_KEY='calorielens.settings.v1';
const MEALS_KEY='calorielens.meals.v1';
const PROFILE_KEY='liantu.profile.v2';
const LOGS_KEY='liantu.workouts.v1';
const BODY_KEY='liantu.body-metrics.v1';
const PLAN_VERSIONS_KEY='liantu.plan-versions.v1';
const PLAN_PROPOSALS_KEY='liantu.plan-proposals.v1';
const ONBOARDING_KEY='liantu.onboarding.v1';
const ENERGY_KEY='liantu.energy-adjustments.v1';
const CHAT_KEY='liantu.coach-chat.v1';
const CHAT_MEMORY_KEY='liantu.coach-memory.v1';
const SESSION_OVERRIDES_KEY='liantu.session-overrides.v1';
const ACTIVE_WORKOUT_KEY='liantu.active-workout.v1';

const defaultSettings:Settings={
  providerId:'zhipu',protocol:'openai_chat',endpoint:'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  model:'glm-5v-turbo',apiKey:'',customHeaders:'',target:2000,calorieTargetMode:'auto',aiNutritionLogging:true,aiWorkoutLogging:true,exerciseNameMode:'bilingual',
  chatgptAccessToken:'',chatgptRefreshToken:'',chatgptExpiresAt:0,chatgptAccountId:'',chatgptEmail:'',chatgptPlanType:'',
};
const emptyManualMeal:ManualMealDraft={mealName:'',grams:'',calories:'',protein:'',carbs:'',fat:''};
const emptyChatMemory:ChatMemory={summary:'',compressedCount:0,updatedAt:0};

const createSetLogs=(sets:number,reps:string,weightKg:number,rpe:number):ExerciseSetLog[]=>Array.from({length:sets},(_,index)=>({setNumber:index+1,completed:false,weightKg,reps,rpe}));
const withSetSummary=(log:ExerciseLog,setLogs:ExerciseSetLog[]):ExerciseLog=>{
  const completed=setLogs.filter((item)=>item.completed),last=completed.at(-1)??setLogs[0];
  return {...log,setLogs,completedSets:completed.length,weightKg:completed.length?Math.max(...completed.map((item)=>item.weightKg)):last?.weightKg??0,reps:last?.reps??log.reps,rpe:completed.length?completed.reduce((sum,item)=>sum+item.rpe,0)/completed.length:last?.rpe??log.rpe};
};
const normalizeActiveLog=(log:ExerciseLog):ExerciseLog=>{
  if(log.setLogs?.length)return withSetSummary(log,log.setLogs);
  const planned=Math.max(1,log.plannedSets??log.completedSets??1),setLogs=createSetLogs(planned,log.reps,log.weightKg,log.rpe).map((item,index)=>({...item,completed:index<log.completedSets}));
  return withSetSummary(log,setLogs);
};

const localDateKey=(time:number|Date) => {
  const date=time instanceof Date?time:new Date(time);
  const year=date.getFullYear(),month=String(date.getMonth()+1).padStart(2,'0'),day=String(date.getDate()).padStart(2,'0');
  return `${year}-${month}-${day}`;
};
const dateTitle=(date:Date) => date.toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'});
const fixed=(value:number,digits=0) => value.toLocaleString('zh-CN',{maximumFractionDigits:digits,minimumFractionDigits:digits});
const timeNow=()=>Date.now();
const parseJsonObject=(content:string)=>{
  const cleaned=content.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  const start=cleaned.indexOf('{'),end=cleaned.lastIndexOf('}');
  if(start<0||end<=start)throw new Error('模型返回了文本，但没有可解析的 JSON 内容');
  return JSON.parse(cleaned.slice(start,end+1)) as Record<string,unknown>;
};
const chatActionTitle=(action:ChatAction)=>action.type==='profile'?'待确认个人记录':action.type==='energy'?'待确认消耗记录':action.type==='nutrition'?'待确认饮食记录':action.type==='workout'?'待确认训练记录':'待确认计划调整';
const chatActionSummary=(action:ChatAction,profile:TrainingProfile)=>{
  if(action.type==='profile')return `${action.weightKg?`体重 ${action.weightKg} kg `:''}${action.sleepHours?`睡眠 ${action.sleepHours} 小时`:''}`;
  if(action.type==='energy')return `${action.kcal>0?'+':''}${action.kcal} kcal · ${action.note}`;
  if(action.type==='nutrition')return `${action.mealName} · ${Math.round(action.calories)} kcal · 蛋白质 ${action.protein}g / 碳水 ${action.carbs}g / 脂肪 ${action.fat}g`;
  if(action.type==='workout')return `${action.date} · ${action.title} · ${action.exercises.length} 个动作${action.durationMinutes?` · ${action.durationMinutes} 分钟`:''}${action.averageRpe?` · RPE ${action.averageRpe}`:''}`;
  return `${action.goal?goalLabels[action.goal]:goalLabels[profile.goal]} · ${action.daysPerWeek??profile.daysPerWeek} 天/周 · ${action.sessionMinutes??profile.sessionMinutes} 分钟`;
};
const exerciseNameParts=(exercise:Pick<ExerciseDefinition,'name'|'englishName'>,mode:ExerciseNameMode)=>{
  const chinese=exercise.name.trim(),english=exercise.englishName.trim();
  if(mode==='en')return {primary:english||chinese,secondary:''};
  if(mode==='zh')return {primary:chinese||english,secondary:''};
  return {primary:chinese||english,secondary:chinese.toLocaleLowerCase()===english.toLocaleLowerCase()?'':english};
};
const allExerciseDefinitions=[...Object.values(exerciseCatalog),...datasetExerciseDefinitions,...freeExerciseDefinitions];
const isDateKey=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(new Date(`${value}T12:00:00`).getTime());
const requestedDateFromText=(text:string,currentDateKey:string)=>{
  const current=new Date(`${currentDateKey}T12:00:00`),normalized=text.trim().toLocaleLowerCase();
  let date:Date|undefined;
  if(/前天/.test(normalized))date=new Date(current.getFullYear(),current.getMonth(),current.getDate()-2);
  else if(/昨天|昨日/.test(normalized))date=new Date(current.getFullYear(),current.getMonth(),current.getDate()-1);
  else if(/今天|今日/.test(normalized))date=current;
  const full=normalized.match(/(?:^|\D)(20\d{2})[年./-](\d{1,2})[月./-](\d{1,2})(?:日|\D|$)/);
  const monthDay=!full?normalized.match(/(?:^|\D)(\d{1,2})[月./-](\d{1,2})(?:日|号|\D|$)/):null;
  if(full)date=new Date(Number(full[1]),Number(full[2])-1,Number(full[3]));
  else if(monthDay){
    date=new Date(current.getFullYear(),Number(monthDay[1])-1,Number(monthDay[2]));
    if(localDateKey(date)>currentDateKey)date=new Date(current.getFullYear()-1,Number(monthDay[1])-1,Number(monthDay[2]));
  }
  if(!date)return undefined;
  const key=localDateKey(date);
  return isDateKey(key)&&key<=currentDateKey?key:undefined;
};
const normalizedName=(value:string)=>value.trim().toLocaleLowerCase().replace(/[\s_()（）-]+/g,'');
const findExerciseDefinition=(exerciseId:string|undefined,name:string,session:TrainingSession)=>{
  const key=normalizedName(name);
  return session.exercises.find((item)=>item.id===exerciseId||normalizedName(item.name)===key||normalizedName(item.englishName)===key)
    ??allExerciseDefinitions.find((item)=>item.id===exerciseId||normalizedName(item.name)===key||normalizedName(item.englishName)===key);
};

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
  const [manualMeal,setManualMeal]=useState<ManualMealDraft>(emptyManualMeal);
  const [models,setModels]=useState<string[]>([]);
  const [modelListStatus,setModelListStatus]=useState('填写连接信息后自动读取模型列表');
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
  const [activeWorkoutOpen,setActiveWorkoutOpen]=useState(false);
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
  const [energyAdjustments,setEnergyAdjustments]=useState<EnergyAdjustment[]>([]);
  const [energyInput,setEnergyInput]=useState('');
  const [energyNote,setEnergyNote]=useState('');
  const [chatMessages,setChatMessages]=useState<ChatMessage[]>([]);
  const [chatMemory,setChatMemory]=useState<ChatMemory>(emptyChatMemory);
  const [chatInput,setChatInput]=useState('');
  const [connectionTest,setConnectionTest]=useState<{kind:'testing'|'success'|'error';message:string}|null>(null);
  const [sessionOverrides,setSessionOverrides]=useState<Record<string,DailySessionOverride>>({});
  const [editingSession,setEditingSession]=useState<TrainingSession|null>(null);
  const [deviceLogin,setDeviceLogin]=useState<ChatGptDeviceLogin|null>(null);
  const [chatGptAuthStatus,setChatGptAuthStatus]=useState('');
  const [showChatSummary,setShowChatSummary]=useState(false);
  const loginAbort=useRef<AbortController|null>(null);
  const chatThreadEndRef=useRef<HTMLDivElement|null>(null);
  const proxy=async(body:Record<string,unknown>)=>{
    const payload=await bigModelRequest(body);
    if(payload.oauth)setSettings((current)=>({...current,...payload.oauth}));
    return payload;
  };

  useEffect(()=>{
    if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>undefined);
    queueMicrotask(()=>{
      try{
        const savedSettings=localStorage.getItem(SETTINGS_KEY),savedMeals=localStorage.getItem(MEALS_KEY);
        const savedProfile=localStorage.getItem(PROFILE_KEY),savedLogs=localStorage.getItem(LOGS_KEY),savedBody=localStorage.getItem(BODY_KEY);
        const savedVersions=localStorage.getItem(PLAN_VERSIONS_KEY),savedProposals=localStorage.getItem(PLAN_PROPOSALS_KEY);
        const savedEnergy=localStorage.getItem(ENERGY_KEY),savedChat=localStorage.getItem(CHAT_KEY),savedChatMemory=localStorage.getItem(CHAT_MEMORY_KEY),savedOverrides=localStorage.getItem(SESSION_OVERRIDES_KEY),savedWorkout=localStorage.getItem(ACTIVE_WORKOUT_KEY);
        if(savedSettings)setSettings({...defaultSettings,...JSON.parse(savedSettings)});
        if(savedMeals)setMeals(JSON.parse(savedMeals));
        const parsedProfile=savedProfile?JSON.parse(savedProfile) as Partial<TrainingProfile>:null;
        const loadedProfile:TrainingProfile=parsedProfile?{...defaultProfile,...parsedProfile,mainLift1RM:{...defaultProfile.mainLift1RM,...parsedProfile.mainLift1RM}}:defaultProfile;
        if(savedProfile)setProfile(loadedProfile);
        if(savedLogs)setLogs(JSON.parse(savedLogs));
        if(savedBody)setBodyMetrics(JSON.parse(savedBody));
        if(savedVersions)setPlanVersions(JSON.parse(savedVersions));
        else setPlanVersions([{id:`plan-v1-${Date.now()}`,version:1,createdAt:Date.now(),effectiveFrom:loadedProfile.startDate,profile:loadedProfile,reason:'首次规则计划',evidenceIds:['acsm-2026','autoreg-2021']}]);
        if(savedProposals)setPlanProposals(JSON.parse(savedProposals));
        if(savedEnergy)setEnergyAdjustments(JSON.parse(savedEnergy));
        if(savedChat)setChatMessages(JSON.parse(savedChat));
        if(savedChatMemory)setChatMemory({...emptyChatMemory,...JSON.parse(savedChatMemory)});
        if(savedOverrides)setSessionOverrides(JSON.parse(savedOverrides));
        if(savedWorkout){
          const draft=JSON.parse(savedWorkout) as {session?:TrainingSession;logs?:ExerciseLog[];note?:string};
          if(draft.session&&Array.isArray(draft.logs)){
            setActiveSession(draft.session);setActiveLogs(draft.logs.map(normalizeActiveLog));setWorkoutNote(String(draft.note??''));
            setNotice(`已恢复 ${draft.session.date} 的未完成训练进度`);
          }
        }
        if(!localStorage.getItem(ONBOARDING_KEY))setShowOnboarding(true);
      }catch{setNotice('部分本机记录无法读取，已使用默认设置');}
      setReady(true);
    });
  },[]);
  useEffect(()=>{if(ready)localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));},[settings,ready]);
  useEffect(()=>{if(ready)localStorage.setItem(MEALS_KEY,JSON.stringify(meals));},[meals,ready]);
  useEffect(()=>{if(ready)localStorage.setItem(LOGS_KEY,JSON.stringify(logs));},[logs,ready]);
  useEffect(()=>{if(ready)localStorage.setItem(PROFILE_KEY,JSON.stringify(profile));},[profile,ready]);
  useEffect(()=>{if(ready)localStorage.setItem(BODY_KEY,JSON.stringify(bodyMetrics));},[bodyMetrics,ready]);
  useEffect(()=>{if(ready)localStorage.setItem(PLAN_VERSIONS_KEY,JSON.stringify(planVersions));},[planVersions,ready]);
  useEffect(()=>{if(ready)localStorage.setItem(PLAN_PROPOSALS_KEY,JSON.stringify(planProposals));},[planProposals,ready]);
  useEffect(()=>{if(ready)localStorage.setItem(ENERGY_KEY,JSON.stringify(energyAdjustments));},[energyAdjustments,ready]);
  useEffect(()=>{if(ready)localStorage.setItem(CHAT_KEY,JSON.stringify(chatMessages));},[chatMessages,ready]);
  useEffect(()=>{if(ready)localStorage.setItem(CHAT_MEMORY_KEY,JSON.stringify(chatMemory));},[chatMemory,ready]);
  useEffect(()=>{if(ready)localStorage.setItem(SESSION_OVERRIDES_KEY,JSON.stringify(sessionOverrides));},[sessionOverrides,ready]);
  useEffect(()=>{
    if(!ready)return;
    if(!activeSession){localStorage.removeItem(ACTIVE_WORKOUT_KEY);return;}
    localStorage.setItem(ACTIVE_WORKOUT_KEY,JSON.stringify({session:activeSession,logs:activeLogs,note:workoutNote,updatedAt:Date.now()}));
  },[activeSession,activeLogs,workoutNote,ready]);
  useEffect(()=>{
    if(!ready||tab!=='settings'||!settings.endpoint.trim())return;
    const preset=providerPresets.find((item)=>item.id===settings.providerId);
    const localEndpoint=/^http:\/\/(?:localhost|127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01]))/i.test(settings.endpoint.trim());
    if(settings.providerId==='chatgpt'&&!settings.chatgptAccessToken.trim()){queueMicrotask(()=>setModelListStatus(isNativeApp()?'请先使用 ChatGPT 账号登录':'ChatGPT 账号登录仅支持练途 APK'));return;}
    if(!settings.apiKey.trim()&&!preset?.apiKeyOptional&&!localEndpoint){queueMicrotask(()=>setModelListStatus('填写 API 密钥后自动读取模型列表'));return;}
    let cancelled=false;
    queueMicrotask(()=>{if(!cancelled)setModelListStatus('正在自动读取模型列表…');});
    const timer=window.setTimeout(async()=>{
      try{
        const payload=await proxy({action:'models',...settings});
        if(cancelled)return;
        const list=payload.models??[];
        setModels(list);
        setModelListStatus(list.length?`已自动读取 ${list.length} 个模型`:'接口没有返回可选模型');
        if(list.length&&!settings.model.trim())setSettings((current)=>({...current,model:list[0]}));
      }catch(error){if(!cancelled)setModelListStatus(error instanceof Error?`自动读取失败：${error.message}`:'自动读取模型失败');}
    },700);
    return ()=>{cancelled=true;window.clearTimeout(timer);};
  // settings.model is intentionally excluded: selecting a model must not refetch the catalog.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[ready,tab,settings.providerId,settings.protocol,settings.endpoint,settings.apiKey,settings.customHeaders,settings.chatgptAccessToken]);
  useEffect(()=>{
    let cancelled=false;
    queueMicrotask(()=>{
      if(cancelled)return;
      setMedia(null);
      const local=detail?exerciseMedia[detail.id]:null;
      if(local){setMedia(local);return;}
      if(detail?.animation||detail?.images?.length||!detail?.wgerId)return;
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
  const todaySession=useMemo(()=>applySessionOverride(buildSession(todayEffectiveProfile,now,logs),sessionOverrides[todayKey]),[todayEffectiveProfile,now,logs,sessionOverrides,todayKey]);
  const calendar=useMemo(()=>{
    const first=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth(),1);
    const start=new Date(first);start.setDate(first.getDate()-((first.getDay()+6)%7));
    return Array.from({length:42},(_,index)=>{const date=new Date(start);date.setDate(start.getDate()+index);const key=localDateKey(date);const dateProfile=profileAt(key);return {date,profile:dateProfile,session:applySessionOverride(buildSession(dateProfile,date,logs),sessionOverrides[key]),inMonth:date.getMonth()===calendarMonth.getMonth()};});
  },[calendarMonth,profileAt,logs,sessionOverrides]);
  const selectedProfile=profileAt(selectedPlanDate);
  const selectedSession=useMemo(()=>applySessionOverride(buildSession(selectedProfile,new Date(`${selectedPlanDate}T12:00:00`),logs),sessionOverrides[selectedPlanDate]),[selectedProfile,selectedPlanDate,logs,sessionOverrides]);
  const selectedDayCompleted=useMemo(()=>logs.some((log)=>log.date===selectedPlanDate),[logs,selectedPlanDate]);
  const todayLogs=useMemo(()=>logs.filter((log)=>log.date===todayKey),[logs,todayKey]);
  const sortedBody=useMemo(()=>[...bodyMetrics].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt),[bodyMetrics]);
  const latestBody=sortedBody[0];
  const calorieBody=sortedBody.find((item)=>item.date<=todayKey&&item.bmr>=800&&item.bmr<=3500);
  const caloriePlan=useMemo(()=>calculateBaseCalorieTarget({...profile,measuredBmr:calorieBody?.bmr}),[profile,calorieBody?.bmr]);
  const baseCalorieTarget=settings.calorieTargetMode==='manual'?Math.min(10000,Math.max(500,settings.target)):caloriePlan.calories;
  const calorieSourceLabel=caloriePlan.source==='report_bmr'?'体成分报告基础代谢':caloriePlan.source==='mifflin_st_jeor'?'身高、体重、年龄和性别':'体重估算';
  const trainingBurned=todayLogs.reduce((sum,log)=>sum+log.caloriesBurned,0);
  const todayEnergyAdjustments=useMemo(()=>energyAdjustments.filter((item)=>item.date===todayKey),[energyAdjustments,todayKey]);
  const manualBurned=todayEnergyAdjustments.reduce((sum,item)=>sum+item.kcal,0);
  const burned=Math.max(0,trainingBurned+manualBurned);
  const effectiveCalorieTarget=baseCalorieTarget+burned;
  const netBudget=effectiveCalorieTarget-totals.calories;
  const nutritionProgress=Math.min(100,totals.calories/Math.max(1,effectiveCalorieTarget)*100);
  const dailyNutrition=useMemo(()=>assessDailyNutrition({totals,calorieTarget:effectiveCalorieTarget,weightKg:todayEffectiveProfile.weightKg,goal:todayEffectiveProfile.goal,hasTraining:!todaySession.recovery}),[totals,effectiveCalorieTarget,todayEffectiveProfile,todaySession.recovery]);

  const saveSettings=()=>{localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));setNotice('设置已保存在这台设备');};
  const selectProvider=(id:string)=>{
    const preset=providerPresets.find((item)=>item.id===id);if(!preset)return;
    setModels([]);setSettings({...settings,providerId:preset.id,protocol:preset.protocol,endpoint:preset.endpoint,model:preset.model,apiKey:'',customHeaders:''});
  };
  const requireConnection=(needsModel=true)=>{
    if(settings.providerId==='chatgpt'&&!settings.chatgptAccessToken.trim()){setTab('settings');setNotice('请先使用 ChatGPT 账号登录');return false;}
    if(!settings.endpoint.trim()||(needsModel&&!settings.model.trim())){setTab('settings');setNotice(needsModel?'请先填写接口地址和模型名称':'请先填写接口地址');return false;}
    return true;
  };
  const openChatGptLoginPage=async()=>{
    if(!deviceLogin)return;
    try{await Browser.open({url:deviceLogin.verificationUrl});}catch{window.open(deviceLogin.verificationUrl,'_blank','noopener,noreferrer');}
  };
  const copyChatGptCode=async()=>{
    if(!deviceLogin)return;
    try{await navigator.clipboard.writeText(deviceLogin.userCode);setNotice('登录验证码已复制');}catch{setNotice(`请手动输入验证码：${deviceLogin.userCode}`);}
  };
  const cancelChatGptLogin=()=>{
    loginAbort.current?.abort();loginAbort.current=null;setDeviceLogin(null);setChatGptAuthStatus('已取消登录');Browser.close().catch(()=>undefined);
  };
  const loginChatGpt=async()=>{
    if(!isNativeApp()){setNotice('ChatGPT 账号登录仅支持练途 APK');return;}
    loginAbort.current?.abort();
    const controller=new AbortController();loginAbort.current=controller;
    setNotice('');setConnectionTest(null);setChatGptAuthStatus('正在获取登录验证码…');
    try{
      const login=await beginChatGptAccountLogin();setDeviceLogin(login);setChatGptAuthStatus('等待你在浏览器完成 ChatGPT 授权…');
      try{await Browser.open({url:login.verificationUrl});}catch{window.open(login.verificationUrl,'_blank','noopener,noreferrer');}
      const credentials=await finishChatGptAccountLogin(login,controller.signal);
      let models:string[]=[];
      try{
        const catalog=await fetchChatGptAccountModels(credentials);models=catalog.models;
        const selectedModel=models.includes(settings.model)?settings.model:models[0];
        setModels(models);setModelListStatus(`已读取 ${models.length} 个账号模型，正在验证 ${selectedModel}…`);setChatGptAuthStatus('账号已授权，正在验证模型能否回答…');
        try{
          const tested=await testChatGptAccount(catalog.credentials,selectedModel);
          setSettings((current)=>({...current,providerId:'chatgpt',protocol:'openai_responses',endpoint:'https://chatgpt.com/backend-api/codex/responses',...chatGptCredentialPatch(tested.credentials),model:selectedModel}));
          setModelListStatus(`已读取 ${models.length} 个模型；${selectedModel} 调用验证成功`);
          setConnectionTest({kind:'success',message:`ChatGPT 账号与模型均可用 · 模型返回：${tested.content.slice(0,100)}`});
          setChatGptAuthStatus('ChatGPT 账号已连接并验证可用');setNotice(`ChatGPT 登录成功，${selectedModel} 已通过普通文本测试`);
        }catch(error){
          const message=error instanceof Error?error.message:'模型调用验证失败';
          setSettings((current)=>({...current,providerId:'chatgpt',protocol:'openai_responses',endpoint:'https://chatgpt.com/backend-api/codex/responses',...chatGptCredentialPatch(catalog.credentials),model:selectedModel}));
          setModelListStatus(`已读取 ${models.length} 个模型，但调用验证失败：${message}`);setConnectionTest({kind:'error',message});
          setChatGptAuthStatus('账号已登录，但模型调用尚未成功');setNotice(`账号登录完成，但模型不能使用：${message}`);
        }
      }catch(error){
        setSettings((current)=>({...current,...chatGptCredentialPatch(credentials)}));
        const message=error instanceof Error?error.message:'模型读取失败';
        setModelListStatus(`账号登录完成；${message}`);setChatGptAuthStatus('账号已登录，但模型列表不可用');setNotice(`账号登录完成，但不能使用：${message}`);
      }
      setDeviceLogin(null);
      await Browser.close().catch(()=>undefined);
    }catch(error){
      if(!controller.signal.aborted){const message=error instanceof Error?error.message:'ChatGPT 登录失败';setChatGptAuthStatus(message);setNotice(message);}
    }finally{if(loginAbort.current===controller)loginAbort.current=null;}
  };
  const logoutChatGpt=()=>{
    loginAbort.current?.abort();loginAbort.current=null;setDeviceLogin(null);setModels([]);setConnectionTest(null);setChatGptAuthStatus('已退出 ChatGPT 账号');
    setSettings((current)=>({...current,chatgptAccessToken:'',chatgptRefreshToken:'',chatgptExpiresAt:0,chatgptAccountId:'',chatgptEmail:'',chatgptPlanType:''}));
    setNotice('已从练途退出 ChatGPT 账号');
  };
  const choosePhoto=async(file?:File)=>{
    if(!file)return;setBusy('正在处理照片…');setNotice('');setCurrentMeal(null);
    try{setImageData(await imageToData(file));}catch(error){setNotice(error instanceof Error?error.message:'无法读取图片');}finally{setBusy('');}
  };
  const choosePhotoNative=async(target:'meal'|'report',source:'camera'|'photos')=>{
    setBusy(source==='camera'?'正在打开相机…':'正在打开相册…');setNotice('');
    try{const data=await chooseNativeImage(source);if(!data){setNotice('已取消选择，原有照片没有变化');return;}if(target==='meal'){setImageData(data);setCurrentMeal(null);}else setBodyImageData(data);}catch(error){setNotice(error instanceof Error?error.message:'无法读取图片');}finally{setBusy('');}
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
  const saveManualMeal=()=>{
    const numeric={grams:Number(manualMeal.grams)||undefined,calories:Math.max(0,Number(manualMeal.calories)||0),protein:Math.max(0,Number(manualMeal.protein)||0),carbs:Math.max(0,Number(manualMeal.carbs)||0),fat:Math.max(0,Number(manualMeal.fat)||0)};
    if(!manualMeal.mealName.trim())return setNotice('请填写食物或餐次名称');
    if(!numeric.calories&&!numeric.protein&&!numeric.carbs&&!numeric.fat)return setNotice('请至少填写热量或一项宏量营养素');
    const meal=createManualMeal({mealName:manualMeal.mealName,...numeric});
    setMeals((items)=>[meal,...items]);setManualMeal(emptyManualMeal);setNotice('手动饮食已记入今天，训练能量页已同步');
  };
  const fetchModels=async()=>{
    if(!requireConnection(false))return;
    setBusy('正在获取模型列表…');setNotice('');setModelListStatus('正在读取模型列表…');
    try{const payload=await proxy({action:'models',...settings});const list=payload.models||[];setModels(list);setModelListStatus(`已读取 ${list.length} 个模型`);if(list.length&&!settings.model.trim())setSettings((current)=>({...current,model:list[0]}));setNotice(`已获取 ${list.length} 个模型，可从下拉菜单选择`);}catch(error){const message=error instanceof Error?error.message:'获取失败';setModelListStatus(`读取失败：${message}`);setNotice(message);}finally{setBusy('');}
  };
  const textProbe=async()=>{
    if(!requireConnection())return;
    setBusy('正在测试普通文本连接…');setNotice('');setConnectionTest({kind:'testing',message:'正在发送普通文本测试，请稍候…'});
    try{const payload=await proxy({action:'textProbe',...settings});const content=(payload.content||'').trim();setConnectionTest({kind:'success',message:`普通文本连接成功 · 模型返回：${content.slice(0,160)}`});}
    catch(error){const message=error instanceof Error?error.message:'普通文本测试失败';setConnectionTest({kind:'error',message});setNotice(message);}finally{setBusy('');}
  };
  const probe=async()=>{
    if(!requireConnection())return;
    setBusy('正在验证图片能力…');setNotice('');setConnectionTest({kind:'testing',message:'正在发送内置红蓝测试图，请稍候…'});
    try{const payload=await proxy({action:'probe',...settings,imageData:imageData||testImageData()});const content=(payload.content||'').trim();setConnectionTest({kind:'success',message:`视觉连接成功 · 模型返回：${content.slice(0,160)}`});}
    catch(error){const message=error instanceof Error?error.message:'视觉测试失败';setConnectionTest({kind:'error',message});setNotice(message);}finally{setBusy('');}
  };
  const askCoach=async()=>{
    if(!requireConnection())return;
    setBusy('教练正在结合训练和饮食记录…');setNotice('');
    try{
      const payload=await proxy({action:'coach',...settings,profile,session:todaySession,nutrition:{...totals,target:baseCalorieTarget,burned,targetSource:settings.calorieTargetMode==='manual'?'manual':caloriePlan.source},recentLogs:logs.slice(0,5),bodyMetrics:sortedBody.slice(0,6)});
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
      const payload=await proxy({action:'plan',...settings,profile,currentSession:todaySession,recentLogs:logs.slice(0,8),nutrition:{...totals,target:baseCalorieTarget,burned,targetSource:settings.calorieTargetMode==='manual'?'manual':caloriePlan.source},bodyMetrics:sortedBody.slice(0,8)});
      let raw:CoachPlan={};
      try{raw=parseJsonObject(payload.content||'') as CoachPlan;}catch{raw={rationale:[(payload.content||'').trim()].filter(Boolean)};}
      const goal=raw.goal&&Object.keys(goalLabels).includes(raw.goal)?raw.goal:profile.goal;
      const daysPerWeek=raw.daysPerWeek&&[2,3,4,5,6].includes(raw.daysPerWeek)?raw.daysPerWeek:profile.daysPerWeek;
      const after={...profile,goal,daysPerWeek,sessionMinutes:Math.min(120,Math.max(20,Number(raw.sessionMinutes)||profile.sessionMinutes))};
      const inferredType=after.goal!==profile.goal||after.daysPerWeek!==profile.daysPerWeek?'structure':'dose';
      const changeType=raw.changeType==='structure'||raw.changeType==='dose'?raw.changeType:inferredType;
      const rationale=(Array.isArray(raw.rationale)?raw.rationale:[]).map((item)=>String(item).trim()).filter(Boolean);
      const cycle=String(raw.cycle??'').trim()||`沿用规则引擎的${todaySession.phase}阶段`;
      const deload=String(raw.deload??'').trim()||(todaySession.phase==='减载'?'保持当前主动减载安排':'当前未触发减载规则');
      const nutritionFocus=String(raw.nutritionFocus??'').trim()||dailyNutrition.nextMealAdvice[0]||'保持当前能量和蛋白质目标';
      const proposal=createPlanProposal(profile,after,`${goalLabels[after.goal]} · ${splitLabel(after.daysPerWeek)}`,[...rationale,`周期：${cycle}`,`减载：${deload}`,`饮食：${nutritionFocus}`],changeType,now);
      setCoachPlan(proposal);setPlanProposals((items)=>[proposal,...items]);
      setNotice('模型已返回计划提案；请查看差异后选择保持原计划或应用调整');
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
    if(activeSession){
      if(activeSession.date===session.date){setActiveWorkoutOpen(true);setNotice(`已恢复 ${session.date} 的训练进度`);return;}
      const hasProgress=activeLogs.some((item)=>item.completedSets>0)||workoutNote.trim();
      if(hasProgress){setNotice(`已有 ${activeSession.date} 的未完成训练，请先继续完成或放弃该记录`);return;}
    }
    setActiveSession(session);setActiveWorkoutOpen(true);setWorkoutNote('');
    setActiveLogs(session.exercises.map((exercise)=>({exerciseId:exercise.id,completedSets:0,plannedSets:exercise.sets,reps:exercise.reps,weightKg:exercise.suggestedWeightKg??0,rpe:exercise.targetRpe,setLogs:createSetLogs(exercise.sets,exercise.reps,exercise.suggestedWeightKg??0,exercise.targetRpe)})));
  };
  const pauseWorkout=()=>{setActiveWorkoutOpen(false);setNotice('训练进度已自动保存，可随时继续');};
  const discardWorkout=()=>{
    if(!activeSession||!window.confirm(`放弃 ${activeSession.date} 的未完成训练记录？`))return;
    setActiveWorkoutOpen(false);setActiveSession(null);setActiveLogs([]);setWorkoutNote('');setNotice('已放弃未完成训练');
  };
  const updateActiveSet=(exerciseId:string,setIndex:number,patch:Partial<ExerciseSetLog>)=>setActiveLogs((items)=>items.map((item)=>{
    if(item.exerciseId!==exerciseId)return item;
    const setLogs=(item.setLogs??createSetLogs(item.plannedSets??1,item.reps,item.weightKg,item.rpe)).map((set,index)=>index===setIndex?{...set,...patch}:set);
    return withSetSummary(item,setLogs);
  }));
  const saveSessionOverride=(session:TrainingSession)=>{
    const override:DailySessionOverride={date:session.date,updatedAt:Date.now(),exercises:session.exercises.map((exercise)=>({
      exerciseId:exercise.id,definition:exercise,role:exercise.role,sets:exercise.sets,reps:exercise.reps,restSeconds:exercise.restSeconds,targetRpe:exercise.targetRpe,
      ...(exercise.suggestedWeightKg!==undefined?{suggestedWeightKg:exercise.suggestedWeightKg}:{}),
    }))};
    setSessionOverrides((items)=>({...items,[session.date]:override}));setEditingSession(null);
    setNotice(`已保存 ${session.date} 的临时训练，只修改这一天。`);
  };
  const restoreSessionOverride=(date:string)=>{
    setSessionOverrides((items)=>{const next={...items};delete next[date];return next;});setEditingSession(null);
    setNotice(`已恢复 ${date} 的系统周期安排。`);
  };
  const finishWorkout=()=>{
    if(!activeSession)return;
    const planned=activeSession.exercises.reduce((sum,item)=>sum+item.sets,0);
    const completed=activeLogs.reduce((sum,item)=>sum+item.completedSets,0);
    if(completed===0)return setNotice('至少完成一组后再保存训练');
    const completedSetLogs=activeLogs.flatMap((item)=>item.setLogs?.filter((set)=>set.completed)??[]),used=activeLogs.filter((item)=>item.completedSets>0);
    const completion=Math.min(1,completed/Math.max(1,planned));
    const averageRpe=completedSetLogs.length?completedSetLogs.reduce((sum,item)=>sum+item.rpe,0)/completedSetLogs.length:used.reduce((sum,item)=>sum+item.rpe,0)/used.length;
    const duration=Math.max(5,Math.round(activeSession.durationMinutes*completion));
    const log:WorkoutLog={id:crypto.randomUUID(),date:activeSession.date,sessionId:activeSession.id,title:activeSession.title,
      durationMinutes:duration,caloriesBurned:Math.round(activeSession.estimatedCalories*completion),completion,averageRpe,
      exercises:activeLogs,note:workoutNote,completedAt:Date.now()};
    setLogs((items)=>[log,...items]);setRecoveryAfter(activeSession);setActiveWorkoutOpen(false);setActiveSession(null);setActiveLogs([]);setWorkoutNote('');setNotice(`${log.date} 的训练已保存并标记金色，估算消耗 ${log.caloriesBurned} kcal`);
  };

  const addEnergyAdjustment=(kcalValue?:number,noteValue?:string)=>{
    const kcal=Math.round(kcalValue??Number(energyInput));
    if(!Number.isFinite(kcal)||kcal===0||Math.abs(kcal)>3000)return setNotice('请输入 -3000 到 3000 之间且不为 0 的消耗修正值');
    const entry:EnergyAdjustment={id:crypto.randomUUID(),date:todayKey,kcal,note:(noteValue??energyNote).trim()||'手动消耗修正',createdAt:timeNow()};
    setEnergyAdjustments((items)=>[entry,...items]);setEnergyInput('');setEnergyNote('');setNotice(`已${kcal>0?'增加':'减少'} ${Math.abs(kcal)} kcal 消耗`);
  };

  const compactChatContext=async(conversation:ChatMessage[])=>{
    const start=Math.min(chatMemory.compressedCount,conversation.length);
    if(conversation.length-start<=12)return chatMemory;
    const cutoff=Math.max(start,conversation.length-6),batch=conversation.slice(start,cutoff);
    if(!batch.length)return chatMemory;
    const localSummary=[chatMemory.summary,...batch.map((message)=>`${message.role==='user'?'用户':'教练'}：${message.text}`)].filter(Boolean).join('\n').slice(-6000);
    const next={summary:localSummary,compressedCount:cutoff,updatedAt:Date.now()};setChatMemory(next);
    void proxy({action:'chatSummary',...settings,previousSummary:chatMemory.summary,messages:batch.map(({role,text})=>({role,text}))}).then((payload)=>{
      const remote=(payload.content||'').trim();if(!remote)return;
      setChatMemory((current)=>current.compressedCount===cutoff?{...current,summary:remote.slice(0,6000),updatedAt:Date.now()}:current);
    }).catch(()=>undefined);
    return next;
  };

  const sendChat=async()=>{
    const text=chatInput.trim();if(!text)return;
    if(!requireConnection())return;
    const userMessage:ChatMessage={id:crypto.randomUUID(),role:'user',text,createdAt:Date.now()};
    const conversation=[...chatMessages,userMessage];setChatMessages(conversation);setChatInput('');setBusy('AI 教练正在回复…');setNotice('');
    try{
      const memory=await compactChatContext(conversation);
      const requestedDateHint=requestedDateFromText(text,todayKey);
      const requestedDateLogs=requestedDateHint?logs.filter((log)=>log.date===requestedDateHint):[];
      const payload=await proxy({action:'chat',...settings,currentDate:todayKey,selectedPlanDate,requestedDateHint,requestedDateLogs,profile,currentSession:todaySession,selectedSession,recentLogs:logs.slice(0,8),nutrition:{...totals,target:baseCalorieTarget,burned,targetSource:settings.calorieTargetMode==='manual'?'manual':caloriePlan.source},bodyMetrics:sortedBody.slice(0,8),energyAdjustments:todayEnergyAdjustments,permissions:{nutritionLogging:settings.aiNutritionLogging,workoutLogging:settings.aiWorkoutLogging},conversationSummary:memory.summary,compressedCount:memory.compressedCount,messages:conversation.slice(-8).map(({role,text})=>({role,text}))});
      let raw:Record<string,unknown>;
      try{raw=parseJsonObject(payload.content||'');}catch{raw={reply:(payload.content||'').trim(),action:null};}
      const reply=String(raw.reply??'').trim();if(!reply)throw new Error('模型没有返回对话正文');
      let action:ChatAction|undefined;
      if(raw.action&&typeof raw.action==='object'){
        const candidate=raw.action as Record<string,unknown>;
        if(candidate.type==='profile')action={type:'profile',...(Number(candidate.weightKg)>0?{weightKg:Number(candidate.weightKg)}:{}),...(Number(candidate.sleepHours)>0?{sleepHours:Number(candidate.sleepHours)}:{})};
        if(candidate.type==='energy'&&Number.isFinite(Number(candidate.kcal))&&Number(candidate.kcal)!==0&&Math.abs(Number(candidate.kcal))<=3000)action={type:'energy',kcal:Math.round(Number(candidate.kcal)),note:String(candidate.note??'对话记录的运动消耗')};
        if(candidate.type==='nutrition'&&settings.aiNutritionLogging){
          const calories=Math.min(20_000,Math.max(0,Number(candidate.calories)||0)),protein=Math.min(1_000,Math.max(0,Number(candidate.protein)||0)),carbs=Math.min(2_000,Math.max(0,Number(candidate.carbs)||0)),fat=Math.min(1_000,Math.max(0,Number(candidate.fat)||0));
          const mealName=String(candidate.mealName??'').trim();
          if(mealName&&(calories||protein||carbs||fat))action={type:'nutrition',mealName,...(Number(candidate.grams)>0?{grams:Math.min(10_000,Number(candidate.grams))}:{}),calories,protein,carbs,fat};
        }
        if(candidate.type==='workout'&&settings.aiWorkoutLogging){
          const candidateDate=String(candidate.date??'').trim();
          const actionDate=candidateDate?candidateDate:todayKey;
          if(!isDateKey(actionDate)||actionDate>todayKey)throw new Error('AI 返回的训练日期无效或位于未来，未生成记录卡');
          const targetProfile=profileAt(actionDate);
          const targetSession=applySessionOverride(buildSession(targetProfile,new Date(`${actionDate}T12:00:00`),logs),sessionOverrides[actionDate]);
          const rawExercises=Array.isArray(candidate.exercises)?candidate.exercises.slice(0,20):[];
          const exercises=rawExercises.map((item,index)=>{
            const value=(item&&typeof item==='object'?item:{}) as Record<string,unknown>;
            const name=String(value.name??'').trim();
            const suppliedId=String(value.exerciseId??'').trim();
            const matched=findExerciseDefinition(suppliedId||undefined,name,targetSession);
            const sets=Math.min(20,Math.max(0,Math.round(Number(value.sets)||0)));
            return {exerciseId:matched?.id||suppliedId||`chat-${index}`,name:name||matched?.name||`动作 ${index+1}`,sets,reps:String(value.reps??'').trim()||'未填写',...(Number(value.weightKg)>=0&&Number.isFinite(Number(value.weightKg))?{weightKg:Math.min(1_000,Number(value.weightKg))}:{}),...(Number(value.rpe)>=1&&Number(value.rpe)<=10?{rpe:Number(value.rpe)}:{})};
          }).filter((item)=>item.sets>0);
          const duration=Number(candidate.durationMinutes),calories=Number(candidate.caloriesBurned),rpe=Number(candidate.averageRpe);
          const title=String(candidate.title??`${actionDate} 训练`).trim()||`${actionDate} 训练`;
          if(exercises.length||duration>0)action={type:'workout',date:actionDate,title,...(duration>0?{durationMinutes:Math.min(240,Math.max(5,Math.round(duration)))}:{}),...(calories>0?{caloriesBurned:Math.min(5_000,Math.round(calories))}:{}),...(rpe>=1&&rpe<=10?{averageRpe:rpe}:{}),exercises,note:String(candidate.note??'由 AI 对话整理，用户已确认')};
        }
        if(candidate.type==='plan')action={type:'plan',...(Object.keys(goalLabels).includes(String(candidate.goal))?{goal:String(candidate.goal) as TrainingGoal}:{}),...([2,3,4,5,6].includes(Number(candidate.daysPerWeek))?{daysPerWeek:Number(candidate.daysPerWeek) as TrainingDayCount}:{}),...(Number(candidate.sessionMinutes)>=20&&Number(candidate.sessionMinutes)<=120?{sessionMinutes:Number(candidate.sessionMinutes)}:{}),rationale:String(candidate.rationale??'根据本次对话提出')};
      }
      setChatMessages((items)=>[...items,{id:crypto.randomUUID(),role:'assistant',text:reply,createdAt:Date.now(),action}]);
    }catch(error){
      const message=error instanceof Error?error.message:'AI 对话失败';setNotice(message);
      setChatMessages((items)=>[...items,{id:crypto.randomUUID(),role:'assistant',text:`请求未完成：${message}`,createdAt:Date.now()}]);
    }finally{setBusy('');}
  };

  const applyChatAction=(message:ChatMessage)=>{
    const action=message.action;if(!action||message.applied)return;
    if(action.type==='energy')addEnergyAdjustment(action.kcal,action.note);
    if(action.type==='nutrition'){
      if(!settings.aiNutritionLogging)return setNotice('AI 饮食记录权限已关闭，未写入数据');
      const meal=createManualMeal(action);setMeals((items)=>[meal,...items]);setNotice(`已把“${meal.mealName}”记入今天饮食`);
    }
    if(action.type==='workout'){
      if(!settings.aiWorkoutLogging)return setNotice('AI 训练记录权限已关闭，未写入数据');
      const targetProfile=profileAt(action.date);
      const targetSession=applySessionOverride(buildSession(targetProfile,new Date(`${action.date}T12:00:00`),logs),sessionOverrides[action.date]);
      const prescriptions:ExercisePrescription[]=action.exercises.map((item,index)=>{
        const matched=findExerciseDefinition(item.exerciseId,item.name,targetSession);
        const definition:ExerciseDefinition=matched??{id:`chat-${action.date}-${index}`,name:item.name,englishName:item.name,target:'AI 对话补录',equipment:[targetProfile.equipment],cues:['按实际完成的动作范围和器械设置记录'],easier:'降低重量、次数或活动范围',source:'curated'};
        const original=targetSession.exercises.find((exercise)=>exercise.id===definition.id);
        const role=original?.role??(index===0?'T1':index===1?'T2':'T3');
        return {...definition,role,sets:item.sets,reps:item.reps,restSeconds:original?.restSeconds??(role==='T1'?180:role==='T2'?120:75),targetRpe:item.rpe??action.averageRpe??7,progressionNote:original?.progressionNote??'AI 对话补录的实际动作；后续调整仍由规则引擎计算。',...(item.weightKg!==undefined?{suggestedWeightKg:item.weightKg}:{}),weightBasis:'AI 对话整理，用户确认后写入'};
      });
      const override:DailySessionOverride={date:action.date,updatedAt:timeNow(),exercises:prescriptions.map((exercise)=>({exerciseId:exercise.id,definition:exercise,role:exercise.role,sets:exercise.sets,reps:exercise.reps,restSeconds:exercise.restSeconds,targetRpe:exercise.targetRpe,...(exercise.suggestedWeightKg!==undefined?{suggestedWeightKg:exercise.suggestedWeightKg}:{})}))};
      const exercises:ExerciseLog[]=prescriptions.map((item)=>({exerciseId:item.id,completedSets:item.sets,plannedSets:item.sets,reps:item.reps,weightKg:item.suggestedWeightKg??0,rpe:item.targetRpe}));
      const completion=1;
      const duration=action.durationMinutes??Math.max(5,targetSession.durationMinutes);
      const averageRpe=action.averageRpe??(exercises.length?exercises.reduce((sum,item)=>sum+item.rpe,0)/exercises.length:7);
      const log:WorkoutLog={id:crypto.randomUUID(),date:action.date,sessionId:targetSession.id,title:action.title,durationMinutes:duration,caloriesBurned:action.caloriesBurned??estimateCalories(6,targetProfile.weightKg,duration),completion,averageRpe,exercises,note:action.note,completedAt:timeNow()};
      setSessionOverrides((items)=>({...items,[action.date]:override}));
      setLogs((items)=>[log,...items.filter((item)=>item.date!==action.date)]);
      setSelectedPlanDate(action.date);setCalendarMonth(new Date(`${action.date.slice(0,7)}-01T12:00:00`));setTab('plan');
      setNotice(`已${logs.some((item)=>item.date===action.date)?'更新':'补录'} ${action.date} 的训练卡片并标记金色：${action.title}`);
    }
    if(action.type==='profile'){
      const after={...profile,...(action.weightKg?{weightKg:Math.min(250,Math.max(30,action.weightKg))}:{}),...(action.sleepHours?{sleepHours:Math.min(12,Math.max(3,action.sleepHours))}:{})};
      setProfile(after);setPlanVersions((items)=>{const previous=items.at(-1);return [...items,{id:`plan-v${(previous?.version??0)+1}-${Date.now()}`,version:(previous?.version??0)+1,createdAt:Date.now(),effectiveFrom:todayKey,profile:after,reason:'AI 对话确认的个人记录',evidenceIds:['autoreg-2021'],previousVersionId:previous?.id}];});
      setNotice('已按你的确认记录体重或睡眠，并更新未来未完成训练的计算基线');
    }
    if(action.type==='plan'){
      const after={...profile,...(action.goal?{goal:action.goal}:{}),...(action.daysPerWeek?{daysPerWeek:action.daysPerWeek}:{}),...(action.sessionMinutes?{sessionMinutes:action.sessionMinutes}:{})};
      const proposal=createPlanProposal(profile,after,'AI 对话提出的计划调整',[action.rationale],'structure',now);
      setCoachPlan(proposal);setPlanProposals((items)=>[proposal,...items]);setTab('plan');setNotice('对话建议已转为待确认计划；尚未应用');
    }
    setChatMessages((items)=>items.map((item)=>item.id===message.id?{...item,applied:true}:item));
  };

  const applyManualPlan=(after:TrainingProfile,summary:string)=>{
    if(JSON.stringify(after)===JSON.stringify(profile)){setNotice('当前已经是这个计划参数');return;}
    const proposal=createPlanProposal(profile,after,summary,['由用户主动修改计划参数，应用前显示差异'],'structure',now);
    const accepted=acceptPlanProposal(proposal,planVersions);
    setProfile(after);setPlanVersions(accepted.versions);setPlanProposals((items)=>[accepted.proposal,...items]);setCoachPlan(null);
    setNotice(`已应用：${summary}。从 ${accepted.version.effectiveFrom} 起更新未完成日历；历史记录不变。`);
  };
  const saveStrengthBaselines=()=>{
    if(profile.equipment!=='bodyweight'&&!Object.values(profile.mainLift1RM).some((value)=>value>0))return setNotice('请至少填写一个主要动作的 1RM；完全不知道时可先完成一次校准训练');
    setPlanVersions((items)=>{
      const previous=items.at(-1);
      return [...items,{id:`plan-v${(previous?.version??0)+1}-${Date.now()}`,version:(previous?.version??0)+1,createdAt:Date.now(),effectiveFrom:todayKey,profile,reason:'更新主要动作 1RM 基线',evidenceIds:['acsm-2026','autoreg-2021'],previousVersionId:previous?.id}];
    });
    setNotice('1RM 基线已保存；今天及之后未完成训练的建议重量已重新计算');
  };
  const finishOnboarding=(destination?:Tab)=>{
    if(destination&&profile.equipment!=='bodyweight'&&!Object.values(profile.mainLift1RM).some((value)=>value>0))return setNotice('请至少填写一个主要动作的 1RM；不知道可点右上角“跳过”，首训后再校准');
    localStorage.setItem(ONBOARDING_KEY,'completed');
    setShowOnboarding(false);
    setPlanVersions((items)=>items.length?[{...items[0],profile,effectiveFrom:todayKey},...items.slice(1)]:items);
    if(destination)setTab(destination);
    setNotice(destination==='body'?'基础计划已生成；报告可识别也可跳过。':'基础计划已生成，之后可随时提出并确认调整。');
  };

  const titles:Record<Tab,string>={today:'今日训练',plan:'训练计划',nutrition:'热量镜',coach:'AI 教练',body:'身体趋势',settings:'我的设置'};
  return <main className="app-shell">
    <header className="topbar"><div><p className="eyebrow">练途 · TRAIN WITH A PLAN</p><h1>{titles[tab]}</h1></div>{tab!=='today'&&<button className="text-button" onClick={()=>setTab('today')}>完成</button>}</header>
    {notice&&<div className="notice" role="status"><span>{notice}</span><button onClick={()=>setNotice('')} aria-label="关闭提示">×</button></div>}
    {busy&&<div className="busy" role="status"><i/><span>{busy}</span></div>}

    {tab==='today'&&<>
      {activeSession&&<section className="workout-resume-card"><div><p className="section-kicker">未完成训练 · 已自动保存</p><h2>{activeSession.title}</h2><p>{activeSession.date} · 已完成 {activeLogs.reduce((sum,item)=>sum+item.completedSets,0)} / {activeLogs.reduce((sum,item)=>sum+item.plannedSets,0)} 组</p></div><div><button onClick={()=>setActiveWorkoutOpen(true)}>继续训练</button><button onClick={discardWorkout}>放弃</button></div></section>}
      <section className="plan-identity"><div><p className="section-kicker">你的规则计划</p><h2>{goalLabels[todayEffectiveProfile.goal]} · {todaySession.split}</h2><p>第 {todaySession.week} 周 · {todaySession.phase}阶段 · {todayEffectiveProfile.equipment==='bodyweight'?'徒手':todayEffectiveProfile.equipment==='dumbbell'?'哑铃':'健身房器械优先'}</p></div><button onClick={()=>setTab('plan')}>计划依据 ›</button></section>
      <section className="training-hero">
        <div className="training-date"><span>{dateTitle(now)}</span><em>第 {todaySession.week} 周 · {goalLabels[todayEffectiveProfile.goal]}</em></div>
        <p className="section-kicker">{todaySession.recovery?'恢复安排':'今天练什么'}</p><h2>{todaySession.title}</h2><p>{todaySession.focus}</p>
        <div className="training-metrics"><span><b>{todaySession.durationMinutes}</b> 分钟</span><span><b>{todaySession.exercises.length}</b> 个动作</span><span><b>≈{todaySession.estimatedCalories}</b> kcal</span></div>
        <button className="training-start" onClick={()=>beginWorkout()}>{activeSession?.date===todayKey?'继续训练':todayLogs.length?'再练一次':'开始训练'}<span>→</span></button>
      </section>
      <section className="energy-card">
        <div className="section-row"><div><p className="section-kicker">能量联动</p><h2>摄入与消耗</h2></div><button onClick={()=>setTab('nutrition')}>打开热量镜</button></div>
        <div className="energy-equation"><span><b>{fixed(totals.calories)}</b>已摄入</span><i>−</i><span><b>{burned}</b>总消耗</span><i>=</i><span className="net"><b>{fixed(totals.calories-burned)}</b>净摄入</span></div>
        <div className="energy-bar"><i style={{width:`${Math.min(100,totals.calories/Math.max(1,effectiveCalorieTarget)*100)}%`}}/></div>
        <p>按当前目标还可安排约 <strong>{fixed(netBudget)} kcal</strong>；基础目标 {baseCalorieTarget} kcal，今日活动消耗 {burned} kcal。</p>
      </section>
      <section className="session-list-card"><div className="section-row"><div><p className="section-kicker">本次内容</p><h2>{todaySession.circuit?'按轮循环':'按顺序完成'}</h2></div><span>{todaySession.exercises.reduce((sum,item)=>sum+item.sets,0)} 组</span></div>
        <div className="exercise-preview-list">{todaySession.exercises.map((exercise,index)=>{const names=exerciseNameParts(exercise,settings.exerciseNameMode);return <button key={exercise.id} onClick={()=>setDetail(exercise)}><ExerciseThumb exercise={exercise}/><span>{String(index+1).padStart(2,'0')}</span><div><b>{names.primary}</b>{names.secondary&&<small className="exercise-name-alt">{names.secondary}</small>}<small>{exercise.sets} 组 × {exercise.reps} · 休息 {exercise.restSeconds} 秒</small></div><i>›</i></button>;})}</div>
      </section>
      <section className="adjust-card"><div className="coach-orb">↗</div><div><p className="section-kicker">自适应计划</p><h2>为什么今天这样练</h2><p>{todaySession.adjustment}</p>{coachNote&&<blockquote>{coachNote}</blockquote>}<button onClick={askCoach}>用大模型分析今天记录</button></div></section>
      {logs.length>0&&<section className="history-card"><div className="section-row"><div><p className="section-kicker">最近训练</p><h2>完成记录</h2></div></div>{logs.slice(0,3).map((log)=><article key={log.id}><div><b>{log.title}</b><small>训练日期 {log.date}</small></div><span>{Math.round(log.completion*100)}% · RPE {fixed(log.averageRpe,1)}</span></article>)}</section>}
    </>}

    {tab==='plan'&&<section className="plan-stack">
      <section className="prescription-card"><div className="prescription-head"><div><p className="section-kicker">当前训练处方</p><h2>{goalLabels[todayEffectiveProfile.goal]} · {todaySession.split}</h2></div><span>规则编译</span></div><div className="prescription-flow"><div><b>目标</b><span>{goalLabels[todayEffectiveProfile.goal]}</span></div><i>→</i><div><b>结构</b><span>T1 / T2 / T3</span></div><i>→</i><div><b>反馈</b><span>RPE + 完成率</span></div></div><ul><li>每周 {todayEffectiveProfile.daysPerWeek} 练，按日历明确训练目标和周期阶段</li><li>新手使用线性与双重进阶，不固定整周减载</li><li>中级按积累、评估、强化组织；至少两项疲劳信号才建议减载</li><li>所有 AI 变化先成为待确认建议，拒绝后日历完全不变</li></ul></section>
      <section className="split-detail-card"><div className="section-row"><div><p className="section-kicker">分化与组次</p><h2>{splitLabel(todayEffectiveProfile.daysPerWeek)}怎么练</h2></div><span>{todayEffectiveProfile.goal==='strength'?'力量组次':'目标自适应'}</span></div><div className="split-day-list">{splitSchedule(todayEffectiveProfile.daysPerWeek).map((day)=><article key={day.title}><b>{day.title}</b><small>{day.exercises.map((item)=>`${item.role} ${item.name}`).join(' · ')}</small></article>)}</div><p>{todayEffectiveProfile.goal==='strength'?'基础期 T1 通常 4组×4–6次，强化期 5组×3–5次；T2 通常 3组×6–10次，T3 2组×10–15次。':'增肌主项通常 4组×6–10次，T2 3组×8–12次，T3 2组×10–15次；耐力和循环会提高次数并缩短休息。'} 5×5、4×8、3×12 或字面意义的 12×3 都可在当天编辑器中单独设置，不会把同一组次强套给所有动作。</p></section>
      <section className="cycle-map"><div className="section-row"><div><p className="section-kicker">系统安排周期</p><h2>{todayEffectiveProfile.level==='beginner'?'新手持续进阶':'8 周中级训练块'}</h2></div><span>当前：{todaySession.phase}</span></div><div>{Array.from({length:8},(_,index)=>{const weekNumber=index+1;const phase=todayEffectiveProfile.level==='beginner'?'基础':weekNumber<=3?'积累':weekNumber===4||weekNumber===8?'评估':'强化';const current=((todaySession.week-1)%8)+1===weekNumber;return <article key={weekNumber} className={`${phase} ${current?'current':''}`}><b>W{weekNumber}</b><small>{phase}</small></article>;})}</div><p>{todayEffectiveProfile.level==='beginner'?'每个动作连续两次失败才降重 5%–10%；没有固定第 8 周减载。':'第 4、8 周是检查点，不是自动减载周；只有表现、RPE、疼痛、睡眠或压力至少两项异常时才提出主动减载。'}</p></section>
      <section className="goal-card"><p className="section-kicker">训练目标</p><h2>计划首先围绕什么？</h2><div className="goal-grid">{(Object.keys(goalLabels) as TrainingGoal[]).map((goal)=><button key={goal} className={profile.goal===goal?'active':''} onClick={()=>applyManualPlan({...profile,goal},`训练目标改为${goalLabels[goal]}`)}>{goalLabels[goal]}</button>)}</div><p className="field-help">手动点击会直接建立新计划版本；结构调整从下周一更新未完成日历。AI 建议仍需单独确认。</p></section>
      <section className="training-modes"><article><span>力</span><div><b>力量训练</b><small>T1 主项高质量输出，按 RPE 渐进</small></div></article><article><span>耐</span><div><b>耐力训练</b><small>稳态有氧与低技术门槛间歇</small></div></article><article><span>循</span><div><b>循环训练</b><small>器械推、拉、腿组合并控制休息</small></div></article><article><span>功</span><div><b>功能性训练</b><small>单腿、搬运、髋铰链与躯干稳定</small></div></article><article className="deload"><span>减</span><div><b>主动减载</b><small>只在累计疲劳满足规则时提出，仍需你确认</small></div></article></section>
      <section className="calendar-card"><header><button aria-label="上个月" onClick={()=>setCalendarMonth(new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()-1,1))}>‹</button><div><p className="section-kicker">计划版本日历</p><h2>{calendarMonth.toLocaleDateString('zh-CN',{year:'numeric',month:'long'})}</h2></div><button aria-label="下个月" onClick={()=>setCalendarMonth(new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+1,1))}>›</button></header><div className="calendar-weekdays">{['一','二','三','四','五','六','日'].map((item)=><span key={item}>{item}</span>)}</div><div className="calendar-grid">{calendar.map(({date,session,inMonth})=>{const key=localDateKey(date);const completed=logs.some((log)=>log.date===key);const area=session.recovery?'恢复':session.title.split('｜')[0];return <button key={key} className={`${inMonth?'':'outside'} ${key===todayKey?'today':''} ${key===selectedPlanDate?'selected':''} ${completed?'completed':''} ${session.recovery?'rest':'train'}`} onClick={()=>setSelectedPlanDate(key)} aria-label={`${key} ${area} ${session.phase}${completed?' 已完成':''}`}><b>{date.getDate()}</b><small>{session.phase}</small><em>{completed?'✓ ':''}{area}</em></button>;})}</div><div className="phase-legend"><span><i className="base"/>基础</span><span><i className="build"/>积累</span><span><i className="peak"/>强化</span><span><i className="base"/>评估</span><span><i className="deload"/>减载</span><span><i className="completed"/>已完成</span></div></section>
      <section className="selected-day-card"><div className="section-row"><div><p className="section-kicker">{selectedPlanDate} · {selectedSession.phase}阶段</p><h2>{selectedSession.title}</h2></div><span>{selectedDayCompleted?'已完成':selectedSession.recovery?'恢复日':`${selectedSession.durationMinutes} 分钟`}</span></div><p><b>当天目标：</b>{selectedSession.objective}</p><p>{selectedSession.focus}</p><div className="selected-exercise-list">{selectedSession.exercises.map((exercise)=>{const names=exerciseNameParts(exercise,settings.exerciseNameMode);return <button key={exercise.id} onClick={()=>setDetail(exercise)}><ExerciseThumb exercise={exercise}/><span><b>{exercise.role} · {names.primary}</b>{names.secondary&&<small className="exercise-name-alt">{names.secondary}</small>}<small>{exercise.sets} 组 × {exercise.reps} · 目标 RPE {exercise.targetRpe}</small><small>{exercise.suggestedWeightKg!==undefined?`建议 ${exercise.suggestedWeightKg} kg${exercise.loadPercent1RM?` · 约 ${exercise.loadPercent1RM}% 1RM`:''}`:'建议重量：首组按 RPE 6–7 校准'}</small></span><i>›</i></button>;})}</div><div className="session-edit-actions"><button className="secondary-action action-button" disabled={selectedDayCompleted} onClick={()=>setEditingSession(selectedSession)}>{selectedDayCompleted?'已有训练记录，保留历史':'修改或添加当天动作'}</button>{sessionOverrides[selectedPlanDate]&&<button className="text-button" onClick={()=>restoreSessionOverride(selectedPlanDate)}>恢复系统安排</button>}</div>{selectedPlanDate<=todayKey&&<button className="primary-action action-button" onClick={()=>beginWorkout(selectedSession)}>{selectedPlanDate===todayKey?(selectedDayCompleted?'再练一次':'开始今天训练'):(selectedDayCompleted?'补记这天另一场':'补录这天训练')}</button>}</section>
      <section className="plan-settings"><p className="section-kicker">直接调整计划</p><div className="segment-row"><span>每周训练</span><div>{([2,3,4,5,6] as TrainingDayCount[]).map((days)=><button key={days} className={profile.daysPerWeek===days?'active':''} onClick={()=>applyManualPlan({...profile,daysPerWeek:days},`改为${splitLabel(days)}`)}>{days} 天</button>)}</div></div><div className="segment-row"><span>器械条件</span><div>{([['bodyweight','徒手'],['dumbbell','哑铃'],['gym','健身房']] as [Equipment,string][]).map(([value,label])=><button key={value} className={profile.equipment===value?'active':''} onClick={()=>applyManualPlan({...profile,equipment:value},`器械条件改为${label}`)}>{label}</button>)}</div></div><button className="secondary-action action-button" onClick={undoLastPlan}>撤销上一计划版本</button></section>
      <section className="ai-plan-card"><div className="coach-orb">AI</div><div><p className="section-kicker">综合制定计划</p><h2>训练 + 饮食 + 体成分</h2><p>读取最近训练完成度、RPE、热量镜记录和八电极报告趋势，生成可核对再应用的计划参数。</p><button onClick={generateCoachPlan}>生成综合计划</button></div></section>
      {coachPlan&&<section className="proposal-card"><div className="section-row"><div><p className="section-kicker">待确认计划差异</p><h2>{goalLabels[coachPlan.before.goal]} → {goalLabels[coachPlan.after.goal]}</h2></div><span>{coachPlan.changeType==='structure'?'下周生效':'下次训练'}</span></div><p><b>分化：</b>{splitLabel(coachPlan.before.daysPerWeek)} → {splitLabel(coachPlan.after.daysPerWeek)}</p><p><b>时长：</b>{coachPlan.before.sessionMinutes} → {coachPlan.after.sessionMinutes} 分钟</p><p><b>生效日期：</b>{coachPlan.effectiveFrom}</p><ul>{coachPlan.rationale.map((item)=><li key={item}>{item}</li>)}</ul><div className="two-buttons"><button className="secondary-action action-button" onClick={rejectCoachPlan}>保持原计划</button><button className="primary-action action-button" onClick={applyCoachPlan}>应用调整</button></div></section>}
      {planVersions.length>0&&<section className="history-card"><div className="section-row"><div><p className="section-kicker">计划版本</p><h2>变更可追溯</h2></div><span>{planVersions.length} 个版本</span></div>{[...planVersions].reverse().slice(0,4).map((version)=><article key={version.id}><div><b>v{version.version} · {version.reason}</b><small>从 {version.effectiveFrom} 生效</small></div><span>{splitLabel(version.profile.daysPerWeek)}</span></article>)}</section>}
    </section>}

    {tab==='nutrition'&&<>
      <section className="nutrition-summary"><div className="calorie-ring" style={{'--progress':`${nutritionProgress*3.6}deg`} as React.CSSProperties}><span>今日已记录</span><strong>{fixed(totals.calories)}</strong><small>/ {effectiveCalorieTarget} kcal</small></div><div className="macro-list"><div><i className="protein"/><span>蛋白质</span><b>{fixed(totals.protein,1)}g</b></div><div><i className="carbs"/><span>碳水</span><b>{fixed(totals.carbs,1)}g</b></div><div><i className="fat"/><span>脂肪</span><b>{fixed(totals.fat,1)}g</b></div></div></section>
      <p className="target-breakdown">今日总目标 = 动态基础目标 {baseCalorieTarget} + 已记录活动消耗 {burned} = <b>{effectiveCalorieTarget} kcal</b>。基础目标来源：{settings.calorieTargetMode==='manual'?'手动设置':calorieSourceLabel}。</p>
      <section className="energy-adjust-card"><div className="section-row"><div><p className="section-kicker">今日活动消耗</p><h2>{burned} kcal</h2></div><span>训练 {trainingBurned} · 修正 {manualBurned>=0?'+':''}{manualBurned}</span></div><p>完成训练后会自动按体重、时长和完成度写入；手环或器械数据不一致时可输入正数增加、负数减少。</p><div className="form-grid"><label>增减 kcal<input type="number" inputMode="numeric" value={energyInput} onChange={(event)=>setEnergyInput(event.target.value)} placeholder="例如 120 或 -80"/></label><label>说明<input value={energyNote} onChange={(event)=>setEnergyNote(event.target.value)} placeholder="例如 手环修正"/></label></div><button className="secondary-action action-button" onClick={()=>addEnergyAdjustment()}>记入今天消耗</button>{todayEnergyAdjustments.length>0&&<div className="energy-adjust-list">{todayEnergyAdjustments.map((item)=><article key={item.id}><span><b>{item.kcal>0?'+':''}{item.kcal} kcal</b><small>{item.note}</small></span><button onClick={()=>setEnergyAdjustments((items)=>items.filter((entry)=>entry.id!==item.id))}>删除</button></article>)}</div>}</section>
      <section className="proposal-card"><div className="section-row"><div><p className="section-kicker">今天怎么继续吃</p><h2>{dailyNutrition.status==='over'?'后续餐做减法':dailyNutrition.status==='insufficient'?'后续餐补足缺口':'今日接近目标'}</h2></div><span>{dailyNutrition.caloriesRemaining>=0?'还可':'超出'} {Math.abs(dailyNutrition.caloriesRemaining)} kcal</span></div><p>蛋白质目标 {dailyNutrition.proteinTarget}g，仍差 {Math.max(0,dailyNutrition.proteinRemaining)}g；碳水目标 {dailyNutrition.carbsTarget}g，仍差 {Math.max(0,dailyNutrition.carbsRemaining)}g。</p><ul>{dailyNutrition.nextMealAdvice.map((item)=><li key={item}>{item}</li>)}</ul><p className="rule-note">{dailyNutrition.recoveryImpact}</p></section>
      <section className="manual-meal-card"><div className="section-row"><div><p className="section-kicker">手动记录饮食</p><h2>不拍照也能记入今天</h2></div><span>热量或宏量至少填一项</span></div><label>食物或餐次名称<input value={manualMeal.mealName} onChange={(event)=>setManualMeal({...manualMeal,mealName:event.target.value})} placeholder="例如 午餐鸡胸饭"/></label><div className="manual-meal-grid"><label>总重量（g，可选）<input type="number" inputMode="decimal" min="0" value={manualMeal.grams} onChange={(event)=>setManualMeal({...manualMeal,grams:event.target.value})}/></label><label>热量（kcal）<input type="number" inputMode="decimal" min="0" value={manualMeal.calories} onChange={(event)=>setManualMeal({...manualMeal,calories:event.target.value})}/></label><label>蛋白质（g）<input type="number" inputMode="decimal" min="0" value={manualMeal.protein} onChange={(event)=>setManualMeal({...manualMeal,protein:event.target.value})}/></label><label>碳水（g）<input type="number" inputMode="decimal" min="0" value={manualMeal.carbs} onChange={(event)=>setManualMeal({...manualMeal,carbs:event.target.value})}/></label><label>脂肪（g）<input type="number" inputMode="decimal" min="0" value={manualMeal.fat} onChange={(event)=>setManualMeal({...manualMeal,fat:event.target.value})}/></label></div><button className="primary-action action-button" onClick={saveManualMeal}>手动记入今天</button></section>
      {!currentMeal&&<section className="capture-card">{imageData?<img className="photo-preview" src={imageData} alt="待分析的餐食照片"/>:<div className="camera-mark">⌾</div>}<p className="section-kicker">热量镜 v0.3.5 · 本地营养优先</p><h2>{imageData?'照片已准备好':'拍下这一餐'}</h2><p className="muted">按餐具尺寸、体积、密度中位值估重；识别后可逐项校正克数、倍率和调味料。</p>{isNativeApp()?<div className="native-photo-actions"><button className="primary-action action-button" onClick={()=>choosePhotoNative('meal','camera')}>拍照</button><button className="secondary-action action-button" onClick={()=>choosePhotoNative('meal','photos')}>从相册选择</button></div>:<label className={imageData?'secondary-action':'primary-action'}><input type="file" accept="image/*" capture="environment" onChange={(event)=>choosePhoto(event.target.files?.[0])}/>{imageData?'重新选择照片':'拍照或选择照片'}</label>}{imageData&&<button className="primary-action action-button" onClick={analyze}>开始分析</button>}</section>}
      {currentMeal&&<ResultCard meal={currentMeal} imageData={imageData} updateGrams={updateGrams} saveMeal={saveMeal} reset={()=>{setCurrentMeal(null);setImageData('');}}/>}
      <Diary meals={meals} onDelete={(id)=>setMeals((items)=>items.filter((meal)=>meal.id!==id))}/>
    </>}

    {tab==='coach'&&<section className="coach-chat-page">
      <section className="coach-chat-intro"><div className="coach-orb">AI</div><div><p className="section-kicker">自由对话</p><h2>和模型讨论训练与记录</h2><p>可以说“午餐鸡胸饭约 650 kcal”“今天卧推 80kg 做了 4×8”或“补录昨天的腿部训练”。模型会按明确日期生成待确认记录；只有你确认后才写入。</p></div></section>
      <section className="chat-memory-card"><div><b>{chatMemory.compressedCount?`已压缩 ${chatMemory.compressedCount} 条旧消息`:'自动压缩已开启'}</b><span>发送给模型：长期摘要＋最近 8 条消息＋实时训练和饮食数据</span></div>{chatMemory.summary&&<details><summary>查看长期摘要</summary><p>{chatMemory.summary}</p></details>}</section>
      <section className="chat-thread">{chatMessages.length===0&&<div className="chat-empty"><b>从一句自然语言开始</b><span>例如：今天卧推最后两组 RPE 9，帮我记下训练并分析下一次怎么调。</span></div>}{chatMessages.map((message)=><article key={message.id} className={message.role}><div><small>{message.role==='user'?'我':'AI 教练'}</small><p>{message.text}</p>{message.action&&<section className="chat-action"><b>{chatActionTitle(message.action)}</b><span>{chatActionSummary(message.action,profile)}</span><button disabled={message.applied} onClick={()=>applyChatAction(message)}>{message.applied?'已确认':message.action.type==='plan'?'生成待确认计划':'确认记录'}</button></section>}</div></article>)}<div ref={chatThreadEndRef} className="chat-thread-end"/></section>
      <section className="chat-tools"><button onClick={()=>setShowChatSummary(true)}>长期摘要{chatMemory.compressedCount?` · ${chatMemory.compressedCount} 条`:''}</button><button onClick={()=>chatThreadEndRef.current?.scrollIntoView({behavior:'smooth',block:'end'})}>回到最新</button></section>
      <section className="chat-composer"><textarea value={chatInput} onChange={(event)=>setChatInput(event.target.value)} placeholder="输入训练感受、饮食、睡眠、体重、日期或时间安排…"/><button onClick={sendChat} disabled={!chatInput.trim()||Boolean(busy)}>发送</button></section>
      {showChatSummary&&<div className="chat-summary-overlay" role="dialog" aria-modal="true" aria-label="AI 教练长期摘要" onClick={()=>setShowChatSummary(false)}><section className="chat-summary-sheet" onClick={(event)=>event.stopPropagation()}><div className="section-row"><div><p className="section-kicker">对话记忆</p><h2>长期摘要</h2></div><button onClick={()=>setShowChatSummary(false)}>关闭</button></div><p>{chatMemory.summary||'还没有需要压缩的旧对话。对话超过 12 条后会自动生成摘要，并始终保留最近消息。'}</p><small>{chatMemory.compressedCount?`已压缩 ${chatMemory.compressedCount} 条旧消息 · ${new Date(chatMemory.updatedAt).toLocaleString('zh-CN')}`:'自动压缩已开启'}</small></section></div>}
    </section>}

    {tab==='body'&&<section className="body-stack">
      <section className="body-overview"><div><p className="section-kicker">最新体成分</p><h2>{latestBody?latestBody.date:'等待首次记录'}</h2></div>{latestBody?<div className="body-metrics"><article><span>体重</span><b>{fixed(latestBody.weightKg,1)}<small> kg</small></b></article><article><span>体脂率</span><b>{fixed(latestBody.bodyFatPercent,1)}<small> %</small></b></article><article><span>肌肉量</span><b>{fixed(latestBody.muscleMassKg,1)}<small> kg</small></b></article></div>:<p>上传八电极体成分报告截图，或直接手工录入。</p>}</section>
      <section className="report-card"><div className="segment-row"><span>报告类型</span><div><button className={reportType==='body_composition'?'active':''} onClick={()=>setReportType('body_composition')}>八电极体成分</button><button className={reportType==='checkup'?'active':''} onClick={()=>setReportType('checkup')}>常规体检</button></div></div>{bodyImageData?<img src={bodyImageData} alt="待识别的报告"/>:<div className="report-placeholder"><span>▤</span><div><b>{reportType==='body_composition'?'识别八电极体成分报告':'识别常规体检报告'}</b><small>{reportType==='body_composition'?'读取日期、体重、体脂率、肌肉量等明确字段':'只摘录截图中明确可见的日期和检查结果，保存前由你核对'}</small></div></div>}{isNativeApp()?<div className="native-photo-actions"><button className="primary-action action-button" onClick={()=>choosePhotoNative('report','camera')}>拍照</button><button className="secondary-action action-button" onClick={()=>choosePhotoNative('report','photos')}>从相册选择</button></div>:<label className="secondary-action"><input type="file" accept="image/*" onChange={(event)=>chooseBodyReport(event.target.files?.[0])}/>{bodyImageData?'重新选择截图':'选择报告截图'}</label>}{bodyImageData&&<button className="primary-action action-button" onClick={analyzeBodyReport}>大模型识别报告</button>}</section>
      <section className="body-form"><div className="section-row"><div><p className="section-kicker">核对或手工录入</p><h2>按测量日期保存</h2></div>{pendingBody.source==='report'&&<span>识别置信度 {pendingBody.confidence}%</span>}</div><label>测量日期<input type="date" value={pendingBody.date} onChange={(event)=>setPendingBody({...pendingBody,date:event.target.value})}/></label><div className="form-grid"><label>体重（kg）<input type="number" inputMode="decimal" value={pendingBody.weightKg||''} onChange={(event)=>setPendingBody({...pendingBody,weightKg:Math.max(0,Number(event.target.value)||0)})}/></label><label>体脂率（%）<input type="number" inputMode="decimal" value={pendingBody.bodyFatPercent||''} onChange={(event)=>setPendingBody({...pendingBody,bodyFatPercent:Math.max(0,Number(event.target.value)||0)})}/></label><label>肌肉量（kg）<input type="number" inputMode="decimal" value={pendingBody.muscleMassKg||''} onChange={(event)=>setPendingBody({...pendingBody,muscleMassKg:Math.max(0,Number(event.target.value)||0)})}/></label><label>内脏脂肪等级<input type="number" inputMode="decimal" value={pendingBody.visceralFat||''} onChange={(event)=>setPendingBody({...pendingBody,visceralFat:Math.max(0,Number(event.target.value)||0)})}/></label><label>基础代谢（kcal）<input type="number" value={pendingBody.bmr||''} onChange={(event)=>setPendingBody({...pendingBody,bmr:Math.max(0,Number(event.target.value)||0)})}/></label></div><label>备注<input value={pendingBody.note} onChange={(event)=>setPendingBody({...pendingBody,note:event.target.value})} placeholder="设备、测量状态或需要关注的变化"/></label><button className="primary-action action-button" onClick={saveBodyMetric}>保存这次测量</button></section>
      {sortedBody.length>0&&<section className="body-history"><p className="section-kicker">历史趋势</p>{sortedBody.map((record,index)=>{const previous=sortedBody[index+1];const change=previous?record.weightKg-previous.weightKg:0;return <article key={record.id}><div><b>{record.date}</b><small>{record.source==='report'?'报告识别':'手工录入'}</small></div><span>{fixed(record.weightKg,1)} kg {previous&&<em className={change>0?'up':change<0?'down':''}>{change>0?'+':''}{fixed(change,1)}</em>}</span><span>{fixed(record.bodyFatPercent,1)}% 体脂</span><span>{fixed(record.muscleMassKg,1)} kg 肌肉</span><button onClick={()=>setBodyMetrics((items)=>items.filter((item)=>item.id!==record.id))}>删除</button></article>;})}</section>}
    </section>}

    {tab==='settings'&&<section className="settings-stack">
      <div className="settings-card"><p className="section-kicker">个人训练参数</p><h2>用于计划与动态热量计算</h2><div className="form-grid"><label>体重（kg）<input type="number" inputMode="decimal" value={profile.weightKg||''} onChange={(event)=>setProfile({...profile,weightKg:event.target.value===''?0:Number(event.target.value)})} onBlur={()=>setProfile({...profile,weightKg:Math.min(250,Math.max(30,profile.weightKg||65))})}/></label><label>身高（cm）<input type="number" inputMode="decimal" value={profile.heightCm??''} onChange={(event)=>setProfile({...profile,heightCm:event.target.value===''?undefined:Number(event.target.value)})} onBlur={()=>setProfile({...profile,heightCm:Math.min(230,Math.max(120,profile.heightCm??170))})}/></label><label>年龄<input type="number" inputMode="numeric" value={profile.age??''} onChange={(event)=>setProfile({...profile,age:event.target.value===''?undefined:Number(event.target.value)})} onBlur={()=>setProfile({...profile,age:Math.min(90,Math.max(14,profile.age??30))})}/></label><label>性别<select aria-label="性别" value={profile.sex??''} onChange={(event)=>setProfile({...profile,sex:event.target.value?event.target.value as 'male'|'female':undefined})}><option value="">未填写</option><option value="male">男</option><option value="female">女</option></select></label><label>日常非训练活动<select aria-label="日常非训练活动" value={profile.dailyActivity??'light'} onChange={(event)=>setProfile({...profile,dailyActivity:event.target.value as TrainingProfile['dailyActivity']})}><option value="sedentary">久坐为主</option><option value="light">一般活动</option><option value="active">体力活动较多</option></select></label><label>平均睡眠（小时）<input type="number" inputMode="decimal" step="0.1" value={profile.sleepHours??''} onChange={(event)=>setProfile({...profile,sleepHours:event.target.value===''?undefined:Number(event.target.value)})} onBlur={()=>setProfile({...profile,sleepHours:Math.min(12,Math.max(3,profile.sleepHours??7.5))})}/></label><label>单次时长（分钟）<input type="number" inputMode="numeric" value={profile.sessionMinutes||''} onChange={(event)=>setProfile({...profile,sessionMinutes:event.target.value===''?0:Number(event.target.value)})} onBlur={()=>setProfile({...profile,sessionMinutes:Math.min(120,Math.max(20,profile.sessionMinutes||45))})}/></label></div><p className="field-help">热量计算优先读取体成分报告中的基础代谢；没有时使用个人参数，仍不完整时按体重估算。训练消耗另行加入，不会重复计算。</p><div className="segment-row"><span>训练水平</span><div><button className={profile.level==='beginner'?'active':''} onClick={()=>setProfile({...profile,level:'beginner'})}>初学</button><button className={profile.level==='intermediate'?'active':''} onClick={()=>setProfile({...profile,level:'intermediate'})}>进阶</button></div></div></div>
      <div className="settings-card"><p className="section-kicker">动作名称语言</p><h2>中文与英文名称</h2><div className="segment-row"><span>显示方式</span><div><button className={settings.exerciseNameMode==='bilingual'?'active':''} onClick={()=>setSettings({...settings,exerciseNameMode:'bilingual'})}>中英双语</button><button className={settings.exerciseNameMode==='zh'?'active':''} onClick={()=>setSettings({...settings,exerciseNameMode:'zh'})}>仅中文</button><button className={settings.exerciseNameMode==='en'?'active':''} onClick={()=>setSettings({...settings,exerciseNameMode:'en'})}>English</button></div></div><p className="field-help">动作搜索始终同时匹配中文名、英文名、肌群和器械，不受显示方式影响。</p></div>
      <div className="settings-card"><p className="section-kicker">主要动作基线</p><h2>更新 1RM 与建议重量</h2><p className="field-help">填写近期动作规范的一次最大重量；不建议用动作变形或疼痛状态下的重量。RDL 会按硬拉 1RM 保守换算。</p><OneRmFields profile={profile} onChange={(key,value)=>setProfile({...profile,mainLift1RM:{...profile.mainLift1RM,[key]:value}})}/><button className="primary-action action-button" onClick={saveStrengthBaselines}>保存并重算未来重量</button></div>
      <div className="settings-card ai-permission-card"><p className="section-kicker">AI 记录权限</p><h2>允许确认后写入数据</h2><label className="permission-row"><input type="checkbox" checked={settings.aiNutritionLogging} onChange={(event)=>setSettings({...settings,aiNutritionLogging:event.target.checked})}/><span><b>允许 AI 记录饮食</b><small>对话识别餐食后生成待确认卡，确认后写入热量镜。</small></span></label><label className="permission-row"><input type="checkbox" checked={settings.aiWorkoutLogging} onChange={(event)=>setSettings({...settings,aiWorkoutLogging:event.target.checked})}/><span><b>允许 AI 记录训练</b><small>可按今天、昨天或明确日期整理实际组次、重量和 RPE；确认后更新对应日历卡片。</small></span></label><p className="field-help">关闭权限后，模型仍可回答和分析，但客户端会拒绝对应写入操作。</p></div>
      <div className="settings-card model-settings">
        <div className="section-row"><div><p className="section-kicker">模型连接</p><h2>供应商、账号与本地端口</h2></div><span>{settings.providerId==='chatgpt'?'ChatGPT Codex OAuth':protocolLabels[settings.protocol]}</span></div>
        <div className="provider-grid">{providerPresets.map((preset)=><button key={preset.id} className={settings.providerId===preset.id?'active':''} onClick={()=>{selectProvider(preset.id);setConnectionTest(null);}}><b>{preset.name}</b><small>{preset.subtitle}</small></button>)}</div>
        {settings.providerId==='chatgpt'&&<div className="chatgpt-auth-card">
          {settings.chatgptAccessToken&&settings.chatgptAccountId?<><div className="chatgpt-account-row"><span className="account-mark">✓</span><div><b>{settings.chatgptEmail||'ChatGPT 账号已连接'}</b><small>{settings.chatgptPlanType?`${settings.chatgptPlanType.toUpperCase()} 计划 · `:''}令牌到期 {new Date(settings.chatgptExpiresAt).toLocaleString('zh-CN')}</small></div></div><button className="secondary-action action-button" onClick={logoutChatGpt}>退出账号</button></>:deviceLogin?<><p className="field-help">在浏览器登录 ChatGPT，然后输入下面的设备码。练途正在等待授权结果。</p><button className="device-code" onClick={copyChatGptCode}><small>点击复制设备码</small><b>{deviceLogin.userCode}</b></button><div className="two-buttons"><button className="secondary-action action-button" onClick={cancelChatGptLogin}>取消</button><button className="primary-action action-button" onClick={openChatGptLoginPage}>重新打开登录页</button></div></>:<button className="primary-action action-button" onClick={loginChatGpt} disabled={!isNativeApp()}>使用 ChatGPT 账号登录</button>}
          <p className="model-list-status" role="status">{chatGptAuthStatus||(!isNativeApp()?'请在练途 APK 中使用账号登录':'登录后会自动读取此账号可用的 Codex 模型')}</p>
        </div>}
        <div className="form-grid">
          {settings.providerId!=='chatgpt'&&<label>连接协议<select value={settings.protocol} onChange={(event)=>{setModels([]);setSettings({...settings,providerId:'custom',protocol:event.target.value as ProviderProtocol});setConnectionTest(null);}}>{(Object.keys(protocolLabels) as ProviderProtocol[]).map((protocol)=><option key={protocol} value={protocol}>{protocolLabels[protocol]}</option>)}</select></label>}
          <label>自动获取的模型<select value={models.includes(settings.model)?settings.model:''} onChange={(event)=>{if(event.target.value)setSettings({...settings,model:event.target.value});setConnectionTest(null);}}><option value="">{models.length?'请选择模型':'等待读取模型列表'}</option>{models.map((model)=><option key={model} value={model}>{model}</option>)}</select></label>
        </div>
        <p className="model-list-status" role="status">{modelListStatus}</p>
        <label>模型 ID 手动输入<input value={settings.model} onChange={(event)=>{setSettings({...settings,model:event.target.value});setConnectionTest(null);}} placeholder="列表没有时可手工输入模型 ID"/></label>
        {settings.providerId!=='chatgpt'&&<><label>Base URL / 完整端点<input value={settings.endpoint} onChange={(event)=>{setModels([]);setSettings({...settings,providerId:'custom',endpoint:event.target.value});setConnectionTest(null);}} placeholder="https://… 或 APK 内 http://192.168…:11434"/></label><label>API 密钥（本地模型可留空）<input type="password" autoComplete="off" placeholder="仅保存在这台设备" value={settings.apiKey} onChange={(event)=>{setSettings({...settings,apiKey:event.target.value});setConnectionTest(null);}}/></label><details className="advanced-settings"><summary>高级：自定义请求头</summary><label>JSON 请求头<textarea value={settings.customHeaders} onChange={(event)=>setSettings({...settings,customHeaders:event.target.value})} placeholder={'{"HTTP-Referer":"https://example.com","X-Title":"练途"}'}/></label><p>用于网关、反向代理或供应商附加鉴权；自定义值会覆盖协议默认请求头。</p></details></>}
        <div className="model-test-buttons"><button className="secondary-action action-button" onClick={fetchModels}>重新读取</button><button className="secondary-action action-button" onClick={textProbe}>普通测试</button><button className="secondary-action action-button" onClick={probe}>视觉测试</button></div>
        {connectionTest&&<div className={`connection-result ${connectionTest.kind}`} role="status"><b>{connectionTest.kind==='testing'?'测试中':connectionTest.kind==='success'?'连接成功':'连接失败'}</b><span>{connectionTest.message}</span></div>}
        <p className="field-help">{settings.providerId==='chatgpt'?'账号授权完成后自动读取可用模型；选择模型后先运行普通测试，再运行视觉测试。':'进入本页后会自动读取模型名称，也可手工覆盖。先运行普通测试确认接口、密钥和模型，再运行视觉测试。支持 OpenAI Chat、Responses、Anthropic Messages、Gemini GenerateContent 与 Ollama 原生协议。'}{isNativeApp()?' APK 可直连本机或局域网 HTTP 端口。':' 网页版自定义代理仅允许 HTTPS；本机、局域网端口和 ChatGPT 账号登录请使用 APK。'}</p>
      </div>
      <div className="settings-card calorie-target-card"><p className="section-kicker">每日能量目标</p><h2>{baseCalorieTarget} kcal 基础目标</h2><div className="segment-row"><span>计算方式</span><div><button className={settings.calorieTargetMode==='auto'?'active':''} onClick={()=>setSettings({...settings,calorieTargetMode:'auto'})}>自动计算</button><button className={settings.calorieTargetMode==='manual'?'active':''} onClick={()=>setSettings({...settings,calorieTargetMode:'manual'})}>手动设置</button></div></div>{settings.calorieTargetMode==='manual'?<label>手动基础目标（kcal）<input type="number" min="500" max="10000" value={settings.target} onChange={(event)=>setSettings({...settings,target:Math.min(10000,Math.max(500,Number(event.target.value)||500))})}/></label>:<div className="calorie-formula"><span>基础代谢 <b>{caloriePlan.bmr}</b></span><span>活动系数 <b>× {caloriePlan.activityMultiplier}</b></span><span>目标修正 <b>{caloriePlan.goalAdjustment>=0?'+':''}{caloriePlan.goalAdjustment}</b></span><small>来源：{calorieSourceLabel}；训练与手动活动消耗会在当天另加。</small></div>}<button className="primary-action action-button" onClick={saveSettings}>保存全部设置</button></div>
      <button className="install-card" onClick={()=>setInstallOpen(true)}><span>＋</span><div><b>安装到手机主屏幕</b><small>像普通 App 一样打开练途</small></div><i>›</i></button>
    </section>}

    <nav className="bottom-nav" aria-label="主导航"><button className={tab==='today'?'active':''} onClick={()=>setTab('today')}><span>▶</span>今日</button><button className={tab==='plan'?'active':''} onClick={()=>setTab('plan')}><span>▦</span>计划</button><button className={tab==='nutrition'?'active':''} onClick={()=>setTab('nutrition')}><span>◉</span>热量镜</button><button className={tab==='coach'?'active':''} onClick={()=>setTab('coach')}><span>AI</span>教练</button><button className={tab==='body'?'active':''} onClick={()=>setTab('body')}><span>⌁</span>身体</button><button className={tab==='settings'?'active':''} onClick={()=>setTab('settings')}><span>⚙</span>我的</button></nav>

    {activeSession&&activeWorkoutOpen&&<WorkoutSheet session={activeSession} logs={activeLogs} note={workoutNote} updateSet={updateActiveSet} setNote={setWorkoutNote} close={pauseWorkout} finish={finishWorkout} showDetail={setDetail} nameMode={settings.exerciseNameMode}/>}
    {editingSession&&<SessionEditorSheet session={editingSession} save={saveSessionOverride} restore={()=>restoreSessionOverride(editingSession.date)} close={()=>setEditingSession(null)} showDetail={setDetail} nameMode={settings.exerciseNameMode}/>}
    {detail&&<ExerciseSheet exercise={detail} media={media} close={()=>setDetail(null)} nameMode={settings.exerciseNameMode}/>}
    {recoveryAfter&&<RecoverySheet session={recoveryAfter} close={()=>setRecoveryAfter(null)}/>}
    {installOpen&&<div className="modal-backdrop" onClick={()=>setInstallOpen(false)}><section className="install-sheet" onClick={(event)=>event.stopPropagation()}><span className="sheet-handle"/><p className="section-kicker">安装练途</p><h2>添加到主屏幕</h2><ol><li><b>1</b><span>使用 Safari 或 Chrome 打开当前网址</span></li><li><b>2</b><span>点击“分享”或浏览器菜单</span></li><li><b>3</b><span>选择“添加到主屏幕”或“安装应用”</span></li></ol><button className="primary-action action-button" onClick={()=>setInstallOpen(false)}>知道了</button></section></div>}
    {showOnboarding&&<OnboardingSheet profile={profile} settings={settings} setProfile={setProfile} setSettings={setSettings} finish={finishOnboarding}/>}
  </main>;
}

function OneRmFields({profile,onChange}:{profile:TrainingProfile;onChange:(key:MainLiftKey,value:number)=>void}) {
  return <div className="form-grid one-rm-grid">{(Object.keys(mainLiftLabels) as MainLiftKey[]).map((key)=><label key={key}>{mainLiftLabels[key]} 1RM（kg）<input type="number" inputMode="decimal" min="0" max="600" step="0.5" value={profile.mainLift1RM?.[key]||''} onChange={(event)=>onChange(key,Math.min(600,Math.max(0,Number(event.target.value)||0)))}/></label>)}</div>;
}

function OnboardingSheet({profile,settings,setProfile,setSettings,finish}:{profile:TrainingProfile;settings:Settings;setProfile:(value:TrainingProfile)=>void;setSettings:(value:Settings)=>void;finish:(destination?:Tab)=>void}) {
  return <div className="workout-overlay onboarding-overlay"><section className="workout-sheet onboarding-sheet">
    <header><div><small>首次使用 · 可随时修改</small><b>先回答几个问题，再安排训练</b></div><button onClick={()=>finish()}>跳过</button></header>
    <div className="onboarding-copy"><p>计划由本地规则引擎生成；接入大模型和上传报告都是可选项。任何 AI 调整都要你再次确认。</p></div>
    <div className="settings-card"><p className="section-kicker">1 · 目标与经验</p><div className="goal-grid">{(Object.keys(goalLabels) as TrainingGoal[]).map((goal)=><button key={goal} className={profile.goal===goal?'active':''} onClick={()=>setProfile({...profile,goal})}>{goalLabels[goal]}</button>)}</div><div className="segment-row"><span>训练经验</span><div><button className={profile.level==='beginner'?'active':''} onClick={()=>setProfile({...profile,level:'beginner'})}>新手 / 恢复</button><button className={profile.level==='intermediate'?'active':''} onClick={()=>setProfile({...profile,level:'intermediate'})}>中级</button></div></div></div>
    <div className="settings-card"><p className="section-kicker">2 · 时间与器械</p><div className="segment-row"><span>每周训练</span><div>{([2,3,4,5,6] as TrainingDayCount[]).map((days)=><button key={days} className={profile.daysPerWeek===days?'active':''} onClick={()=>setProfile({...profile,daysPerWeek:days})}>{days} 天</button>)}</div></div><div className="segment-row"><span>器械</span><div>{([['bodyweight','徒手'],['dumbbell','哑铃'],['gym','健身房']] as [Equipment,string][]).map(([value,label])=><button key={value} className={profile.equipment===value?'active':''} onClick={()=>setProfile({...profile,equipment:value})}>{label}</button>)}</div></div><label>单次可用时间（分钟）<input type="number" inputMode="numeric" value={profile.sessionMinutes||''} onChange={(event)=>setProfile({...profile,sessionMinutes:event.target.value===''?0:Number(event.target.value)})} onBlur={()=>setProfile({...profile,sessionMinutes:Math.min(120,Math.max(20,profile.sessionMinutes||60))})}/></label></div>
    <div className="settings-card"><p className="section-kicker">3 · 主要动作 1RM</p><h2>用于计算开局训练重量</h2><p className="field-help">填写近期动作规范的一次最大重量；至少填写一个。完全不知道可以点右上角跳过，首训按 RPE 6–7 校准。</p><OneRmFields profile={profile} onChange={(key,value)=>setProfile({...profile,mainLift1RM:{...profile.mainLift1RM,[key]:value}})}/></div>
    <div className="settings-card"><p className="section-kicker">4 · 恢复、体格与限制</p><div className="form-grid"><label>平均睡眠（小时）<input type="number" inputMode="decimal" step="0.1" value={profile.sleepHours??''} onChange={(event)=>setProfile({...profile,sleepHours:event.target.value===''?undefined:Number(event.target.value)})} onBlur={()=>setProfile({...profile,sleepHours:Math.min(12,Math.max(3,profile.sleepHours??7.5))})}/></label><label>当前体重（kg）<input type="number" inputMode="decimal" value={profile.weightKg||''} onChange={(event)=>setProfile({...profile,weightKg:event.target.value===''?0:Number(event.target.value)})} onBlur={()=>setProfile({...profile,weightKg:Math.min(250,Math.max(30,profile.weightKg||65))})}/></label><label>身高（cm）<input type="number" inputMode="decimal" value={profile.heightCm??''} onChange={(event)=>setProfile({...profile,heightCm:event.target.value===''?undefined:Number(event.target.value)})}/></label><label>年龄<input type="number" inputMode="numeric" value={profile.age??''} onChange={(event)=>setProfile({...profile,age:event.target.value===''?undefined:Number(event.target.value)})}/></label><label>性别<select value={profile.sex??''} onChange={(event)=>setProfile({...profile,sex:event.target.value?event.target.value as 'male'|'female':undefined})}><option value="">未填写</option><option value="male">男</option><option value="female">女</option></select></label><label>日常非训练活动<select value={profile.dailyActivity??'light'} onChange={(event)=>setProfile({...profile,dailyActivity:event.target.value as TrainingProfile['dailyActivity']})}><option value="sedentary">久坐为主</option><option value="light">一般活动</option><option value="active">体力活动较多</option></select></label></div><p className="field-help">这些数据用于动态热量目标；不填写身高、年龄或性别时会按体重估算，不再固定使用 2000 kcal。</p><label>疼痛或不适部位<input value={(profile.painAreas??[]).join('、')} onChange={(event)=>setProfile({...profile,painAreas:event.target.value.split(/[、,，]/).map((item)=>item.trim()).filter(Boolean)})} placeholder="没有可留空；例如右膝、肩前侧"/></label><label>现有心肺活动<input value={(profile.cardioActivities??[]).join('、')} onChange={(event)=>setProfile({...profile,cardioActivities:event.target.value.split(/[、,，]/).map((item)=>item.trim()).filter(Boolean)})} placeholder="例如跑步、骑车、球类"/></label></div>
    <div className="settings-card"><p className="section-kicker">5 · 可选大模型</p><label>API 密钥<input type="password" autoComplete="off" value={settings.apiKey} onChange={(event)=>setSettings({...settings,apiKey:event.target.value})} placeholder="可跳过，之后在我的设置中填写"/></label></div>
    <div className="two-buttons"><button className="secondary-action action-button" onClick={()=>finish('body')}>先生成计划，再上传报告</button><button className="primary-action action-button" onClick={()=>finish('today')}>生成基础计划</button></div>
  </section></div>;
}

function SessionEditorSheet({session,save,restore,close,showDetail,nameMode}:{session:TrainingSession;save:(value:TrainingSession)=>void;restore:()=>void;close:()=>void;showDetail:(value:ExerciseDefinition)=>void;nameMode:ExerciseNameMode}) {
  const [draft,setDraft]=useState<ExercisePrescription[]>(session.exercises);
  const [libraryQuery,setLibraryQuery]=useState('');
  const [libraryEquipment,setLibraryEquipment]=useState<'all'|Equipment>('all');
  const update=(id:string,patch:Partial<ExercisePrescription>)=>setDraft((items)=>items.map((item)=>item.id===id?{...item,...patch}:item));
  const add=(exercise:ExerciseDefinition)=>{
    if(draft.some((item)=>item.id===exercise.id))return;
    setDraft((items)=>[...items,createCustomExercise(exercise)]);
  };
  const preset=(id:string,sets:number,reps:number)=>update(id,{sets,reps:`${reps} 次`});
  const query=libraryQuery.trim().toLocaleLowerCase();
  const allExercises=[...Object.values(exerciseCatalog),...datasetExerciseDefinitions,...freeExerciseDefinitions];
  const matchingExercises=allExercises.filter((exercise)=>{
    if(libraryEquipment!=='all'&&!exercise.equipment.includes(libraryEquipment))return false;
    if(!query)return true;
    return [exercise.name,exercise.englishName,exercise.target,exercise.level,exercise.category,...(exercise.primaryMuscles??[]),...(exercise.secondaryMuscles??[])].filter(Boolean).join(' ').toLocaleLowerCase().includes(query);
  });
  const visibleExercises=matchingExercises.slice(0,libraryQuery.trim()?80:36);
  return <div className="workout-overlay session-editor-overlay"><section className="session-editor-sheet">
    <header><button onClick={close}>取消</button><div><small>{session.date} · 只改当天</small><b>编辑动作与组次</b></div><button onClick={restore}>恢复系统</button></header>
    <p className="editor-note">“3×12”表示 3 组、每组 12 次；“12×3”表示 12 组、每组 3 次。后者训练量较高，不作为普通默认值，但可以手动填写。</p>
    <div className="session-editor-list">{draft.map((exercise)=>{const names=exerciseNameParts(exercise,nameMode);return <article key={exercise.id}><div className="editor-exercise-head"><ExerciseThumb exercise={exercise}/><div><b>{names.primary}</b>{names.secondary&&<small className="exercise-name-alt">{names.secondary}</small>}<small>{exercise.target}</small></div><button onClick={()=>setDraft((items)=>items.filter((item)=>item.id!==exercise.id))}>删除</button></div><div className="scheme-presets"><button onClick={()=>preset(exercise.id,5,5)}>5×5</button><button onClick={()=>preset(exercise.id,4,8)}>4×8</button><button onClick={()=>preset(exercise.id,3,12)}>3×12</button></div><div className="editor-fields"><label>角色<select value={exercise.role} onChange={(event)=>update(exercise.id,{role:event.target.value as ExercisePrescription['role']})}><option value="T1">T1 主项</option><option value="T2">T2 次级</option><option value="T3">T3 辅助</option><option value="conditioning">体能</option></select></label><label>组数<input type="number" inputMode="numeric" min="1" max="12" value={exercise.sets} onChange={(event)=>update(exercise.id,{sets:Math.min(12,Math.max(1,Number(event.target.value)||1))})}/></label><label>每组次数<input value={exercise.reps} onChange={(event)=>update(exercise.id,{reps:event.target.value})} placeholder="例如 5 次或 8–12 次"/></label><label>重量 kg<input type="number" inputMode="decimal" min="0" step="0.5" value={exercise.suggestedWeightKg??''} onChange={(event)=>update(exercise.id,{suggestedWeightKg:event.target.value===''?undefined:Math.max(0,Number(event.target.value)||0)})}/></label><label>目标 RPE<input type="number" inputMode="decimal" min="1" max="10" step="0.5" value={exercise.targetRpe} onChange={(event)=>update(exercise.id,{targetRpe:Math.min(10,Math.max(1,Number(event.target.value)||7))})}/></label><label>休息秒<input type="number" inputMode="numeric" min="15" max="600" step="15" value={exercise.restSeconds} onChange={(event)=>update(exercise.id,{restSeconds:Math.min(600,Math.max(15,Number(event.target.value)||60))})}/></label></div></article>;})}</div>
    <section className="exercise-library-browser">
      <div className="section-row"><div><p className="section-kicker">GymVisual 动图优先 · free-exercise-db 补充</p><h2>2200+ 动作条目 · 1324 个 GIF</h2></div><span>{matchingExercises.length} 个匹配</span></div>
      <div className="library-filters"><input type="search" value={libraryQuery} onChange={(event)=>setLibraryQuery(event.target.value)} placeholder="搜索动作中文名、英文名、肌群或器械"/><select value={libraryEquipment} onChange={(event)=>setLibraryEquipment(event.target.value as 'all'|Equipment)}><option value="all">全部器械</option><option value="gym">健身房器械</option><option value="dumbbell">哑铃</option><option value="bodyweight">徒手</option></select></div>
      <div className="library-results">{visibleExercises.map((exercise)=>{const added=draft.some((item)=>item.id===exercise.id),names=exerciseNameParts(exercise,nameMode);return <article key={exercise.id}><button className="library-exercise-info" onClick={()=>showDetail(exercise)}><ExerciseThumb exercise={exercise}/><span><b>{names.primary}</b>{names.secondary&&<small className="exercise-name-alt">{names.secondary}</small>}<small>{exercise.target}</small></span></button><button disabled={added} onClick={()=>add(exercise)}>{added?'已添加':'添加'}</button></article>;})}</div>
      {matchingExercises.length>visibleExercises.length&&<p className="field-help">当前显示前 {visibleExercises.length} 个结果；输入更具体的动作、肌群或器械名称可继续筛选全部动作。</p>}
    </section>
    <button className="primary-action action-button" disabled={draft.length===0} onClick={()=>save({...session,exercises:draft})}>保存当天安排</button>
  </section></div>;
}

function WorkoutSheet({session,logs,note,updateSet,setNote,close,finish,showDetail,nameMode}:{session:TrainingSession;logs:ExerciseLog[];note:string;updateSet:(id:string,setIndex:number,patch:Partial<ExerciseSetLog>)=>void;setNote:(value:string)=>void;close:()=>void;finish:()=>void;showDetail:(value:ExerciseDefinition)=>void;nameMode:ExerciseNameMode}) {
  const completed=logs.reduce((sum,item)=>sum+item.completedSets,0),planned=session.exercises.reduce((sum,item)=>sum+item.sets,0);
  return <div className="workout-overlay"><section className="workout-sheet"><header><button onClick={close}>暂存退出</button><div><small>{session.phase}阶段 · 正在训练</small><b>{session.title}</b></div><span>{completed}/{planned} 组</span></header><div className="workout-progress"><i style={{width:`${completed/Math.max(1,planned)*100}%`}}/></div><div className="workout-exercises">{session.exercises.map((exercise)=>{
    const log=logs.find((item)=>item.exerciseId===exercise.id)!,names=exerciseNameParts(exercise,nameMode),setLogs=log.setLogs??createSetLogs(exercise.sets,log.reps,log.weightKg,log.rpe);
    return <article key={exercise.id}><button className="exercise-info" onClick={()=>showDetail(exercise)}><ExerciseThumb exercise={exercise}/><div><b>{exercise.role} · {names.primary}</b>{names.secondary&&<small className="exercise-name-alt">{names.secondary}</small>}<small>{exercise.sets} 组 × {exercise.reps} · RPE {exercise.targetRpe} · 休 {exercise.restSeconds} 秒</small><small>{exercise.suggestedWeightKg?`本次建议 ${exercise.suggestedWeightKg} kg${exercise.loadPercent1RM?` · ${exercise.loadPercent1RM}% 1RM`:''}`:'本次先用 RPE 6–7 校准重量'}</small></div><span>示范 ›</span></button><p className="rule-note"><b>{exercise.weightBasis}</b><br/>{exercise.progressionNote}</p><div className="set-log-table"><div className="set-log-head"><span>组</span><span>kg</span><span>次数</span><span>RPE</span><span>完成</span></div>{setLogs.map((set,index)=><div className={`set-log-row ${set.completed?'completed':''}`} key={set.setNumber}><b>{set.setNumber}</b><input aria-label={`${names.primary} 第${set.setNumber}组重量`} type="number" inputMode="decimal" min="0" step="0.5" value={set.weightKg||''} onChange={(event)=>updateSet(exercise.id,index,{weightKg:Math.max(0,Number(event.target.value)||0)})}/><input aria-label={`${names.primary} 第${set.setNumber}组次数`} value={set.reps} onChange={(event)=>updateSet(exercise.id,index,{reps:event.target.value})}/><input aria-label={`${names.primary} 第${set.setNumber}组RPE`} type="number" inputMode="decimal" min="1" max="10" step="0.5" value={set.rpe} onChange={(event)=>updateSet(exercise.id,index,{rpe:Math.min(10,Math.max(1,Number(event.target.value)||7))})}/><button aria-label={`${names.primary} 第${set.setNumber}组${set.completed?'取消完成':'标记完成'}`} className={set.completed?'completed':''} onClick={()=>updateSet(exercise.id,index,{completed:!set.completed})}>{set.completed?'✓':'○'}</button></div>)}</div></article>;
  })}</div><label className="workout-note">训练备注<textarea value={note} onChange={(event)=>setNote(event.target.value)} placeholder="例如：睡眠不足、右膝感觉良好…"/></label><button className="finish-workout" onClick={finish}>完成训练并查看拉伸恢复</button></section></div>;
}

function ExerciseThumb({exercise}:{exercise:ExerciseDefinition}) {
  const libraryImage=exercise.thumbnail||exercise.images?.[0]||'';
  const fallback=libraryImage||exerciseMedia[exercise.id]?.image||'';
  const [source,setSource]=useState(fallback);
  useEffect(()=>{
    let cancelled=false;
    queueMicrotask(()=>{
      if(cancelled)return;
      if(libraryImage||exerciseMedia[exercise.id]||!exercise.wgerId){setSource(fallback);return;}
      fetch(`/api/wger?id=${exercise.wgerId}`).then(async(response)=>{
        if(!response.ok)throw new Error('动作图片加载失败');
        return await response.json() as ExerciseMedia;
      }).then((item)=>{if(!cancelled)setSource(item.image||fallback);}).catch(()=>{if(!cancelled)setSource(fallback);});
    });
    return ()=>{cancelled=true;};
  },[exercise.id,exercise.wgerId,fallback,libraryImage]);
  return <span className="exercise-thumb">{source?<img src={source} alt=""/>:<i>肌</i>}</span>;
}

function RecoverySheet({session,close}:{session:TrainingSession;close:()=>void}) {
  const items=recoveryRecommendations(session);
  return <div className="workout-overlay recovery-overlay"><section className="recovery-sheet"><header><div><small>训练完成</small><h2>拉伸与恢复建议</h2></div><button onClick={close}>完成</button></header><p className="recovery-intro">根据本次 {session.title} 的主要训练肌群生成。三种方式任选其一，也可以先徒手拉伸再选择一种工具放松。</p>{items.map((item)=><article key={item.area}><div className="recovery-area"><span>◎</span><b>{item.area}</b></div><div><b>纯动作</b><p>{item.stretch}</p></div><div><b>泡沫轴</b><p>{item.foam}</p></div><div><b>筋膜枪</b><p>{item.massageGun}</p></div></article>)}<button className="primary-action action-button" onClick={close}>完成本次恢复</button></section></div>;
}

function ExerciseSheet({exercise,media,close,nameMode}:{exercise:ExerciseDefinition;media:ExerciseMedia|null;close:()=>void;nameMode:ExerciseNameMode}) {
  const libraryImages=exercise.images??[];
  const aiSupplement=libraryImages.some((image)=>image.includes('/generated-exercises/free-db-supplements/'));
  const names=exerciseNameParts(exercise,nameMode);
  return <div className="modal-backdrop detail-layer" onClick={close}><section className="exercise-sheet" onClick={(event)=>event.stopPropagation()}><span className="sheet-handle"/>
    {exercise.animation?<img className="exercise-animation" src={exercise.animation} alt={`${exercise.name}循环动作示范`}/>:libraryImages.length?<div className={`exercise-pose-pair ${libraryImages.length===1?'single':''}`}>{libraryImages.slice(0,2).map((image,index)=><figure key={image}><img src={image} alt={`${exercise.name}${libraryImages.length===1?'动作阶段':'起始结束'}示意`}/><figcaption>{libraryImages.length===1?'起始与结束阶段':index===0?'起始姿势':'结束姿势'}</figcaption></figure>)}</div>:media?.video?<video controls playsInline src={media.video}/>:media?.image?<><img src={media.image} alt={`${exercise.name}动作示范`}/>{media.source==='ai'&&<small className="ai-media-tag">AI 生成动作示意</small>}</>:<div className="movement-placeholder"><span>↕</span><small>动作示范加载中或暂无媒体</small></div>}
    <p className="section-kicker">{exercise.target}</p><h2>{names.primary}</h2>{names.secondary&&<p className="english-name">{names.secondary}</p>}
    {exercise.level&&<p className="exercise-library-meta">难度：{exercise.level} · 主肌群：{exercise.primaryMuscles?.join('、')||'未标注'}{exercise.secondaryMuscles?.length?` · 辅助：${exercise.secondaryMuscles.join('、')}`:''}</p>}
    <ol>{exercise.cues.map((cue,index)=><li key={`${index}-${cue}`}><b>{index+1}</b><span>{cue}</span></li>)}</ol><p className="easier"><b>需要降低难度：</b>{exercise.easier}</p>
    {exercise.source==='exercises-dataset'?<p className="attribution">{exercise.attribution} · 动作数据 exercises-dataset</p>:libraryImages.length?<p className="attribution">动作数据：<a href="https://github.com/yuhonas/free-exercise-db" target="_blank" rel="noreferrer">yuhonas/free-exercise-db</a> · Unlicense{aiSupplement?'；动作媒体：AI 生成补充素材 · 练途项目原创资产':'；图片同源'}</p>:media?.image&&<p className="attribution">{media.source==='ai'?<>动作媒体：AI 生成 · 练途项目原创资产</>:<>动作媒体：{media.author||'wger 社区'} · <a href={media.licenseUrl} target="_blank" rel="noreferrer">{media.license}</a> · 来源 wger</>}</p>}
    <button className="primary-action action-button" onClick={close}>返回训练</button>
  </section></div>;
}

function ResultCard({meal,imageData,updateGrams,saveMeal,reset}:{meal:Meal;imageData:string;updateGrams:(id:string,value:string)=>void;saveMeal:()=>void;reset:()=>void}) {
  return <section className="result-card"><div className="result-head">{imageData&&<img src={imageData} alt="已分析的餐食"/>}<div><p className="section-kicker">热量镜 v0.3.5 · 置信度 {meal.confidence}%</p><h2>{meal.mealName}</h2><strong>{fixed(meal.calories)} kcal</strong><span>蛋白质 {fixed(meal.protein,1)}g · 碳水 {fixed(meal.carbs,1)}g · 脂肪 {fixed(meal.fat,1)}g</span></div></div><p className="rule-note">本地营养数据优先；修改克数或分量倍率后在本机重新计算。</p><div className="food-list">{meal.items.map((item)=><article key={item.id} className={`food-row ${item.sourceType==='model'?'model-estimate':''}`}><div className="food-title"><div><b>{item.name}</b>{item.sourceType==='model'&&<em>模型估算</em>}</div><strong>{fixed(item.calories,1)} kcal</strong></div><div className="grams-control"><label>克数<input type="number" inputMode="decimal" min="0" value={Number(item.grams.toFixed(1))} onChange={(event)=>updateGrams(item.id,event.target.value)}/></label><span>{fixed(item.caloriesPer100)} kcal/100g</span></div><div className="portion-buttons">{[.5,1,1.5,2].map((multiplier)=><button key={multiplier} onClick={()=>updateGrams(item.id,String(Math.round(item.grams*multiplier*10)/10))}>×{multiplier}</button>)}</div><small>来源：{item.nutritionSource}</small></article>)}</div><p className="assumptions"><b>估算依据</b>{meal.assumptions}</p><div className="two-buttons"><button className="secondary-action action-button" onClick={reset}>重新拍照</button><button className="primary-action action-button" onClick={saveMeal}>记入今天</button></div></section>;
}

function Diary({meals,onDelete}:{meals:Meal[];onDelete:(id:string)=>void}) {
  if(!meals.length)return <section className="empty-card compact-empty"><span>◉</span><h2>还没有饮食记录</h2><p>拍照分析后，摄入会同步到训练首页。</p></section>;
  return <section className="diary-list nutrition-diary"><p className="section-kicker">饮食日记</p>{meals.slice(0,10).map((meal)=><article key={meal.id} className="diary-card"><div><small>{new Date(meal.timestamp).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</small><h2>{meal.mealName}</h2><p>{fixed(meal.protein,1)}g 蛋白质 · {meal.items.filter((item)=>item.grams>0).length} 个分项</p></div><div><strong>{fixed(meal.calories)}<small> kcal</small></strong><button onClick={()=>onDelete(meal.id)}>删除</button></div></article>)}</section>;
}
