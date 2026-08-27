'use client';
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from 'react';
import { enrichModelMeal, Meal, parseModelJson, recalculateMeal } from '@/lib/nutrition';

type Tab = 'home' | 'diary' | 'settings';
type Settings = { endpoint:string; model:string; apiKey:string; target:number };

const SETTINGS_KEY = 'calorielens.settings.v1';
const MEALS_KEY = 'calorielens.meals.v1';
const defaultSettings: Settings = {
  endpoint:'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  model:'glm-5v-turbo', apiKey:'', target:2000,
};

const todayKey = (time:number) => new Date(time).toLocaleDateString('zh-CN');
const fixed = (value:number,digits=0) => value.toLocaleString('zh-CN',{maximumFractionDigits:digits,minimumFractionDigits:digits});

async function imageToData(file: File) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve,reject) => {
      const value = new Image(); value.onload=()=>resolve(value); value.onerror=()=>reject(new Error('无法读取这张图片')); value.src=objectUrl;
    });
    const scale = Math.min(1,1024 / Math.max(image.width,image.height));
    const canvas = document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(image.width*scale)); canvas.height=Math.max(1,Math.round(image.height*scale));
    canvas.getContext('2d')?.drawImage(image,0,0,canvas.width,canvas.height);
    return canvas.toDataURL('image/jpeg',.84);
  } finally { URL.revokeObjectURL(objectUrl); }
}

function testImageData() {
  const canvas=document.createElement('canvas'); canvas.width=360; canvas.height=220;
  const context=canvas.getContext('2d');
  if (!context) return '';
  context.fillStyle='#df554d'; context.fillRect(0,0,180,220);
  context.fillStyle='#3e77cf'; context.fillRect(180,0,180,220);
  context.fillStyle='white'; context.font='bold 28px sans-serif'; context.fillText('视觉测试',118,122);
  return canvas.toDataURL('image/jpeg',.86);
}

async function proxy(body: Record<string,unknown>) {
  const response=await fetch('/api/bigmodel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const payload=await response.json() as { error?:string; content?:string; models?:string[] };
  if (!response.ok) throw new Error(payload.error || '请求失败，请稍后重试');
  return payload;
}

export default function Home() {
  const [tab,setTab]=useState<Tab>('home');
  const [settings,setSettings]=useState<Settings>(defaultSettings);
  const [meals,setMeals]=useState<Meal[]>([]);
  const [imageData,setImageData]=useState('');
  const [currentMeal,setCurrentMeal]=useState<Meal|null>(null);
  const [models,setModels]=useState<string[]>([]);
  const [busy,setBusy]=useState('');
  const [notice,setNotice]=useState('');
  const [installOpen,setInstallOpen]=useState(false);
  const [ready,setReady]=useState(false);
  const [currentDay,setCurrentDay]=useState('');

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>undefined);
    queueMicrotask(() => {
      try {
        const savedSettings=localStorage.getItem(SETTINGS_KEY);
        const savedMeals=localStorage.getItem(MEALS_KEY);
        if (savedSettings) setSettings({...defaultSettings,...JSON.parse(savedSettings)});
        if (savedMeals) setMeals(JSON.parse(savedMeals));
      } catch { setNotice('部分本机记录无法读取，已使用默认设置'); }
      setCurrentDay(todayKey(Date.now()));
      setReady(true);
    });
  },[]);

  useEffect(() => { if (ready) localStorage.setItem(MEALS_KEY,JSON.stringify(meals)); },[meals,ready]);

  const todayMeals=useMemo(() => meals.filter((meal)=>todayKey(meal.timestamp)===currentDay),[meals,currentDay]);
  const totals=useMemo(() => todayMeals.reduce((sum,meal)=>({
    calories:sum.calories+meal.calories,protein:sum.protein+meal.protein,
    carbs:sum.carbs+meal.carbs,fat:sum.fat+meal.fat,
  }),{calories:0,protein:0,carbs:0,fat:0}),[todayMeals]);
  const progress=Math.min(100,totals.calories/Math.max(1,settings.target)*100);

  const saveSettings=() => {
    localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));
    setNotice('设置已保存在这台设备');
  };

  const choosePhoto=async (file?:File) => {
    if (!file) return;
    setBusy('正在处理照片…'); setNotice(''); setCurrentMeal(null);
    try { setImageData(await imageToData(file)); }
    catch(error){ setNotice(error instanceof Error?error.message:'无法读取图片'); }
    finally { setBusy(''); }
  };

  const analyze=async () => {
    if (!imageData) return setNotice('请先拍照或选择一张照片');
    if (!settings.apiKey.trim()) { setTab('settings'); return setNotice('请先填写 API 密钥'); }
    setBusy('正在识别食物并计算营养…'); setNotice('');
    try {
      const payload=await proxy({action:'analyze',...settings,imageData});
      const meal=enrichModelMeal(parseModelJson(payload.content || ''));
      if (meal.calories<=0) throw new Error('本地数据库和模型估算均未得到可计算结果');
      setCurrentMeal(meal);
    } catch(error){ setNotice(error instanceof Error?error.message:'分析失败，请重试'); }
    finally { setBusy(''); }
  };

  const updateGrams=(id:string,value:string) => {
    if (!currentMeal) return;
    const grams=Math.max(0,Number.parseFloat(value)||0);
    setCurrentMeal(recalculateMeal(currentMeal,currentMeal.items.map((item)=>item.id===id?{...item,grams}:item)));
  };

  const saveMeal=() => {
    if (!currentMeal) return;
    setMeals((items)=>[{...currentMeal,timestamp:Date.now()},...items]);
    setCurrentMeal(null); setImageData(''); setNotice('已记入今天的饮食日记');
  };

  const fetchModels=async () => {
    setBusy('正在获取服务器模型列表…'); setNotice('');
    try {
      const payload=await proxy({action:'models',...settings}); setModels(payload.models||[]);
      setNotice(`已获取 ${payload.models?.length||0} 个模型`);
    } catch(error){ setNotice(error instanceof Error?error.message:'获取失败'); }
    finally { setBusy(''); }
  };

  const probe=async () => {
    setBusy('正在验证模型图片能力…'); setNotice('');
    try {
      const payload=await proxy({action:'probe',...settings,imageData:imageData||testImageData()});
      setNotice(`图片测试通过：${(payload.content||'').slice(0,180)}`);
    } catch(error){ setNotice(error instanceof Error?error.message:'测试失败'); }
    finally { setBusy(''); }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div><p className="eyebrow">CALORIE LENS</p><h1>{tab==='home'?'热量镜':tab==='diary'?'饮食日记':'设置'}</h1></div>
        {tab==='home' && <button className="icon-button" aria-label="打开设置" onClick={()=>setTab('settings')}>⚙</button>}
        {tab!=='home' && <button className="text-button" onClick={()=>setTab('home')}>完成</button>}
      </header>

      {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={()=>setNotice('')} aria-label="关闭提示">×</button></div>}
      {busy && <div className="busy" role="status"><i/><span>{busy}</span></div>}

      {tab==='home' && <>
        <section className="daily-card" aria-label="今日营养概览">
          <div className="calorie-ring" style={{'--progress':`${progress*3.6}deg`} as React.CSSProperties}>
            <span>今日已记录</span><strong>{fixed(totals.calories)}</strong><small>/ {settings.target} kcal</small>
          </div>
          <div className="macro-list">
            <div><i className="protein"/><span>蛋白质</span><b>{fixed(totals.protein,1)}g</b></div>
            <div><i className="carbs"/><span>碳水</span><b>{fixed(totals.carbs,1)}g</b></div>
            <div><i className="fat"/><span>脂肪</span><b>{fixed(totals.fat,1)}g</b></div>
          </div>
        </section>

        {!currentMeal && <section className="capture-card">
          {imageData ? <img className="photo-preview" src={imageData} alt="待分析的餐食照片"/> : <div className="camera-mark" aria-hidden="true">⌾</div>}
          <p className="section-kicker">拍照识别 · 本地营养优先</p>
          <h2>{imageData?'照片已准备好':'这一餐，大概多少热量？'}</h2>
          <p className="muted">拍下餐食或从相册选择，逐项查看克数、计算公式与数据来源。</p>
          <label className={imageData?'secondary-action':'primary-action'}>
            <input type="file" accept="image/*" capture="environment" onChange={(event)=>choosePhoto(event.target.files?.[0])}/>
            {imageData?'重新选择照片':'拍照或选择照片'}
          </label>
          {imageData && <button className="primary-action action-button" onClick={analyze} disabled={Boolean(busy)}>开始分析</button>}
        </section>}

        {currentMeal && <ResultCard meal={currentMeal} imageData={imageData} updateGrams={updateGrams} saveMeal={saveMeal} reset={()=>{setCurrentMeal(null);setImageData('')}}/>}

        {!currentMeal && <section className="trust-strip"><span>USDA 本地数据库</span><i>·</i><span>未知食物模型估算</span><i>·</i><span>克数可修改</span></section>}
      </>}

      {tab==='diary' && <Diary meals={meals} onDelete={(id)=>setMeals((items)=>items.filter((meal)=>meal.id!==id))}/>} 

      {tab==='settings' && <section className="settings-stack">
        <div className="settings-card">
          <p className="section-kicker">视觉模型接口</p>
          <h2>连接智谱视觉</h2>
          <label>接口地址<input value={settings.endpoint} onChange={(event)=>setSettings({...settings,endpoint:event.target.value})}/></label>
          <label>API 密钥<input type="password" autoComplete="off" placeholder="仅保存在这台设备" value={settings.apiKey} onChange={(event)=>setSettings({...settings,apiKey:event.target.value})}/></label>
          <label>模型名称<input list="models" value={settings.model} onChange={(event)=>setSettings({...settings,model:event.target.value})}/></label>
          <datalist id="models">{models.map((model)=><option key={model} value={model}/>)}</datalist>
          <div className="two-buttons"><button className="secondary-action action-button" onClick={fetchModels}>获取模型列表</button><button className="secondary-action action-button" onClick={probe}>测试图片能力</button></div>
          <p className="field-help">支持普通开放平台及 Coding Plan 的 OpenAI Chat Completions 地址。密钥只保存在当前浏览器，并随分析请求加密传输，不写入网页源码。</p>
        </div>
        <div className="settings-card">
          <p className="section-kicker">每日目标</p>
          <label>目标热量（kcal）<input type="number" min="500" max="10000" value={settings.target} onChange={(event)=>setSettings({...settings,target:Math.max(500,Number(event.target.value)||2000)})}/></label>
          <button className="primary-action action-button" onClick={saveSettings}>保存设置</button>
        </div>
        <button className="install-card" onClick={()=>setInstallOpen(true)}><span>＋</span><div><b>安装到 iPhone 主屏幕</b><small>像普通 App 一样从桌面打开</small></div><i>›</i></button>
      </section>}

      <nav className="bottom-nav" aria-label="主导航">
        <button className={tab==='home'?'active':''} onClick={()=>setTab('home')}><span>⌂</span>首页</button>
        <button className={tab==='diary'?'active':''} onClick={()=>setTab('diary')}><span>▤</span>日记</button>
        <button className={tab==='settings'?'active':''} onClick={()=>setTab('settings')}><span>⚙</span>设置</button>
      </nav>

      {installOpen && <div className="modal-backdrop" onClick={()=>setInstallOpen(false)}><section className="install-sheet" onClick={(event)=>event.stopPropagation()}>
        <span className="sheet-handle"/><p className="section-kicker">IPHONE 安装</p><h2>添加到主屏幕</h2>
        <ol><li><b>1</b><span>使用 Safari 打开当前网址</span></li><li><b>2</b><span>点击浏览器底部的“分享”按钮</span></li><li><b>3</b><span>选择“添加到主屏幕”，再点“添加”</span></li></ol>
        <button className="primary-action action-button" onClick={()=>setInstallOpen(false)}>知道了</button>
      </section></div>}
    </main>
  );
}

function ResultCard({meal,imageData,updateGrams,saveMeal,reset}:{meal:Meal;imageData:string;updateGrams:(id:string,value:string)=>void;saveMeal:()=>void;reset:()=>void}) {
  return <section className="result-card">
    <div className="result-head">
      {imageData && <img src={imageData} alt="已分析的餐食"/>}
      <div><p className="section-kicker">混合计算结果 · 置信度 {meal.confidence}%</p><h2>{meal.mealName}</h2><strong>{fixed(meal.calories)} kcal</strong><span>蛋白质 {fixed(meal.protein,1)}g · 碳水 {fixed(meal.carbs,1)}g · 脂肪 {fixed(meal.fat,1)}g</span></div>
    </div>
    <p className="rule-note">本地营养数据优先；缺失条目由模型估算每100克数据。修改任意克数后由网页重新计算。</p>
    <div className="food-list">{meal.items.map((item)=><article key={item.id} className={`food-row ${item.sourceType==='model'?'model-estimate':''} ${item.hiddenIngredient?'adjustable':''}`}>
      <div className="food-title"><div><b>{item.name}</b>{item.sourceType==='model'&&<em>模型估算</em>}{item.hiddenIngredient&&<em>可调整</em>}</div><strong>{fixed(item.calories,1)} kcal</strong></div>
      <div className="grams-control"><label>克数<input type="number" inputMode="decimal" min="0" step="1" value={Number(item.grams.toFixed(1))} onChange={(event)=>updateGrams(item.id,event.target.value)}/></label><span>{fixed(item.caloriesPer100)} kcal/100g · {fixed(item.caloriesPer100/100,2)} kcal/g</span></div>
      <p>计算：{fixed(item.grams,1)}g × {fixed(item.caloriesPer100)} ÷ 100 = {fixed(item.calories,1)} kcal</p>
      <small>来源：{item.nutritionSource}</small>
    </article>)}</div>
    <p className="assumptions"><b>识别与估算依据</b>{meal.assumptions}</p>
    <div className="two-buttons"><button className="secondary-action action-button" onClick={reset}>重新拍照</button><button className="primary-action action-button" onClick={saveMeal}>记入今天</button></div>
  </section>;
}

function Diary({meals,onDelete}:{meals:Meal[];onDelete:(id:string)=>void}) {
  if (!meals.length) return <section className="empty-card"><span>▤</span><h2>还没有饮食记录</h2><p>完成一次照片分析并点击“记入今天”，记录会保存在这台 iPhone。</p></section>;
  return <section className="diary-list">{meals.map((meal)=><article key={meal.id} className="diary-card"><div><small>{new Date(meal.timestamp).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</small><h2>{meal.mealName}</h2><p>{fixed(meal.protein,1)}g 蛋白质 · {meal.items.filter((item)=>item.grams>0).length} 个分项</p></div><div><strong>{fixed(meal.calories)}<small> kcal</small></strong><button onClick={()=>onDelete(meal.id)}>删除</button></div></article>)}</section>;
}
