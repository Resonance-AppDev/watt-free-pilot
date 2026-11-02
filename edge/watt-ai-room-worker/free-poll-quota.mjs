// R15 upstream-provider allowance preflight; no WATT-defined user/global daily AI quotas.
// This is advisory only: a transactional provider-scoped reservation is still required.
export function quotaDecision(snapshot,estimatedTokens){
 if(!snapshot||typeof snapshot!=='object'||!Number.isSafeInteger(estimatedTokens)||estimatedTokens<1)return {allowed:false,reason:'INVALID_QUOTA'};
 const keys=['remainingRequestsMinute','remainingRequestsDay','remainingTokensMinute','remainingTokensDay'];
 if(keys.some(k=>!Number.isSafeInteger(snapshot[k])||snapshot[k]<0))return {allowed:false,reason:'INVALID_QUOTA'};
 if(snapshot.remainingRequestsMinute<1||snapshot.remainingRequestsDay<1)return {allowed:false,reason:'PROVIDER_REQUEST_LIMIT_EXHAUSTED'};
 if(snapshot.remainingTokensMinute<estimatedTokens||snapshot.remainingTokensDay<estimatedTokens)return {allowed:false,reason:'PROVIDER_TOKEN_LIMIT_EXHAUSTED'};
 return {allowed:true,reason:'ELIGIBLE_FOR_ATOMIC_RESERVATION'};
}
export function validateReservation(reservation,provider,jobId){
 return Boolean(reservation&&reservation.committed===true&&reservation.provider===provider&&reservation.jobId===jobId&&
 typeof reservation.reservationId==='string'&&reservation.reservationId.length>0);
}
