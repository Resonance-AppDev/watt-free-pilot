// R16 pure parser for verified provider usage. No credentials, network or database writes.
const MAX=1_000_000;
function tokenCount(value){return Number.isSafeInteger(value)&&value>=0&&value<=MAX?value:null;}
export function extractProviderUsage(provider,payload){
 if(!payload||typeof payload!=='object')return null;
 let input,output;
 if(provider==='gemini'){
  input=payload.usageMetadata?.promptTokenCount;
  output=payload.usageMetadata?.candidatesTokenCount;
 }else if(provider==='groq'||provider==='openrouter'){
  input=payload.usage?.prompt_tokens;
  output=payload.usage?.completion_tokens;
 }else return null;
 input=tokenCount(input);output=tokenCount(output);
 return input===null||output===null?null:Object.freeze({inputTokens:input,outputTokens:output});
}
export function readProviderRateLimit(provider,headers){
 if(!['groq','gemini','openrouter'].includes(provider)||!headers||typeof headers.get!=='function')return null;
 // Different providers expose different rate-limit headers. Only record observed values.
 const names=provider==='groq'?['x-ratelimit-remaining-requests']:provider==='openrouter'?['x-ratelimit-remaining-requests']:[];
 for(const name of names){
  const value=headers.get(name);
  if(typeof value==='string'&&/^(0|[1-9][0-9]{0,9})$/.test(value))return Object.freeze({remainingRequests:Number(value),sourceHeader:name});
 }
 return null;
}
