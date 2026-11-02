// Live Supabase consent response validation. Fail closed if the room roster changes.
import {FREE_PROVIDER_IDS} from './free-poll.mjs';
export function consentReadyForProvider(status,provider){
 if(!FREE_PROVIDER_IDS.includes(provider))return false;
 if(!status||typeof status!=='object'||!Number.isSafeInteger(status.member_count)||status.member_count<1)return false;
 if(!Array.isArray(status.providers)||status.providers.length!==FREE_PROVIDER_IDS.length)return false;
 const seen=new Set();
 for(const entry of status.providers){
  if(!entry||!FREE_PROVIDER_IDS.includes(entry.provider)||seen.has(entry.provider)||
     !Number.isSafeInteger(entry.approved_members)||entry.approved_members<0||
     entry.approved_members>status.member_count||typeof entry.my_consent!=='boolean')return false;
  seen.add(entry.provider);
 }
 if(seen.size!==FREE_PROVIDER_IDS.length)return false;
 const entry=status.providers.find(p=>p.provider===provider);
 return entry.my_consent===true&&entry.approved_members===status.member_count;
}
export function attachConsentToCandidates(candidates,status){
 if(!Array.isArray(candidates))throw new TypeError('INVALID_PROVIDER_CANDIDATES');
 return candidates.map(p=>({...p,providerConsent:consentReadyForProvider(status,p?.id),
   allRoomMembersConsented:consentReadyForProvider(status,p?.id)}));
}
