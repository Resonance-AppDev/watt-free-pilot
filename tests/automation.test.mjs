import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const ci = fs.readFileSync('.github/workflows/ci.yml','utf8');
const auto = fs.readFileSync('.github/workflows/firebase-auto-preview.yml','utf8');
const manual = fs.readFileSync('.github/workflows/firebase-preview-keyless.yml','utf8');
const deploy = fs.readFileSync('scripts/github-preview-only.sh','utf8');
const guide = fs.readFileSync('docs/AUTOMATED-PREVIEW-OPERATIONS.md','utf8');
test('CI always tests and only archives static assets after main push',()=>{
  assert.match(ci,/pull_request:/);
  assert.match(ci,/push:/);
  assert.match(ci,/actions\/upload-artifact@v4/);
  assert.match(ci,/if: github.event_name == 'push' && github.ref == 'refs\/heads\/main'/);
  assert.match(ci,/path: public\//);
  assert.match(ci,/retention-days: 1/);
  assert.doesNotMatch(ci,/firebase deploy|hosting:channel:deploy|id-token: write/);
});
test('Automatic preview executes only on private main push with both distinct opt-ins',()=>{
  assert.match(auto,/^  push:\n    branches: \[main\]/m);
  assert.doesNotMatch(auto,/^  workflow_dispatch:/m);
  assert.match(auto,/github.repository == 'Resonance-AppDev\/watt-free-pilot'/);
  assert.match(auto,/github.event.repository.visibility == 'public'/);
  assert.match(auto,/needs.readiness.outputs.protected == 'true'/);
  assert.ok(auto.includes('gh api repos/Resonance-AppDev/watt-free-pilot/branches/main'));
  assert.doesNotMatch(auto,/github.event.repository.private == true/);
  assert.match(auto,/vars.WATT_AUTO_PREVIEW_ENABLED == 'true'/);
  assert.match(auto,/vars.WATT_PREVIEW_ACCEPTANCE_APPROVED == 'true'/);
  assert.match(auto,/vars.WATT_AUTO_WIF_PROVIDER != ''/);
  assert.match(auto,/vars.WATT_AUTO_WIF_SERVICE_ACCOUNT != ''/);
  assert.match(auto,/needs: readiness/);
});
test('Google OIDC and Firebase operations cannot run until safety preflight',()=>{
  assert.match(auto,/permissions:\n      contents: read\n      id-token: write/);
  const checks=auto.indexOf('Verify complete source and Hosting payload BEFORE cloud auth');
  const auth=auto.indexOf('google-github-actions/auth@v3');
  assert.ok(checks>0 && checks<auth);
  assert.match(auto,/python3 verify-kit.py/);
  assert.match(auto,/npm run check/);
  assert.match(auto,/npm run build/);
  assert.match(auto,/bash scripts\/github-preview-only.sh/);
  assert.doesNotMatch(auto,/credentials_json|firebase deploy --only|hosting:clone/);
});
test('Shared deploy guard refuses existing channel and live channel',()=>{
  assert.match(deploy,/hosting:channel:list/);
  assert.match(deploy,/hosting:channel:deploy "\$CHANNEL"/);
  assert.match(deploy,/--no-authorized-domains/);
  assert.match(deploy,/--expires 7d/);
  assert.match(deploy,/channel .*already exists; refusing to overwrite/);
  assert.doesNotMatch(deploy,/^firebase deploy /m);
});
test('Original manual keyless workflow remains manual-only',()=>{
  assert.match(manual,/workflow_dispatch:/);
  assert.doesNotMatch(manual,/^  push:/m);
});
test('IAM federation for automatic previews must be restricted separately',()=>{
  assert.match(guide,/assertion.repository_id == '1441700773'/);
  assert.match(guide,/assertion.event_name == 'push'/);
  assert.match(guide,/firebase-auto-preview.yml@refs\/heads\/main/);
  assert.match(guide,/Google Cloud IAM/);
  assert.match(guide,/Do not enable billing/i);
  assert.match(guide,/WATT_PREVIEW_ACCEPTANCE_APPROVED/);
});


test('Manual and automatic identities are deliberately separate',()=>{
  assert.match(manual,/vars.WATT_WIF_PROVIDER/);
  assert.match(manual,/vars.WATT_WIF_SERVICE_ACCOUNT/);
  assert.doesNotMatch(manual,/WATT_AUTO_WIF_/);
  assert.match(auto,/vars.WATT_AUTO_WIF_PROVIDER/);
  assert.match(auto,/vars.WATT_AUTO_WIF_SERVICE_ACCOUNT/);
  assert.doesNotMatch(auto,/vars.WATT_WIF_PROVIDER/);
  assert.match(auto,/github.repository_id == '1441700773'/);
  assert.match(manual,/github.repository_id == '1441700773'/);
});
test('Automated provider guide restricts immutable organization and exact workflow',()=>{
  assert.match(guide,/assertion.repository_owner_id == '337308611'/);
  assert.match(guide,/assertion.workflow_ref == 'Resonance-AppDev\/watt-free-pilot\/.github\/workflows\/firebase-auto-preview.yml@refs\/heads\/main'/);
  assert.match(guide,/WATT_AUTO_WIF_PROVIDER/);
  assert.match(guide,/WATT_AUTO_WIF_SERVICE_ACCOUNT/);
});
