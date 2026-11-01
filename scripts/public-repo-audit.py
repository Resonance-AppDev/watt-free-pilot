#!/usr/bin/env python3
"""Fail closed on credential-shaped content or unsafe filenames in Git history."""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PATTERNS = {
    'private-key': re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
    'github-token': re.compile(rb'\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b'),
    'openai-secret': re.compile(rb'\bsk-(?:proj-|live-)?[A-Za-z0-9_-]{30,}\b'),
    'supabase-secret': re.compile(rb'\bsb_secret_[A-Za-z0-9_-]{16,}\b'),
    'aws-key': re.compile(rb'\b(?:AKIA|ASIA)[0-9A-Z]{16}\b'),
    'google-service-key': re.compile(rb'"type"\s*:\s*"service_account"'),
}
BAD_PATH = re.compile(r'(?:^|/)(?:\.env(?:\.[^/]*)?|id_rsa|id_ed25519|[^/]*service.account[^/]*\.json|[^/]*credentials[^/]*\.json|[^/]*\.(?:p12|pem|key|sqlite3?|db|bak|dump|sql))$', re.I)


def git(*args):
    proc = subprocess.run(['git', *args], cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
    if proc.returncode:
        print('STOP: full Git history was not accessible for public exposure audit', file=sys.stderr)
        raise SystemExit(2)
    return proc.stdout


def main():
    revisions = git('rev-list', '--all').decode('ascii').splitlines()
    if not revisions:
        raise SystemExit('STOP: no Git history to audit')
    findings = set()
    checked = 0
    for rev in revisions:
        paths = git('ls-tree', '-r', '--name-only', rev).decode('utf-8').splitlines()
        for path in paths:
            if BAD_PATH.search(path):
                findings.add((rev[:12], path, 'unsafe filename'))
            data = git('show', f'{rev}:{path}')
            if len(data) > 2000000 or b'\x00' in data:
                continue
            checked += 1
            for label, pattern in PATTERNS.items():
                if pattern.search(data):
                    findings.add((rev[:12], path, label))
    if findings:
        for rev, path, label in sorted(findings):
            print(f'STOP: {label} in {path} at commit {rev} (credential values redacted)', file=sys.stderr)
        raise SystemExit(1)
    authors = git('log', '--all', '--format=%ae%n%ce').decode('utf-8', 'replace').splitlines()
    direct = {email.lower() for email in authors if '@' in email and not email.endswith('users.noreply.github.com')}
    if direct:
        print(f'NOTICE: {len(direct)} commit author/committer email address(es) would become public; no values logged.')
    print(f'PASS: inspected {checked} tracked-file versions across {len(revisions)} commits; no recognized credentials or unsafe filenames.')
    print('LIMIT: heuristic audit cannot rule out all private data; review issues, commit messages, licenses and backend RLS manually.')


if __name__ == '__main__':
    main()
