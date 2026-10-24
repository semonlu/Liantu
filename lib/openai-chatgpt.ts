export type ChatGptOAuthCredentials={
  access:string;
  refresh:string;
  expires:number;
  accountId:string;
  email?:string;
  planType?:string;
};

export type ChatGptDeviceLogin={
  deviceAuthId:string;
  userCode:string;
  verificationUrl:string;
  intervalMs:number;
  expiresAt:number;
};

export type RawHttpResult={status:number;data:unknown};
export type RawHttpClient=(url:string,method:'GET'|'POST',headers:Record<string,string>,data?:unknown)=>Promise<RawHttpResult>;

const AUTH_BASE='https://auth.openai.com';
const CODEX_BASE='https://chatgpt.com/backend-api/codex';
const CLIENT_ID='app_EMoamEEZ73f0CkXaXp7hrann';
const DEVICE_CALLBACK=`${AUTH_BASE}/deviceauth/callback`;
const DEVICE_TIMEOUT_MS=15*60_000;
const CLIENT_VERSION='0.147.0';
const APP_VERSION='1.1.8';

const requestHeaders=(contentType:string)=>({
  'Content-Type':contentType,
  originator:'codex_cli_rs',
  version:APP_VERSION,
  'User-Agent':`codex_cli_rs/${CLIENT_VERSION}`,
});

function asObject(value:unknown):Record<string,unknown>{
  if(typeof value==='string'){
    try{const parsed=JSON.parse(value);return parsed&&typeof parsed==='object'?parsed as Record<string,unknown>:{};}catch{return {};}
  }
  return value&&typeof value==='object'?value as Record<string,unknown>:{};
}

function responseError(prefix:string,response:RawHttpResult){
  const body=asObject(response.data),nested=asObject(body.error);
  const rawError=typeof body.error==='string'?body.error:undefined;
  const fallback=typeof response.data==='string'?response.data:JSON.stringify(response.data??'');
  const detail=String(nested.message||nested.code||rawError||body.error_description||body.detail||body.message||body.code||fallback).replace(/\s+/g,' ').slice(0,500);
  const hint=response.status===401||response.status===403?'。账号授权已失效或无 Codex 权限，请退出后重新登录':response.status===429?'。账号当前额度或请求频率受限，请稍后再试':'';
  return new Error(`${prefix}（HTTP ${response.status}）${detail?`：${detail}`:''}${hint}`);
}

function decodeJwtPayload(token:string){
  const part=token.split('.')[1];
  if(!part)return {} as Record<string,unknown>;
  try{
    const normalized=part.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(part.length/4)*4,'=');
    const bytes=Uint8Array.from(atob(normalized),(char)=>char.charCodeAt(0));
    const text=new TextDecoder().decode(bytes);
    return asObject(JSON.parse(text));
  }catch{return {} as Record<string,unknown>;}
}

function identityFromToken(access:string){
  const payload=decodeJwtPayload(access),auth=asObject(payload['https://api.openai.com/auth']);
  const profile=asObject(payload.profile);
  const accountId=String(auth.chatgpt_account_id??payload.chatgpt_account_id??'').trim();
  const email=String(payload.email??profile.email??'').trim()||undefined;
  const planType=String(auth.chatgpt_plan_type??payload.chatgpt_plan_type??'').trim()||undefined;
  return {accountId,email,planType};
}

function credentialsFromToken(body:Record<string,unknown>,existing?:ChatGptOAuthCredentials):ChatGptOAuthCredentials{
  const access=String(body.access_token??'').trim();
  const refresh=String(body.refresh_token??existing?.refresh??'').trim();
  if(!access||!refresh)throw new Error('ChatGPT 授权成功，但令牌响应不完整');
  const identity=identityFromToken(access);
  const accountId=identity.accountId||existing?.accountId||'';
  if(!accountId)throw new Error('ChatGPT 授权成功，但无法读取账号标识');
  const expiresIn=Number(body.expires_in);
  return {
    access,refresh,accountId,
    expires:Date.now()+(Number.isFinite(expiresIn)&&expiresIn>0?expiresIn*1000:60*60_000),
    email:identity.email??existing?.email,
    planType:identity.planType??existing?.planType,
  };
}

export function chatGptCredentialsFrom(value:Record<string,unknown>):ChatGptOAuthCredentials{
  return {
    access:String(value.chatgptAccessToken??''),refresh:String(value.chatgptRefreshToken??''),
    expires:Number(value.chatgptExpiresAt)||0,accountId:String(value.chatgptAccountId??''),
    email:String(value.chatgptEmail??'').trim()||undefined,planType:String(value.chatgptPlanType??'').trim()||undefined,
  };
}

export function chatGptCredentialPatch(credentials:ChatGptOAuthCredentials){
  return {
    chatgptAccessToken:credentials.access,chatgptRefreshToken:credentials.refresh,
    chatgptExpiresAt:credentials.expires,chatgptAccountId:credentials.accountId,
    chatgptEmail:credentials.email??'',chatgptPlanType:credentials.planType??'',
  };
}

export async function requestChatGptDeviceLogin(http:RawHttpClient):Promise<ChatGptDeviceLogin>{
  const response=await http(`${AUTH_BASE}/api/accounts/deviceauth/usercode`,'POST',requestHeaders('application/json'),{client_id:CLIENT_ID});
  if(response.status<200||response.status>=300){
    if(response.status===404)throw new Error('ChatGPT 账号尚未启用 Codex 设备码授权，请先在 ChatGPT 安全设置中启用');
    throw responseError('无法获取 ChatGPT 登录验证码',response);
  }
  const body=asObject(response.data);
  const deviceAuthId=String(body.device_auth_id??'').trim(),userCode=String(body.user_code??body.usercode??'').trim();
  if(!deviceAuthId||!userCode)throw new Error('ChatGPT 登录接口没有返回完整验证码');
  const intervalSeconds=Number(body.interval);
  return {
    deviceAuthId,userCode,verificationUrl:`${AUTH_BASE}/codex/device`,
    intervalMs:Number.isFinite(intervalSeconds)&&intervalSeconds>0?Math.max(1000,intervalSeconds*1000):5000,
    expiresAt:Date.now()+DEVICE_TIMEOUT_MS,
  };
}

const wait=(ms:number,signal?:AbortSignal)=>new Promise<void>((resolve,reject)=>{
  if(signal?.aborted)return reject(new Error('已取消 ChatGPT 登录'));
  const timer=setTimeout(resolve,ms);
  signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(new Error('已取消 ChatGPT 登录'));},{once:true});
});

async function exchangeDeviceCode(http:RawHttpClient,authorizationCode:string,codeVerifier:string){
  const form=new URLSearchParams({grant_type:'authorization_code',code:authorizationCode,redirect_uri:DEVICE_CALLBACK,client_id:CLIENT_ID,code_verifier:codeVerifier}).toString();
  const response=await http(`${AUTH_BASE}/oauth/token`,'POST',requestHeaders('application/x-www-form-urlencoded'),form);
  if(response.status<200||response.status>=300)throw responseError('ChatGPT 令牌交换失败',response);
  return credentialsFromToken(asObject(response.data));
}

export async function completeChatGptDeviceLogin(login:ChatGptDeviceLogin,http:RawHttpClient,signal?:AbortSignal):Promise<ChatGptOAuthCredentials>{
  while(Date.now()<login.expiresAt){
    if(signal?.aborted)throw new Error('已取消 ChatGPT 登录');
    const response=await http(`${AUTH_BASE}/api/accounts/deviceauth/token`,'POST',requestHeaders('application/json'),{device_auth_id:login.deviceAuthId,user_code:login.userCode});
    if(response.status>=200&&response.status<300){
      const body=asObject(response.data),authorizationCode=String(body.authorization_code??'').trim(),codeVerifier=String(body.code_verifier??'').trim();
      if(!authorizationCode||!codeVerifier)throw new Error('ChatGPT 授权响应缺少交换码');
      return exchangeDeviceCode(http,authorizationCode,codeVerifier);
    }
    if(response.status!==403&&response.status!==404)throw responseError('ChatGPT 设备授权失败',response);
    await wait(Math.min(login.intervalMs,Math.max(1000,login.expiresAt-Date.now())),signal);
  }
  throw new Error('ChatGPT 登录验证码已过期，请重新登录');
}

export async function ensureChatGptCredentials(credentials:ChatGptOAuthCredentials,http:RawHttpClient){
  if(!credentials.access||!credentials.refresh||!credentials.accountId)throw new Error('请先使用 ChatGPT 账号登录');
  if(credentials.expires>Date.now()+60_000)return credentials;
  const form=new URLSearchParams({grant_type:'refresh_token',refresh_token:credentials.refresh,client_id:CLIENT_ID}).toString();
  const response=await http(`${AUTH_BASE}/oauth/token`,'POST',requestHeaders('application/x-www-form-urlencoded'),form);
  if(response.status<200||response.status>=300)throw responseError('ChatGPT 登录已失效，请重新登录',response);
  return credentialsFromToken(asObject(response.data),credentials);
}

function codexHeaders(credentials:ChatGptOAuthCredentials,accept='application/json',requestId?:string){
  return {
    Authorization:`Bearer ${credentials.access}`,
    'ChatGPT-Account-ID':credentials.accountId,
    Accept:accept,
    'Content-Type':'application/json; charset=utf-8',
    'Accept-Language':'zh-CN,zh;q=0.9,en;q=0.6',
    originator:'codex_cli_rs',version:APP_VERSION,'User-Agent':`codex_cli_rs/${CLIENT_VERSION}`,
    ...(requestId?{'x-client-request-id':requestId,'session-id':requestId,'thread-id':requestId}:{}),
  };
}

export async function listChatGptModels(credentials:ChatGptOAuthCredentials,http:RawHttpClient){
  const current=await ensureChatGptCredentials(credentials,http);
  let response=await http(`${CODEX_BASE}/models?client_version=${CLIENT_VERSION}`,'GET',codexHeaders(current));
  if(response.status<200||response.status>=300)response=await http(`${CODEX_BASE}/models`,'GET',codexHeaders(current));
  if(response.status<200||response.status>=300)throw responseError('读取 ChatGPT 模型列表失败',response);
  const body=asObject(response.data),rows=Array.isArray(body.models)?body.models:[];
  const models=rows.filter((row)=>{
    const item=asObject(row);
    return item.supported_in_api!==false&&String(item.visibility??'list')!=='hide'&&item.use_responses_lite!==true;
  }).sort((left,right)=>Number(asObject(right).priority??0)-Number(asObject(left).priority??0))
    .map((row)=>String(asObject(row).slug??asObject(row).id??'').trim()).filter(Boolean);
  if(!models.length)throw new Error('ChatGPT 账号已连接，但没有返回可选 Codex 模型');
  return {models:[...new Set(models)],credentials:current};
}

function objectText(value:unknown):string{
  if(typeof value==='string')return value.trim();
  if(Array.isArray(value))return value.map(objectText).filter(Boolean).join('');
  if(!value||typeof value!=='object')return '';
  const item=value as Record<string,unknown>;
  for(const key of ['output_text','text','content']){const found=objectText(item[key]);if(found)return found;}
  if(Array.isArray(item.output))return objectText(item.output);
  return '';
}

function codexResponseText(data:unknown){
  if(typeof data!=='string')return objectText(data);
  const trimmed=data.trim();
  if(trimmed.startsWith('{')){
    try{return objectText(JSON.parse(trimmed));}catch{}
  }
  const deltas:string[]=[],completed:string[]=[];
  for(const line of data.split(/\r?\n/)){
    if(!line.startsWith('data:'))continue;
    const payload=line.slice(5).trim();
    if(!payload||payload==='[DONE]')continue;
    let event:Record<string,unknown>;
    try{event=asObject(JSON.parse(payload));}catch{continue;}
    const type=String(event.type??'');
    if(type==='error'||type==='response.failed'){
      const response=asObject(event.response),error=asObject(event.error),responseErrorValue=response.error;
      const message=String(error.message??asObject(responseErrorValue).message??responseErrorValue??event.message??'Codex 响应失败');
      throw new Error(message);
    }
    try{
      if(type==='response.output_text.delta'&&typeof event.delta==='string')deltas.push(event.delta);
      if(type==='response.output_text.done'&&typeof event.text==='string')completed.push(event.text);
      if(type==='response.completed')completed.push(objectText(event.response));
    }catch{/* 忽略单个非文本事件，继续读取后续 SSE。 */}
  }
  return deltas.join('').trim()||completed.filter(Boolean).at(-1)?.trim()||'';
}

export async function requestChatGptModel(params:{
  credentials:ChatGptOAuthCredentials;http:RawHttpClient;model:string;system?:string;text:string;imageData?:string;maxTokens:number;json?:boolean;
}){
  const credentials=await ensureChatGptCredentials(params.credentials,params.http);
  const content:Array<Record<string,unknown>>=[{type:'input_text',text:params.text}];
  if(params.imageData)content.push({type:'input_image',image_url:params.imageData});
  const requestId=globalThis.crypto?.randomUUID?.()??`liantu-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const input=[{type:'message',role:'user',content}];
  const headers=codexHeaders(credentials,'text/event-stream',requestId);
  const primary={
    model:params.model,instructions:params.system||'请直接回答用户。',input,tools:[],tool_choice:'auto',parallel_tool_calls:false,
    reasoning:{effort:'medium',summary:'auto'},store:false,stream:true,include:['reasoning.encrypted_content'],
  };
  let response=await params.http(`${CODEX_BASE}/responses`,'POST',headers,primary);
  let firstFailure='';
  if(response.status===400){
    firstFailure=responseError('标准 Codex 格式被拒绝',response).message;
    response=await params.http(`${CODEX_BASE}/responses`,'POST',headers,{model:params.model,instructions:params.system||'请直接回答用户。',input,store:false,stream:true});
  }
  if(response.status<200||response.status>=300){
    const final=responseError('ChatGPT Codex 请求失败',response);
    throw new Error(`${final.message}（模型：${params.model}）${firstFailure?`；首次请求详情：${firstFailure}`:''}`);
  }
  const text=codexResponseText(response.data);
  if(!text)throw new Error('ChatGPT Codex 已返回成功状态，但没有可显示的文本内容');
  return {content:text,credentials};
}
