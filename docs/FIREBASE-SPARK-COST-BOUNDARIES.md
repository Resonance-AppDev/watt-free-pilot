# Firebase Spark usage guardrails

Consult <https://firebase.google.com/pricing> for current quota. On 2026-11-01, the no-cost Spark plan listed **10 GB Hosting storage and 360 MB/day Hosting data transfer**. No payment method is needed for Spark, but the site can be restricted/unavailable when quotas are exceeded. This is separate from Supabase's limits and any future OpenAI API charges.

This package uses **static Firebase Hosting only**. It does not provision Firebase Auth, Firestore, Cloud Functions, Cloud Run, Storage buckets or App Hosting. Static hosting means costs can be controlled independently of the existing Supabase backend.

Do not upgrade to Blaze or connect billing without separate explicit approval and a cost forecast. Do not promise unlimited free users, bandwidth, realtime or AI. Consider page size, cache rates and Firebase/Supabase usage monitoring before scaling.
