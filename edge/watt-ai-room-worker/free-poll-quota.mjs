// R15 quota decision helpers. These do not reserve database quota or call providers.
// Callers must atomically reserve each provider's budget server-side before a request.
export function quotaDecision(snapshot,estimatedTokens){
 if(!snapshot||typeof snapshot!=='object'||!Number.isSafeInteger(estimatedTokens)||estimatedTokens<1)return {allowed:false,reason:'INVALID_QUOTA'};
 const keys=['remainingRequestsMinute','remainingRequestsDay','remainingTokensMinute','remainingTokensDay','remainingGlobalRequestsDay','remainingUserRequestsDay'];
 if(keys.some(k=>!Number.isSafeInteger(snapshot[k])||snapshot[k]<0))return {allowed:false,reason:'INVALID_QUOTA'};
 if(snapshot.remainingRequestsMinute<1||snapshot.remainingRequestsDay<1||snapshot.remainingGlobalRequestsDay<1||snapshot.remainingUserRequestsDay<1)return {allowed:false,reason:'REQUEST_QUOTA_EXHAUSTED'};
 if(snapshot.remainingTokensMinute<estimatedTokens||snapshot.remainingTokensDay<estimatedTokens)return {allowed:false,reason:'TOKEN_QUOTA_EXHAUSTED'};
 return {allowed:true,reason:'ELIGIBLE_FOR_ATOMIC_RESERVATION'};
}
export function validateReservation(reservation,provider,jobId){
 return Boolean(reservation&&reservation.committed===true&&reservation.provider===provider&&reservation.jobId===jobId&&
 typeof reservation.reservationId==='string'&&reservation.reservationId.length>0);
}
