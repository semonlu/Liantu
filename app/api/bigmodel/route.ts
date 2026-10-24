import { nutritionCatalogPrompt, parseModelJson } from '@/lib/nutrition';
import { listProviderModels, requestProviderModel, validateEndpoint } from '@/lib/model-provider';
import type { ModelConnection, ProviderProtocol } from '@/lib/model-provider';

const SYSTEM_PROMPT =
  '你负责视觉识别、烹饪方式判断和可食部克数估算。营养数据优先由 App 的本地库提供。' +
  '复合菜必须尽可能拆成基础成分，例如炒饭拆成米饭、鸡蛋、蔬菜、食用油。' +
  '看不见但烹饪中可能使用的油、糖、酱油、蚝油或蛋黄酱必须作为独立分项，根据烹饪方式给出合理中位克数并把 hiddenIngredient 设为 true，不要因不可见而一律低估。' +
  '估算克数时不得直接套用常见一人份，也不得因不确定而统一采用偏低值。' +
  '请在内部依次完成：寻找盘碗、餐具或手部等尺寸参照；估计食物长度、宽度、平均厚度或容器占比；' +
  '根据熟制状态选择合理密度并由体积换算重量；最后用容器容量、整餐视觉体积和各分项总重量做一致性复核。' +
  '没有可靠尺寸参照时，可结合中国常见餐具尺寸和该菜品通常范围给出中位估计，同时降低 confidence。' +
  '以上测量过程仅用于内部估算，不要输出完整思考过程，也不要增加体积、密度、上下限或参照物字段。' +
  '只返回一个 JSON 对象，不要 Markdown，不要解释。字段必须严格为 mealName(string), confidence(0-100 integer), assumptions(string), items(array)。' +
  'items 每项字段严格为 name(string), databaseKey(string), grams(number), cookingMethod(string), hiddenIngredient(boolean), ' +
  'estimatedCaloriesPer100(number), estimatedProteinPer100(number), estimatedCarbsPer100(number), estimatedFatPer100(number)。' +
  'items 最多 12 项；assumptions 必须控制在 40 个汉字以内，只保留给用户看的简短估算提示。' +
  'grams 和每100克估算值使用一位小数以内。databaseKey 必须从给定本地条目中选择；' +
  '能够匹配本地条目时四个 estimated*Per100 必须全部填 0；无法匹配时 databaseKey 填 unknown，并估算四个每100克营养值，' +
  '在 assumptions 说明依据并降低 confidence。可用本地条目：';

const BODY_REPORT_PROMPT='读取八电极生物电阻抗体成分报告截图。只抄录明确可见的数值，不推算。只返回 JSON：date,weightKg,bodyFatPercent,muscleMassKg,visceralFat,bmr,confidence,note。缺失字段填0。';
const CHECKUP_REPORT_PROMPT='读取常规体检报告截图。只摘录明确可见的检查日期、指标、结果、单位和参考范围，不诊断、不推算。只返回 JSON：date,weightKg,bodyFatPercent,muscleMassKg,visceralFat,bmr,confidence,visibleFindings,note。没有相应体成分字段填0。';
const COACH_PROMPT='你是训练记录解读助手。根据目标、今日计划、最近训练完成度与 RPE、当天饮食记录和体成分趋势，用中文给出3-5句简洁、可执行的今日建议。recentLogs.exercises 中存在 setLogs 时，必须逐组读取所有 completed=true 的重量、次数和 RPE，比较组间下降与疲劳，不能只按动作级汇总字段或最后一组判断。区分事实、估算与建议；不虚构缺失数据。';
const CHAT_PROMPT='你是练途 AI 教练。用自然中文回答用户，并且只返回 JSON：reply(string),action(null或对象)。action 只能是以下一种：{type:"profile",weightKg?:number,sleepHours?:number}；{type:"energy",kcal:number,note:string}；{type:"nutrition",mealName:string,grams?:number,calories:number,protein:number,carbs:number,fat:number} 用于记录用户明确描述的当天饮食；{type:"workout",date:"YYYY-MM-DD",title:string,durationMinutes?:number,caloriesBurned?:number,averageRpe?:number,exercises:[{exerciseId?:string,name:string,sets:number,reps:string,weightKg?:number,rpe?:number}],note:string} 用于新增或替换用户指定日期的已完成训练。用户要求修改已有日期时，必须结合 context.requestedDateLogs 返回修改后的完整动作清单，确认后客户端会替换旧记录并把该日历卡标记金色，不能只返回增量；不能把计划或建议当成已完成。{type:"plan",goal?:fat_loss|strength|hypertrophy|endurance|circuit|functional,daysPerWeek?:2|3|4|5|6,sessionMinutes?:20-120,rationale:string}。优先使用 context.requestedDateHint；context.currentDate 是设备当前日期，用户说今天、昨天、前天或月日时必须换算成明确 YYYY-MM-DD，没说日期时 workout.date 使用 currentDate，不得把未来日期写成已完成。严格读取 context.permissions。分析 context.recentLogs 或 requestedDateLogs 时，若动作含 setLogs，必须读取所有 completed=true 的逐组重量、次数、RPE，不能只看动作级汇总或最后一组。没有明确可执行内容时 action 为 null。任何 action 都只是待用户确认，不能声称已经保存或应用。';
const CHAT_SUMMARY_PROMPT='把旧的练途教练对话压缩成中文长期摘要。保留用户目标、训练水平、器械条件、明确偏好、伤痛限制、已确认的训练或饮食事实、重要计划决策和仍待解决的问题；删除寒暄、重复内容和已经过期的临时措辞。不得把建议写成已完成事实，不得补充原文没有的数据。直接返回紧凑纯文本，最多1200个汉字。';
const PLAN_PROMPT='你是训练计划解释与提案助手，不能绕过确定性规则引擎。recentLogs.exercises 中存在 setLogs 时，必须读取每个 completed=true 的逐组重量、次数与 RPE，不能只读取动作级 weightKg/reps/rpe 汇总字段。只返回 JSON：goal(fat_loss|strength|hypertrophy|endurance|circuit|functional),daysPerWeek(2|3|4|5|6),sessionMinutes(20-120),changeType(dose|structure),cycle,deload,rationale(2-4条),nutritionFocus。当前产品结构为2天全身AB、3天器械优先推拉腿、4天上下肢、5天上下肢加功能体能、6天PPL两轮；分化是产品可执行性选择，不得声称某种分化具有绝对优势。新手不固定整周减载；中级只有累计疲劳信号满足时才提出主动减载。单餐异常不得修改训练。';

const protocols:ProviderProtocol[]=['openai_chat','openai_responses','anthropic_messages','gemini_generate','ollama_chat'];

function connectionFrom(body:Record<string,unknown>):ModelConnection{
  const protocol=String(body.protocol??'openai_chat') as ProviderProtocol;
  if(!protocols.includes(protocol))throw new Error('不支持的接口协议');
  return {providerId:String(body.providerId??'zhipu'),protocol,endpoint:String(body.endpoint??''),model:String(body.model??''),apiKey:String(body.apiKey??''),customHeaders:String(body.customHeaders??'')};
}

const serverHttp=async(url:string,method:'GET'|'POST',headers:Record<string,string>,data?:Record<string,unknown>)=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),90_000);
  try{
    const response=await fetch(url,{method,headers,body:data?JSON.stringify(data):undefined,signal:controller.signal});
    const text=await response.text();
    let payload:unknown=text;
    try{payload=JSON.parse(text);}catch{}
    return {status:response.status,data:payload};
  }catch(error){
    if(controller.signal.aborted)throw new Error('模型请求超过 90 秒，已停止等待。请重试或换用响应更快的模型');
    throw error;
  }finally{clearTimeout(timer);}
};

export async function POST(request:Request){
  try{
    const body=await request.json() as Record<string,unknown>;
    const connection=connectionFrom(body),action=String(body.action??'analyze');
    validateEndpoint(connection.endpoint,false);
    if(action==='models'){
      const models=await listProviderModels(connection,serverHttp);
      if(!models.length)throw new Error('服务器返回的模型列表为空');
      return Response.json({models},{headers:{'Cache-Control':'no-store'}});
    }
    if(!connection.model.trim())throw new Error('请先填写或选择模型');
    const context={currentDate:body.currentDate,selectedPlanDate:body.selectedPlanDate,requestedDateHint:body.requestedDateHint,requestedDateLogs:body.requestedDateLogs,conversationSummary:body.conversationSummary,compressedCount:body.compressedCount,messages:body.messages,profile:body.profile,currentSession:body.currentSession??body.session,selectedSession:body.selectedSession,recentLogs:body.recentLogs,nutrition:body.nutrition,bodyMetrics:body.bodyMetrics,energyAdjustments:body.energyAdjustments,permissions:body.permissions};
    if(action==='textProbe'){
      const content=await requestProviderModel({connection,text:'这是练途的连接测试。请只回复：练途连接成功',temperature:0,maxTokens:800},serverHttp);
      return Response.json({content},{headers:{'Cache-Control':'no-store'}});
    }
    if(action==='chatSummary'){
      const content=await requestProviderModel({connection,system:CHAT_SUMMARY_PROMPT,text:`已有摘要与新增旧消息：${JSON.stringify({previousSummary:body.previousSummary,messages:body.messages}).slice(0,24000)}`,temperature:0,maxTokens:1400},serverHttp);
      return Response.json({content},{headers:{'Cache-Control':'no-store'}});
    }
    if(action==='chat'){
      const content=await requestProviderModel({connection,system:CHAT_PROMPT,text:`用户资料和最近对话：${JSON.stringify(context).slice(0,24000)}`,temperature:.2,maxTokens:3000,json:true},serverHttp);
      return Response.json({content},{headers:{'Cache-Control':'no-store'}});
    }
    if(action==='coach'||action==='plan'){
      const content=await requestProviderModel({connection,system:action==='plan'?PLAN_PROMPT:COACH_PROMPT,text:`以下是用户数据：${JSON.stringify(context).slice(0,24000)}`,temperature:.2,maxTokens:action==='plan'?3200:1200,json:action==='plan'},serverHttp);
      return Response.json({content},{headers:{'Cache-Control':'no-store'}});
    }
    const imageData=String(body.imageData??'');
    if(!/^data:image\/(?:jpeg|png|webp);base64,/i.test(imageData))throw new Error('图片格式无效，请重新选择');
    if(imageData.length>8_000_000)throw new Error('图片过大，请重新选择');
    if(action==='probe'||action==='bodyReport'){
      const bodyReport=action==='bodyReport',reportType=String(body.reportType??'body_composition');
      const system=bodyReport?(reportType==='checkup'?CHECKUP_REPORT_PROMPT:BODY_REPORT_PROMPT):'';
      const text=action==='probe'?'请简短描述图片中最明显的物体或色块，不要推测未看到的内容。':'读取这张报告，保留原单位，只抄录明确可见字段。';
      const content=await requestProviderModel({connection,system,text,imageData,temperature:0,maxTokens:action==='probe'?160:900,json:bodyReport},serverHttp);
      return Response.json({content},{headers:{'Cache-Control':'no-store'}});
    }
    let lastError='模型返回的数据不完整';
    for(let attempt=0;attempt<2;attempt++){
      const retry=attempt?'上次输出不完整。本次 assumptions 不超过40字、最多8项，必须使用紧凑JSON并完整闭合所有括号。':'';
      const content=await requestProviderModel({connection,system:SYSTEM_PROMPT+nutritionCatalogPrompt()+retry,text:'分析这张餐食照片。优先按中国常见烹饪方式判断，并列出分项。',imageData,temperature:0,maxTokens:4096,json:true},serverHttp);
      try{const parsed=parseModelJson(content);if(!Array.isArray(parsed.items)||!parsed.items.length)throw new Error('没有食物分项');return Response.json({content},{headers:{'Cache-Control':'no-store'}});}catch(error){lastError=error instanceof Error?error.message:lastError;}
    }
    throw new Error(`模型返回的数据不完整，已自动重试但仍未成功：${lastError}`);
  }catch(error){
    return Response.json({error:error instanceof Error?error.message:'请求失败，请稍后重试'},{status:400,headers:{'Cache-Control':'no-store'}});
  }
}
