// R15: deterministic selection for a consented, quota-bounded free AI response poll.
// No provider calls, secrets, database mutations or release activation occur here.
export const FREE_PROVIDER_IDS=Object.freeze(['groq','gemini','openrouter']);
export const MAX_POLL_RESPONSES=3;
const int=n=>Number.isSafeInteger(n)&&n>=0;
export function selectFreeCandidates(providers,{maxResponses=MAX_POLL_RESPONSES}={}){
  if(!Array.isArray(providers)||!int(maxResponses)||maxResponses>MAX_POLL_RESPONSES)throw new TypeError('INVALID_POLL_CONFIG');
  const seen=new Set();
  return providers.filter(p=>{
    if(!p||typeof p!=='object'||!FREE_PROVIDER_IDS.includes(p.id)||seen.has(p.id))return false;
    seen.add(p.id);
    return p.verifiedFreeTier===true&&p.providerConsent===true&&p.allRoomMembersConsented===true&&
      p.enabled===true&&p.credentialConfigured===true&&
      int(p.remainingRequests)&&p.remainingRequests>0&&
      int(p.remainingTokens)&&p.remainingTokens>0&&
      p.releaseApproved===true;
  }).sort((a,b)=>FREE_PROVIDER_IDS.indexOf(a.id)-FREE_PROVIDER_IDS.indexOf(b.id))
    .slice(0,maxResponses).map(p=>({id:p.id,model:p.model}));
}
export function formatFreePoll(results){
  if(!Array.isArray(results))throw new TypeError('INVALID_POLL_RESULTS');
  const seen=new Set(),responses=[];
  for(const item of results){
    if(!item||!FREE_PROVIDER_IDS.includes(item.provider)||seen.has(item.provider)||
      typeof item.model!=='string'||!item.model.trim()||
      typeof item.text!=='string'||!item.text.trim())continue;
    seen.add(item.provider);
    responses.push({provider:item.provider,model:item.model,text:item.text.slice(0,2000)});
    if(responses.length===MAX_POLL_RESPONSES)break;
  }
  return {kind:'watt-free-ai-poll',responses,partial:responses.length<MAX_POLL_RESPONSES};
}
