import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const s=fs.readFileSync('01-Preview-Only.sh','utf8');
const rc=JSON.parse(fs.readFileSync('.firebaserc','utf8'));
const conf=JSON.parse(fs.readFileSync('firebase.json','utf8'));
test('historical Firebase project pinned, new review channel without live deployment',()=>{
 assert.equal(rc.projects.default,'watt-36912');
 assert.match(s,/CHANNEL='watt-r0-supabase-review'/);
 assert.match(s,/firebase hosting:channel:deploy "\$CHANNEL"/);
 assert.doesNotMatch(s,/^firebase deploy\s/m);
 assert.doesNotMatch(s,/^firebase hosting:clone\s/m);
});
test('preview guard checks existing channels, project authorization and protected Auth settings',()=>{
 assert.match(s,/projects:list --json/);
 assert.match(s,/hosting:channel:list --project/);
 assert.match(s,/--no-authorized-domains/);
 assert.match(s,/--expires 7d/);
 assert.match(s,/sha256sum -c HOSTING-PAYLOAD.sha256/);
});
test('no Firebase managed backend has been introduced',()=>{
 assert.ok(conf.hosting.public==='public');
 assert.ok(!('firestore' in conf)&&!('functions' in conf)&&!('database' in conf)&&!('auth' in conf));
 assert.ok(!('rewrites' in conf.hosting)&&!('site' in conf.hosting));
});
test('public content is ready for controlled enrollment and existing Supabase',()=>{
 const text=fs.readFileSync('public/index.html','utf8');
 assert.match(text,/INVITE-ONLY PILOT/);assert.match(text,/R0 Free Pilot/);
 assert.match(fs.readFileSync('public/assets/core.js','utf8'),/qylyuijjeruvbxipnrgh/);
});
