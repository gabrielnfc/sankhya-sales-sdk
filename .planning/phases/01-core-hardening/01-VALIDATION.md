---
phase: 1
slug: core-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | CORE-01 | unit | `npx vitest run src/core/__tests__/gateway-serializer.test.ts` | ✅ | ⬜ pending |
| 1-01-02 | 01 | 1 | CORE-02 | unit | `npx vitest run src/core/__tests__/gateway-serializer.test.ts` | ✅ | ⬜ pending |
| 1-01-03 | 01 | 1 | CORE-03 | unit | `npx vitest run src/core/__tests__/gateway-serializer.test.ts` | ✅ | ⬜ pending |
| 1-02-01 | 02 | 1 | CORE-04 | unit | `npx vitest run src/core/__tests__/auth.test.ts` | ✅ | ⬜ pending |
| 1-02-02 | 02 | 1 | CORE-05 | unit | `npx vitest run src/core/__tests__/retry.test.ts` | ✅ | ⬜ pending |
| 1-02-03 | 02 | 1 | CORE-07 | unit | `npx vitest run src/core/__tests__/retry.test.ts` | ✅ | ⬜ pending |
| 1-03-01 | 03 | 2 | CORE-06 | config | `npx vitest run --coverage` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `@vitest/coverage-v8@^3.2.4` — install coverage provider (match vitest 3.x)
- [ ] Coverage thresholds in `vitest.config.ts` — branches/functions/lines/statements >= 90%

*Existing test infrastructure covers all other phase requirements.*

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
