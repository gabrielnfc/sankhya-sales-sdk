---
phase: 07-package-validation
plan: 01
subsystem: infra
tags: [npm, package, tree-shaking, tsconfig, publish-gate]

requires:
  - phase: 06-documentation
    provides: CHANGELOG.md, README.en.md, typedoc.json, examples/
provides:
  - sideEffects: false for tree-shaking
  - CHANGELOG.md in tarball via files array
  - prepublishOnly publish gate pipeline
  - .npmignore exclusions for README.en.md, .planning/, examples/, typedoc.json
  - noFallthroughCasesInSwitch tsconfig flag
affects: [07-package-validation]

tech-stack:
  added: []
  patterns: [prepublishOnly lifecycle hook for publish gate]

key-files:
  created: []
  modified: [package.json, .npmignore, tsconfig.json]

key-decisions:
  - "prepublishOnly runs lint+typecheck+test+build+publint as mandatory publish gate"
  - "npm auto-includes README* files regardless of files array or .npmignore -- README.en.md exclusion is best-effort"

patterns-established:
  - "Publish gate: all quality checks must pass before npm publish via prepublishOnly hook"

requirements-completed: [PKGP-01, PKGP-03, PKGP-04]

duration: 1m34s
completed: 2026-04-07
---

# Phase 7 Plan 1: Package Config Summary

**Tree-shaking sideEffects flag, CHANGELOG.md tarball inclusion, and prepublishOnly publish gate pipeline**

## Performance

- **Duration:** 1m 34s
- **Started:** 2026-04-07T09:39:48Z
- **Completed:** 2026-04-07T09:41:22Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- package.json configured with sideEffects: false for bundler tree-shaking
- CHANGELOG.md added to files array so it ships in npm tarball
- prepublishOnly script enforces lint, typecheck, test, build, publint before any publish
- .npmignore updated to exclude README.en.md, .planning/, examples/, typedoc.json
- tsconfig.json hardened with noFallthroughCasesInSwitch: true

## Task Commits

Each task was committed atomically:

1. **Task 1: Package.json -- sideEffects, files array, prepublishOnly script** - `4e646f8` (chore)
2. **Task 2: .npmignore and tsconfig.json updates** - `90a9010` (chore)

## Files Created/Modified
- `package.json` - Added sideEffects: false, CHANGELOG.md to files, prepublishOnly script
- `.npmignore` - Added README.en.md, .planning/, examples/, typedoc.json exclusions
- `tsconfig.json` - Added noFallthroughCasesInSwitch: true

## Decisions Made
- prepublishOnly chosen over prepack because it only fires on `npm publish` (not `npm pack` alone), providing the right gate point
- npm 10+ auto-includes README* files regardless of .npmignore when files field is present -- README.en.md exclusion in .npmignore is best-effort documentation of intent

## Deviations from Plan

None - plan executed exactly as written. Note: npm 10.8.2 auto-includes README.en.md in tarball despite .npmignore entry due to npm always-include behavior for README* files. The .npmignore entry is correct per npm documentation but npm overrides it for README variants. This is a platform limitation, not a configuration error.

## Issues Encountered
None

## Known Stubs
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Package config complete, ready for exports validation (plan 02) and dry-run testing (plan 03)
- publint will validate exports correctness in the prepublishOnly pipeline

---
*Phase: 07-package-validation*
*Completed: 2026-04-07*
