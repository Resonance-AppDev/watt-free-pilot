/* Unified WATT AI: browser-safe formatting and a guarded worker call. No provider key here. */
import {API_ORIGIN,PUBLISHABLE_KEY,PilotError,ROOM_ID} from './core.js';
const INTEGER=/^[1-9]\d{0,17}$/;
export const CONSENT_VERSION='watt-ai-room-v1';
export function asksWattAI(body){
 return typeof body==='string' && /^@watt(?:\b|$)/i.test(body.trim());
}
export function normalizeAiStatus(value){
 if(!value || typeof value!=='object' || !Number.isInteger(value.member_count) ||
    !Number.isInteger(value.consented_count) || value.member_count<1 || value.member_count>6 ||
    value.consented_count<0 || value.consented_count>value.member_count ||
    typeof value.enabled!=='boolean'||typeof value.my_consent!=='boolean'||
    typeof value.ready!=='boolean'||typeof value.is_owner!=='boolean')
    throw new PilotError('INVALID_RESPONSE');
 return {enabled:value.enabled,consented:value.consented_count,
  members:value.member_count,myConsent:value.my_consent,ready:value.ready,owner:value.is_owner};
}
export function normalizeAiMessages(data,roomId){
 if(!ROOM_ID.test(roomId)||!Array.isArray(data?.messages)||data.messages.length>50)
  throw new PilotError('INVALID_RESPONSE');
 return data.messages.map(m=>{
  if(m?.room_id!==roomId||!INTEGER.test(String(m.id))||m.sender_type!=='ai'||
    typeof m.body!=='string'||!m.body.trim()||m.body.length>2000||
    typeof m.created_at!=='string')throw new PilotError('INVALID_RESPONSE');
  return {id:Number(m.id),sender_name:'WATT AI',sender_type:'ai',
   body:m.body,created_at:m.created_at,kind:'ai'};
 });
}
export function mergeUnifiedMessages(human=[],ai=[]){
 const items=[
  ...human.map(m=>({...m,kind:'human'})),
  ...ai.map(m=>({...m,kind:'ai',sender_name:'WATT AI'}))
 ];
 return items.sort((a,b)=>{
  const ta=Date.parse(a.created_at),tb=Date.parse(b.created_at);
  const aa=Number.isNaN(ta)?0:ta,bb=Number.isNaN(tb)?0:tb;
  return aa-bb || (a.kind==='human'?-1:1);
 }).slice(-200);
}
export function canRequestAI(status){
 return Boolean(status?.ready&&status.enabled&&status.myConsent&&status.members>0&&status.consented===status.members);
}
export async function requestRoomAiReply(token,roomId,messageId,transport=globalThis.fetch){
 if(!token||!ROOM_ID.test(roomId)||!INTEGER.test(String(messageId)))throw new PilotError('BAD_INPUT',400);
 if(typeof transport!=='function')throw new PilotError('NO_NETWORK');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),23000);
 try{
  const response=await transport(API_ORIGIN+'/functions/v1/watt-ai-room-worker',{
   method:'POST',mode:'cors',cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',
   signal:controller.signal,
   headers:{apikey:PUBLISHABLE_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:JSON.stringify({roomId,triggerMessageId:String(messageId)})
  });
  let data;try{data=await response.json()}catch{throw new PilotError('INVALID_RESPONSE',response.status)}
  if(!response.ok||data?.ok!==true){
   throw new PilotError(typeof data?.code==='string' && /^[A-Z_]{2,50}$/.test(data.code)?data.code:'AI_UNAVAILABLE',response.status);
  }
  if(data.shared!==true || !INTEGER.test(String(data.aiMessageId)))throw new PilotError('INVALID_RESPONSE');
  return {shared:true,aiMessageId:Number(data.aiMessageId)};
 }catch(e){
  if(controller.signal.aborted)throw new PilotError('AI_TIMEOUT');
  throw e;
 }finally{clearTimeout(timer)}
}
