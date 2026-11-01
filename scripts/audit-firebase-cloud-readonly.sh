#!/usr/bin/env bash
# WATT R06. READ-ONLY review on an already-authorized Google Cloud Shell.
# No billing activation, service/API enablement, IAM mutations, secrets or deploys.
set -euo pipefail
PROJECT='watt-36912'
if [[ $# -ne 0 ]]; then echo 'STOP: no arguments accepted' >&2; exit 2; fi
command -v gcloud >/dev/null || { echo 'STOP: gcloud not found' >&2; exit 2; }
if ! NUMBER="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)' 2>/dev/null)" || [[ ! "$NUMBER" =~ ^[0-9]+$ ]]; then
 echo 'STOP: cannot verify access to exact Google Cloud project watt-36912; no changes made' >&2; exit 3
fi
printf 'Verified project: %s; number: %s\n' "$PROJECT" "$NUMBER"
printf '\nBilling enabled (read-only; UNKNOWN if access denied): '
if BILLING="$(gcloud billing projects describe "$PROJECT" --format='value(billingEnabled)' 2>/dev/null)" && [[ "$BILLING" =~ ^(True|False|true|false)$ ]];then
 printf '%s\n' "$BILLING"
else printf 'UNKNOWN - halt before further setup\n'; fi
printf '\nExisting enabled API count (read-only; UNKNOWN if access denied): '
if APIS="$(gcloud services list --enabled --project "$PROJECT" --format='value(config.name)' 2>/dev/null)"; then
 printf '%s\n' "$(printf '%s\n' "$APIS" | sed '/^$/d' | wc -l | tr -d ' ')"
else printf 'UNKNOWN\n'; fi
printf '\nExisting global WIF pool names (read-only; UNKNOWN if access denied):\n'
if ! gcloud iam workload-identity-pools list --project "$PROJECT" --location=global --format='value(name)' 2>/dev/null; then
 echo 'UNKNOWN — no IAM or API changes were attempted'; fi
printf '\nNo Cloud changes, service-account keys or deployment commands were executed.\n'
