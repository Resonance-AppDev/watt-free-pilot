# WATT public source release and automation gates

Status: public-readiness code is staged, but repository visibility must be changed through authenticated GitHub Settings. Publishing source is not a production website release.

## Before changing visibility
- Review all files, commit history, issue comments, PRs, license/ownership, and operational metadata for public disclosure. The automated full-history scan is heuristic; it does not prove the repository has no personal or confidential information.
- Git commit author email addresses and the intended browser-safe Supabase publishable key will be visible to the public. Never mistake the publishable key for an authorization boundary: membership checks and RLS remain mandatory.
- A public GitHub repository is forkable. All historical GitHub Actions logs become accessible.
- The operator must use repository Settings > General > Danger Zone > Change repository visibility > Make public. ChatGPT's GitHub connector cannot change visibility.

## Required free public-branch protection
After switching visibility, use Settings > Branches > Add rule for branch pattern main (available on GitHub Free public repositories).
- Require a pull request before merging.
- Require successful checks: Static safety and source tests, and Full-history secret and unsafe-file audit.
- Disable force pushes and branch deletion; require resolving conversations and prevent bypass where possible.
- Confirm the GET branches/main API returns protected=true. GitHub's workflow checks only this flag, not the complete protection policy. Review settings yourself.

## Automated operations
- CI runs on main pushes and PRs and creates a one-day reviewed static frontend artifact.
- The public-readiness scanner checks repository files across complete Git history and reports only locations of suspected secrets.
- Readiness reporting runs on main pushes. Automatic Firebase temporary previews can only become eligible when the repository is public, main has branch protection, both approval variables are true, the two separate auto-WIF identifiers exist, IAM trust is restricted, and source checks pass.
- Auto-preview is OFF by default; do not enable before a first successful manual preview and two-account acceptance.
- No GitHub workflow targets Firebase live Hosting. No automatic releases of billing, public registration, AI posting, Sparks, evidence publishing, Auth/Firestore changes, Supabase writes, Cloudflare import, Floot or Wix.
- Do not put credentials, tokens or customer data in GitHub logs, commits or issues. Temporary Firebase previews are publicly accessible URLs.

## Cost and external setup
No GitHub paid upgrade is required for public branch protection. GitHub Actions automation requires no ChatGPT Work or desktop credits, subject to GitHub quotas. Google Cloud/Firebase identity must still be established by an authorized project administrator without an unapproved billing upgrade. This step is not accomplished by making GitHub public.
