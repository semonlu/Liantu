import assert from 'node:assert/strict';
import {
  listProviderModels, normalizeEndpoint, parseCustomHeaders, requestProviderModel, validateEndpoint,
} from '../lib/model-provider.ts';
import type { ModelConnection } from '../lib/model-provider.ts';

assert.equal(normalizeEndpoint('openai_chat','https://api.example.com/v1'),'https://api.example.com/v1/chat/completions');
assert.equal(normalizeEndpoint('openai_responses','https://api.openai.com/v1'),'https://api.openai.com/v1/responses');
assert.equal(normalizeEndpoint('anthropic_messages','https://api.anthropic.com'),'https://api.anthropic.com/v1/messages');
assert.equal(normalizeEndpoint('ollama_chat','http://127.0.0.1:11434'),'http://127.0.0.1:11434/api/chat');
assert.deepEqual(parseCustomHeaders('{"X-Title":"练途"}'),{'X-Title':'练途'});
assert.throws(()=>validateEndpoint('http://127.0.0.1:11434',false),/网页版/);
assert.doesNotThrow(()=>validateEndpoint('http://192.168.1.8:11434',true));

const base:ModelConnection={providerId:'test',protocol:'openai_chat',endpoint:'https://api.example.com/v1/chat/completions',model:'vision-test',apiKey:'secret',customHeaders:'{"X-App":"liantu"}'};
const calls:Array<{url:string;method:string;headers:Record<string,string>;body?:Record<string,unknown>}>=[];
const responses:unknown[]=[];
const http=async(url:string,method:'GET'|'POST',headers:Record<string,string>,body?:Record<string,unknown>)=>{
  calls.push({url,method,headers,body});
  return {status:200,data:responses.shift()};
};

responses.push({choices:[{message:{content:'chat-ok'}}]});
assert.equal(await requestProviderModel({connection:base,system:'system',text:'hello',maxTokens:100,temperature:0},http),'chat-ok');

responses.push({choices:[{message:{content:null,reasoning_content:'{"reply":"structured-fallback"}'}}]});
assert.equal(await requestProviderModel({connection:base,text:'hello',maxTokens:100,temperature:0},http),'{"reply":"structured-fallback"}');

responses.push({data:{choices:[{message:{content:[{type:'text',text:'nested-chat'}]}}]}});
assert.equal(await requestProviderModel({connection:base,text:'hello',maxTokens:100,temperature:0},http),'nested-chat');
assert.equal(calls.at(-1)?.headers.Authorization,'Bearer secret');
assert.equal(calls.at(-1)?.headers['X-App'],'liantu');

responses.push({output_text:'responses-ok'});
assert.equal(await requestProviderModel({connection:{...base,protocol:'openai_responses',endpoint:'https://api.openai.com/v1/responses'},text:'hello',maxTokens:100,temperature:0},http),'responses-ok');

responses.push({content:[{type:'text',text:'anthropic-ok'}]});
assert.equal(await requestProviderModel({connection:{...base,protocol:'anthropic_messages',endpoint:'https://api.anthropic.com/v1/messages'},text:'hello',maxTokens:100,temperature:0},http),'anthropic-ok');
assert.equal(calls.at(-1)?.headers['x-api-key'],'secret');
assert.equal(calls.at(-1)?.headers['anthropic-version'],'2023-06-01');

responses.push({candidates:[{content:{parts:[{text:'gemini-ok'}]}}]});
assert.equal(await requestProviderModel({connection:{...base,protocol:'gemini_generate',endpoint:'https://generativelanguage.googleapis.com/v1beta'},text:'hello',maxTokens:100,temperature:0},http),'gemini-ok');
assert.match(calls.at(-1)?.url??'',/models\/vision-test:generateContent$/);
assert.equal(calls.at(-1)?.headers['x-goog-api-key'],'secret');

responses.push({message:{content:'ollama-ok'}});
assert.equal(await requestProviderModel({connection:{...base,protocol:'ollama_chat',endpoint:'http://127.0.0.1:11434',apiKey:''},text:'hello',maxTokens:100,temperature:0},http),'ollama-ok');
assert.equal(calls.at(-1)?.body?.stream,false);

responses.push({models:[{model:'gemma3'},{name:'qwen3'}]});
assert.deepEqual(await listProviderModels({...base,protocol:'ollama_chat',endpoint:'http://127.0.0.1:11434',apiKey:''},http),['gemma3','qwen3']);

const zhipu={...base,providerId:'zhipu',endpoint:'https://open.bigmodel.cn/api/coding/paas/v4/chat/completions'};
responses.push({choices:[{message:{content:''},finish_reason:'length'}]});
responses.push({choices:[{message:{content:'zhipu-retry-ok'},finish_reason:'stop'}]});
assert.equal(await requestProviderModel({connection:zhipu,text:'hello',maxTokens:800,temperature:0},http),'zhipu-retry-ok');
assert.deepEqual(calls.at(-2)?.body?.thinking,{type:'disabled'});
assert.equal(calls.at(-1)?.body?.max_tokens,8192);

console.log('model provider validation passed');
