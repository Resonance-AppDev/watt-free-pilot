// R15 provider-specific room consent gate. No legacy room-wide consent is transferable.
export const PROVIDERS=Object.freeze(['groq','gemini','openrouter']);
export function providerConsentVersion(provider){
 if(!PROVIDERS.includes(provider))throw new TypeError('INVALID_PROVIDER');
 return 'watt-ai-provider-v1';
}
export function allMembersApproved(members,consents,provider){
 const version=providerConsentVersion(provider);
 if(!Array.isArray(members)||!Array.isArray(consents)||members.length===0)return false;
 const ids=new Set();
 for(const member of members){
  if(typeof member?.user_id!=='string'||!member.user_id||ids.has(member.user_id))return false;
  ids.add(member.user_id);
 }
 const approvals=new Set();
 for(const c of consents){
  if(c?.provider!==provider||c?.consent_version!==version||c.allowed!==true||!ids.has(c.user_id))continue;
  approvals.add(c.user_id);
 }
 return approvals.size===ids.size;
}
export function eligibleConsentedProviders(members,consents){
 return PROVIDERS.filter(provider=>allMembersApproved(members,consents,provider));
}
