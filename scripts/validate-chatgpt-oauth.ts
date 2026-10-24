import assert from 'node:assert/strict';
import {
  completeChatGptDeviceLogin, listChatGptModels, requestChatGptDeviceLogin, requestChatGptModel,
} from '../lib/openai-chatgpt.ts';
import type { RawHttpClient } from '../lib/openai-chatgpt.ts';

const jwt=(payload:Record<string,unknown>)=>{
  const encode=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({alg:'none'})}.${encode(payload)}.`;
};

const access=jwt({email:'tester@example.com','https://api.openai.com/auth':{chatgpt_account_id:'acct-test',chatgpt_plan_type:'plus'}});
const calls:Array<{url:string;method:string;data?:unknown}>=[];
const queue:Array<{status:number;data:unknown}>=[
  {status:200,data:{device_auth_id:'device-1',user_code:'ABCD-EFGH',interval:1}},
  {status:200,data:{authorization_code:'authorization-1',code_verifier:'verifier-1'}},
  {status:200,data:{access_token:access,refresh_token:'refresh-1',expires_in:3600}},
];
const http:RawHttpClient=async(url,method,_headers,data)=>{
  calls.push({url,method,data});
  const response=queue.shift();
  if(!response)throw new Error(`unexpected request ${url}`);
  return response;
};

const login=await requestChatGptDeviceLogin(http);
assert.equal(login.userCode,'ABCD-EFGH');
assert.equal(login.verificationUrl,'https://auth.openai.com/codex/device');
const credentials=await completeChatGptDeviceLogin(login,http);
assert.equal(credentials.accountId,'acct-test');
assert.equal(credentials.email,'tester@example.com');
assert.equal(credentials.planType,'plus');
assert.match(String(calls[2].data),/grant_type=authorization_code/);
assert.match(String(calls[2].data),/redirect_uri=https%3A%2F%2Fauth.openai.com%2Fdeviceauth%2Fcallback/);

const catalogHttp:RawHttpClient=async(url)=>{
  assert.match(url,/\/backend-api\/codex\/models\?client_version=/);
  return {status:200,data:{models:[
    {slug:'gpt-5.6-sol',visibility:'list',supported_in_api:true,priority:20},
    {slug:'gpt-responses-lite',visibility:'list',supported_in_api:true,use_responses_lite:true,priority:100},
    {slug:'gpt-5.5',visibility:'list',supported_in_api:true,priority:10},
    {slug:'codex-auto-review',visibility:'hide',supported_in_api:true},
    {slug:'not-api',visibility:'list',supported_in_api:false},
  ]}};
};
const catalog=await listChatGptModels(credentials,catalogHttp);
assert.deepEqual(catalog.models,['gpt-5.6-sol','gpt-5.5']);

let primaryBody:Record<string,unknown>|undefined;
const responseHttp:RawHttpClient=async(url,method,headers,data)=>{
  assert.equal(url,'https://chatgpt.com/backend-api/codex/responses');
  assert.equal(method,'POST');
  assert.equal(headers['ChatGPT-Account-ID'],'acct-test');
  assert.equal(headers.originator,'codex_cli_rs');
  assert.equal(headers['OpenAI-Beta'],undefined);
  assert.ok(headers['x-client-request-id']);
  assert.equal(headers['session-id'],headers['x-client-request-id']);
  assert.equal(headers['thread-id'],headers['x-client-request-id']);
  primaryBody=data as Record<string,unknown>;
  return {status:200,data:[
    'event: response.output_text.delta',
    'data: {"type":"response.output_text.delta","delta":"练途"}',
    '',
    'event: response.output_text.delta',
    'data: {"type":"response.output_text.delta","delta":"连接成功"}',
    '',
    'data: [DONE]',
  ].join('\n')};
};
const response=await requestChatGptModel({credentials,http:responseHttp,model:'gpt-5.6-sol',text:'测试',maxTokens:200});
assert.equal(response.content,'练途连接成功');
assert.equal(primaryBody?.store,false);
assert.equal(primaryBody?.stream,true);
assert.equal((primaryBody?.input as Array<{type?:string}>)?.[0]?.type,'message');
assert.deepEqual(primaryBody?.tools,[]);
assert.equal(primaryBody?.tool_choice,'auto');
assert.equal(primaryBody?.parallel_tool_calls,false);
assert.deepEqual(primaryBody?.reasoning,{effort:'medium',summary:'auto'});
assert.deepEqual(primaryBody?.include,['reasoning.encrypted_content']);
assert.equal(primaryBody?.max_output_tokens,undefined);

const fallbackBodies:Array<Record<string,unknown>>=[];
const fallbackHttp:RawHttpClient=async(_url,_method,_headers,data)=>{
  fallbackBodies.push(data as Record<string,unknown>);
  if(fallbackBodies.length===1)return {status:400,data:{error:{code:'unsupported_parameter',message:'Unsupported parameter: reasoning'}}};
  return {status:200,data:'data: {"type":"response.output_text.delta","delta":"降级连接成功"}\n\ndata: [DONE]\n'};
};
const fallback=await requestChatGptModel({credentials,http:fallbackHttp,model:'gpt-5.6-sol',text:'测试降级',maxTokens:200});
assert.equal(fallback.content,'降级连接成功');
assert.equal(fallbackBodies.length,2);
assert.equal(fallbackBodies[1].reasoning,undefined);
assert.equal(fallbackBodies[1].tools,undefined);

let rejectedCalls=0;
const rejectedHttp:RawHttpClient=async()=>{
  rejectedCalls+=1;
  return rejectedCalls===1
    ?{status:400,data:{error:{code:'invalid_request',message:'primary body rejected'}}}
    :{status:400,data:{error_description:'minimal body rejected'}};
};
await assert.rejects(
  requestChatGptModel({credentials,http:rejectedHttp,model:'gpt-5.6-sol',text:'测试错误详情',maxTokens:200}),
  /minimal body rejected.*模型：gpt-5\.6-sol.*primary body rejected/,
);

const expired={...credentials,access:'expired',expires:0};
let refreshSeen=false;
const refreshedAccess=jwt({email:'tester@example.com'});
const refreshHttp:RawHttpClient=async(url,_method,_headers,data)=>{
  if(url.endsWith('/oauth/token')){
    refreshSeen=true;
    assert.match(String(data),/grant_type=refresh_token/);
    return {status:200,data:{access_token:refreshedAccess,refresh_token:'refresh-2',expires_in:3600}};
  }
  return {status:200,data:{models:[{slug:'gpt-5.5',visibility:'list',supported_in_api:true}]}};
};
const refreshed=await listChatGptModels(expired,refreshHttp);
assert.equal(refreshSeen,true);
assert.equal(refreshed.credentials.accountId,'acct-test');
assert.equal(refreshed.credentials.refresh,'refresh-2');

console.log('ChatGPT OAuth device flow, refresh, model catalog and Codex SSE checks passed.');
