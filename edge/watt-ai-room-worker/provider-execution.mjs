// R15 provider execution primitive. Call only after provider-dispatch preflight and committed quota reservation.
// No room history, database writes, implicit retries, paid fallback, or release activation.
const ENDPOINTS=Object.freeze({
 groq:'https://api.groq.com/openai/v1/chat/completions',
 gemini:'https://generativelanguage.googleapis.com/v1beta/models/',
 openrouter:'https://openrouter.ai/api/v1/chat/completions'
});
const MODELS=/^[a-zA-Z0-9._:/-]{1,120}$/;
export async function executeFreeProvider({provider,model,prompt,credential,reservation,jobId,fetchImpl=fetch,timeoutMs=18000}){
 if(!Object.hasOwn(ENDPOINTS,provider)||!MODELS.test(model||'')||typeof prompt!=='string'||!prompt.trim()||prompt.length>2000||
 typeof credential!=='string'||!credential||typeof jobId!=='string'||!jobId||
 !reservation||reservation.committed!==true||reservation.provider!==provider||reservation.jobId!==jobId||
 typeof reservation.reservationId!=='string'||!reservation.reservationId||
 !Number.isSafeInteger(timeoutMs)||timeoutMs<1000||timeoutMs>30000)throw new TypeError('DISPATCH_NOT_AUTHORIZED');
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  let url,headers,body;
  if(provider==='gemini'){
   url=ENDPOINTS.gemini+encodeURIComponent(model)+':generateContent';
   headers={'x-goog-api-key':credential,'content-type':'application/json'};
   body={contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{maxOutputTokens:512}};
  }else{
   url=ENDPOINTS[provider];
   headers={'authorization':'Bearer '+credential,'content-type':'application/json'};
   body={model,messages:[{role:'user',content:prompt}],max_tokens:512};
  }
  const response=await fetchImpl(url,{method:'POST',headers,body:JSON.stringify(body),signal:controller.signal});
  if(!response.ok)return {ok:false,provider,code:response.status===429?'UPSTREAM_RATE_LIMIT':'UPSTREAM_UNAVAILABLE'};
  const raw=await response.text();
  if(raw.length>65536)return {ok:false,provider,code:'UPSTREAM_TOO_LARGE'};
  let data;
  try{data=JSON.parse(raw);}catch{return {ok:false,provider,code:'INVALID_PROVIDER_RESPONSE'};}
  const answer=provider==='gemini'?data?.candidates?.[0]?.content?.parts?.map(p=>p?.text||'').join(''):
   data?.choices?.[0]?.message?.content;
  if(typeof answer!=='string'||!answer.trim())return {ok:false,provider,code:'EMPTY_PROVIDER_RESPONSE'};
  return {ok:true,provider,model,text:answer.trim().slice(0,2000)};
 }catch{return {ok:false,provider,code:'UPSTREAM_REQUEST_FAILED'};}
 finally{clearTimeout(timer);}
}
