/* WATT Free Pilot network adapter. The publishable key is public by design; never put secrets here. */
export const API_ORIGIN = 'https://qylyuijjeruvbxipnrgh.supabase.co';
export const PUBLISHABLE_KEY = 'sb_publishable_dAXJdCG5NEwxY56OaPZLyw_khCp3ybm';
export const ROOM_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const INVITE_CODE = /^[a-f0-9]{64}$/;
const RPC_WHITELIST = new Set([
  'watt_pilot_list_rooms', 'watt_pilot_get_room', 'watt_pilot_create_room',
  'watt_pilot_join_room', 'watt_pilot_issue_invite', 'watt_pilot_revoke_invites',
  'watt_pilot_send_message',
  'watt_ai_room_status','watt_ai_get_room_messages',
  'watt_ai_set_member_consent','watt_ai_set_room_enabled'
]);
export class PilotError extends Error {
  constructor(code = 'REQUEST_FAILED', status = 0) { super(code); this.name='PilotError'; this.code=code; this.status=status; }
}
export async function apiPost(path, body = {}, token = '', transport = globalThis.fetch, ms = 15000) {
  if (!path.startsWith('/auth/v1/token?grant_type=password') && !/^\/rest\/v1\/rpc\/(?:watt_pilot_|watt_ai_)[a-z_]+$/.test(path)) throw new PilotError('INVALID_PATH');
  if (typeof transport !== 'function') throw new PilotError('NO_NETWORK');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await transport(API_ORIGIN + path, {
      method: 'POST', mode: 'cors', cache: 'no-store', credentials: 'omit',
      referrerPolicy:'no-referrer', signal:controller.signal,
      headers: {apikey:PUBLISHABLE_KEY, 'Content-Type':'application/json', ...(token ? {Authorization:'Bearer '+token}:{})},
      body:JSON.stringify(body)
    });
    let json;
    try { json = await res.json(); } catch { throw new PilotError('INVALID_RESPONSE', res.status); }
    if(!res.ok || !json || json.ok === false) {
      throw new PilotError(typeof json?.code==='string' ? json.code :
        typeof json?.error_code==='string' ? json.error_code : 'REQUEST_FAILED',res.status);
    }
    return json;
  } catch(e) {
    if(controller.signal.aborted) throw new PilotError('TIMEOUT');
    throw e;
  } finally { clearTimeout(timer); }
}
export function rpc(name, body={}, token='', transport=globalThis.fetch) {
  if(!RPC_WHITELIST.has(name)) throw new PilotError('INVALID_RPC');
  if(typeof token !== 'string' || !token) throw new PilotError('AUTH_REQUIRED',401);
  return apiPost('/rest/v1/rpc/'+name,body,token,transport);
}
export async function signInWithPassword(email, password, transport=globalThis.fetch) {
  if(typeof email!=='string'||email.trim().length>254||!email.trim()||typeof password!=='string'||!password) throw new PilotError('BAD_INPUT',400);
  const res=await apiPost('/auth/v1/token?grant_type=password',{email:email.trim(),password},'',transport);
  const u=res.user,seconds=Number(res.expires_in??0);
  if(!u || !ROOM_ID.test(u.id??'') || typeof res.access_token!=='string' || !res.access_token ||
     u.is_anonymous || !u.email_confirmed_at || !Number.isFinite(seconds) || seconds<=20 || seconds>86400)
     throw new PilotError('AUTH_REQUIRED',401);
  return {token:res.access_token,id:u.id,email:String(u.email??email).slice(0,254),expiresAt:Date.now()+(seconds-15)*1000};
}
export function normalizeRooms(data) {
  if(!Array.isArray(data?.rooms)||data.rooms.length>100) throw new PilotError('INVALID_RESPONSE');
  if(!data.rooms.every(r=>ROOM_ID.test(r?.id??'')&&typeof r.title==='string'&&r.title.length<=80&&['owner','member'].includes(r.role))) throw new PilotError('INVALID_RESPONSE');
  return data.rooms.map(r=>({id:r.id,title:r.title,role:r.role,owner_id:r.owner_id??null}));
}
export function normalizeRoom(result, requestedId) {
  if(result?.ok!==true || !ROOM_ID.test(result?.room?.id??'') || result.room.id!==requestedId ||
    !Array.isArray(result.members) || result.members.length>6 || !Array.isArray(result.messages) || result.messages.length>50)
    throw new PilotError('INVALID_RESPONSE');
  const messages=result.messages.map(m=>{
    if(!Number.isSafeInteger(Number(m.id))||Number(m.id)<=0||typeof m.body!=='string'||m.body.length>2000||
       !ROOM_ID.test(m.sender_id??''))throw new PilotError('INVALID_RESPONSE');
    return {id:Number(m.id),sender_id:m.sender_id,sender_name:typeof m.sender_name==='string'?m.sender_name.slice(0,40):'Participant',
      body:m.body,created_at:typeof m.created_at==='string'?m.created_at:''};
  });
  const cursor=Number(result.next_after_id);
  if(!Number.isSafeInteger(cursor)||cursor<0)throw new PilotError('INVALID_RESPONSE');
  return {id:requestedId,title:String(result.room.title??'Private room').slice(0,80),
    members:result.members.length,messages,cursor};
}
export function checkMessage(body) {
  if(typeof body!=='string'||body.length>2000||body.trim().length<1)return false;
  return new TextEncoder().encode(body).byteLength<=8000;
}
export function secureUUID() {
  if(typeof globalThis.crypto?.randomUUID==='function')return globalThis.crypto.randomUUID();
  if(typeof globalThis.crypto?.getRandomValues!=='function')throw new PilotError('NO_SECURE_RANDOM');
  const bytes=new Uint8Array(16);globalThis.crypto.getRandomValues(bytes);
  bytes[6]=(bytes[6]&0x0f)|0x40;bytes[8]=(bytes[8]&0x3f)|0x80;
  const str=[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');
  return str.replace(/^(........)(....)(....)(....)(............)$/, '$1-$2-$3-$4-$5');
}
export function nextPending(previous,body,uuid=secureUUID) {
  if(!checkMessage(body))throw new PilotError('BAD_INPUT',400);
  return previous?.body===body ? previous : {body,id:uuid()};
}
export function friendlyError(err) {
  const code=err?.code??'';
  if(['AUTH_REQUIRED','USER_NOT_ALLOWED'].includes(code)||err?.status===401)return 'Your pilot session is not authorized or has expired. Sign in again.';
  if(code==='MEMBERSHIP_REQUIRED')return 'You are not a member of this private room.';
  if(code==='ROOM_LIMIT')return 'Free Pilot limit: you may own a maximum of two rooms.';
  if(code==='ROOM_FULL')return 'This room has reached its six-person limit.';
  if(code==='MESSAGE_LIMIT')return 'This room has reached its 1,000-message limit.';
  if(code==='SEND_LIMIT'||code==='JOIN_LIMIT'||err?.status===429)return 'The current rate limit has been reached. Try again later.';
  if(code==='INVALID_INVITE')return 'This invitation is invalid, expired, revoked or already used.';
  if(code==='OWNER_REQUIRED')return 'Only the room owner can perform this action.';
  if(code==='MESSAGE_ID_CONFLICT')return 'A message identifier was reused for different content. Your message was not accepted.';
  if(code==='WORKER_NOT_READY'||code==='AI_DISABLED'||code==='AI_UNAVAILABLE'||code==='PROVIDER_NOT_CONFIGURED'||code==='AI_PROVIDER_CONFIGURATION')
    return 'WATT AI is not available in this pilot room yet. Human messaging remains available.';
  if(code==='ROOM_CONSENT_INCOMPLETE'||code==='CONSENT_INCOMPLETE'||code==='CONSENT_CHANGED')
    return 'Everyone in this room must agree before WATT AI can respond.';
  if(code==='AI_TIMEOUT'||code==='PROVIDER_UNAVAILABLE')
    return 'WATT AI could not respond. Your human message remains saved; check before retrying.';

  if(code==='TIMEOUT')return 'Request timed out. The server may have completed the action; check rooms or messages before retrying.';
  if(code==='invalid_credentials'||err?.status===400)return 'Check your enrolled email and password.';
  if(code==='BAD_INPUT')return 'Please review the input and try again.';
  return 'The request could not be completed. Your existing WATT data has not been replaced.';
}
export function isExpired(session){return !session||Date.now()>=session.expiresAt;}
