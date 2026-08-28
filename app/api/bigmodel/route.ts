import { nutritionCatalogPrompt, parseModelJson } from '@/lib/nutrition';

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

const BODY_REPORT_PROMPT =
  '你负责读取八电极生物电阻抗体成分报告截图。只抄录图片中明确可见的数值，不根据身高、性别或其他字段推算。' +
  '只返回一个 JSON 对象，不要 Markdown。字段严格为 date(YYYY-MM-DD，图片没有日期则为空字符串), weightKg(number), ' +
  'bodyFatPercent(number), muscleMassKg(number), visceralFat(number), bmr(number), confidence(0-100 integer), note(string)。' +
  '肌肉量优先填写报告中“肌肉量”或同义字段；只有“骨骼肌量”时也填入 muscleMassKg，并在 note 写明原标签。缺失字段填 0。';

const CHECKUP_REPORT_PROMPT =
  '你负责读取常规体检报告截图。只摘录图片中明确可见的检查日期、指标名称、结果、单位和参考范围，不做诊断，不推算缺失值。' +
  '为了兼容本地记录，只返回一个 JSON 对象，不要 Markdown。字段严格为 date(YYYY-MM-DD，图片没有则为空字符串), ' +
  'weightKg(number), bodyFatPercent(number), muscleMassKg(number), visceralFat(number), bmr(number), confidence(0-100 integer), ' +
  'visibleFindings(string，使用分号列出可见指标及原单位), note(string)。没有相应体成分字段时填 0。';

const COACH_PROMPT =
  '你是训练记录解读助手。根据用户提供的目标、今日计划、最近训练完成度与 RPE、当天饮食记录和体成分趋势，' +
  '用中文给出 3-5 句简洁、可执行的今日建议。明确区分记录事实、估算与建议；不要诊断，不虚构缺失数据。';

const PLAN_PROMPT =
  '你是训练计划解释与提案助手，但不能绕过确定性规则引擎。根据提供的训练、饮食和体成分数据，只提出可选计划参数。' +
  '只返回 JSON，不要 Markdown。字段严格为 goal(fat_loss|strength|hypertrophy|endurance|circuit|functional), daysPerWeek(2|3|4|5|6), ' +
  'sessionMinutes(20-120 integer), changeType(dose|structure), cycle(string), deload(string), rationale(array of 2-4 short strings), nutritionFocus(string)。' +
  '训练以健身房器械为主；2天全身AB、3天全身ABC、4天上下肢、5天上下肢加功能体能、6天PPL两轮。' +
  '新手不固定整周减载；中级只有累计疲劳信号满足时才提出主动减载。单餐异常不得修改训练。缺失数据必须说明，不得虚构。';

function endpointFrom(raw: unknown) {
  let endpoint = String(raw ?? '').trim().replace(/\/+$/,'');
  if (endpoint === 'https://open.bigmodel.cn/api/paas/v4' || endpoint === 'https://open.bigmodel.cn/api/coding/paas/v4') {
    endpoint += '/chat/completions';
  }
  const url = new URL(endpoint);
  const allowedPaths = new Set([
    '/api/paas/v4/chat/completions',
    '/api/coding/paas/v4/chat/completions',
  ]);
  if (url.protocol !== 'https:' || url.hostname !== 'open.bigmodel.cn' || !allowedPaths.has(url.pathname)) {
    throw new Error('仅支持智谱开放平台或 Coding Plan 的 OpenAI Chat Completions 地址');
  }
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/,'');
}

function assistantContent(payload: unknown) {
  const body = payload as { choices?: Array<{ message?: { content?: unknown } }> };
  const content = body.choices?.[0]?.message?.content;
  if (Array.isArray(content)) {
    return content.map((part) => typeof part === 'object' && part ? String((part as { text?: unknown }).text ?? '') : '').join('');
  }
  return String(content ?? '').trim();
}

async function upstream(url: string, apiKey: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Authorization': `Bearer ${apiKey.replace(/[,，]+$/,'')}`,
      ...(init?.body ? { 'Content-Type':'application/json; charset=utf-8' } : {}),
    },
  });
  const text = await response.text();
  if (!response.ok) {
    let message = text;
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } };
      message = parsed.error?.message ?? text;
    } catch {}
    throw new Error(`接口返回 ${response.status}：${message.replace(/\s+/g,' ').slice(0,260)}`);
  }
  return JSON.parse(text) as unknown;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string,unknown>;
    const apiKey = String(body.apiKey ?? '').trim();
    if (!apiKey) throw new Error('请先填写 API 密钥');
    const endpoint = endpointFrom(body.endpoint);
    const action = String(body.action ?? 'analyze');

    if (action === 'models') {
      const modelsUrl = endpoint.replace(/\/chat\/completions$/,'/models');
      const payload = await upstream(modelsUrl,apiKey) as { data?: Array<{ id?: string }> };
      const models = (payload.data ?? []).map((item) => String(item.id ?? '')).filter(Boolean);
      if (!models.length) throw new Error('服务器返回的模型列表为空');
      return Response.json({ models },{ headers:{ 'Cache-Control':'no-store' } });
    }

    const model = String(body.model ?? '').trim();
    if (!model) throw new Error('请先填写或选择模型');

    if (action === 'coach' || action === 'plan') {
      const context = {
        profile:body.profile,currentSession:body.currentSession ?? body.session,recentLogs:body.recentLogs,
        nutrition:body.nutrition,bodyMetrics:body.bodyMetrics,
      };
      const payload = await upstream(endpoint,apiKey,{
        method:'POST',body:JSON.stringify({ model,temperature:.2,max_tokens:action==='plan'?900:600,...(action==='plan'?{response_format:{type:'json_object'},thinking:{type:'disabled'}}:{}),messages:[
          {role:'system',content:action==='plan'?PLAN_PROMPT:COACH_PROMPT},
          {role:'user',content:`以下是用户数据：${JSON.stringify(context).slice(0,24_000)}`},
        ]}),
      });
      const content=assistantContent(payload);
      if(!content)throw new Error('请求成功，但模型没有返回内容');
      if(action==='plan'){
        const parsed=parseModelJson(content);
        if(!['fat_loss','strength','hypertrophy','endurance','circuit','functional'].includes(String(parsed.goal))||![2,3,4,5,6].includes(Number(parsed.daysPerWeek)))throw new Error('模型返回的计划参数超出规则引擎允许范围');
      }
      return Response.json({content},{headers:{'Cache-Control':'no-store'}});
    }

    const imageData = String(body.imageData ?? '');
    if (!/^data:image\/(?:jpeg|png|webp);base64,/i.test(imageData)) throw new Error('图片格式无效，请重新选择');
    if (imageData.length > 8_000_000) throw new Error('图片过大，请重新选择');

    const probe = action === 'probe';
    const bodyReport = action === 'bodyReport';
    const reportType=String(body.reportType??'body_composition');
    const messages = probe
      ? [{ role:'user',content:[
          { type:'text',text:'请简短描述图片中最明显的物体或色块。这是视觉能力测试，不要推测未看到的内容。' },
          { type:'image_url',image_url:{ url:imageData } },
        ] }]
      : bodyReport
        ? [{role:'system',content:reportType==='checkup'?CHECKUP_REPORT_PROMPT:BODY_REPORT_PROMPT},{role:'user',content:[
            {type:'text',text:reportType==='checkup'?'读取这张常规体检报告。保留原单位，只抄录明确可见字段。':'读取这张体成分报告。严格保留图片中的单位含义，不要推算缺失值。'},
            {type:'image_url',image_url:{url:imageData}},
          ]}]
      : [];
    if(!probe&&!bodyReport){
      let lastError='模型返回的数据不完整';
      for(let attempt=0;attempt<2;attempt++){
        const retryInstruction=attempt===0?'':'上次输出不完整。本次 assumptions 不超过40字、最多8项，必须使用紧凑JSON并完整闭合所有括号。';
        const mealMessages=[
          {role:'system',content:SYSTEM_PROMPT+nutritionCatalogPrompt()+retryInstruction},
          {role:'user',content:[{type:'text',text:'分析这张餐食照片。优先按中国常见烹饪方式判断，并列出分项。'},{type:'image_url',image_url:{url:imageData}}]},
        ];
        const payload=await upstream(endpoint,apiKey,{method:'POST',body:JSON.stringify({model,temperature:0,max_tokens:4096,thinking:{type:'disabled'},response_format:{type:'json_object'},messages:mealMessages})});
        const content=assistantContent(payload);
        try{
          const parsed=parseModelJson(content);
          if(!Array.isArray(parsed.items)||parsed.items.length===0)throw new Error('没有食物分项');
          return Response.json({content},{headers:{'Cache-Control':'no-store'}});
        }catch(error){lastError=error instanceof Error?error.message:lastError;}
      }
      throw new Error(`模型返回的数据不完整，已自动重试但仍未成功：${lastError}`);
    }
    const payload = await upstream(endpoint,apiKey,{method:'POST',body:JSON.stringify({ model,temperature:0,max_tokens:probe ? 160 : 900,thinking:{type:'disabled'},...(bodyReport?{response_format:{type:'json_object'}}:{}),messages })});
    const content = assistantContent(payload);
    if (!content) throw new Error('请求成功，但模型没有返回内容');
    return Response.json({ content },{ headers:{ 'Cache-Control':'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '请求失败，请稍后重试';
    return Response.json({ error:message },{ status:400,headers:{ 'Cache-Control':'no-store' } });
  }
}
