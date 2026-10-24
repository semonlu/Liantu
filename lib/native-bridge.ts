import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { nutritionCatalogPrompt, parseModelJson } from './nutrition';
import { listProviderModels, requestProviderModel, validateEndpoint } from './model-provider';
import type { ModelConnection, ProviderProtocol } from './model-provider';
import {
  chatGptCredentialPatch, chatGptCredentialsFrom, completeChatGptDeviceLogin, listChatGptModels,
  requestChatGptDeviceLogin, requestChatGptModel,
} from './openai-chatgpt';
import type { ChatGptDeviceLogin, ChatGptOAuthCredentials } from './openai-chatgpt';

type ApiPayload={error?:string;content?:string;models?:string[];oauth?:ReturnType<typeof chatGptCredentialPatch>};

const mealPrompt='你负责视觉识别、烹饪方式判断和可食部克数估算。营养数据优先由 App 的本地库提供。复合菜必须尽可能拆成基础成分。看不见但烹饪中可能使用的油、糖、酱油、蚝油或蛋黄酱必须作为独立分项，根据烹饪方式给出合理中位克数并把 hiddenIngredient 设为 true，不要因不可见而一律低估。估算克数时不得直接套用常见一人份，也不得因不确定而统一采用偏低值。请在内部依次完成：寻找盘碗、餐具或手部等尺寸参照；估计食物长度、宽度、平均厚度或容器占比；根据熟制状态选择合理密度并由体积换算重量；最后用容器容量、整餐视觉体积和各分项总重量做一致性复核。没有可靠尺寸参照时，可结合中国常见餐具尺寸和该菜品通常范围给出中位估计，同时降低 confidence。以上过程仅用于内部估算，不要输出思考过程或增加字段。只返回 JSON：mealName, confidence, assumptions, items；items 每项严格包含 name,databaseKey,grams,cookingMethod,hiddenIngredient,estimatedCaloriesPer100,estimatedProteinPer100,estimatedCarbsPer100,estimatedFatPer100。items 最多12项，assumptions 不超过40个汉字，grams 和每100克估算值最多一位小数。匹配本地条目时 estimated 字段全填0，无法匹配时 databaseKey 填 unknown 并给出估算。可用本地条目：';
const planPrompt='你是训练计划解释与提案助手，不能绕过确定性规则引擎。recentLogs.exercises 中存在 setLogs 时，必须读取每个 completed=true 的逐组重量、次数与 RPE，不能只读取动作级 weightKg/reps/rpe 汇总字段。只返回 JSON：goal(fat_loss|strength|hypertrophy|endurance|circuit|functional),daysPerWeek(2|3|4|5|6),sessionMinutes(20-120),changeType(dose|structure),cycle,deload,rationale(2-4条),nutritionFocus。当前产品结构为2天全身AB、3天器械优先推拉腿、4天上下肢、5天上下肢加功能体能、6天PPL两轮；分化是产品可执行性选择，不得声称某种分化具有绝对优势。新手不固定整周减载；中级只有累计疲劳信号满足时才提出主动减载。单餐异常不得修改训练。';
const coachPrompt='根据目标、今日训练、最近完成率和RPE、当天饮食与身体趋势，用中文给出3-5句简洁建议。recentLogs.exercises 中存在 setLogs 时，必须逐组读取所有 completed=true 的重量、次数和 RPE，比较组间下降与疲劳，不能只按动作级汇总字段或最后一组判断。区分记录事实、估算与建议，不虚构缺失数据。';
const chatPrompt='你是练途 AI 教练。用自然中文回答用户，并且只返回 JSON：reply(string),action(null或对象)。action 只能是以下一种：{type:"profile",weightKg?:number,sleepHours?:number}；{type:"energy",kcal:number,note:string}；{type:"nutrition",mealName:string,grams?:number,calories:number,protein:number,carbs:number,fat:number} 用于记录用户明确描述的当天饮食，营养值不是用户提供时可做保守估算并在 reply 明确说明；{type:"workout",date:"YYYY-MM-DD",title:string,durationMinutes?:number,caloriesBurned?:number,averageRpe?:number,exercises:[{exerciseId?:string,name:string,sets:number,reps:string,weightKg?:number,rpe?:number}],note:string} 用于新增或替换用户明确指定日期的已完成训练；用户要求修改已有日期时，必须结合 context.requestedDateLogs 返回修改后的完整动作清单，确认后客户端会替换该日期旧记录并把日历标记金色，不能只返回增量；不能把计划或建议当成已完成；{type:"plan",goal?:fat_loss|strength|hypertrophy|endurance|circuit|functional,daysPerWeek?:2|3|4|5|6,sessionMinutes?:20-120,rationale:string}。优先使用 context.requestedDateHint；context.currentDate 是设备当前日期，用户说今天、昨天、前天或月日时必须换算成明确 YYYY-MM-DD，没说日期时 workout.date 使用 currentDate，不得把未来日期写成已完成。严格读取 context.permissions：nutritionLogging 或 workoutLogging 为 false 时不得生成对应 action。分析 context.recentLogs 或 requestedDateLogs 时，若动作含 setLogs，必须读取所有 completed=true 的逐组重量、次数、RPE，不能只看动作级汇总或最后一组。不得从模糊对话推测训练重量、组次或完成状态；没有明确可执行内容时 action 为 null。任何 action 都只是待用户确认，不能声称已经保存或应用。';
const chatSummaryPrompt='把旧的练途教练对话压缩成中文长期摘要。保留用户目标、训练水平、器械条件、明确偏好、伤痛限制、已确认的训练或饮食事实、重要计划决策和仍待解决的问题；删除寒暄、重复内容和已经过期的临时措辞。不得把建议写成已完成事实，不得补充原文没有的数据。直接返回紧凑纯文本，最多1200个汉字。';
const bodyPrompt='读取八电极体成分报告，只抄录明确可见字段。只返回 JSON：date,weightKg,bodyFatPercent,muscleMassKg,visceralFat,bmr,confidence,note。缺失填0，不推算。';
const checkupPrompt='读取常规体检报告，只摘录明确可见的日期、指标、结果、单位和参考范围，不诊断。只返回 JSON：date,weightKg,bodyFatPercent,muscleMassKg,visceralFat,bmr,confidence,visibleFindings,note。没有体成分字段填0。';

export const isNativeApp=()=>Capacitor.isNativePlatform();

export function isNativeImageCancellation(error:unknown) {
  const record=error&&typeof error==='object'?error as Record<string,unknown>:{};
  const value=`${String(record.code??'')} ${error instanceof Error?error.message:String(error??'')}`;
  return /cancel|canceled|cancelled|用户取消|取消状态|no image picked|no image selected/i.test(value);
}

export async function chooseNativeImage(source:'camera'|'photos'):Promise<string|null> {
  try{
    const photo=await Camera.getPhoto({quality:84,width:1280,height:1280,correctOrientation:true,allowEditing:false,resultType:CameraResultType.Base64,source:source==='camera'?CameraSource.Camera:CameraSource.Photos,saveToGallery:false});
    if(!photo.base64String)throw new Error(source==='camera'?'相机没有写入可读取的照片，请重试或改用相册':'没有读取到所选照片，请重新选择');
    const format=photo.format==='png'||photo.format==='webp'?photo.format:'jpeg';
    return `data:image/${format};base64,${photo.base64String}`;
  }catch(error){
    if(isNativeImageCancellation(error))return null;
    throw error;
  }
}

const nativeRawHttp=async(url:string,method:'GET'|'POST',headers:Record<string,string>,data?:unknown)=>{
  try{
    const response=await CapacitorHttp.request({url,method,headers,data,connectTimeout:15_000,readTimeout:90_000});
    return {status:response.status,data:response.data as unknown};
  }catch(error){
    if(/timeout|timed out|超时/i.test(error instanceof Error?error.message:String(error)))throw new Error('模型请求超过 90 秒，已停止等待。请重试或换用响应更快的模型');
    throw error;
  }
};
const nativeHttp=async(url:string,method:'GET'|'POST',headers:Record<string,string>,data?:Record<string,unknown>)=>nativeRawHttp(url,method,headers,data);

export async function beginChatGptAccountLogin(){
  if(!isNativeApp())throw new Error('ChatGPT 账号登录仅支持练途 APK');
  return requestChatGptDeviceLogin(nativeRawHttp);
}

export async function finishChatGptAccountLogin(login:ChatGptDeviceLogin,signal?:AbortSignal){
  if(!isNativeApp())throw new Error('ChatGPT 账号登录仅支持练途 APK');
  return completeChatGptDeviceLogin(login,nativeRawHttp,signal);
}

export async function fetchChatGptAccountModels(credentials:ChatGptOAuthCredentials){
  if(!isNativeApp())throw new Error('ChatGPT 账号登录仅支持练途 APK');
  return listChatGptModels(credentials,nativeRawHttp);
}

export async function testChatGptAccount(credentials:ChatGptOAuthCredentials,model:string){
  if(!isNativeApp())throw new Error('ChatGPT 账号登录仅支持练途 APK');
  if(!model.trim())throw new Error('账号没有可测试的 Codex 模型');
  return requestChatGptModel({credentials,http:nativeRawHttp,model,text:'这是练途账号可用性测试。请只回复：练途连接成功',maxTokens:160});
}

function connectionFrom(body:Record<string,unknown>):ModelConnection{
  return {
    providerId:String(body.providerId??'zhipu'),protocol:String(body.protocol??'openai_chat') as ProviderProtocol,
    endpoint:String(body.endpoint??''),model:String(body.model??''),apiKey:String(body.apiKey??''),customHeaders:String(body.customHeaders??''),
  };
}

export async function bigModelRequest(body:Record<string,unknown>):Promise<ApiPayload>{
  if(!isNativeApp()){
    if(body.providerId==='chatgpt')throw new Error('ChatGPT 账号登录仅支持练途 APK，请安装 APK 后使用');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),100_000);
    try{
      const response=await fetch('/api/bigmodel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});
      const payload=await response.json() as ApiPayload;
      if(!response.ok)throw new Error(payload.error||'请求失败，请稍后重试');
      return payload;
    }catch(error){
      if(controller.signal.aborted)throw new Error('模型请求超过 100 秒，已停止等待。请重试或换用响应更快的模型');
      throw error;
    }finally{clearTimeout(timer);}
  }
  const connection=connectionFrom(body),action=String(body.action??'analyze');
  validateEndpoint(connection.endpoint,true);
  const chatgpt=connection.providerId==='chatgpt';
  let oauth=chatGptCredentialsFrom(body);
  const result=(content:string):ApiPayload=>({content,...(chatgpt?{oauth:chatGptCredentialPatch(oauth)}:{})});
  const modelRequest=async(request:{system?:string;text:string;imageData?:string;maxTokens:number;temperature:number;json?:boolean})=>{
    if(!chatgpt)return requestProviderModel({connection,...request},nativeHttp);
    const response=await requestChatGptModel({credentials:oauth,http:nativeRawHttp,model:connection.model,system:request.system,text:request.text,imageData:request.imageData,maxTokens:request.maxTokens,json:request.json});
    oauth=response.credentials;
    return response.content;
  };
  if(action==='models'){
    if(chatgpt){const response=await listChatGptModels(oauth,nativeRawHttp);oauth=response.credentials;return {models:response.models,oauth:chatGptCredentialPatch(oauth)};}
    const models=await listProviderModels(connection,nativeHttp);
    if(!models.length)throw new Error('服务器返回的模型列表为空');
    return {models};
  }
  if(!connection.model.trim())throw new Error('请先填写或选择模型');
  const context={currentDate:body.currentDate,selectedPlanDate:body.selectedPlanDate,requestedDateHint:body.requestedDateHint,requestedDateLogs:body.requestedDateLogs,conversationSummary:body.conversationSummary,compressedCount:body.compressedCount,messages:body.messages,profile:body.profile,currentSession:body.currentSession??body.session,selectedSession:body.selectedSession,recentLogs:body.recentLogs,nutrition:body.nutrition,bodyMetrics:body.bodyMetrics,energyAdjustments:body.energyAdjustments,permissions:body.permissions};
  if(action==='textProbe'){
    return result(await modelRequest({text:'这是练途的连接测试。请只回复：练途连接成功',temperature:0,maxTokens:800}));
  }
  if(action==='chatSummary'){
    return result(await modelRequest({system:chatSummaryPrompt,text:`已有摘要与新增旧消息：${JSON.stringify({previousSummary:body.previousSummary,messages:body.messages}).slice(0,24000)}`,temperature:0,maxTokens:1400}));
  }
  if(action==='chat'){
    return result(await modelRequest({system:chatPrompt,text:`用户资料和最近对话：${JSON.stringify(context).slice(0,24000)}`,temperature:.2,maxTokens:3000,json:true}));
  }
  if(action==='coach'||action==='plan'){
    return result(await modelRequest({system:action==='plan'?planPrompt:coachPrompt,text:`用户数据：${JSON.stringify(context).slice(0,24000)}`,temperature:.2,maxTokens:action==='plan'?3200:1200,json:action==='plan'}));
  }
  const imageData=String(body.imageData??'');
  if(!/^data:image\/(?:jpeg|png|webp);base64,/i.test(imageData))throw new Error('图片格式无效，请重新选择');
  if(action==='probe'||action==='bodyReport'){
    const system=action==='bodyReport'?(body.reportType==='checkup'?checkupPrompt:bodyPrompt):'';
    const prompt=action==='probe'?'简短描述图片中最明显的物体或色块，不推测。':'读取报告并严格保留原单位，不推算缺失值。';
    return result(await modelRequest({system,text:prompt,imageData,temperature:0,maxTokens:action==='probe'?160:900,json:action==='bodyReport'}));
  }
  let failure='输出不完整';
  for(let attempt=0;attempt<2;attempt++){
    const retry=attempt?'上次输出不完整。本次 assumptions 不超过40字、最多8项，必须使用紧凑JSON并完整闭合所有括号。':'';
    const content=await modelRequest({system:mealPrompt+nutritionCatalogPrompt()+retry,text:'分析这张餐食照片。优先按中国常见烹饪方式判断，并列出分项。',imageData,temperature:0,maxTokens:4096,json:true});
    try{const parsed=parseModelJson(content);if(!Array.isArray(parsed.items)||!parsed.items.length)throw new Error('没有食物分项');return result(content);}catch(error){failure=error instanceof Error?error.message:failure;}
  }
  throw new Error(`模型返回不完整，自动重试仍失败：${failure}`);
}
