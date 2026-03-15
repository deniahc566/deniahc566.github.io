/**
 * accuracy.test.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Regression tests against the ACTUAL production PREMIUM_RATES embedded in
 * index.html.  Each test pins an exact numeric value from the rate table so
 * that any unintended change to the data or calculation logic is immediately
 * caught.
 *
 * Key production behaviours verified here (distinct from fixture tests):
 *   1. Main-benefit raw values per age band / type / package
 *   2. Critical-illness raw values per age band
 *   3. Per-person total with roundToThousand applied
 *   4. Ages 1-6 Độc lập: 30% surcharge (Độc lập rate = Mua kèm × 1.3)
 *   5. Ages 7+: Độc lập = Mua kèm (no surcharge)
 *   6. Gender-neutral pricing for ages 7+ (Nam = Nữ)
 *   7. CI rate jump at the age-51 band boundary (370 000 → 800 000)
 *   8. Maternity (2 000 000) included correctly in total
 *   9. Multi-component totals with combined rounding
 *
 * Reference date: 23 Feb 2026
 * DOBs below are exact birthdays on that date, so calculateAge returns the
 * stated age with no round-up applied.
 *
 * Production benefit-name constants (must match keys in PREMIUM_RATES):
 *   BENEFIT_MAIN     = 'Tử vong, nội trú, ngoại trú'
 *   BENEFIT_CRITICAL = 'Bệnh hiểm nghèo'
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const {
    buildRateMap,
    calculatePersonPremium,
    roundToThousand,
} = require('./premium-functions');

// ─── Load real PREMIUM_RATES from index.html ──────────────────────────────────
const html       = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');
const ratesMatch = html.match(/const PREMIUM_RATES = (\[.*?\]);/s);
if (!ratesMatch) throw new Error('PREMIUM_RATES not found in index.html');
const REAL_RATES = JSON.parse(ratesMatch[1]);
const realMap    = buildRateMap(REAL_RATES);

// ─── Fixed reference date: 23 Feb 2026 ───────────────────────────────────────
const TODAY = new Date(2026, 1, 23);

// ─── Exact-birthday DOBs (calculateAge returns stated age, no round-up) ───────
const DOB = {
    age1:  '23/02/2025',
    age4:  '23/02/2022',
    age10: '23/02/2016',
    age18: '23/02/2008',
    age19: '23/02/2007',
    age25: '23/02/2001',
    age35: '23/02/1991',
    age50: '23/02/1976',
    age51: '23/02/1975',
    age61: '23/02/1965',
    age65: '23/02/1961',
    age66: '23/02/1960',
};

// ─── Helper ───────────────────────────────────────────────────────────────────
function calc(personData, totalPeople = 1) {
    return calculatePersonPremium(personData, totalPeople, realMap, TODAY);
}

function person(dob, gender = 'male', pkg = '1', ci = false, mat = false) {
    return { dob, gender, package: pkg, criticalIllness: ci, maternity: mat };
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. Main-benefit raw values from rate table
// ═════════════════════════════════════════════════════════════════════════════

describe('Main benefit – raw premiums per band (no rounding on component)', () => {

    // ── Band 1-3 ──────────────────────────────────────────────────────────────
    test('age 1 | Mua kèm (2 persons) | Nam | pkg1 → 963,000', () => {
        expect(calc(person(DOB.age1), 2).mainPremium).toBe(963_000);
    });

    test('age 1 | Mua kèm | Nam | pkg5 → 7,354,000', () => {
        expect(calc(person(DOB.age1), 2).mainPremium).toBe(963_000); // pkg1 baseline
        expect(calc(person(DOB.age1, 'male', '5'), 2).mainPremium).toBe(7_354_000);
    });

    test('age 1 | Độc lập (1 person) | Nam | pkg1 → 1,251,900  (30% surcharge)', () => {
        expect(calc(person(DOB.age1), 1).mainPremium).toBe(1_251_900);
    });

    test('age 1 Độc lập mainPremium = Mua kèm × 1.3', () => {
        const ind = calc(person(DOB.age1), 1).mainPremium;
        const bun = calc(person(DOB.age1), 2).mainPremium;
        expect(ind).toBe(Math.round(bun * 1.3 / 100) * 100); // raw 1,251,900
    });

    // ── Band 4-6 ──────────────────────────────────────────────────────────────
    test('age 4 | Mua kèm | Nam | pkg1 → 555,000', () => {
        expect(calc(person(DOB.age4), 2).mainPremium).toBe(555_000);
    });

    test('age 4 | Độc lập | Nam | pkg1 → 721,000  (30% surcharge, pre-rounded in table)', () => {
        expect(calc(person(DOB.age4), 1).mainPremium).toBe(721_000);
    });

    test('age 4 | Độc lập | Nam | pkg3 → 2,583,100', () => {
        expect(calc(person(DOB.age4, 'male', '3'), 1).mainPremium).toBe(2_583_100);
    });

    // ── Band 10-18 ────────────────────────────────────────────────────────────
    test('age 10 | Độc lập | Nam | pkg1 → 482,000', () => {
        expect(calc(person(DOB.age10), 1).mainPremium).toBe(482_000);
    });

    test('age 18 | Độc lập | Nam | pkg1 → 482,000  (same band as 10)', () => {
        expect(calc(person(DOB.age18), 1).mainPremium).toBe(482_000);
    });

    // ── Band 19-30 ────────────────────────────────────────────────────────────
    test('age 19 | Độc lập | Nam | pkg1 → 459,000', () => {
        expect(calc(person(DOB.age19), 1).mainPremium).toBe(459_000);
    });

    test('age 25 | Độc lập | Nam | pkg2 → 688,000', () => {
        expect(calc(person(DOB.age25, 'male', '2'), 1).mainPremium).toBe(688_000);
    });

    test('age 25 | Độc lập | Nam | pkg5 → 3,502,000', () => {
        expect(calc(person(DOB.age25, 'male', '5'), 1).mainPremium).toBe(3_502_000);
    });

    // ── Band 31-40 ────────────────────────────────────────────────────────────
    test('age 35 | Độc lập | Nam | pkg1 → 505,000', () => {
        expect(calc(person(DOB.age35), 1).mainPremium).toBe(505_000);
    });

    test('age 35 | Độc lập | Nam | pkg3 → 1,807,000', () => {
        expect(calc(person(DOB.age35, 'male', '3'), 1).mainPremium).toBe(1_807_000);
    });

    // ── Band 41-50 ────────────────────────────────────────────────────────────
    test('age 50 | Độc lập | Nam | pkg1 → 528,000', () => {
        expect(calc(person(DOB.age50), 1).mainPremium).toBe(528_000);
    });

    test('age 50 | Độc lập | Nam | pkg5 → 4,027,000', () => {
        expect(calc(person(DOB.age50, 'male', '5'), 1).mainPremium).toBe(4_027_000);
    });

    // ── Band 51-60 ────────────────────────────────────────────────────────────
    test('age 51 | Độc lập | Nam | pkg1 → 550,000', () => {
        expect(calc(person(DOB.age51), 1).mainPremium).toBe(550_000);
    });

    test('age 51 | Độc lập | Nam | pkg5 → 4,202,000', () => {
        expect(calc(person(DOB.age51, 'male', '5'), 1).mainPremium).toBe(4_202_000);
    });

    // ── Band 61-65 ────────────────────────────────────────────────────────────
    test('age 61 | Độc lập | Nam | pkg1 → 734,000', () => {
        expect(calc(person(DOB.age61), 1).mainPremium).toBe(734_000);
    });

    test('age 61 | Độc lập | Nam | pkg2 → 1,101,000', () => {
        expect(calc(person(DOB.age61, 'male', '2'), 1).mainPremium).toBe(1_101_000);
    });

    test('age 65 | Độc lập | Nam | pkg1 → 734,000  (same rate as 61)', () => {
        expect(calc(person(DOB.age65), 1).mainPremium).toBe(734_000);
    });

    // ── Out of coverage ───────────────────────────────────────────────────────
    test('age 66 | no rate row → mainPremiumRaw = null, mainPremium = 0', () => {
        const r = calc(person(DOB.age66), 1);
        expect(r.mainPremiumRaw).toBeNull();
        expect(r.mainPremium).toBe(0);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. Critical-illness raw premiums
// ═════════════════════════════════════════════════════════════════════════════

describe('Critical illness – raw premiums per band', () => {

    test('age 1 | Mua kèm | Nam | pkg1 → 30,000', () => {
        expect(calc(person(DOB.age1, 'male', '1', true), 2).criticalIllnessPremium).toBe(30_000);
    });

    test('age 1 | Độc lập | Nam | pkg1 → 39,000  (30% surcharge)', () => {
        expect(calc(person(DOB.age1, 'male', '1', true), 1).criticalIllnessPremium).toBe(39_000);
    });

    test('age 4 | Mua kèm | Nam | pkg1 → 21,000', () => {
        expect(calc(person(DOB.age4, 'male', '1', true), 2).criticalIllnessPremium).toBe(21_000);
    });

    test('age 4 | Độc lập | Nam | pkg1 → 28,000  (30% surcharge, pre-rounded in table)', () => {
        expect(calc(person(DOB.age4, 'male', '1', true), 1).criticalIllnessPremium).toBe(28_000);
    });

    test('age 10 | Độc lập | Nam | pkg1 → 27,000', () => {
        expect(calc(person(DOB.age10, 'male', '1', true), 1).criticalIllnessPremium).toBe(27_000);
    });

    test('age 25 | Độc lập | Nam | pkg1 → 35,000', () => {
        expect(calc(person(DOB.age25, 'male', '1', true), 1).criticalIllnessPremium).toBe(35_000);
    });

    test('age 25 | Độc lập | Nam | pkg3 → 86,000', () => {
        expect(calc(person(DOB.age25, 'male', '3', true), 1).criticalIllnessPremium).toBe(86_000);
    });

    test('age 35 | Độc lập | Nam | pkg1 → 125,000', () => {
        expect(calc(person(DOB.age35, 'male', '1', true), 1).criticalIllnessPremium).toBe(125_000);
    });

    test('age 50 | Độc lập | Nam | pkg1 → 370,000', () => {
        expect(calc(person(DOB.age50, 'male', '1', true), 1).criticalIllnessPremium).toBe(370_000);
    });

    // ── CI rate jump at age-51 boundary ───────────────────────────────────────
    test('age 51 | Độc lập | Nam | pkg1 → 800,000  (>2× jump from age 50)', () => {
        expect(calc(person(DOB.age51, 'male', '1', true), 1).criticalIllnessPremium).toBe(800_000);
    });

    test('age 61 | Độc lập | Nam | pkg1 → 1,770,000', () => {
        expect(calc(person(DOB.age61, 'male', '1', true), 1).criticalIllnessPremium).toBe(1_770_000);
    });

    test('age 61 | Độc lập | Nam | pkg5 → 8,800,000', () => {
        expect(calc(person(DOB.age61, 'male', '5', true), 1).criticalIllnessPremium).toBe(8_800_000);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. Total with roundToThousand – single component
// ═════════════════════════════════════════════════════════════════════════════

describe('Total – rounding applied to individual component sums', () => {

    // Raw 1,251,900 → roundToThousand → 1,252,000
    test('age 1 | Độc lập | Nam | pkg1 | main only → total = 1,252,000', () => {
        expect(calc(person(DOB.age1), 1).total).toBe(1_252_000);
    });

    // Raw 721,000 → already multiple of 1000
    test('age 4 | Độc lập | Nam | pkg1 | main only → total = 721,000', () => {
        expect(calc(person(DOB.age4), 1).total).toBe(721_000);
    });

    // 963,000 → already multiple → 963,000
    test('age 1 | Mua kèm | Nam | pkg1 | main only → total = 963,000', () => {
        expect(calc(person(DOB.age1), 2).total).toBe(963_000);
    });

    // 459,000 → already multiple
    test('age 25 | Độc lập | Nam | pkg1 | main only → total = 459,000', () => {
        expect(calc(person(DOB.age1, 'male', '1'), 1).total).toBe(1_252_000); // sanity
        expect(calc(person(DOB.age25), 1).total).toBe(459_000);
    });

    // 505,000 → already multiple
    test('age 35 | Độc lập | Nam | pkg1 | main only → total = 505,000', () => {
        expect(calc(person(DOB.age35), 1).total).toBe(505_000);
    });

    // 550,000 → already multiple
    test('age 51 | Độc lập | Nam | pkg1 | main only → total = 550,000', () => {
        expect(calc(person(DOB.age51), 1).total).toBe(550_000);
    });

    // 734,000 → already multiple
    test('age 61 | Độc lập | Nam | pkg1 | main only → total = 734,000', () => {
        expect(calc(person(DOB.age61), 1).total).toBe(734_000);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. Total – main + CI  (rounding on sum)
// ═════════════════════════════════════════════════════════════════════════════

describe('Total – main + critical illness', () => {

    // age 4 Độc lập: 721,500 + 27,300 = 748,800 → 749,000
    test('age 4 | Độc lập | Nam | pkg1 | main + CI → total = 749,000', () => {
        expect(calc(person(DOB.age4, 'male', '1', true), 1).total).toBe(749_000);
    });

    // age 1 Độc lập: 1,251,900 + 39,000 = 1,290,900 → 1,291,000
    test('age 1 | Độc lập | Nam | pkg1 | main + CI → total = 1,291,000', () => {
        expect(calc(person(DOB.age1, 'male', '1', true), 1).total).toBe(1_291_000);
    });

    // age 25: 459,000 + 35,000 = 494,000 → 494,000
    test('age 25 | Độc lập | Nam | pkg1 | main + CI → total = 494,000', () => {
        expect(calc(person(DOB.age25, 'male', '1', true), 1).total).toBe(494_000);
    });

    // age 35, pkg3: 1,807,000 + 322,000 = 2,129,000 → 2,129,000
    test('age 35 | Độc lập | Nam | pkg3 | main + CI → total = 2,129,000', () => {
        expect(calc(person(DOB.age35, 'male', '3', true), 1).total).toBe(2_129_000);
    });

    // age 50, pkg1: 528,000 + 370,000 = 898,000 → 898,000
    test('age 50 | Độc lập | Nam | pkg1 | main + CI → total = 898,000', () => {
        expect(calc(person(DOB.age50, 'male', '1', true), 1).total).toBe(898_000);
    });

    // age 51, pkg1: 550,000 + 800,000 = 1,350,000 → 1,350,000
    test('age 51 | Độc lập | Nam | pkg1 | main + CI → total = 1,350,000', () => {
        expect(calc(person(DOB.age51, 'male', '1', true), 1).total).toBe(1_350_000);
    });

    // age 61, pkg1: 734,000 + 1,770,000 = 2,504,000 → 2,504,000
    test('age 61 | Độc lập | Nam | pkg1 | main + CI → total = 2,504,000', () => {
        expect(calc(person(DOB.age61, 'male', '1', true), 1).total).toBe(2_504_000);
    });

    // age 61, pkg5: 5,603,000 + 8,800,000 = 14,403,000 → 14,403,000
    test('age 61 | Độc lập | Nam | pkg5 | main + CI → total = 14,403,000', () => {
        expect(calc(person(DOB.age61, 'male', '5', true), 1).total).toBe(14_403_000);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. Total – main + maternity  (fixed 2,000,000)
// ═════════════════════════════════════════════════════════════════════════════

describe('Total – main + maternity', () => {

    // age 25, Nữ, pkg3: 1,643,000 + 2,000,000 = 3,643,000
    test('age 25 | Nữ | pkg3 | main + maternity → total = 3,643,000', () => {
        expect(calc(person(DOB.age25, 'female', '3', false, true), 1).total).toBe(3_643_000);
    });

    // age 35, Nữ, pkg3: 1,807,000 + 2,000,000 = 3,807,000
    test('age 35 | Nữ | pkg3 | main + maternity → total = 3,807,000', () => {
        expect(calc(person(DOB.age35, 'female', '3', false, true), 1).total).toBe(3_807_000);
    });

    // age 50, Nữ, pkg5: 4,027,000 + 2,000,000 = 6,027,000
    test('age 50 | Nữ | pkg5 | main + maternity → total = 6,027,000', () => {
        expect(calc(person(DOB.age50, 'female', '5', false, true), 1).total).toBe(6_027_000);
    });

    // age 19, Nữ, pkg3: 1,643,000 + 2,000,000 = 3,643,000 (lower boundary)
    test('age 19 | Nữ | pkg3 | main + maternity → total = 3,643,000  (lower boundary)', () => {
        expect(calc(person(DOB.age19, 'female', '3', false, true), 1).total).toBe(3_643_000);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6. Total – main + CI + maternity
// ═════════════════════════════════════════════════════════════════════════════

describe('Total – main + CI + maternity', () => {

    // age 25, Nữ, pkg3: 1,643,000 + 86,000 + 2,000,000 = 3,729,000
    test('age 25 | Nữ | pkg3 | main + CI + maternity → total = 3,729,000', () => {
        expect(calc(person(DOB.age25, 'female', '3', true, true), 1).total).toBe(3_729_000);
    });

    // age 35, Nữ, pkg3: 1,807,000 + 322,000 + 2,000,000 = 4,129,000
    test('age 35 | Nữ | pkg3 | main + CI + maternity → total = 4,129,000', () => {
        expect(calc(person(DOB.age35, 'female', '3', true, true), 1).total).toBe(4_129_000);
    });

    // age 50, Nữ, pkg3: 1,889,000 + 925,000 + 2,000,000 = 4,814,000
    // (pkg1 does not qualify for maternity — minimum is pkg3)
    test('age 50 | Nữ | pkg3 | main + CI + maternity → total = 4,814,000', () => {
        expect(calc(person(DOB.age50, 'female', '3', true, true), 1).total).toBe(4_814_000);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// 7. Production-specific structural behaviours
// ═════════════════════════════════════════════════════════════════════════════

describe('Production behaviours: gender parity & bundled/independent rates', () => {

    // Gender neutral for ages 7+ (Nam = Nữ)
    test('age 25 | Nam mainPremium = Nữ mainPremium (gender-neutral pricing)', () => {
        const m = calc(person(DOB.age25, 'male'), 1).mainPremium;
        const f = calc(person(DOB.age25, 'female'), 1).mainPremium;
        expect(m).toBe(f);
    });

    test('age 35 | Nam CI premium = Nữ CI premium', () => {
        const m = calc(person(DOB.age35, 'male', '1', true), 1).criticalIllnessPremium;
        const f = calc(person(DOB.age35, 'female', '1', true), 1).criticalIllnessPremium;
        expect(m).toBe(f);
    });

    test('age 61 | Nam mainPremium = Nữ mainPremium', () => {
        const m = calc(person(DOB.age61, 'male'), 1).mainPremium;
        const f = calc(person(DOB.age61, 'female'), 1).mainPremium;
        expect(m).toBe(f);
    });

    // Ages 7+: Độc lập = Mua kèm (no surcharge)
    test('age 25 | 1-person (Độc lập) mainPremium = 2-person (Mua kèm) mainPremium', () => {
        const ind = calc(person(DOB.age25), 1).mainPremium;
        const bun = calc(person(DOB.age25), 2).mainPremium;
        expect(ind).toBe(bun);
    });

    test('age 35 | 1-person CI premium = 2-person CI premium', () => {
        const ind = calc(person(DOB.age35, 'male', '1', true), 1).criticalIllnessPremium;
        const bun = calc(person(DOB.age35, 'male', '1', true), 2).criticalIllnessPremium;
        expect(ind).toBe(bun);
    });

    // Ages 1-6: Độc lập > Mua kèm (30% surcharge)
    test('age 1 | 1-person (Độc lập) mainPremium > 2-person (Mua kèm) mainPremium', () => {
        const ind = calc(person(DOB.age1), 1).mainPremium;
        const bun = calc(person(DOB.age1), 2).mainPremium;
        expect(ind).toBeGreaterThan(bun);
    });

    test('age 4 | Độc lập mainPremium > Mua kèm  (30% surcharge, table pre-rounded)', () => {
        const ind = calc(person(DOB.age4), 1).mainPremium;
        const bun = calc(person(DOB.age4), 2).mainPremium;
        expect(ind).toBeGreaterThan(bun);
        expect(ind / bun).toBeCloseTo(1.3, 1); // approx 30%, table values pre-rounded
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// 8. CI rate jump at age-51 band boundary
// ═════════════════════════════════════════════════════════════════════════════

describe('CI rate jump: age 50 → 51 boundary', () => {

    test('age 50 CI pkg1 = 370,000', () => {
        expect(calc(person(DOB.age50, 'male', '1', true), 1).criticalIllnessPremium).toBe(370_000);
    });

    test('age 51 CI pkg1 = 800,000  (more than double age 50)', () => {
        expect(calc(person(DOB.age51, 'male', '1', true), 1).criticalIllnessPremium).toBe(800_000);
    });

    test('age 51 CI pkg1 > age 50 CI pkg1 × 2', () => {
        const ci50 = calc(person(DOB.age50, 'male', '1', true), 1).criticalIllnessPremium;
        const ci51 = calc(person(DOB.age51, 'male', '1', true), 1).criticalIllnessPremium;
        expect(ci51).toBeGreaterThan(ci50 * 2);
    });

    test('age 50 CI pkg5 = 1,850,000', () => {
        expect(calc(person(DOB.age50, 'male', '5', true), 1).criticalIllnessPremium).toBe(1_850_000);
    });

    test('age 51 CI pkg5 = 4,029,000', () => {
        expect(calc(person(DOB.age51, 'male', '5', true), 1).criticalIllnessPremium).toBe(4_029_000);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// 9. PREMIUM_RATES data integrity
// ═════════════════════════════════════════════════════════════════════════════

describe('PREMIUM_RATES data integrity', () => {

    test('loaded 578 rate rows from index.html', () => {
        expect(REAL_RATES.length).toBe(578);
    });

    test('every row has the 5 package fields', () => {
        for (const r of REAL_RATES) {
            expect(r).toHaveProperty('package1');
            expect(r).toHaveProperty('package5');
        }
    });

    test('every row has gender, type, benefit, age', () => {
        for (const r of REAL_RATES) {
            expect(r).toHaveProperty('gender');
            expect(r).toHaveProperty('type');
            expect(r).toHaveProperty('benefit');
            expect(r).toHaveProperty('age');
        }
    });

    test('rate map has same number of entries as REAL_RATES (no duplicates)', () => {
        expect(realMap.size).toBe(REAL_RATES.length);
    });
});
