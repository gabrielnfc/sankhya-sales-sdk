# Phase 8: CI/CD & Release - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-07
**Phase:** 08-ci-cd-release
**Areas discussed:** Workflow architecture, Version/publish, Secrets/integration, Coverage reporting

---

## Workflow Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| 3 separate workflows | ci.yml + integration.yml + release.yml with distinct triggers | ✓ |
| Single workflow with jobs | One workflow file with conditional jobs | |
| 2 workflows (ci + release) | Combine integration into CI | |

**User's choice:** Accepted recommended approach (3 separate workflows)
**Notes:** User asked for best path, accepted all recommendations

---

## Version and Publish

| Option | Description | Selected |
|--------|-------------|----------|
| Manual bump + tag | Developer bumps package.json, creates git tag | ✓ |
| Automated via release-please | Google's release-please action manages versions | |
| npm version command | Use npm version patch/minor/major | |

**User's choice:** Manual bump + tag (simplest, no extra dependencies)

---

## Secrets and Integration

| Option | Description | Selected |
|--------|-------------|----------|
| Push to main only | Integration tests on push to main | ✓ |
| Push + schedule | Also run on cron schedule | |
| Manual dispatch only | Only run when manually triggered | |

**User's choice:** Push to main only (avoids false failures from sandbox downtime)

---

## Coverage Reporting

| Option | Description | Selected |
|--------|-------------|----------|
| Job summary + artifact | Coverage in Actions summary, report as artifact | ✓ |
| PR comment action | Use codecov or similar to post PR comments | |
| Badge only | Just a coverage badge in README | |

**User's choice:** Job summary + artifact (minimal deps, already have vitest coverage)

---

## Claude's Discretion

- GitHub Actions versions, caching strategy, optional README badge

## Deferred Ideas

None
