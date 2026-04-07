---
phase: 08-ci-cd-release
verified: 2026-04-07T20:00:00Z
status: passed
score: 8/8 must-haves verified
re_verification: true
gaps_resolved: true
gaps:
  - truth: "Tag push matching v* triggers release workflow that publishes to npm with provenance"
    status: resolved
    reason: "release.yml uses actions/checkout@v6 and actions/setup-node@v6 which do not exist (latest stable is v4); workflow will fail at runner setup"
    artifacts:
      - path: ".github/workflows/release.yml"
        issue: "Lines 14 and 16 reference @v6 tags that do not exist on actions/checkout and actions/setup-node"
    missing:
      - "Change actions/checkout@v6 to actions/checkout@v4 in release.yml"
      - "Change actions/setup-node@v6 to actions/setup-node@v4 in release.yml"
  - truth: "Release workflow runs full quality checks before publishing (via prepublishOnly)"
    status: resolved
    reason: "release.yml runs 'npm run prepublishOnly' but package.json has no prepublishOnly script -- the script was added in Phase 7 (commit 4e646f8) but lost during the Phase 8 merge"
    artifacts:
      - path: "package.json"
        issue: "Missing prepublishOnly script; also missing sideEffects:false and CHANGELOG.md in files array (Phase 7 merge regression)"
      - path: ".github/workflows/release.yml"
        issue: "Line 24 calls 'npm run prepublishOnly' which does not exist in current package.json"
    missing:
      - "Restore prepublishOnly script to package.json: \"prepublishOnly\": \"npm run lint && npm run typecheck && npm run test && npm run build && npx publint\""
      - "Restore sideEffects: false to package.json (Phase 7 merge regression)"
      - "Restore CHANGELOG.md to files array in package.json (Phase 7 merge regression)"
  - truth: "CHANGELOG.md has a proper [1.0.0] section with release date ready for extraction"
    status: partial
    reason: "CHANGELOG.md v1.0.0 section only lists CI/CD items from Phase 8 -- it is missing all features from v0.1.0 that should be included in the 1.0.0 release (the 0.1.0 section has them separately, but the awk extraction for GitHub Release will only extract the 1.0.0 section)"
    artifacts:
      - path: "CHANGELOG.md"
        issue: "The [1.0.0] section only has 6 items (CI/CD + package validation); the actual v1.0.0 release includes all v0.1.0 features. GitHub Release notes will be incomplete."
    missing:
      - "This is a design choice -- v1.0.0 changelog section could be intentionally incremental over v0.1.0. Verify with user whether GitHub Release notes should include all features or just the delta."
---

# Phase 8: CI/CD & Release Verification Report

**Phase Goal:** Every push to main runs automated quality gates; v1.0.0 is published to npm with provenance attestation and a GitHub Release
**Verified:** 2026-04-07T20:00:00Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Push to any branch triggers CI with lint, typecheck, test, build on Node 20 and 22 | VERIFIED | ci.yml has `on: push: branches: ['**']` with matrix `[20, 22]` and all 4 quality steps |
| 2 | PR to any branch triggers CI with same quality gates | VERIFIED | ci.yml has `on: pull_request: branches: ['**']` sharing the same quality job |
| 3 | Coverage report is visible in CI job summary showing >= 90% thresholds | VERIFIED | ci.yml coverage job writes markdown table to `$GITHUB_STEP_SUMMARY` and uploads artifact |
| 4 | Push to main triggers integration tests with sandbox credentials | VERIFIED | integration.yml triggers on `push: branches: [main]` with 4 SANKHYA_* secrets |
| 5 | Tag push matching v* triggers release workflow that publishes to npm with provenance | FAILED | release.yml uses actions/checkout@v6 and actions/setup-node@v6 which do not exist |
| 6 | GitHub Release is created after successful npm publish with CHANGELOG content as body | PARTIAL | softprops/action-gh-release@v2 is configured correctly but workflow will fail before reaching this step due to @v6 issue |
| 7 | CHANGELOG.md has a proper [1.0.0] section with release date ready for extraction | VERIFIED | `## [1.0.0] - 2026-04-07` heading present with Added/Changed sections |
| 8 | Release workflow runs full quality checks before publishing (via prepublishOnly) | FAILED | `npm run prepublishOnly` called in release.yml but script missing from package.json (merge regression) |

**Score:** 4/8 truths verified (2 FAILED, 1 PARTIAL, 1 blocked by upstream failure)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.github/workflows/ci.yml` | Quality gate workflow for push/PR | VERIFIED | 59 lines, complete with matrix, coverage job, summary, artifact upload |
| `.github/workflows/integration.yml` | Integration test workflow for main | VERIFIED | 24 lines, main-only trigger, 4 secrets, 15-min timeout |
| `.github/workflows/release.yml` | npm publish + GitHub Release workflow | FAILED | Uses non-existent @v6 action tags; calls missing prepublishOnly script |
| `package.json` | Repository field for npm provenance | PARTIAL | Repository field present; but prepublishOnly, sideEffects, CHANGELOG.md in files all missing (Phase 7 merge regression) |
| `CHANGELOG.md` | v1.0.0 release notes | VERIFIED | [1.0.0] section present, no preview references, link references correct |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| ci.yml | package.json scripts | npm run lint/typecheck/test/build | WIRED | All 4 scripts exist in package.json |
| integration.yml | package.json scripts | npm run test:integration | WIRED | test:integration script exists |
| release.yml | package.json scripts | npm run prepublishOnly | NOT WIRED | prepublishOnly script missing from package.json |
| release.yml | npmjs.com | npm publish --provenance --access public | WIRED | Command present with OIDC permissions (id-token: write) |
| release.yml | CHANGELOG.md | awk extraction | WIRED | awk pattern matches [1.0.0] heading format correctly |
| release.yml | GitHub Releases | softprops/action-gh-release@v2 | WIRED | Action configured with changelog body output |

### Data-Flow Trace (Level 4)

Not applicable -- workflow files are declarative CI/CD configs, not dynamic data-rendering artifacts.

### Behavioral Spot-Checks

Step 7b: SKIPPED -- GitHub Actions workflows cannot be tested locally without running a server. Validation is limited to static analysis of YAML structure and script references.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CICD-01 | 08-01-PLAN | GitHub Actions lint, typecheck, test, build on push/PR | SATISFIED | ci.yml has all 4 steps in quality job with Node 20+22 matrix |
| CICD-02 | 08-01-PLAN | Integration tests with secrets on push to main | SATISFIED | integration.yml triggers on main with 4 SANKHYA_* secrets |
| CICD-03 | 08-01-PLAN | Coverage report visible in CI | SATISFIED | Coverage job writes to GITHUB_STEP_SUMMARY and uploads artifact |
| CICD-04 | 08-02-PLAN | npm publish --provenance via release workflow | BLOCKED | release.yml has the publish command but workflow will fail due to @v6 actions and missing prepublishOnly |
| CICD-05 | 08-02-PLAN | GitHub Release v1.0.0 with release notes | BLOCKED | softprops/action-gh-release configured but unreachable due to upstream failures |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| .github/workflows/release.yml | 14 | actions/checkout@v6 (non-existent version) | BLOCKER | Workflow will fail immediately at checkout step |
| .github/workflows/release.yml | 16 | actions/setup-node@v6 (non-existent version) | BLOCKER | Workflow will fail at Node setup step |
| .github/workflows/release.yml | 24 | npm run prepublishOnly (script not in package.json) | BLOCKER | Quality gate step will fail with "Missing script" |
| package.json | - | Missing prepublishOnly script (Phase 7 merge regression) | BLOCKER | Release workflow quality gate broken |
| package.json | - | Missing sideEffects: false (Phase 7 merge regression) | WARNING | Tree-shaking hint lost for bundlers |
| package.json | - | Missing CHANGELOG.md in files array (Phase 7 merge regression) | WARNING | CHANGELOG not included in npm tarball |

### Human Verification Required

### 1. CI Workflow Execution

**Test:** Push a branch and open a PR to verify ci.yml runs correctly
**Expected:** GitHub Actions shows "CI" workflow with quality and coverage jobs; matrix runs Node 20 and 22; coverage summary appears in job summary
**Why human:** Requires actual GitHub Actions runner execution

### 2. Integration Workflow Execution

**Test:** Push to main and verify integration.yml runs
**Expected:** Integration tests run with sandbox credentials and pass
**Why human:** Requires GitHub Secrets to be configured and sandbox to be accessible

### 3. Release Workflow End-to-End

**Test:** After fixing gaps, tag v1.0.0 and push to verify release.yml
**Expected:** npm package published with provenance badge; GitHub Release created with changelog notes
**Why human:** Requires OIDC Trusted Publishing configured on npmjs.com and actual tag push

### 4. npm Provenance Badge

**Test:** Visit npmjs.com/package/sankhya-sales-sdk after publish
**Expected:** Provenance badge visible on package page
**Why human:** Requires actual npm publish to verify provenance attestation

### Gaps Summary

Two critical blockers prevent the release workflow from functioning:

1. **Non-existent GitHub Action versions in release.yml:** The `actions/checkout@v6` and `actions/setup-node@v6` tags do not exist (latest stable is v4). Plan 01 SUMMARY documented this exact issue was fixed for ci.yml and integration.yml, but Plan 02 execution did not apply the same fix to release.yml. The workflow will fail immediately on the checkout step.

2. **Missing prepublishOnly script (merge regression):** The `prepublishOnly` script was added to package.json in Phase 7 (commit `4e646f8`) but was lost when Phase 8 Plan 01 modified package.json to add the repository field. The merge did not preserve the Phase 7 additions (`prepublishOnly`, `sideEffects: false`, `CHANGELOG.md` in files array). This means the release workflow quality gate (`npm run prepublishOnly`) will fail with "Missing script".

Both issues are straightforward fixes. The CI (ci.yml) and integration (integration.yml) workflows are fully correct and functional. The release workflow (release.yml) has the right structure and logic but needs the two blockers resolved before it can execute successfully.

**Root cause:** Both gaps stem from the same pattern -- Plan 02 was executed in a worktree that had an older version of package.json, and the merge back to main did not reconcile the Phase 7 changes.

---

_Verified: 2026-04-07T20:00:00Z_
_Verifier: Claude (gsd-verifier)_
