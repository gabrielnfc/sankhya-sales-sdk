---
phase: 3
slug: write-path-e2e-validation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/integration/` |
| **Full suite command** | `npx vitest run --coverage` |
| **Estimated runtime** | ~60 seconds (write operations hit sandbox) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/integration/`
- **After every plan wave:** Run `npx vitest run --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 1 | RVAL-06 | integration | `npx vitest run tests/integration/` | ✅ | ⬜ pending |
| 3-01-02 | 01 | 1 | RVAL-07 | integration | `npx vitest run tests/integration/` | ✅ | ⬜ pending |
| 3-02-01 | 02 | 1 | RVAL-09 | integration | `npx vitest run tests/integration/` | ✅ | ⬜ pending |
| 3-02-02 | 02 | 1 | RVAL-10 | unit+integration | `npx vitest run tests/` | ✅ | ⬜ pending |
| 3-03-01 | 03 | 2 | RVAL-12 | integration | `npx vitest run tests/integration/` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] E2E test file for B2B flow — `tests/integration/e2e-b2b.test.ts`

*Existing infrastructure covers all other phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| No duplicate entries after simulated timeout | RVAL-10 | Requires inspecting sandbox state | Run write test, check sandbox for duplicate records |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
