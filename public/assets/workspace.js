import {rpc,signInWithPassword,signUpWithPilotInvite,normalizeRooms,normalizeRoom,checkMessage,nextPending,friendlyError,isExpired,ROOM_ID,INVITE_CODE} from './core.js';

const $=id=>document.getElementById(id);
const state={session:null,rooms:[],activeRoomId:null,messages:new Map(),cursors:new Map(),drafts:new Map(),pending:new Map(),
  roomEpoch:0,loginEpoch:0,action:'',sessionTimer:null,selectedRoom:null};
function notice(text,warning=false){$('status-text').textContent=text;$('status').classList.toggle('warning',warning);}
function setBusy(action=''){
  state.action=action;
  for(const id of ['signup-submit','show-signup','show-login','login-submit','show-create','show-join','refresh-rooms','generate-invite','revoke-invites','copy-invite']){
    const el=$(id);if(el)el.disabled=Boolean(action);
  }
  $('message-draft').disabled=Boolean(action)||!state.activeRoomId;
  $('send-button').disabled=Boolean(action)||!state.activeRoomId||!$('message-draft').value.trim();
  $('refresh-messages').disabled=Boolean(action)||!state.activeRoomId;
  for(const formId of ['create-form','join-form']){
    const form=$(formId);
    for(const el of form.querySelectorAll('button,input'))el.disabled=Boolean(action);
  }
}
function tokenSession(){if(isExpired(state.session)){if(state.session)logout('Your session expired. Sign in again.');return null;}return state.session;}
function logout(text='Signed out. Your private data was cleared from this tab.'){
  state.loginEpoch++;state.roomEpoch++;state.session=null;state.rooms=[];state.activeRoomId=null;state.selectedRoom=null;
  state.messages.clear();state.cursors.clear();state.drafts.clear();state.pending.clear();
  if(state.sessionTimer)clearTimeout(state.sessionTimer);state.sessionTimer=null;
  $('login-view').hidden=false;$('app-view').hidden=true;$('login-form').reset();
  $('create-form').hidden=true;$('join-form').hidden=true;$('invite-panel').hidden=true;
  $('invite-code').value='';$('message-draft').value='';$('account-email').textContent='';
  $('messages').replaceChildren();$('room-list').replaceChildren();$('room-title').textContent='Choose a room';
  $('room-description').textContent='Your private WATT conversations';$('room-count').textContent='0';
  $('owner-tools').hidden=true;
  setBusy();updateComposer();notice(text);
}
function setSession(session){state.session=session;$('account-email').textContent=session.email;
  $('login-view').hidden=true;$('app-view').hidden=false;
  if(state.sessionTimer)clearTimeout(state.sessionTimer);
  state.sessionTimer=setTimeout(()=>logout('Pilot session expired; private data cleared.'),Math.max(1,session.expiresAt-Date.now()));
}
function setRoomForm(which){
  const a=$('create-form'),b=$('join-form');
  const reveal=which==='create'?a:b,other=which==='create'?b:a;
  const wasHidden=reveal.hidden;reveal.hidden=!wasHidden;other.hidden=true;
  $('show-create').setAttribute('aria-expanded',String(!a.hidden));
  $('show-join').setAttribute('aria-expanded',String(!b.hidden));
  if(!reveal.hidden)reveal.querySelector('input')?.focus();
}
function renderRooms(){
  const list=$('room-list');list.replaceChildren();$('room-count').textContent=String(state.rooms.length);
  $('work-grid').classList.toggle('single-room',state.rooms.length===1);
  if(!state.rooms.length){const p=document.createElement('p');p.className='empty-list';p.textContent='No rooms yet. Create your own private room, or join with a code.';list.append(p);}
  for(const r of state.rooms){
    const btn=document.createElement('button');btn.type='button';btn.className='room-button';
    btn.setAttribute('aria-pressed',String(r.id===state.activeRoomId));
    const name=document.createElement('strong');name.textContent=r.title;
    const meta=document.createElement('small');meta.textContent=r.role==='owner'?'Owner':'Member';
    btn.append(name,meta);btn.addEventListener('click',()=>{void selectRoom(r.id);});list.append(btn);
  }
  renderOwner();
}
function clearOwnerInvite(){ $('invite-panel').hidden=true;$('invite-code').value='';$('invite-expiry').textContent=''; }
function renderOwner(){const room=state.rooms.find(r=>r.id===state.activeRoomId);
  $('owner-tools').hidden=!room||room.role!=='owner';
}
function renderMessages(){
  const output=$('messages');output.replaceChildren();
  const room=state.activeRoomId?state.messages.get(state.activeRoomId):null;
  if(!state.activeRoomId){const empty=document.createElement('div');empty.className='chat-empty';empty.textContent='Select a private room or create a new room to begin.';output.append(empty);return;}
  if(!room?.length){const empty=document.createElement('div');empty.className='chat-empty';empty.textContent='No messages yet. Start a human conversation.';output.append(empty);return;}
  for(const msg of room){
    const article=document.createElement('article');article.className='message'+(msg.sender_id===state.session?.id?' mine':'');
    const top=document.createElement('div');top.className='message-head';
    const who=document.createElement('span');who.textContent=msg.sender_id===state.session?.id?'You':msg.sender_name||'Participant';
    const date=document.createElement('time');date.dateTime=msg.created_at;
    const d=new Date(msg.created_at);date.textContent=Number.isNaN(d.getTime())?'Sent':d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    const text=document.createElement('p');text.className='message-body';text.textContent=msg.body;
    top.append(who,date);article.append(top,text);output.append(article);
  }
  output.scrollTop=output.scrollHeight;
}
function updateComposer(){
  const box=$('message-draft');box.disabled=!state.activeRoomId||Boolean(state.action);
  box.placeholder=state.activeRoomId?'Write a message to this private room…':'Select a private room to start';
  $('message-count').textContent=String(box.value.length)+'/2,000 · Human messages only. AI automatic posting is OFF.';
  $('send-button').disabled=!state.activeRoomId||Boolean(state.action)||!checkMessage(box.value);
  $('refresh-messages').disabled=!state.activeRoomId||Boolean(state.action);
}
function showRoomTitle(room){
  $('room-title').textContent=room?.title??'Choose a room';
  $('room-description').textContent=room?(room.members+' member'+(room.members===1?'':'s')+' · Free Pilot human chat'):'Your private WATT conversations';
}
async function loadRoom(id){
  const s=tokenSession();if(!s||id!==state.activeRoomId)return;
  const request=++state.roomEpoch;const after=state.cursors.get(id)??0;
  if(after===0 && !state.messages.has(id))notice('Verifying membership and loading messages…');
  try{
    const raw=await rpc('watt_pilot_get_room',{p_room_id:id,p_after_id:after,p_limit:50},s.token);
    if(state.session!==s||state.activeRoomId!==id||request!==state.roomEpoch)return;
    const result=normalizeRoom(raw,id);
    if(result.cursor<after)throw new Error('Invalid message cursor');
    const old=state.messages.get(id)??[];
    const map=new Map(old.map(m=>[m.id,m]));for(const m of result.messages)map.set(m.id,m);
    const merged=[...map.values()].sort((a,b)=>a.id-b.id).slice(-200);
    state.messages.set(id,merged);state.cursors.set(id,result.cursor);
    showRoomTitle(result);renderMessages();
    notice(result.messages.length===50&&after>0?'Room refreshed. Additional newer messages may be available; refresh again.':'Connected · Your private room is synchronized.');
  }catch(e){if(state.session!==s||state.activeRoomId!==id||request!==state.roomEpoch)return;
    if(e?.code==='AUTH_REQUIRED'||e?.status===401||e?.code==='USER_NOT_ALLOWED'){logout(friendlyError(e));return;}
    if(e?.code==='MEMBERSHIP_REQUIRED'){
      state.messages.delete(id);state.cursors.delete(id);state.pending.delete(id);state.drafts.delete(id);
      state.rooms=state.rooms.filter(r=>r.id!==id);state.activeRoomId=null;state.roomEpoch++;
      $('message-draft').value='';clearOwnerInvite();renderRooms();showRoomTitle(null);renderMessages();updateComposer();
    }
    notice(friendlyError(e),true);
  }
}
async function selectRoom(id){
  if(!state.rooms.some(r=>r.id===id))return;
  const previous=state.activeRoomId;
  if(previous)state.drafts.set(previous,$('message-draft').value);
  state.roomEpoch++;state.activeRoomId=id;
  $('message-draft').value=state.drafts.get(id)??'';clearOwnerInvite();renderRooms();
  const room=state.rooms.find(r=>r.id===id);showRoomTitle({title:room?.title??'Private room',members:0});
  renderMessages();updateComposer();await loadRoom(id);
}
async function refreshRooms(prefer=null){
  const s=tokenSession();if(!s)return;
  try{
    const result=normalizeRooms(await rpc('watt_pilot_list_rooms',{},s.token));
    if(state.session!==s)return;
    state.rooms=result;
    const valid=new Set(result.map(r=>r.id));
    for(const id of state.messages.keys())if(!valid.has(id)){
      state.messages.delete(id);state.cursors.delete(id);state.drafts.delete(id);state.pending.delete(id);
    }
    if(state.activeRoomId&&!valid.has(state.activeRoomId)){
      state.activeRoomId=null;state.roomEpoch++;$('message-draft').value='';clearOwnerInvite();
    }
    let next=valid.has(prefer)?prefer:valid.has(state.activeRoomId)?state.activeRoomId:result.length===1?result[0].id:null;
    renderRooms();
    if(next){if(next!==state.activeRoomId)await selectRoom(next);else {showRoomTitle({title:result.find(r=>r.id===next).title,members:0});await loadRoom(next);}}
    else{showRoomTitle(null);renderMessages();updateComposer();notice('Rooms refreshed. Choose a room or create a private room.');}
  }catch(e){if(state.session===s){if(e?.status===401)logout(friendlyError(e));else notice(friendlyError(e),true);}}
}
async function runAction(name,fn){
  if(state.action)return;
  const session=tokenSession();if(!session)return;
  setBusy(name);
  try{await fn(session);}catch(e){if(state.session===session){
    if(e?.status===401||e?.code==='USER_NOT_ALLOWED'||e?.code==='AUTH_REQUIRED')logout(friendlyError(e));
    else notice(friendlyError(e),true);
  }}finally{if(state.session===session){setBusy();updateComposer();}}
}
function toggleEnrollment(show){
  if(state.action||state.session)return;
  $('login-form').hidden=show;$('signup-form').hidden=!show;
  notice(show?'Invitation required. Enrollment is subject to server approval and email verification.':'Sign in with your existing WATT pilot account.');
  if(show)$('signup-email').focus();else $('email').focus();
}
$('show-signup').addEventListener('click',()=>toggleEnrollment(true));
$('show-login').addEventListener('click',()=>toggleEnrollment(false));
$('signup-form').addEventListener('submit',async e=>{
  e.preventDefault();if(state.action||state.session)return;
  const form=$('signup-form');
  const email=$('signup-email').value.trim();
  const code=$('signup-code').value.trim().toLowerCase();
  let password=$('signup-password').value;
  const confirmed=$('signup-confirm').value;
  if(password!==confirmed){notice('Passwords must match.',true);return;}
  const epoch=++state.loginEpoch;setBusy('signup');
  notice('Validating invitation and enrollment permissions…');
  try{
    await signUpWithPilotInvite(email,password,code);
    if(epoch!==state.loginEpoch)return;
    form.reset();
    $('login-form').hidden=false;$('signup-form').hidden=true;
    notice('If your invitation was accepted, confirm your email, then sign in. Keep your invitation code private for joining the room.');
  }catch(err){if(epoch===state.loginEpoch)notice(friendlyError(err),true);}
  finally{password='';$('signup-password').value='';$('signup-confirm').value='';setBusy();updateComposer();}
});
$('login-form').addEventListener('submit',async e=>{
  e.preventDefault();if(state.action||state.session)return;
  const email=$('email').value.trim();let password=$('password').value;$('password').value='';
  const epoch=++state.loginEpoch;setBusy('login');notice('Checking your existing WATT pilot access…');
  try{
    const session=await signInWithPassword(email,password);password='';
    if(epoch!==state.loginEpoch)return;
    const rooms=normalizeRooms(await rpc('watt_pilot_list_rooms',{},session.token));
    if(epoch!==state.loginEpoch)return;
    setSession(session);state.rooms=rooms;renderRooms();
    notice(rooms.length?'Welcome back. Opening your private room…':'Welcome. Create a private Free Pilot room or join one with an invitation.');
    if(rooms.length===1)await selectRoom(rooms[0].id);
  }catch(err){if(epoch===state.loginEpoch)notice(friendlyError(err),true);}
  finally{password='';setBusy();updateComposer();}
});
$('sign-out').addEventListener('click',()=>logout());
$('show-create').addEventListener('click',()=>setRoomForm('create'));
$('show-join').addEventListener('click',()=>setRoomForm('join'));
$('create-form').addEventListener('submit',e=>{
  e.preventDefault();const data=new FormData(e.currentTarget);
  const title=data.get('title')?.toString().trim()??'';
  const name=data.get('name')?.toString().trim()??'';
  void runAction('create',async s=>{
    if(!title||title.length>80||!name||name.length>40)throw {code:'BAD_INPUT'};
    const data=await rpc('watt_pilot_create_room',{p_title:title,p_name:name},s.token);
    if(state.session!==s)return;
    if(!ROOM_ID.test(data?.room?.id??''))throw {code:'INVALID_RESPONSE'};
    $('create-form').reset();$('create-form').hidden=true;$('show-create').setAttribute('aria-expanded','false');
    await refreshRooms(data.room.id);notice('Private room created. Membership and limits are enforced by the server.');
  });
});
$('join-form').addEventListener('submit',e=>{
  e.preventDefault();const data=new FormData(e.currentTarget);
  const token=String(data.get('token')??'').trim().toLowerCase();
  const name=String(data.get('name')??'').trim();
  void runAction('join',async s=>{
    if(!INVITE_CODE.test(token)||!name||name.length>40)throw {code:'BAD_INPUT'};
    const data=await rpc('watt_pilot_join_room',{p_token:token,p_name:name},s.token);
    if(state.session!==s)return;
    if(!ROOM_ID.test(data?.room?.id??''))throw {code:'INVALID_RESPONSE'};
    $('join-form').reset();$('join-form').hidden=true;$('show-join').setAttribute('aria-expanded','false');
    await refreshRooms(data.room.id);notice('Joined private room. Server membership checks remain active.');
  });
});
$('generate-invite').addEventListener('click',()=>void runAction('invite',async s=>{
  const id=state.activeRoomId,room=state.rooms.find(r=>r.id===id);
  if(!id||room?.role!=='owner')throw {code:'OWNER_REQUIRED'};
  clearOwnerInvite();const data=await rpc('watt_pilot_issue_invite',{p_room_id:id},s.token);
  if(state.session!==s||state.activeRoomId!==id)return;
  if(!INVITE_CODE.test(data?.token??''))throw {code:'INVALID_RESPONSE'};
  $('invite-code').value=data.token;$('invite-expiry').textContent='Expires: '+String(data.expires_at??'within 24 hours')+'. Share privately with an enrolled account.';
  $('invite-panel').hidden=false;notice('Private invitation generated. Older invitations were replaced.');
}));
$('revoke-invites').addEventListener('click',()=>{
  if(!window.confirm('Revoke all active invitation codes for this room?'))return;
  void runAction('revoke',async s=>{
    const id=state.activeRoomId,room=state.rooms.find(r=>r.id===id);
    if(!id||room?.role!=='owner')throw {code:'OWNER_REQUIRED'};
    await rpc('watt_pilot_revoke_invites',{p_room_id:id},s.token);
    if(state.session!==s)return;clearOwnerInvite();notice('All room invitation codes were revoked.');
  });
});
$('copy-invite').addEventListener('click',async()=>{
  const code=$('invite-code').value;
  if(!INVITE_CODE.test(code))return;
  try{await navigator.clipboard.writeText(code);notice('Invitation copied. Share it privately.');}
  catch{$('invite-code').focus();$('invite-code').select();notice('Select the highlighted code and copy it manually.');}
});
$('refresh-rooms').addEventListener('click',()=>{void runAction('rooms',async()=>{await refreshRooms();});});
$('refresh-messages').addEventListener('click',()=>{if(state.activeRoomId)void loadRoom(state.activeRoomId);});
$('message-draft').addEventListener('input',e=>{
  if(state.activeRoomId)state.drafts.set(state.activeRoomId,e.currentTarget.value);
  updateComposer();
});
$('send-form').addEventListener('submit',e=>{
  e.preventDefault();void runAction('send',async s=>{
    const id=state.activeRoomId,body=$('message-draft').value;
    if(!id||!state.rooms.some(r=>r.id===id))throw {code:'MEMBERSHIP_REQUIRED'};
    if(!checkMessage(body))throw {code:'BAD_INPUT'};
    const pending=nextPending(state.pending.get(id),body);state.pending.set(id,pending);
    const res=await rpc('watt_pilot_send_message',{p_room_id:id,p_client_message_id:pending.id,p_body:body},s.token);
    if(state.session!==s)return;
    if(!Number.isSafeInteger(Number(res?.message?.id))||Number(res.message.id)<=0)throw {code:'INVALID_RESPONSE'};
    state.pending.delete(id);state.drafts.delete(id);
    if(state.activeRoomId===id){$('message-draft').value='';updateComposer();await loadRoom(id);}
    notice(res.duplicate?'Message already saved; safely synchronized without a duplicate.':'Message saved. The conversation was synchronized.');
  });
});
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'&&tokenSession()&&!state.action)void refreshRooms();
});
updateComposer();
