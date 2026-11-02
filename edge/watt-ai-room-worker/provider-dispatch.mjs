// R15 provider dispatch preflight: never call an upstream provider without a committed reservation.
import {selectFreeCandidates} from './free-poll.mjs';
import {quotaDecision,validateReservation} from './free-poll-quota.mjs';
import {attachConsentToCandidates} from './consent-readiness.mjs';
export function prepareProviderDispatch(providers,consentStatus,quotaSnapshots,reservations,jobId,estimatedTokens){
 if(typeof jobId!=='string'||!jobId||!Number.isSafeInteger(estimatedTokens)||estimatedTokens<1)
  throw new TypeError('INVALID_DISPATCH');
 const consented=attachConsentToCandidates(providers,consentStatus);
 const eligible=consented.map(p=>{
  const quota=quotaDecision(quotaSnapshots?.[p.id],estimatedTokens);
  const reservation=reservations?.[p.id];
  return {...p,remainingRequests:quota.allowed?quotaSnapshots[p.id].remainingRequestsDay:0,
   remainingTokens:quota.allowed?quotaSnapshots[p.id].remainingTokensDay:0,
   releaseApproved:p.releaseApproved===true&&quota.allowed&&validateReservation(reservation,p.id,jobId)};
 });
 return selectFreeCandidates(eligible);
}
