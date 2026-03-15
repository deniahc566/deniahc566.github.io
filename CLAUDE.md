# CLAUDE.md

## Project Overview

Insurance premium calculator for SHB Finance / VBI (Vietnam Bank for Industry and Trade Insurance). The UI is a single-file HTML app (`index.html`) with all logic embedded inline. A separate Jest test suite extracts and tests the pure functions independently.

## Architecture

- **`index.html`** — single-file app; contains all HTML, CSS, and JS (including `PREMIUM_RATES` dataset of ~578 records). No build step.
- **`tests/premium-functions.js`** — pure functions extracted from `index.html` for Node/Jest testing (no DOM dependency).
- **`tests/fixtures/rates.js`** — minimal subset of real rate data used by tests (exports `SAMPLE_RATES`).
- **`tests/premium.test.js`** — main unit test suite.
- **`tests/accuracy.test.js`** — accuracy/regression tests driven by CSV fixtures.
- **`tests/manual-test-cases.csv`**, **`tests/manual-accuracy-tests.csv`** — CSV test data.

## Key Business Logic

- **Age calculation** (`calculateAge`): Insurance rounding rule — if today is NOT the person's exact birthday, add 1 to natural age.
- **Rate lookup key**: `"age|benefit|type|gender"` where type is `"Độc lập"` (independent, 1 person) or `"Mua kèm"` (bundled, 2+ people).
- **Benefits**: Main (`"Tử vong, nội trú, ngoại trú"`), Critical illness (`"Bệnh hiểm nghèo"`), Maternity (flat 2,000,000 VND).
- **Maternity conditions**: female, age 19–50, package ≥ 3.
- **`forceIndependent`**: A person in a group can be forced to independent pricing (e.g. relationship/dependency rules).
- **Premiums** are rounded to nearest 1,000 VND.
- Packages are numbered 1–5 (`package1`…`package5` fields on rate records).
- Coverage ages: 1–65. Age 0 or 66+ = no coverage.

## Commands

```bash
npm test                  # run all tests
npm run test:watch        # watch mode
npm run test:coverage     # with coverage report
```

Reference date used in test suite: **2026-02-20** (hardcoded as `TODAY` in `premium.test.js` for reproducibility).

## Conventions

- All monetary values are integers in VND.
- Vietnamese strings are used as-is in rate map keys (e.g. `"Nam"`, `"Nữ"`, `"Độc lập"`, `"Mua kèm"`, `"Không áp dụng"`).
- `"Không áp dụng"` in a rate cell means "not applicable" → treated as 0.
- When editing `premium-functions.js`, keep functions in sync with the equivalent logic in `index.html`.
