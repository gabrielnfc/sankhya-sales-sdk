---
phase: 08-ci-cd-release
plan: 02
subsystem: infra
tags: [github-actions, npm-publish, oidc, provenance, changelog, release]

requires:
  - phase: 08-ci-cd-release/01
    provides: ci.yml and integration.yml workflows, package.json repository field
provides:
  - release.yml workflow for automated npm publish with OIDC provenance
  - GitHub Release creation with changelog-derived notes
  - Finalized CHANGELOG.md v1.0.0 entry
affects: [npm-publish, release-process]

tech-stack:
  added: [softprops/action-gh-release@v2]
  patterns: [oidc-trusted-publishing, changelog-extraction-awk, tag-triggered-release]

key-files:
  created: [.github/workflows/release.yml]
  modified: [CHANGELOG.md]

key-decisions:
  - "Node 24 for release job to get native npm 11 with OIDC support"
  - "No NPM_TOKEN -- OIDC Trusted Publishing replaces classic tokens"
  - "awk-based changelog extraction for GitHub Release body"

patterns-established:
  - "Tag-triggered release: v* tag push triggers publish + GitHub Release"
  - "OIDC provenance: id-token:write permission, no secret tokens for npm"

requirements-completed: [CICD-04, CICD-05]

duration: 3min
completed: 2026-04-07
---

# Phase 8 Plan 2: Release Workflow Summary

**Automated npm publish with OIDC provenance on v* tags and GitHub Release with awk-extracted changelog notes**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-07T16:34:39Z
- **Completed:** 2026-04-07T16:37:39Z
- **Tasks:** 3 (2 auto + 1 checkpoint auto-approved)
- **Files modified:** 2

## Accomplishments
- Created release.yml workflow that publishes to npm with OIDC provenance attestation on v* tag push
- Finalized CHANGELOG.md from 1.0.0-preview to 1.0.0 with CI/CD items in Added section
- GitHub Release auto-created with changelog section extracted via awk

## Task Commits

Each task was committed atomically:

1. **Task 1: Create release.yml workflow** - `d1159fb` (feat)
2. **Task 2: Update CHANGELOG.md to v1.0.0** - `c17f35b` (docs)
3. **Task 3: Verify all workflows** - auto-approved checkpoint

## Files Created/Modified
- `.github/workflows/release.yml` - Release workflow: v* tag trigger, Node 24, OIDC publish, GitHub Release
- `CHANGELOG.md` - Finalized v1.0.0 entry with Added/Changed sections, updated link references

## Decisions Made
- Node 24 chosen for release job because it ships with npm 11 natively (required for OIDC provenance)
- No NPM_TOKEN or NODE_AUTH_TOKEN -- OIDC Trusted Publishing handles authentication via id-token:write
- awk extraction pattern for changelog: matches between `## [VERSION]` headings

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## User Setup Required

**External services require manual configuration:**
- Configure OIDC Trusted Publishing on npmjs.com: Package Settings -> Trusted Publishers -> Add GitHub Actions
- Set repository: gabrielnfc/sankhya-sales-sdk, workflow: release.yml
- Configure GitHub Secrets: SANKHYA_BASE_URL, SANKHYA_CLIENT_ID, SANKHYA_CLIENT_SECRET, SANKHYA_X_TOKEN
- Before first release: update package.json version to 1.0.0, commit, `git tag v1.0.0`, push tag

## Issues Encountered
None.

## Next Phase Readiness
- All three CI/CD workflows ready (ci.yml, integration.yml from plan 01; release.yml from this plan)
- CHANGELOG.md finalized for v1.0.0 extraction
- User must configure OIDC Trusted Publishing on npmjs.com before first tag push

---
*Phase: 08-ci-cd-release*
*Completed: 2026-04-07*
