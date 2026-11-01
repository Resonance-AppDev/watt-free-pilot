#!/usr/bin/env python3
"""Verify archive extraction contents against WATT's SHA-256 manifest."""
from pathlib import Path
from hashlib import sha256
import sys
root=Path(__file__).resolve().parent
manifest=root/'SHA256SUMS.txt'
if not manifest.is_file():raise SystemExit('No SHA256SUMS manifest')
expected={}
for line in manifest.read_text().splitlines():
    digest,rel=line.split('  ',1)
    if rel in expected or '..' in Path(rel).parts:raise SystemExit('Bad manifest record: '+rel)
    expected[rel]=digest
excluded={'SHA256SUMS.txt','verify-kit.py'}
actual={p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file() and not any(x in p.parts for x in ['.git','.pytest_cache','__pycache__']) and p.relative_to(root).as_posix() not in excluded}
if actual!=set(expected):
    raise SystemExit('File set mismatch. Missing: '+str(set(expected)-actual)+' Unexpected: '+str(actual-set(expected)))
for rel,digest in expected.items():
    found=sha256((root/rel).read_bytes()).hexdigest()
    if found!=digest:raise SystemExit('Checksum mismatch: '+rel)
print(f'PASS — {len(expected)}/{len(expected)} SHA-256 file hashes verified; no missing/unexpected files')
