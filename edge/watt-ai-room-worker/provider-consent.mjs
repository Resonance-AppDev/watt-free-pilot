// Provider-specific room consent. A generic v1/OpenAI approval is not a Groq approval.
// Pure validator; service reads remain server-side, never in the public browser.
export const GROQ_CONSENT_VERSION='watt-ai-groq-2026-v1';
export function allMembersApprovedForGroq(members,consents,expectedCount){
 if(!Array.isArray(members)||!Array.isArray(consents)||
    !Number.isInteger(expectedCount)||expectedCount<1||expectedCount>6||
    members.length!==expectedCount)return false;
 const ids=new Set();
 for(const m of members){
  if(typeof m?.user_id!=='string'||ids.has(m.user_id))return false;
  ids.add(m.user_id);
 }
 const accepted=new Set();
 for(const c of consents){
  if(typeof c?.user_id!=='string'||!ids.has(c.user_id)||
     c.allowed!==true||c.consent_version!==GROQ_CONSENT_VERSION||accepted.has(c.user_id))return false;
  accepted.add(c.user_id);
 }
 return accepted.size===ids.size;
}
