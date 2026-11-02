// WATT room AI R13 — free-provider candidate. Release remains disabled until verification.
// The compile-time release gate is intentionally false and must not be changed
// until provider account tier, room authorization, quotas and release checks pass.
import {GROQ_FREE_ENDPOINT,makeFreeProviderRequest,parseFreeProviderResponse,isExplicitWattRequest,freeAccountSelected} from './free-provider.mjs';
import {allMembersApprovedForGroq,GROQ_CONSENT_VERSION} from './provider-consent.mjs';
declare const Deno: {serve: (f: (request: Request) => Promise<Response>) => void; env: {get: (k: string) => string | undefined}};
const RELEASE_GATE_OPEN = false;
const PROJECT = 'https://qylyuijjeruvbxipnrgh.supabase.co';
const LEGACY_ORIGIN = 'https://headless-hnoporafmau-resonance36912-140e.wix-site-host.com';
const PILOT_ORIGIN = /^https:\/\/watt-36912--watt-r12-unified-ai-[a-z0-9]+\.web\.app$/;
function allowOrigin(origin: string | null): boolean {
  return origin === LEGACY_ORIGIN || (typeof origin === 'string' && PILOT_ORIGIN.test(origin));
}
const CONSENT_VERSION = 'watt-ai-room-v1';
const MAX_INPUT = 2000;
const MAX_OUTPUT = 2000;
const BODY_BYTES = 2048;
const ROOM_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MESSAGE_ID = /^[1-9]\d{0,17}$/;
let active = 0;
const ACTIVE_LIMIT = 2;
class ClientError extends Error {
  constructor(public status: number, public code: string){super(code);}
}
function send(status: number, body: unknown, origin: string | null, extra: Record<string,string> = {}): Response {
  const h: Record<string,string> = {
    'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff', 'Vary':'Origin',
    'Access-Control-Allow-Methods':'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers':'authorization,apikey,content-type', ...extra
  };
  if(allowOrigin(origin)) h['Access-Control-Allow-Origin'] = origin!;
  return new Response(status === 204 ? null : JSON.stringify(body), {status,headers:h});
}
async function bounded(stream: ReadableStream<Uint8Array> | null, bytes: number, ms: number): Promise<unknown> {
  if(!stream)throw new ClientError(400,'INVALID_JSON');
  const reader = stream.getReader();
  const controller = new AbortController();
  const timer = setTimeout(()=>{controller.abort();reader.cancel().catch(()=>{});},ms);
  const parts: Uint8Array[] = [];
  let count=0;
  try {
    while(true){
      if(controller.signal.aborted)throw new ClientError(408,'BODY_TIMEOUT');
      const r = await reader.read();
      if(controller.signal.aborted)throw new ClientError(408,'BODY_TIMEOUT');
      if(r.done)break;
      count+=r.value.byteLength;
      if(count>bytes){reader.cancel().catch(()=>{});throw new ClientError(413,'PAYLOAD_TOO_LARGE');}
      parts.push(r.value);
    }
    const b=new Uint8Array(count);let i=0;
    for(const v of parts){b.set(v,i);i+=v.byteLength;}
    try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(b));}
    catch{throw new ClientError(400,'INVALID_JSON');}
  } finally {clearTimeout(timer);try{reader.releaseLock();}catch{}}
}
async function requestJson(url: string, method: string, headers: Record<string,string>, payload: unknown, timeout = 8000, limit = 65536): Promise<{ok:boolean;status:number;data:any}> {
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeout);
  try{
    const r=await fetch(url,{method,headers,body:payload===undefined?undefined:JSON.stringify(payload),signal:controller.signal});
    if(!r.ok){r.body?.cancel().catch(()=>{});return {ok:false,status:r.status,data:null};}
    const data=await bounded(r.body,limit,timeout);
    return {ok:true,status:r.status,data};
  }catch{return {ok:false,status:0,data:null};}
  finally{clearTimeout(timer);controller.abort();}
}
function apiHeaders(token: string): Record<string,string> {
  const key=Deno.env.get('SUPABASE_ANON_KEY') || '';
  return {apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'};
}
async function rpc(name:string, body:unknown, token:string, service=false):Promise<{ok:boolean;status:number;data:any}> {
  const headers=service ? {apikey:token,Authorization:'Bearer '+token,'Content-Type':'application/json'} : apiHeaders(token);
  return requestJson(PROJECT+'/rest/v1/rpc/'+name,'POST',headers,body,8000,16384);
}
async function userFromBearer(auth:string): Promise<string> {
  if(auth.length>8192 || !/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(auth))throw new ClientError(401,'AUTH_REQUIRED');
  const r=await requestJson(PROJECT+'/auth/v1/user','GET',apiHeaders(auth.slice(7)),undefined,8000);
  if(!r.ok){if(r.status===401||r.status===403)throw new ClientError(401,'AUTH_REQUIRED');throw new ClientError(503,'AUTH_UNAVAILABLE');}
  if(typeof r.data?.id!=='string'||r.data?.is_anonymous===true||!(r.data?.email_confirmed_at||r.data?.phone_confirmed_at))throw new ClientError(403,'CONFIRMED_ACCOUNT_REQUIRED');
  return r.data.id;
}
function validPayload(data:unknown):{roomId:string;triggerMessageId:string}{
  if(!data||typeof data!=='object'||Array.isArray(data))throw new ClientError(400,'INVALID_INPUT');
  const p=data as Record<string,unknown>;
  if(Object.keys(p).some(k=>!['roomId','triggerMessageId'].includes(k))||
     typeof p.roomId!=='string'||!ROOM_ID.test(p.roomId)||
     typeof p.triggerMessageId!=='string'||!MESSAGE_ID.test(p.triggerMessageId))throw new ClientError(400,'INVALID_INPUT');
  return {roomId:p.roomId,triggerMessageId:p.triggerMessageId};
}
async function markFailed(jobId:unknown,key:string,code:string):Promise<void>{
  // Only the specific still-processing job is modified; failures never publish.
  const id=String(jobId);
  if(!MESSAGE_ID.test(id))return;
  await requestJson(PROJECT+'/rest/v1/watt_ai_reply_jobs?id=eq.'+encodeURIComponent(id)+'&status=eq.processing',
    'PATCH',{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json','Prefer':'return=representation'},
    {status:'failed',error_code:code,updated_at:new Date().toISOString()},5000);
}
async function groqConsentForAll(roomId:string,key:string,count:number):Promise<boolean>{
  const origin=PROJECT+'/rest/v1/';
  const headers={apikey:key,Authorization:'Bearer '+key};
  const scope='&room_id=eq.'+encodeURIComponent(roomId);
  const [members,consents]=await Promise.all([
    requestJson(origin+'watt_pilot_members?select=user_id'+scope,'GET',headers,undefined,7000,8000),
    requestJson(origin+'watt_ai_member_consents?select=user_id,allowed,consent_version'+scope,'GET',headers,undefined,7000,8000)
  ]);
  return members.ok&&consents.ok&&allMembersApprovedForGroq(members.data,consents.data,count);
}
async function prepareAndRun(roomId:string,messageId:string,userId:string,auth:string):Promise<{status:number;body:any}>{
  const status=await rpc('watt_ai_room_status',{p_room_id:roomId},auth);
  if(!status.ok){
    if(status.status===400||status.status===401||status.status===403)throw new ClientError(403,'ROOM_ACCESS_DENIED');
    throw new ClientError(503,'ROOM_STATUS_UNAVAILABLE');
  }
  const room=status.data;
  if(typeof room?.member_count!=='number'||room.member_count<=0)throw new ClientError(403,'ROOM_ACCESS_DENIED');
  if(!RELEASE_GATE_OPEN)throw new ClientError(503,'WORKER_NOT_READY');
  // This branch cannot run in the deployed staging build.
  if(!room.ready||room.enabled!==true||room.member_count!==room.consented_count||room.my_consent!==true)
    throw new ClientError(403,'ROOM_CONSENT_INCOMPLETE');
  const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
  const groq=Deno.env.get('GROQ_API_KEY')||'';
  if(!key||!freeAccountSelected((name:string)=>Deno.env.get(name))||!groq)throw new ClientError(503,'FREE_PROVIDER_NOT_VERIFIED');
  // Legacy consent explicitly named OpenAI; never reuse it to disclose room text to Groq.
  if(!await groqConsentForAll(roomId,key,room.member_count))throw new ClientError(403,'PROVIDER_CONSENT_REQUIRED');
  // Inspect ONLY an explicit @WATT message from its author; never load room history.
  const url=PROJECT+'/rest/v1/watt_pilot_messages?select=id,room_id,sender_id,body&id=eq.'+encodeURIComponent(messageId)+'&room_id=eq.'+encodeURIComponent(roomId)+'&limit=1';
  const r=await requestJson(url,'GET',{apikey:key,Authorization:'Bearer '+key},undefined,7000,5000);
  if(!r.ok)throw new ClientError(503,'MESSAGE_LOOKUP_UNAVAILABLE');
  const msg=Array.isArray(r.data)?r.data[0]:null;
  if(!msg||msg.sender_id!==userId||typeof msg.body!=='string'||!isExplicitWattRequest(msg.body)||msg.body.length>MAX_INPUT)
    throw new ClientError(403,'TRIGGER_NOT_ALLOWED');
  // Unique(trigger_message_id) enforces cross-instance deduplication. The existing 20/day job guard is retained until a verified provider-scoped token ledger is implemented.
  const queued=await rpc('watt_ai_enqueue_reply',{p_room_id:roomId,p_trigger_message_id:messageId},key,true);
  if(!queued.ok)throw new ClientError(503,'QUEUE_UNAVAILABLE');
  if(queued.data?.ok!==true)throw new ClientError(queued.data?.code==='ALREADY_QUEUED'?409:403,'JOB_NOT_QUEUED');
  const jobId=queued.data.job_id;
  const claimed=await rpc('watt_ai_claim_reply_job',{p_job_id:jobId},key,true);
  if(!claimed.ok||claimed.data?.ok!==true)throw new ClientError(409,'JOB_NOT_CLAIMED');
  try{
    // A second room-status check minimizes the revocation-to-provider race.
    const fresh=await rpc('watt_ai_room_status',{p_room_id:roomId},auth);
    if(!fresh.ok||fresh.data?.ready!==true||fresh.data?.enabled!==true||
       fresh.data?.member_count!==fresh.data?.consented_count||fresh.data?.my_consent!==true){
       await markFailed(jobId,key,'CONSENT_CHANGED_BEFORE_PROVIDER');
       throw new ClientError(409,'CONSENT_CHANGED');
    }
    if(!await groqConsentForAll(roomId,key,fresh.data.member_count)){
      await markFailed(jobId,key,'PROVIDER_CONSENT_CHANGED');
      throw new ClientError(409,'PROVIDER_CONSENT_CHANGED');
    }
    const out=await requestJson(GROQ_FREE_ENDPOINT,'POST',
      {Authorization:'Bearer '+groq,'Content-Type':'application/json'},
      makeFreeProviderRequest(msg.body),20000,65536);
    if(!out.ok){await markFailed(jobId,key,'PROVIDER_FAILED');throw new ClientError(502,'PROVIDER_UNAVAILABLE');}
    const draft=parseFreeProviderResponse(out.data);
    if(!draft){await markFailed(jobId,key,'EMPTY_PROVIDER_OUTPUT');throw new ClientError(502,'INVALID_AI_OUTPUT');}
    if(!await groqConsentForAll(roomId,key,fresh.data.member_count)){
      await markFailed(jobId,key,'PROVIDER_CONSENT_CHANGED');
      throw new ClientError(409,'PROVIDER_CONSENT_CHANGED');
    }
    // Transactional publisher locks room settings and checks every member's consent AGAIN.
    const pub=await rpc('watt_ai_publish_reply',{p_job_id:jobId,p_body:draft},key,true);
    if(!pub.ok||pub.data?.ok!==true){throw new ClientError(409,'PUBLISH_BLOCKED');}
    return {status:200,body:{ok:true,shared:true,sender:'WATT AI',aiMessageId:pub.data.ai_message_id}};
  }catch(e){
    if(e instanceof ClientError)throw e;
    await markFailed(jobId,key,'PROCESSING_FAILED');
    throw new ClientError(503,'PROCESSING_UNAVAILABLE');
  }
}
Deno.serve(async(request:Request):Promise<Response>=>{
  const origin=request.headers.get('origin');
  if(origin&&!allowOrigin(origin))return send(403,{ok:false,code:'ORIGIN_REJECTED'},origin);
  if(request.method==='OPTIONS')return send(204,null,origin);
  if(request.method!=='GET'&&request.method!=='POST')return send(405,{ok:false,code:'METHOD_NOT_ALLOWED'},origin);
  if(active>=ACTIVE_LIMIT)return send(429,{ok:false,code:'WORKER_BUSY'},origin,{'Retry-After':'2'});
  active++;
  try{
    const auth=request.headers.get('authorization')||'';
    const userId=await userFromBearer(auth);
    if(request.method==='GET')return send(200,{ok:true,worker:'watt-ai-room-worker',mode:'staging',ready:false,autoReplies:false,providerCalls:false,processingPrepared:true,freeProvider:'groq_free_candidate'},origin);
    if((request.headers.get('content-type')||'').split(';')[0].trim().toLowerCase()!=='application/json')throw new ClientError(415,'JSON_REQUIRED');
    const len=request.headers.get('content-length');
    if(len!==null&&(!/^\d+$/.test(len)||Number(len)>BODY_BYTES))throw new ClientError(413,'PAYLOAD_TOO_LARGE');
    const {roomId,triggerMessageId}=validPayload(await bounded(request.body,BODY_BYTES,5000));
    const result=await prepareAndRun(roomId,triggerMessageId,userId,auth.slice(7));
    return send(result.status,result.body,origin);
  }catch(e){
    const error=e instanceof ClientError?e:new ClientError(503,'SERVICE_UNAVAILABLE');
    return send(error.status,{ok:false,code:error.code,shared:false,providerCalls:false},origin);
  }finally{active--;}
});