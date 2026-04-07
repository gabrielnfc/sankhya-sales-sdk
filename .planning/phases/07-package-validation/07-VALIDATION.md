---
phase: 7
slug: package-validation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-07
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.0.0 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run --coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck && npm run lint`
- **After every plan wave:** Run `npm run prepublishOnly`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | PKGP-01 | smoke | `node -e "const p=require('./package.json'); process.exit(p.sideEffects===false?0:1)"` | No — Wave 0 | ⬜ pending |
| 07-01-02 | 01 | 1 | PKGP-04 | smoke | `npm pack --dry-run 2>&1` | No — manual | ⬜ pending |
| 07-01-03 | 01 | 1 | PKGP-06 | typecheck | `npx tsc --noEmit` | Existing | ⬜ pending |
| 07-02-01 | 02 | 1 | PKGP-05 | lint | `npx biome check src/` | Existing | ⬜ pending |
| 07-02-02 | 02 | 1 | PKGP-06 | typecheck | `npx tsc --noEmit` | Existing | ⬜ pending |
| 07-03-01 | 03 | 2 | PKGP-02 | smoke | `npx publint && npx @arethetypeswrong/cli --pack .` | No — manual | ⬜ pending |
| 07-03-02 | 03 | 2 | PKGP-03 | smoke | `npm run prepublishOnly` | No — script is the test | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- None — this phase modifies config files and scripts, not application code. Validation is done by running the tools themselves, not by writing test files.

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tarball contents visual check | PKGP-04 | `npm pack --dry-run` output must be visually verified for unexpected files | Run `npm pack --dry-run`, verify only `dist/`, `README.md`, `CHANGELOG.md`, `LICENSE`, `package.json` appear |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
