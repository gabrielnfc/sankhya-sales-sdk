---
phase: 08
slug: ci-cd-release
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-07
---

# Phase 08 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --exclude 'tests/integration/**'` |
| **Full suite command** | `npx vitest run --exclude 'tests/integration/**' && npx tsc --noEmit && npx biome check src/ tests/` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --exclude 'tests/integration/**'`
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | CICD-01 | yaml-lint | `cat .github/workflows/ci.yml \| node -e "require('yaml').parse(...)"` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | CICD-03 | yaml-lint | `cat .github/workflows/ci.yml` | ❌ W0 | ⬜ pending |
| 08-02-01 | 02 | 1 | CICD-02 | yaml-lint | `cat .github/workflows/integration.yml` | ❌ W0 | ⬜ pending |
| 08-03-01 | 03 | 2 | CICD-04 | yaml-lint | `cat .github/workflows/release.yml` | ❌ W0 | ⬜ pending |
| 08-03-02 | 03 | 2 | CICD-05 | manual | GitHub Release exists after tag push | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements (no new test framework needed)
- Workflow YAML validation is structural (file exists, correct syntax)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| GitHub Actions triggers | CICD-01 | Requires actual push/PR to verify | Push a branch, open PR, verify checks appear |
| npm provenance badge | CICD-04 | Requires actual npm publish | Create v1.0.0 tag, verify provenance on npmjs.com |
| GitHub Release exists | CICD-05 | Requires tag push to trigger | Verify release page after tag push |
| Integration tests with secrets | CICD-02 | Requires GitHub Secrets configured | Push to main, verify integration job runs |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
