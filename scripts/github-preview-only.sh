#!/usr/bin/env bash
# GitHub Actions only. Deploy a new, temporary PREVIEW channel on existing WATT Firebase project.
# NO live Hosting deployment, Firestore, Firebase Auth, Supabase or website cutover.
set -euo pipefail
cd "$(dirname "$0")/.."
PROJECT='watt-36912'
if [[ -z "${GITHUB_ACTIONS:-}" || "${GITHUB_ACTIONS}" != 'true' ]]; then echo 'STOP: GitHub Actions only' >&2; exit 2; fi
if [[ "${GITHUB_REF:-}" != 'refs/heads/main' ]]; then echo 'STOP: not the main branch' >&2; exit 2; fi
if [[ ! "${GITHUB_SHA:-}" =~ ^[[:xdigit:]]{40}$ ]]; then echo 'STOP: missing commit SHA' >&2; exit 2; fi
CHANNEL="watt-gh-${GITHUB_SHA:0:12}"
if [[ $# -ne 0 ]]; then echo 'STOP: no arguments accepted' >&2; exit 2; fi
for binary in node npm sha256sum firebase; do command -v "$binary" >/dev/null || { echo "STOP: missing ${binary}" >&2; exit 2; }; done
sha256sum -c HOSTING-PAYLOAD.sha256
node --input-type=module <<'JS'
import fs from 'node:fs';
const cfg=JSON.parse(fs.readFileSync('firebase.json','utf8'));
const rc=JSON.parse(fs.readFileSync('.firebaserc','utf8'));
if(rc.projects?.default!=='watt-36912') throw Error('STOP: unexpected Firebase project');
if(Object.keys(cfg).join(',')!=='hosting') throw Error('STOP: Firebase backend or extra services in deploy config');
const h=cfg.hosting;
if(!h || Array.isArray(h) || h.public!=='public' || h.rewrites || h.site || h.target || h.functions || h.source) throw Error('STOP: Hosting target unsafe');
const client=fs.readFileSync('public/assets/core.js','utf8');
if(!client.includes('https://qylyuijjeruvbxipnrgh.supabase.co') || !client.includes('sb_publishable_') || /service_role|sb_secret_/.test(client))throw Error('STOP: unsafe backend binding');
JS
npm run check
npm run build
if ! firebase hosting:channel:deploy --help 2>&1 | grep -q -- '--no-authorized-domains'; then
 echo 'STOP: Firebase CLI cannot prevent Auth authorized domain changes' >&2; exit 3
fi
PROJECTS="$(firebase projects:list --json)"
if ! printf '%s' "$PROJECTS" | node -e '
let s="";process.stdin.on("data",b=>s+=b).on("end",()=>{try{let j=JSON.parse(s);if(j.status!=="success"||!Array.isArray(j.result)||!j.result.some(x=>x.projectId==="watt-36912"))process.exit(1);}catch{process.exit(1);}})'; then
 echo 'STOP: service account cannot independently confirm access to project watt-36912' >&2; exit 4
fi
CHANNELS="$(firebase hosting:channel:list --project "$PROJECT" --json)"
if ! printf '%s' "$CHANNELS" | node -e '
let s="";process.stdin.on("data",b=>s+=b).on("end",()=>{try{let j=JSON.parse(s);if(j.status!=="success"||!j.result)process.exit(1);}catch{process.exit(1);}})'; then
 echo 'STOP: preview channel listing failed' >&2; exit 5
fi
if printf '%s' "$CHANNELS" | grep -Fq "$CHANNEL"; then
 echo "STOP: channel $CHANNEL already exists; refusing to overwrite" >&2; exit 6
fi
# Sole remote mutation: create fresh seven-day preview for this exact commit.
firebase hosting:channel:deploy "$CHANNEL" --project "$PROJECT" --expires 7d --no-authorized-domains --non-interactive
printf 'Preview deployed to channel %s; inspect the returned URL. No live release or Auth/Firestore change was requested.\n' "$CHANNEL"
