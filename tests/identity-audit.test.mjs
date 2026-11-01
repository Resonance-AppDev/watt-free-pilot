import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const text=fs.readFileSync('scripts/audit-firebase-cloud-readonly.sh','utf8');
test('Google project audit is read-only and pinned to the known project',()=>{
 assert.match(text,/PROJECT='watt-36912'/);
 assert.match(text,/gcloud projects describe/);
 assert.match(text,/gcloud billing projects describe/);
 assert.match(text,/gcloud services list --enabled/);
 assert.match(text,/gcloud iam workload-identity-pools list/);
 assert.doesNotMatch(text,/gcloud (?:projects create|services enable|billing projects link|iam service-accounts create|iam workload-identity-pools create|config set|auth activate-service-account)/);
 assert.doesNotMatch(text,/firebase (?:deploy|hosting:channel:deploy|hosting:clone)/);
});
