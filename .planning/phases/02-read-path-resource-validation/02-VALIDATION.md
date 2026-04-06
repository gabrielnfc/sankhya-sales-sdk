---
phase: 2
slug: read-path-resource-validation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/integration/resources.test.ts` |
| **Full suite command** | `npx vitest run --coverage` |
| **Estimated runtime** | ~45 seconds (integration tests hit sandbox) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/integration/resources.test.ts`
- **After every plan wave:** Run `npx vitest run --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | RVAL-01 | integration | `npx vitest run tests/integration/resources.test.ts` | ✅ | ⬜ pending |
| 2-01-02 | 01 | 1 | RVAL-02 | integration | `npx vitest run tests/integration/resources.test.ts` | ✅ | ⬜ pending |
| 2-01-03 | 01 | 1 | RVAL-03 | integration | `npx vitest run tests/integration/resources.test.ts` | ✅ | ⬜ pending |
| 2-02-01 | 02 | 1 | RVAL-04,RVAL-05 | integration | `npx vitest run tests/integration/resources.test.ts` | ✅ | ⬜ pending |
| 2-02-02 | 02 | 1 | RVAL-08 | integration | `npx vitest run tests/integration/resources.test.ts` | ✅ | ⬜ pending |
| 2-03-01 | 03 | 2 | RVAL-11 | unit+integration | `npx vitest run tests/` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
