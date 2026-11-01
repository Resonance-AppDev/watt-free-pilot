import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const ci=fs.readFileSync('.github/workflows/ci.yml','utf8');
const workflow=fs.readFileSync('.github/workflows/firebase-preview.yml','utf8');
const deploy=fs.readFileSync('scripts/github-preview-only.sh','utf8');
const security=fs.readFileSync('SECURITY.md','utf8');
test('CI runs on push and pull requests without deployment credentials',()=>{
 assert.match(ci,/pull_request:/);assert.match(ci,/push:/);assert.match(ci,/contents: read/);
 assert.doesNotMatch(ci,/FIREBASE_PREVIEW_SERVICE_ACCOUNT/);
 assert.doesNotMatch(ci,/hosting:channel:deploy|firebase deploy|firebase hosting:clone/);
});
test('Firebase preview is manual, main-only and explicitly confirmed',()=>{
 assert.match(workflow,/workflow_dispatch:/);
 assert.doesNotMatch(workflow,/^  push:/m);
 assert.doesNotMatch(workflow,/^  pull_request:/m);
 assert.match(workflow,/refs\/heads\/main/);
 assert.match(workflow,/PREVIEW_ONLY/);
 assert.match(workflow,/secrets.WATT_FIREBASE_PREVIEW_SERVICE_ACCOUNT/);
});
test('Preview deploy never targets live Hosting or alters auth domain settings',()=>{
 assert.match(deploy,/hosting:channel:deploy "\$CHANNEL"/);
 assert.match(deploy,/--no-authorized-domains/);
 assert.match(deploy,/--expires 7d/);
 assert.match(deploy,/hosting:channel:list/);
 assert.match(deploy,/projects:list --json/);
 assert.doesNotMatch(deploy,/^firebase deploy /m);
 assert.doesNotMatch(deploy,/^firebase hosting:clone /m);
});
test('Private repo and source/credential protections are documented',()=>{
 assert.match(security,/private/i);
 assert.match(security,/service.account/i);
 assert.match(fs.readFileSync('.gitignore','utf8'),/\.env/);
 assert.match(fs.readFileSync('.gitignore','utf8'),/service-account/);
});

test('Optional keyless Firebase preview is main-only, manual, and credentials-free',()=>{
 const wif=fs.readFileSync('.github/workflows/firebase-preview-keyless.yml','utf8');
 assert.ok(wif.includes('workflow_dispatch:'));
 assert.ok(!wif.includes('\n  push:'));
 assert.ok(!wif.includes('\n  pull_request:'));
 assert.ok(wif.includes('Resonance-AppDev/watt-free-pilot'));
 assert.ok(wif.includes('refs/heads/main'));
 assert.ok(wif.includes('PREVIEW_ONLY'));
 assert.ok(wif.includes('id-token: write'));
 assert.ok(wif.includes('google-github-actions/auth@v3'));
 assert.ok(wif.includes('vars.WATT_WIF_PROVIDER'));
 assert.ok(wif.includes('vars.WATT_WIF_SERVICE_ACCOUNT'));
 assert.ok(wif.includes('scripts/github-preview-only.sh'));
 assert.ok(!wif.includes('credentials_json'));
 assert.ok(!wif.includes('firebase deploy --only'));
});
test('Keyless preview requires immutable repo claim and blocks billing upgrades',()=>{
 const guide=fs.readFileSync('docs/FIREBASE-KEYLESS-PREVIEW-GATE.md','utf8');
 assert.ok(guide.includes("repository_id == '1441700773'"));
 assert.ok(guide.includes('assertion.workflow_ref'));
 assert.ok(guide.includes('Do not enable billing'));
 assert.ok(guide.includes('do not remove that IAM capability'));
});
