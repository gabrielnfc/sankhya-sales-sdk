---
phase: 6
slug: documentation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-07
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.0.0 |
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
| 06-01-01 | 01 | 1 | DOCS-01 | manual + grep | `grep -c "@param" src/index.ts` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | DOCS-02 | manual + grep | `grep -c "/**" src/core/*.ts src/resources/*.ts` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 1 | DOCS-03 | build | `npx typedoc --validation` | ❌ W0 | ⬜ pending |
| 06-02-02 | 02 | 1 | DOCS-04 | file check | `test -f README.md && grep "Quick Start" README.md` | ❌ W0 | ⬜ pending |
| 06-02-03 | 02 | 1 | DOCS-04 | file check | `test -f docs/error-handling.md` | ✅ | ⬜ pending |
| 06-03-01 | 03 | 2 | DOCS-05 | execution | `npx tsx examples/quick-start.ts` | ❌ W0 | ⬜ pending |
| 06-03-02 | 03 | 2 | DOCS-06 | file check | `test -f CHANGELOG.md && grep "v0.1.0" CHANGELOG.md` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `typedoc` — install as devDependency for API reference generation
- [ ] `typedoc.json` — TypeDoc configuration file
- [ ] `examples/` — directory for runnable code examples
- [ ] `CHANGELOG.md` — changelog file following Keep a Changelog format

*Existing infrastructure covers test framework requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| README quick-start completes under 5 min | DOCS-04 | Reading time is subjective | Follow README steps, time yourself |
| IDE tooltip renders correctly | DOCS-01 | Requires IDE interaction | Open VS Code, hover over exported symbol |
| TypeDoc HTML is navigable | DOCS-03 | Visual check | Open generated HTML, verify links work |
| Examples produce real API output | DOCS-05 | Requires sandbox credentials | Run each example with valid .env |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
