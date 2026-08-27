import { nutritionCatalogPrompt } from '@/lib/nutrition';

const SYSTEM_PROMPT =
  '你负责视觉识别、烹饪方式判断和可食部克数估算。营养数据优先由 App 的本地库提供。' +
  '复合菜必须尽可能拆成基础成分，例如炒饭拆成米饭、鸡蛋、蔬菜、食用油。' +
  '看不见但烹饪中可能使用的油、糖、酱油、蚝油或蛋黄酱必须作为独立分项，给出保守克数并把 hiddenIngredient 设为 true。' +
  '只返回一个 JSON 对象，不要 Markdown，不要解释。字段必须严格为 mealName(string), confidence(0-100 integer), assumptions(string), items(array)。' +
  'items 每项字段严格为 name(string), databaseKey(string), grams(number), cookingMethod(string), hiddenIngredient(boolean), ' +
  'estimatedCaloriesPer100(number), estimatedProteinPer100(number), estimatedCarbsPer100(number), estimatedFatPer100(number)。' +
  '能够匹配本地条目时四个 estimated*Per100 必须全部填 0；无法匹配时 databaseKey 填 unknown，并估算四个每100克营养值，' +
  '在 assumptions 说明依据并降低 confidence。可用本地条目：';

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
    const imageData = String(body.imageData ?? '');
    if (!model) throw new Error('请先填写或选择模型');
    if (!/^data:image\/(?:jpeg|png|webp);base64,/i.test(imageData)) throw new Error('图片格式无效，请重新选择');
    if (imageData.length > 8_000_000) throw new Error('图片过大，请重新选择');

    const probe = action === 'probe';
    const messages = probe
      ? [{ role:'user',content:[
          { type:'text',text:'请简短描述图片中最明显的物体或色块。这是视觉能力测试，不要推测未看到的内容。' },
          { type:'image_url',image_url:{ url:imageData } },
        ] }]
      : [
          { role:'system',content:SYSTEM_PROMPT + nutritionCatalogPrompt() },
          { role:'user',content:[
            { type:'text',text:'分析这张餐食照片。优先按中国常见烹饪方式判断，并列出分项。' },
            { type:'image_url',image_url:{ url:imageData } },
          ] },
        ];
    const payload = await upstream(endpoint,apiKey,{
      method:'POST',
      body:JSON.stringify({ model,temperature:probe ? 0 : .2,max_tokens:probe ? 160 : 1800,messages }),
    });
    const content = assistantContent(payload);
    if (!content) throw new Error('请求成功，但模型没有返回内容');
    return Response.json({ content },{ headers:{ 'Cache-Control':'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '请求失败，请稍后重试';
    return Response.json({ error:message },{ status:400,headers:{ 'Cache-Control':'no-store' } });
  }
}
