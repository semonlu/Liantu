export type ProviderProtocol='openai_chat'|'openai_responses'|'anthropic_messages'|'gemini_generate'|'ollama_chat';

export type ModelConnection={
  providerId:string;
  protocol:ProviderProtocol;
  endpoint:string;
  model:string;
  apiKey:string;
  customHeaders:string;
};

export type ProviderPreset={
  id:string;
  name:string;
  subtitle:string;
  protocol:ProviderProtocol;
  endpoint:string;
  model:string;
  apiKeyOptional?:boolean;
};

export const providerPresets:ProviderPreset[]=[
  {id:'zhipu',name:'智谱',subtitle:'GLM 视觉与文本',protocol:'openai_chat',endpoint:'https://open.bigmodel.cn/api/paas/v4/chat/completions',model:'glm-5v-turbo'},
  {id:'openai',name:'OpenAI',subtitle:'Responses API',protocol:'openai_responses',endpoint:'https://api.openai.com/v1/responses',model:'gpt-5-mini'},
  {id:'chatgpt',name:'ChatGPT 账号',subtitle:'Plus / Pro · Codex OAuth',protocol:'openai_responses',endpoint:'https://chatgpt.com/backend-api/codex/responses',model:'gpt-5.6-sol',apiKeyOptional:true},
  {id:'anthropic',name:'Anthropic',subtitle:'Claude Messages',protocol:'anthropic_messages',endpoint:'https://api.anthropic.com/v1/messages',model:'claude-sonnet-4-5'},
  {id:'gemini',name:'Google Gemini',subtitle:'GenerateContent',protocol:'gemini_generate',endpoint:'https://generativelanguage.googleapis.com/v1beta',model:'gemini-2.5-flash'},
  {id:'deepseek',name:'DeepSeek',subtitle:'OpenAI 兼容',protocol:'openai_chat',endpoint:'https://api.deepseek.com/chat/completions',model:'deepseek-chat'},
  {id:'openrouter',name:'OpenRouter',subtitle:'多模型网关',protocol:'openai_chat',endpoint:'https://openrouter.ai/api/v1/chat/completions',model:'openai/gpt-4.1-mini'},
  {id:'siliconflow',name:'硅基流动',subtitle:'OpenAI 兼容',protocol:'openai_chat',endpoint:'https://api.siliconflow.cn/v1/chat/completions',model:'Qwen/Qwen2.5-VL-72B-Instruct'},
  {id:'ollama',name:'Ollama',subtitle:'本机 / 局域网 11434',protocol:'ollama_chat',endpoint:'http://127.0.0.1:11434',model:'gemma3',apiKeyOptional:true},
  {id:'lmstudio',name:'LM Studio',subtitle:'本机端口 1234',protocol:'openai_chat',endpoint:'http://127.0.0.1:1234/v1/chat/completions',model:'local-model',apiKeyOptional:true},
  {id:'custom',name:'自定义',subtitle:'兼容服务或反向代理',protocol:'openai_chat',endpoint:'https://example.com/v1/chat/completions',model:''},
];

export const protocolLabels:Record<ProviderProtocol,string>={
  openai_chat:'OpenAI Chat Completions',openai_responses:'OpenAI Responses',anthropic_messages:'Anthropic Messages',
  gemini_generate:'Gemini GenerateContent',ollama_chat:'Ollama 原生 Chat',
};

export type HttpResult={status:number;data:unknown};
export type HttpClient=(url:string,method:'GET'|'POST',headers:Record<string,string>,body?:Record<string,unknown>)=>Promise<HttpResult>;

export type ModelRequest={
  connection:ModelConnection;
  system?:string;
  text:string;
  imageData?:string;
  maxTokens:number;
  temperature:number;
  json?:boolean;
};

function imageParts(imageData?:string){
  if(!imageData)return null;
  const match=imageData.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/i);
  if(!match)throw new Error('图片格式无效，请重新选择');
  return {mimeType:match[1],base64:match[2]};
}

export function parseCustomHeaders(value:unknown){
  const text=String(value??'').trim();
  if(!text)return {};
  let parsed:unknown;
  try{parsed=JSON.parse(text);}catch{throw new Error('自定义请求头必须是 JSON 对象');}
  if(!parsed||Array.isArray(parsed)||typeof parsed!=='object')throw new Error('自定义请求头必须是 JSON 对象');
  const headers:Record<string,string>={};
  for(const [key,raw] of Object.entries(parsed)){
    if(!/^[A-Za-z0-9-]{1,80}$/.test(key)||/^(host|content-length|connection)$/i.test(key))throw new Error(`不允许的请求头：${key}`);
    headers[key]=String(raw).slice(0,2000);
  }
  return headers;
}

export function normalizeEndpoint(protocol:ProviderProtocol,value:unknown){
  const raw=String(value??'').trim().replace(/\/+$/,'');
  if(!raw)throw new Error('请填写接口地址');
  const url=new URL(raw);
  if(protocol==='openai_chat'&&!/\/chat\/completions$/i.test(url.pathname)){
    url.pathname=url.pathname==='/'?'/v1/chat/completions':`${url.pathname.replace(/\/$/,'')}/chat/completions`;
  }
  if(protocol==='openai_responses'&&!/\/responses$/i.test(url.pathname))url.pathname=url.pathname==='/'?'/v1/responses':`${url.pathname.replace(/\/$/,'')}/responses`;
  if(protocol==='anthropic_messages'&&!/\/messages$/i.test(url.pathname))url.pathname=url.pathname==='/'?'/v1/messages':`${url.pathname.replace(/\/$/,'')}/messages`;
  if(protocol==='ollama_chat'&&!/\/api\/chat$/i.test(url.pathname))url.pathname=/\/api$/i.test(url.pathname)?`${url.pathname}/chat`:`${url.pathname.replace(/\/$/,'')}/api/chat`.replace('//','/');
  url.hash='';
  return url.toString().replace(/\/$/,'');
}

export function validateEndpoint(endpoint:string,allowLocalHttp:boolean){
  const url=new URL(endpoint);
  if(url.username||url.password)throw new Error('接口地址不能包含用户名或密码');
  const local=/^(localhost|host\.docker\.internal|\[?::1\]?|[^.]+\.local|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})$/i.test(url.hostname);
  if(!allowLocalHttp&&local)throw new Error('网页版代理不能访问本机或局域网地址，请使用 APK');
  if(url.protocol==='https:')return;
  if(!(allowLocalHttp&&url.protocol==='http:'&&local))throw new Error(allowLocalHttp?'只允许 HTTPS 或本机/局域网 HTTP 地址':'网页版代理只允许 HTTPS；本机或局域网端口请使用 APK');
}

function authHeaders(connection:ModelConnection){
  const key=connection.apiKey.trim().replace(/[,，]+$/,'');
  const headers:Record<string,string>={'Content-Type':'application/json; charset=utf-8'};
  if(connection.protocol==='anthropic_messages'){
    if(key)headers['x-api-key']=key;
    headers['anthropic-version']='2023-06-01';
  }else if(connection.protocol==='gemini_generate'){
    if(key)headers['x-goog-api-key']=key;
  }else if(key)headers.Authorization=`Bearer ${key}`;
  return {...headers,...parseCustomHeaders(connection.customHeaders)};
}

function modelUrl(connection:ModelConnection){
  const endpoint=normalizeEndpoint(connection.protocol,connection.endpoint);
  if(connection.protocol==='openai_chat')return endpoint.replace(/\/chat\/completions$/i,'/models');
  if(connection.protocol==='openai_responses')return endpoint.replace(/\/responses$/i,'/models');
  if(connection.protocol==='anthropic_messages')return endpoint.replace(/\/messages$/i,'/models');
  if(connection.protocol==='gemini_generate')return `${endpoint.replace(/\/models(?:\/.*)?$/i,'')}/models`;
  return endpoint.replace(/\/api\/chat$/i,'/api/tags');
}

export async function listProviderModels(connection:ModelConnection,http:HttpClient){
  const response=await http(modelUrl(connection),'GET',authHeaders(connection));
  if(response.status<200||response.status>=300)throw httpError(response);
  const data=response.data as {data?:Array<{id?:string}>;models?:Array<{id?:string;name?:string;model?:string}>};
  const rows:Array<{id?:string;name?:string;model?:string}>=data.data??data.models??[];
  return rows.map((item)=>String(item.id??item.model??item.name??'').replace(/^models\//,'')).filter(Boolean);
}

function textFrom(value:unknown):string{
  if(typeof value==='string')return value.trim();
  if(Array.isArray(value))return value.map(textFrom).filter(Boolean).join('');
  if(!value||typeof value!=='object')return '';
  const item=value as Record<string,unknown>;
  for(const key of ['text','output_text','content','response','result']){
    const text=textFrom(item[key]);if(text)return text;
  }
  return '';
}

function responseContent(protocol:ProviderProtocol,data:unknown){
  const root=data&&typeof data==='object'&&'data' in data?(data as {data?:unknown}).data??data:data;
  if(protocol==='openai_chat'){
    const choice=(root as {choices?:Array<{message?:{content?:unknown;reasoning_content?:unknown};text?:unknown}>}).choices?.[0];
    const content=textFrom(choice?.message?.content)||textFrom(choice?.text);
    const structuredFallback=textFrom(choice?.message?.reasoning_content);
    return content||(/^```(?:json)?\s*[\[{]|^[\[{]/i.test(structuredFallback)?structuredFallback:'');
  }
  if(protocol==='openai_responses'){
    const payload=root as {output_text?:unknown;output?:Array<{content?:unknown}>};
    return textFrom(payload.output_text)||textFrom(payload.output?.flatMap((item)=>Array.isArray(item.content)?item.content:[item.content]));
  }
  if(protocol==='anthropic_messages')return textFrom((root as {content?:unknown}).content);
  if(protocol==='gemini_generate')return textFrom((root as {candidates?:Array<{content?:{parts?:unknown}}>}).candidates?.[0]?.content?.parts);
  return textFrom((root as {message?:{content?:unknown};response?:unknown}).message?.content)||textFrom((root as {response?:unknown}).response);
}

function httpError(response:HttpResult){
  let message=typeof response.data==='string'?response.data:JSON.stringify(response.data);
  try{const parsed=response.data as {error?:{message?:string}|string;message?:string};message=typeof parsed.error==='string'?parsed.error:parsed.error?.message??parsed.message??message;}catch{}
  return new Error(`接口返回 ${response.status}：${String(message).replace(/\s+/g,' ').slice(0,260)}`);
}

function completionDetail(data:unknown){
  const root=data&&typeof data==='object'&&'data' in data?(data as {data?:unknown}).data??data:data;
  const payload=root as {choices?:Array<{finish_reason?:unknown}>;status?:unknown;incomplete_details?:unknown;candidates?:Array<{finishReason?:unknown}>;done_reason?:unknown};
  return payload?.choices?.[0]?.finish_reason??payload?.candidates?.[0]?.finishReason??payload?.incomplete_details??payload?.done_reason??payload?.status;
}

function increaseOutputLimit(protocol:ProviderProtocol,body:Record<string,unknown>,current:number){
  const next=Math.min(16384,Math.max(8192,current*2));
  if(protocol==='openai_chat'||protocol==='anthropic_messages')body.max_tokens=next;
  if(protocol==='openai_responses')body.max_output_tokens=next;
  if(protocol==='gemini_generate')body.generationConfig={...(body.generationConfig as Record<string,unknown>),maxOutputTokens:next};
  if(protocol==='ollama_chat')body.options={...(body.options as Record<string,unknown>),num_predict:next};
  return next;
}

export async function requestProviderModel(request:ModelRequest,http:HttpClient){
  const {connection}=request;
  const endpoint=normalizeEndpoint(connection.protocol,connection.endpoint);
  const image=imageParts(request.imageData);
  const headers=authHeaders(connection);
  let url=endpoint;
  let body:Record<string,unknown>;
  if(connection.protocol==='openai_chat'){
    const isZhipu=connection.providerId==='zhipu'||/^https:\/\/open\.bigmodel\.cn\//i.test(endpoint);
    body={model:connection.model,temperature:request.temperature,max_tokens:request.maxTokens,...(isZhipu?{thinking:{type:'disabled'}}:{}),...(request.json?{response_format:{type:'json_object'}}:{}),messages:[...(request.system?[{role:'system',content:request.system}]:[]),{role:'user',content:image?[{type:'text',text:request.text},{type:'image_url',image_url:{url:request.imageData}}]:request.text}]};
  }else if(connection.protocol==='openai_responses'){
    body={model:connection.model,max_output_tokens:request.maxTokens,...(request.system?{instructions:request.system}:{}),input:[{role:'user',content:image?[{type:'input_text',text:request.text},{type:'input_image',image_url:request.imageData}]:[{type:'input_text',text:request.text}]}]};
  }else if(connection.protocol==='anthropic_messages'){
    body={model:connection.model,max_tokens:request.maxTokens,temperature:request.temperature,...(request.system?{system:request.system}:{}),messages:[{role:'user',content:image?[{type:'image',source:{type:'base64',media_type:image.mimeType,data:image.base64}},{type:'text',text:request.text}]:request.text}]};
  }else if(connection.protocol==='gemini_generate'){
    url=`${endpoint.replace(/\/models(?:\/.*)?$/i,'')}/models/${encodeURIComponent(connection.model)}:generateContent`;
    body={...(request.system?{system_instruction:{parts:[{text:request.system}]}}:{}),contents:[{role:'user',parts:[{text:request.text},...(image?[{inline_data:{mime_type:image.mimeType,data:image.base64}}]:[])]}],generationConfig:{temperature:request.temperature,maxOutputTokens:request.maxTokens,...(request.json?{responseMimeType:'application/json'}:{})}};
  }else{
    body={model:connection.model,stream:false,format:request.json?'json':undefined,options:{temperature:request.temperature,num_predict:request.maxTokens},messages:[...(request.system?[{role:'system',content:request.system}]:[]),{role:'user',content:request.text,...(image?{images:[image.base64]}:{})}]};
  }
  let response=await http(url,'POST',headers,body);
  if(response.status<200||response.status>=300)throw httpError(response);
  let content=responseContent(connection.protocol,response.data);
  let detail=completionDetail(response.data);
  if(!content&&/length|max[_ -]?tokens?|incomplete/i.test(String(typeof detail==='string'?detail:JSON.stringify(detail??'')))){
    increaseOutputLimit(connection.protocol,body,request.maxTokens);
    response=await http(url,'POST',headers,body);
    if(response.status<200||response.status>=300)throw httpError(response);
    content=responseContent(connection.protocol,response.data);
    detail=completionDetail(response.data);
  }
  if(!content)throw new Error(`接口已连接，但模型连续两次没有返回可显示正文${detail?`（状态：${JSON.stringify(detail).slice(0,120)}）`:''}。请从自动模型列表重新选择模型，或换用非纯推理模型`);
  return content;
}
