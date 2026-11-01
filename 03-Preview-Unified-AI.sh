#!/usr/bin/env bash
# WATT R12 unified AI UI Firebase preview-only deployment. DOES NOT touch live Hosting, Firebase Auth,
# Firestore, Supabase, Floot, Wix, earlier channels, or customer content.
set -euo pipefail
PROJECT='watt-36912'
CHANNEL='watt-r12-unified-ai-review'
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
cd "$ROOT"

if [[ $# -ne 0 ]]; then echo 'STOP: this script takes no arguments' >&2; exit 2; fi
for binary in node npm sha256sum firebase; do
  if ! command -v "$binary" >/dev/null 2>&1; then echo "STOP: missing $binary" >&2; exit 2; fi
done

sha256sum -c HOSTING-PAYLOAD.sha256
python3 verify-kit.py
node --input-type=module <<'NODE'
import fs from 'node:fs';
const pid='watt-36912';
const project=JSON.parse(fs.readFileSync('.firebaserc','utf8'));
if(project.projects?.default!==pid)throw Error('STOP: unexpected project ID');
const cfg=JSON.parse(fs.readFileSync('firebase.json','utf8'));
if(cfg.firestorage || cfg.firestore || cfg.functions || cfg.auth || cfg.database || cfg.storage || cfg.extensions || cfg.remoteconfig)throw Error('STOP: non-Hosting config present');
const h=cfg.hosting;
if(!h || Array.isArray(h) || h.public!=='public' || h.site || h.target || h.rewrites || h.functions || h.source)throw Error('STOP: nonstatic or retargeted Hosting config');
for(const f of ['index.html','workspace/index.html','legal/index.html','robots.txt','assets/core.js','assets/workspace.js','assets/unified-ai.js','assets/site.css']){
 if(!fs.statSync('public/'+f).isFile())throw Error('STOP: missing '+f);
}
const js=fs.readFileSync('public/assets/core.js','utf8');
if(!js.includes('https://qylyuijjeruvbxipnrgh.supabase.co') || !js.includes('sb_publishable_') || /service_role|sb_secret_/.test(js))throw Error('STOP: Supabase frontend is not restricted to scoped publishable key');
const html=fs.readFileSync('public/index.html','utf8');
if(!html.includes('R0 Free Pilot') || !html.includes('INVITE-ONLY PILOT'))throw Error('STOP: incorrect release branding');
console.log('WATT R12 project, Hosting-only scope, content and public-key checks passed.');
NODE

npm run check
npm run build

# Preserve existing Firebase Auth authorized-domain settings. Fail closed with
# older Firebase CLI versions instead of allowing a silent Auth change.
if ! firebase hosting:channel:deploy --help 2>&1 | grep -q -- '--no-authorized-domains'; then
  echo 'STOP: Firebase CLI does not advertise --no-authorized-domains' >&2
  exit 3
fi

# Confirm that the authenticated Google account can access THE actual project.
PROJECTS="$(firebase projects:list --json)"
if ! printf '%s' "$PROJECTS" | node -e '
let s=""; process.stdin.on("data",b=>s+=b).on("end",()=>{
  try {let x=JSON.parse(s);if(x.status!=="success" || !Array.isArray(x.result) || !x.result.some(v=>v.projectId==="watt-36912"))process.exit(1);}
  catch {process.exit(1);}
});'; then
  echo 'STOP: authenticated Firebase CLI cannot verify access to watt-36912' >&2
  exit 4
fi

# Fail closed if the exact preview already exists: never overwrite or roll
# forward an older review release by accident.
CHANNELS="$(firebase hosting:channel:list --project "$PROJECT" --json)"
if ! printf '%s' "$CHANNELS" | node -e '
let s="";process.stdin.on("data",b=>s+=b).on("end",()=>{
 try {const j=JSON.parse(s);if(j.status!=="success")process.exit(1);}
 catch{process.exit(1);}
});'; then
  echo 'STOP: cannot read current Hosting preview-channel inventory' >&2;exit 5
fi
if printf '%s' "$CHANNELS" | grep -Fq "$CHANNEL"; then
  echo "STOP: preview channel $CHANNEL exists; this script refuses to overwrite it" >&2
  exit 6
fi

printf '\nAll preflight checks passed. Publishing ONLY NEW Hosting preview channel: %s\n' "$CHANNEL"
firebase hosting:channel:deploy "$CHANNEL" --project "$PROJECT" --expires 7d --no-authorized-domains --non-interactive
printf '\nWATT Firebase Hosting REVIEW channel published only if command above succeeded.\n'
printf 'Live Hosting, Auth, Firestore, Supabase, Floot and Wix were not deployed by this script.\n'
