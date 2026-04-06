---
phase: 4
slug: public-api-surface
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/core/` |
| **Full suite command** | `npx vitest run --coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/core/`
- **After every plan wave:** Run `npx vitest run --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 1 | APIS-01 | unit | `npx vitest run tests/core/errors.test.ts` | ✅ | ⬜ pending |
| 4-01-02 | 01 | 1 | APIS-02 | unit | `npx vitest run tests/core/errors.test.ts` | ✅ | ⬜ pending |
| 4-02-01 | 02 | 1 | APIS-03 | unit | `npx vitest run tests/core/` | ❌ W0 | ⬜ pending |
| 4-02-02 | 02 | 1 | APIS-04 | unit | `npx vitest run tests/core/` | ❌ W0 | ⬜ pending |
| 4-03-01 | 03 | 2 | APIS-05 | unit | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 4-03-02 | 03 | 2 | APIS-06 | unit | `npx vitest run tests/core/http.test.ts` | ✅ | ⬜ pending |

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
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
