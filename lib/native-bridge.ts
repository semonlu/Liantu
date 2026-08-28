import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { nutritionCatalogPrompt, parseModelJson } from './nutrition';
import { listProviderModels, requestProviderModel, validateEndpoint } from './model-provider';
import type { ModelConnection, ProviderProtocol } from './model-provider';

type ApiPayload={error?:string;content?:string;models?:string[]};

const mealPrompt='你负责视觉识别、烹饪方式判断和可食部克数估算。营养数据优先由 App 的本地库提供。复合菜必须尽可能拆成基础成分。看不见但烹饪中可能使用的油、糖、酱油、蚝油或蛋黄酱必须作为独立分项，根据烹饪方式给出合理中位克数并把 hiddenIngredient 设为 true，不要因不可见而一律低估。估算克数时不得直接套用常见一人份，也不得因不确定而统一采用偏低值。请在内部依次完成：寻找盘碗、餐具或手部等尺寸参照；估计食物长度、宽度、平均厚度或容器占比；根据熟制状态选择合理密度并由体积换算重量；最后用容器容量、整餐视觉体积和各分项总重量做一致性复核。没有可靠尺寸参照时，可结合中国常见餐具尺寸和该菜品通常范围给出中位估计，同时降低 confidence。以上过程仅用于内部估算，不要输出思考过程或增加字段。只返回 JSON：mealName, confidence, assumptions, items；items 每项严格包含 name,databaseKey,grams,cookingMethod,hiddenIngredient,estimatedCaloriesPer100,estimatedProteinPer100,estimatedCarbsPer100,estimatedFatPer100。items 最多12项，assumptions 不超过40个汉字，grams 和每100克估算值最多一位小数。匹配本地条目时 estimated 字段全填0，无法匹配时 databaseKey 填 unknown 并给出估算。可用本地条目：';
const planPrompt='你是训练计划解释与提案助手，不能绕过确定性规则引擎。只返回 JSON：goal(fat_loss|strength|hypertrophy|endurance|circuit|functional),daysPerWeek(2|3|4|5|6),sessionMinutes(20-120),changeType(dose|structure),cycle,deload,rationale(2-4条),nutritionFocus。2天全身AB、3天全身ABC、4天上下肢、5天上下肢加功能体能、6天PPL两轮。新手不固定整周减载；中级只有累计疲劳信号满足时才提出主动减载。单餐异常不得修改训练。';
const coachPrompt='根据目标、今日训练、最近完成率和RPE、当天饮食与身体趋势，用中文给出3-5句简洁建议。区分记录事实、估算与建议，不虚构缺失数据。';
const bodyPrompt='读取八电极体成分报告，只抄录明确可见字段。只返回 JSON：date,weightKg,bodyFatPercent,muscleMassKg,visceralFat,bmr,confidence,note。缺失填0，不推算。';
const checkupPrompt='读取常规体检报告，只摘录明确可见的日期、指标、结果、单位和参考范围，不诊断。只返回 JSON：date,weightKg,bodyFatPercent,muscleMassKg,visceralFat,bmr,confidence,visibleFindings,note。没有体成分字段填0。';

export const isNativeApp=()=>Capacitor.isNativePlatform();

export async function chooseNativeImage() {
  const photo=await Camera.getPhoto({quality:84,width:1024,height:1024,allowEditing:false,resultType:CameraResultType.DataUrl,source:CameraSource.Prompt,saveToGallery:false});
  if(!photo.dataUrl)throw new Error('相机没有返回可读取的照片，请重试或从相册选择');
  return photo.dataUrl;
}

const nativeHttp=async(url:string,method:'GET'|'POST',headers:Record<string,string>,data?:Record<string,unknown>)=>{
  const response=await CapacitorHttp.request({url,method,headers,data});
  return {status:response.status,data:response.data as unknown};
};

function connectionFrom(body:Record<string,unknown>):ModelConnection{
  return {
    providerId:String(body.providerId??'zhipu'),protocol:String(body.protocol??'openai_chat') as ProviderProtocol,
    endpoint:String(body.endpoint??''),model:String(body.model??''),apiKey:String(body.apiKey??''),customHeaders:String(body.customHeaders??''),
  };
}

export async function bigModelRequest(body:Record<string,unknown>):Promise<ApiPayload>{
  if(!isNativeApp()){
    const response=await fetch('/api/bigmodel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const payload=await response.json() as ApiPayload;
    if(!response.ok)throw new Error(payload.error||'请求失败，请稍后重试');
    return payload;
  }
  const connection=connectionFrom(body),action=String(body.action??'analyze');
  validateEndpoint(connection.endpoint,true);
  if(action==='models'){
    const models=await listProviderModels(connection,nativeHttp);
    if(!models.length)throw new Error('服务器返回的模型列表为空');
    return {models};
  }
  if(!connection.model.trim())throw new Error('请先填写或选择模型');
  const context={profile:body.profile,currentSession:body.currentSession??body.session,recentLogs:body.recentLogs,nutrition:body.nutrition,bodyMetrics:body.bodyMetrics};
  if(action==='coach'||action==='plan'){
    const result=await requestProviderModel({connection,system:action==='plan'?planPrompt:coachPrompt,text:`用户数据：${JSON.stringify(context).slice(0,24000)}`,temperature:.2,maxTokens:action==='plan'?900:600,json:action==='plan'},nativeHttp);
    return {content:result};
  }
  const imageData=String(body.imageData??'');
  if(!/^data:image\/(?:jpeg|png|webp);base64,/i.test(imageData))throw new Error('图片格式无效，请重新选择');
  if(action==='probe'||action==='bodyReport'){
    const system=action==='bodyReport'?(body.reportType==='checkup'?checkupPrompt:bodyPrompt):'';
    const prompt=action==='probe'?'简短描述图片中最明显的物体或色块，不推测。':'读取报告并严格保留原单位，不推算缺失值。';
    const result=await requestProviderModel({connection,system,text:prompt,imageData,temperature:0,maxTokens:action==='probe'?160:900,json:action==='bodyReport'},nativeHttp);
    return {content:result};
  }
  let failure='输出不完整';
  for(let attempt=0;attempt<2;attempt++){
    const retry=attempt?'上次输出不完整。本次 assumptions 不超过40字、最多8项，必须使用紧凑JSON并完整闭合所有括号。':'';
    const result=await requestProviderModel({connection,system:mealPrompt+nutritionCatalogPrompt()+retry,text:'分析这张餐食照片。优先按中国常见烹饪方式判断，并列出分项。',imageData,temperature:0,maxTokens:4096,json:true},nativeHttp);
    try{const parsed=parseModelJson(result);if(!Array.isArray(parsed.items)||!parsed.items.length)throw new Error('没有食物分项');return {content:result};}catch(error){failure=error instanceof Error?error.message:failure;}
  }
  throw new Error(`模型返回不完整，自动重试仍失败：${failure}`);
}
