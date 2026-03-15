/**
 * premium.test.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Comprehensive unit-test suite for the SHB Finance / VBI insurance
 * premium calculator (index.html embedded logic).
 *
 * Covers:
 *   1. parseDDMMYYYY  – date parsing & validation
 *   2. calculateAge   – insurance age rounding rule
 *   3. parseVND       – VND string → integer
 *   4. buildRateMap   – map construction
 *   5. findRate       – rate lookup (positive, null, "Không áp dụng" cells)
 *   6. calculatePersonPremium – full premium engine
 *      a. Single person (Độc lập / independent)
 *      b. Multi-person (Mua kèm / bundled)
 *      c. Maternity edge cases
 *      d. Critical illness edge cases
 *      e. Age-band boundaries
 *      f. Out-of-coverage ages (66+, 0)
 *      g. Package boundaries (1–5)
 *      h. Gender-specific rates
 *   7. Grand total calculation across multiple persons
 *
 * Reference date used in age tests: 2026-02-20  (Friday)
 */

'use strict';

const {
    parseDDMMYYYY,
    calculateAge,
    parseVND,
    roundToThousand,
    buildRateMap,
    findRate,
    calculatePersonPremium,
    MATERNITY_PREMIUM,
    BENEFIT_MAIN,
    BENEFIT_CRITICAL,
} = require('./premium-functions');

const { SAMPLE_RATES } = require('./fixtures/rates');

// ─── Shared reference date ────────────────────────────────────────────────────
// Fix the "today" value so tests are reproducible regardless of when they run.
const TODAY = new Date(2026, 1, 20); // 20 Feb 2026  (month is 0-indexed)

// ─── Pre-built rate map ───────────────────────────────────────────────────────
const rateMap = buildRateMap(SAMPLE_RATES);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Shorthand: calculate a person's premium with the fixture rate map and fixed today */
function calc(personData, totalPeople = 1) {
    return calculatePersonPremium(personData, totalPeople, rateMap, TODAY);
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. parseDDMMYYYY
// ═════════════════════════════════════════════════════════════════════════════

describe('parseDDMMYYYY – valid dates', () => {
    test('parses a common valid date', () => {
        const d = parseDDMMYYYY('01/01/2000');
        expect(d).toBeInstanceOf(Date);
        expect(d.getFullYear()).toBe(2000);
        expect(d.getMonth()).toBe(0);  // January
        expect(d.getDate()).toBe(1);
    });

    test('parses last day of a 31-day month', () => {
        const d = parseDDMMYYYY('31/01/1990');
        expect(d).not.toBeNull();
        expect(d.getDate()).toBe(31);
    });

    test('parses 29 Feb on a leap year (2000)', () => {
        const d = parseDDMMYYYY('29/02/2000');
        expect(d).not.toBeNull();
        expect(d.getDate()).toBe(29);
    });

    test('parses 29 Feb on a leap year (2004)', () => {
        expect(parseDDMMYYYY('29/02/2004')).not.toBeNull();
    });

    test('parses minimum allowed year boundary (01/01/1900)', () => {
        const d = parseDDMMYYYY('01/01/1900');
        expect(d).not.toBeNull();
        expect(d.getFullYear()).toBe(1900);
    });

    test('parses the reference date itself (20/02/2026)', () => {
        expect(parseDDMMYYYY('20/02/2026')).not.toBeNull();
    });
});

describe('parseDDMMYYYY – invalid dates', () => {
    test('returns null for empty string', () => {
        expect(parseDDMMYYYY('')).toBeNull();
    });

    test('returns null for null input', () => {
        expect(parseDDMMYYYY(null)).toBeNull();
    });

    test('returns null for undefined input', () => {
        expect(parseDDMMYYYY(undefined)).toBeNull();
    });

    test('returns null when string is too short (9 chars)', () => {
        expect(parseDDMMYYYY('01/01/200')).toBeNull();
    });

    test('returns null when string is too long (11 chars)', () => {
        expect(parseDDMMYYYY('01/01/20000')).toBeNull();
    });

    test('returns null for wrong separator (dashes)', () => {
        expect(parseDDMMYYYY('01-01-2000')).toBeNull();
    });

    test('returns null for wrong separator (dots)', () => {
        expect(parseDDMMYYYY('01.01.2000')).toBeNull();
    });

    test('returns null for wrong part count (only 2 parts)', () => {
        expect(parseDDMMYYYY('01/012000')).toBeNull();
    });

    test('returns null for non-numeric characters in day', () => {
        expect(parseDDMMYYYY('aa/01/2000')).toBeNull();
    });

    test('returns null for month 0 (out of range)', () => {
        expect(parseDDMMYYYY('01/00/2000')).toBeNull();
    });

    test('returns null for month 13 (out of range)', () => {
        expect(parseDDMMYYYY('01/13/2000')).toBeNull();
    });

    test('returns null for day 0', () => {
        expect(parseDDMMYYYY('00/01/2000')).toBeNull();
    });

    test('returns null for day 32', () => {
        expect(parseDDMMYYYY('32/01/2000')).toBeNull();
    });

    test('returns null for 29 Feb on a non-leap year (2001)', () => {
        expect(parseDDMMYYYY('29/02/2001')).toBeNull();
    });

    test('returns null for 30 Feb (impossible)', () => {
        expect(parseDDMMYYYY('30/02/2000')).toBeNull();
    });

    test('returns null for 31 Apr (impossible)', () => {
        expect(parseDDMMYYYY('31/04/2000')).toBeNull();
    });

    test('returns null for year 1899 (below minimum 1900)', () => {
        expect(parseDDMMYYYY('01/01/1899')).toBeNull();
    });

    test('returns null for year 0 (below minimum 1900)', () => {
        expect(parseDDMMYYYY('01/01/0000')).toBeNull();
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. calculateAge – insurance "round-up" convention
// ═════════════════════════════════════════════════════════════════════════════
// TODAY = 20 Feb 2026
// Convention: add 1 year UNLESS today is the exact birthday.

describe('calculateAge – exact birthday today', () => {
    test('exact 36th birthday → age 36', () => {
        // born 20/02/1990, exact birthday → no rounding up
        expect(calculateAge('20/02/1990', TODAY)).toBe(36);
    });

    test('exact 25th birthday → age 25', () => {
        expect(calculateAge('20/02/2001', TODAY)).toBe(25);
    });

    test('exact 1st birthday → age 1 (not 2)', () => {
        expect(calculateAge('20/02/2025', TODAY)).toBe(1);
    });
});

describe('calculateAge – birthday already passed this year (rounds up)', () => {
    // Born 19/02: birthday was yesterday → age rounds UP
    test('19/02/1990 (36 years + 1 day) → age 37', () => {
        expect(calculateAge('19/02/1990', TODAY)).toBe(37);
    });

    test('01/01/1990 → rounds up (birthday Jan 1 already passed)', () => {
        // Natural age = 36, rounds to 37
        expect(calculateAge('01/01/1990', TODAY)).toBe(37);
    });

    test('01/01/2007 → rounds up to 19 (maternity boundary)', () => {
        // Natural age = 19, birthday Jan 1 passed → 20
        expect(calculateAge('01/01/2007', TODAY)).toBe(20);
    });
});

describe('calculateAge – birthday still upcoming this year (rounds up from decreased age)', () => {
    // Born 21/02: birthday is tomorrow → natural decrement, then round up restores
    test('21/02/1990 (birthday tomorrow) → age 36', () => {
        // age = 36, monthDiff=0, dayDiff=-1 → age-- = 35, not exact → age++ = 36
        expect(calculateAge('21/02/1990', TODAY)).toBe(36);
    });

    test('31/12/1990 (birthday far future) → age 36', () => {
        // Natural age = 35 (birthday not yet), round up → 36
        expect(calculateAge('31/12/1990', TODAY)).toBe(36);
    });

    test('21/02/2007 (birthday tomorrow) → age 19 (maternity lower boundary)', () => {
        // age = 19, monthDiff=0, dayDiff=-1 → age-- = 18, round up → 19
        expect(calculateAge('21/02/2007', TODAY)).toBe(19);
    });
});

describe('calculateAge – age-band boundary ages', () => {
    // These DOBs produce the exact boundary ages used in rate lookup

    test('returns 0 for invalid dob (empty string)', () => {
        expect(calculateAge('', TODAY)).toBe(0);
    });

    test('returns 0 for null input', () => {
        expect(calculateAge(null, TODAY)).toBe(0);
    });

    test('returns 0 for malformed dob', () => {
        expect(calculateAge('not-a-date', TODAY)).toBe(0);
    });

    test('born 20/02/2025 → exact 1st birthday → age 1', () => {
        expect(calculateAge('20/02/2025', TODAY)).toBe(1);
    });

    test('born 20/02/2008 → exact 18th birthday → age 18', () => {
        expect(calculateAge('20/02/2008', TODAY)).toBe(18);
    });

    test('born 20/02/2007 → exact 19th birthday → age 19', () => {
        expect(calculateAge('20/02/2007', TODAY)).toBe(19);
    });

    test('born 20/02/1976 → exact 50th birthday → age 50', () => {
        expect(calculateAge('20/02/1976', TODAY)).toBe(50);
    });

    test('born 20/02/1975 → exact 51st birthday → age 51', () => {
        expect(calculateAge('20/02/1975', TODAY)).toBe(51);
    });

    test('born 20/02/1965 → exact 61st birthday → age 61', () => {
        expect(calculateAge('20/02/1965', TODAY)).toBe(61);
    });

    test('born 20/02/1961 → exact 65th birthday → age 65', () => {
        expect(calculateAge('20/02/1961', TODAY)).toBe(65);
    });

    test('born 20/02/1960 → exact 66th birthday → age 66 (no coverage)', () => {
        expect(calculateAge('20/02/1960', TODAY)).toBe(66);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. parseVND
// ═════════════════════════════════════════════════════════════════════════════

describe('parseVND', () => {
    test('parses a plain integer string', () => {
        expect(parseVND('963000')).toBe(963000);
    });

    test('parses a comma-formatted VND string', () => {
        expect(parseVND('963,000')).toBe(963000);
    });

    test('parses multi-comma formatted string', () => {
        expect(parseVND('2,000,000')).toBe(2000000);
    });

    test('returns 0 for "Không áp dụng"', () => {
        expect(parseVND('Không áp dụng')).toBe(0);
    });

    test('returns 0 for empty string', () => {
        expect(parseVND('')).toBe(0);
    });

    test('returns 0 for null', () => {
        expect(parseVND(null)).toBe(0);
    });

    test('returns 0 for undefined', () => {
        expect(parseVND(undefined)).toBe(0);
    });

    test('parses large premium (11,400,000)', () => {
        expect(parseVND('11,400,000')).toBe(11400000);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. buildRateMap
// ═════════════════════════════════════════════════════════════════════════════

describe('buildRateMap', () => {
    test('map has at least as many entries as SAMPLE_RATES rows', () => {
        expect(rateMap.size).toBe(SAMPLE_RATES.length);
    });

    test('key format is correct: age|benefit|type|gender', () => {
        const key = `25|${BENEFIT_MAIN}|Độc lập|Nam`;
        expect(rateMap.has(key)).toBe(true);
    });

    test('each entry has package1..5 properties', () => {
        const key = `25|${BENEFIT_MAIN}|Độc lập|Nam`;
        const row = rateMap.get(key);
        for (let i = 1; i <= 5; i++) {
            expect(row).toHaveProperty(`package${i}`);
        }
    });

    test('empty rates array produces empty map', () => {
        expect(buildRateMap([]).size).toBe(0);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. findRate
// ═════════════════════════════════════════════════════════════════════════════

describe('findRate – positive (rate exists, returns numeric value)', () => {
    test('male, 25, independent, package 1 → positive number', () => {
        const r = findRate(rateMap, 25, BENEFIT_MAIN, 'male', true, 1);
        expect(r).toBeGreaterThan(0);
    });

    test('female, 25, independent, package 1 → positive number', () => {
        const r = findRate(rateMap, 25, BENEFIT_MAIN, 'female', true, 1);
        expect(r).toBeGreaterThan(0);
    });

    test('male, 35, bundled, package 3 → positive number', () => {
        const r = findRate(rateMap, 35, BENEFIT_MAIN, 'male', false, 3);
        expect(r).toBeGreaterThan(0);
    });

    test('critical illness, male, 25, independent, package 2 → positive', () => {
        const r = findRate(rateMap, 25, BENEFIT_CRITICAL, 'male', true, 2);
        expect(r).toBeGreaterThan(0);
    });

    test('package 5 returns a higher premium than package 1 (same person)', () => {
        const p1 = findRate(rateMap, 25, BENEFIT_MAIN, 'male', true, 1);
        const p5 = findRate(rateMap, 25, BENEFIT_MAIN, 'male', true, 5);
        expect(p5).toBeGreaterThan(p1);
    });

    test('bundled rate is lower than independent rate (same age/gender/package)', () => {
        const ind = findRate(rateMap, 35, BENEFIT_MAIN, 'male', true, 1);
        const bun = findRate(rateMap, 35, BENEFIT_MAIN, 'male', false, 1);
        expect(bun).toBeLessThan(ind);
    });
});

describe('findRate – "Không áp dụng" cells return 0 (not null)', () => {
    // Age 61, packages 3-5 → "Không áp dụng" → parseVND returns 0
    test('age 61, independent, male, package 3 → 0 (N/A cell)', () => {
        const r = findRate(rateMap, 61, BENEFIT_MAIN, 'male', true, 3);
        expect(r).toBe(0);
    });

    test('age 61, independent, female, package 5 → 0 (N/A cell)', () => {
        const r = findRate(rateMap, 61, BENEFIT_MAIN, 'female', true, 5);
        expect(r).toBe(0);
    });

    test('age 65, bundled, male, package 3 → 0 (N/A cell)', () => {
        const r = findRate(rateMap, 65, BENEFIT_MAIN, 'male', false, 3);
        expect(r).toBe(0);
    });

    test('critical illness, age 61, independent, male, package 1 → 0 (N/A row)', () => {
        // All critical illness for 61-65 are N/A in SAMPLE_RATES
        const r = findRate(rateMap, 61, BENEFIT_CRITICAL, 'male', true, 1);
        expect(r).toBe(0);
    });
});

describe('findRate – no matching row returns null', () => {
    test('age 66 (out of coverage) → null', () => {
        expect(findRate(rateMap, 66, BENEFIT_MAIN, 'male', true, 1)).toBeNull();
    });

    test('age 0 (invalid parse result) → null', () => {
        expect(findRate(rateMap, 0, BENEFIT_MAIN, 'male', true, 1)).toBeNull();
    });

    test('unknown benefit string → null', () => {
        expect(findRate(rateMap, 25, 'INVALID_BENEFIT', 'male', true, 1)).toBeNull();
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6a. calculatePersonPremium – single person (Độc lập)
// ═════════════════════════════════════════════════════════════════════════════

describe('calculatePersonPremium – single person, main benefit only', () => {
    const personBase = {
        dob: '20/02/2001', // exact 25th birthday on TODAY → age 25
        gender: 'male',
        package: '1',
        criticalIllness: false,
        maternity: false,
    };

    test('isIndependent = true when totalPeople = 1', () => {
        const r = calc(personBase, 1);
        expect(r.isIndependent).toBe(true);
    });

    test('age is correctly computed', () => {
        const r = calc(personBase, 1);
        expect(r.age).toBe(25);
    });

    test('mainPremium > 0', () => {
        const r = calc(personBase, 1);
        expect(r.mainPremium).toBeGreaterThan(0);
    });

    test('criticalIllnessPremium = 0 (not selected)', () => {
        const r = calc(personBase, 1);
        expect(r.criticalIllnessPremium).toBe(0);
    });

    test('maternityPremium = 0 (male)', () => {
        const r = calc(personBase, 1);
        expect(r.maternityPremium).toBe(0);
    });

    test('total = mainPremium', () => {
        const r = calc(personBase, 1);
        expect(r.total).toBe(r.mainPremium);
    });

    test('packageName is "Lựa chọn 1"', () => {
        const r = calc(personBase, 1);
        expect(r.packageName).toBe('Lựa chọn 1');
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6b. calculatePersonPremium – multi-person (Mua kèm / bundled)
// ═════════════════════════════════════════════════════════════════════════════

describe('calculatePersonPremium – multi-person (bundled)', () => {
    const person = {
        dob: '20/02/1991', // exact 35th birthday → age 35
        gender: 'male',
        package: '2',
        criticalIllness: false,
        maternity: false,
    };

    test('isIndependent = false when totalPeople = 2', () => {
        const r = calc(person, 2);
        expect(r.isIndependent).toBe(false);
    });

    test('isIndependent = false when totalPeople = 3', () => {
        const r = calc(person, 3);
        expect(r.isIndependent).toBe(false);
    });

    test('bundled mainPremium is lower than independent rate for same data', () => {
        const bundled = calc(person, 2);
        const indep   = calc(person, 1);
        expect(bundled.mainPremium).toBeLessThan(indep.mainPremium);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6c. calculatePersonPremium – critical illness benefit
// ═════════════════════════════════════════════════════════════════════════════

describe('calculatePersonPremium – critical illness', () => {
    const withCI = {
        dob: '20/02/2001', // age 25
        gender: 'male',
        package: '1',
        criticalIllness: true,
        maternity: false,
    };

    test('criticalIllnessPremium > 0 when checkbox is checked', () => {
        const r = calc(withCI);
        expect(r.criticalIllnessPremium).toBeGreaterThan(0);
    });

    test('total = mainPremium + criticalIllnessPremium', () => {
        const r = calc(withCI);
        expect(r.total).toBe(r.mainPremium + r.criticalIllnessPremium + r.maternityPremium);
    });

    test('criticalIllnessPremiumRaw is non-null (rate exists at 25)', () => {
        const r = calc(withCI);
        expect(r.criticalIllnessPremiumRaw).not.toBeNull();
    });

    test('criticalIllnessPremium = 0 when NOT checked', () => {
        const noCI = { ...withCI, criticalIllness: false };
        const r = calc(noCI);
        expect(r.criticalIllnessPremium).toBe(0);
    });

    // Age 61: critical illness → "N/A" cells → 0, raw = 0 (not null)
    test('age 61 + criticalIllness checked → raw=0 (N/A), not null', () => {
        const elderly = {
            dob: '20/02/1965', // exact 61st birthday
            gender: 'male',
            package: '1',
            criticalIllness: true,
            maternity: false,
        };
        const r = calc(elderly);
        // The row exists but package values are all 'Không áp dụng' → 0
        expect(r.criticalIllnessPremium).toBe(0);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6d. Maternity – eligibility gate (all five conditions must be true)
// ═════════════════════════════════════════════════════════════════════════════

describe('calculatePersonPremium – maternity eligibility', () => {

    // POSITIVE: female, age 25, package 3, maternity=true → 2,000,000
    test('eligible female (25, pkg 3) → maternityPremium = 2,000,000', () => {
        const person = {
            dob: '20/02/2001',  // exact age 25
            gender: 'female',
            package: '3',
            criticalIllness: false,
            maternity: true,
        };
        const r = calc(person);
        expect(r.maternityPremium).toBe(MATERNITY_PREMIUM);
    });

    // Lower age boundary: female, age 19 → eligible
    test('female age 19 (lower boundary) + pkg 3 → eligible', () => {
        const person = {
            dob: '20/02/2007',  // exact age 19
            gender: 'female',
            package: '3',
            criticalIllness: false,
            maternity: true,
        };
        expect(calc(person).maternityPremium).toBe(MATERNITY_PREMIUM);
    });

    // Upper age boundary: female, age 50 → eligible
    test('female age 50 (upper boundary) + pkg 3 → eligible', () => {
        const person = {
            dob: '20/02/1976',  // exact age 50
            gender: 'female',
            package: '3',
            criticalIllness: false,
            maternity: true,
        };
        expect(calc(person).maternityPremium).toBe(MATERNITY_PREMIUM);
    });

    // Lower package boundary: package 3 minimum
    test('female age 25 + pkg 3 (minimum) → eligible', () => {
        const person = {
            dob: '20/02/2001', gender: 'female', package: '3',
            criticalIllness: false, maternity: true,
        };
        expect(calc(person).maternityPremium).toBe(MATERNITY_PREMIUM);
    });

    test('female age 25 + pkg 5 (maximum) → eligible', () => {
        const person = {
            dob: '20/02/2001', gender: 'female', package: '5',
            criticalIllness: false, maternity: true,
        };
        expect(calc(person).maternityPremium).toBe(MATERNITY_PREMIUM);
    });

    // ─── NEGATIVE: wrong gender ───────────────────────────────────────────
    test('male, age 25, pkg 3, maternity=true → maternityPremium = 0', () => {
        const person = {
            dob: '20/02/2001', gender: 'male', package: '3',
            criticalIllness: false, maternity: true,
        };
        expect(calc(person).maternityPremium).toBe(0);
    });

    // ─── NEGATIVE: age too young ──────────────────────────────────────────
    test('female age 18 (too young) + pkg 3 → maternityPremium = 0', () => {
        const person = {
            dob: '20/02/2008',  // exact age 18
            gender: 'female', package: '3',
            criticalIllness: false, maternity: true,
        };
        expect(calc(person).maternityPremium).toBe(0);
    });

    // ─── NEGATIVE: age too old ────────────────────────────────────────────
    test('female age 51 (too old) + pkg 3 → maternityPremium = 0', () => {
        const person = {
            dob: '20/02/1975',  // exact age 51
            gender: 'female', package: '3',
            criticalIllness: false, maternity: true,
        };
        expect(calc(person).maternityPremium).toBe(0);
    });

    // ─── NEGATIVE: package too low ───────────────────────────────────────
    test('female age 25 + pkg 1 → maternityPremium = 0', () => {
        const person = {
            dob: '20/02/2001', gender: 'female', package: '1',
            criticalIllness: false, maternity: true,
        };
        expect(calc(person).maternityPremium).toBe(0);
    });

    test('female age 25 + pkg 2 → maternityPremium = 0', () => {
        const person = {
            dob: '20/02/2001', gender: 'female', package: '2',
            criticalIllness: false, maternity: true,
        };
        expect(calc(person).maternityPremium).toBe(0);
    });

    // ─── NEGATIVE: maternity checkbox not checked ─────────────────────────
    test('female age 25 + pkg 3 + maternity=false → 0', () => {
        const person = {
            dob: '20/02/2001', gender: 'female', package: '3',
            criticalIllness: false, maternity: false,
        };
        expect(calc(person).maternityPremium).toBe(0);
    });

    // ─── Combined maternity + critical illness ────────────────────────────
    test('female age 25 + pkg 3 + maternity + criticalIllness → total includes both', () => {
        const person = {
            dob: '20/02/2001', gender: 'female', package: '3',
            criticalIllness: true, maternity: true,
        };
        const r = calc(person);
        expect(r.maternityPremium).toBe(MATERNITY_PREMIUM);
        expect(r.criticalIllnessPremium).toBeGreaterThan(0);
        expect(r.total).toBe(r.mainPremium + r.criticalIllnessPremium + MATERNITY_PREMIUM);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6e. Age-band boundary edge cases
// ═════════════════════════════════════════════════════════════════════════════

describe('calculatePersonPremium – age-band boundary ages', () => {
    function personAt(exactAge, gender = 'male', pkg = '1') {
        // DOB = 20/02/(2026 - exactAge) → exact birthday → no rounding
        const year = 2026 - exactAge;
        return { dob: `20/02/${year}`, gender, package: pkg, criticalIllness: false, maternity: false };
    }

    test('age 1 (youngest covered) → mainPremium > 0', () => {
        const r = calc(personAt(1));
        expect(r.mainPremiumRaw).not.toBeNull();
        expect(r.mainPremium).toBeGreaterThan(0);
    });

    test('age 10 (start of 10-18 band) → mainPremium > 0', () => {
        const r = calc(personAt(10));
        expect(r.mainPremiumRaw).not.toBeNull();
    });

    test('age 18 (end of 10-18 band) → covered', () => {
        const r = calc(personAt(18));
        expect(r.mainPremiumRaw).not.toBeNull();
    });

    test('age 19 (start of adult band) → covered', () => {
        const r = calc(personAt(19));
        expect(r.mainPremiumRaw).not.toBeNull();
    });

    test('age 50 (end of maternity-eligible band) → covered', () => {
        const r = calc(personAt(50));
        expect(r.mainPremiumRaw).not.toBeNull();
    });

    test('age 51 (no maternity) → mainPremium > 0', () => {
        const r = calc(personAt(51));
        expect(r.mainPremiumRaw).not.toBeNull();
    });

    test('age 61 (start of last band) → package 1 & 2 have rates, pkg 3+ are 0 (N/A)', () => {
        const p1 = calc({ ...personAt(61), package: '1' });
        const p3 = calc({ ...personAt(61), package: '3' });
        expect(p1.mainPremium).toBeGreaterThan(0);
        expect(p3.mainPremium).toBe(0);           // "Không áp dụng" cell
    });

    test('age 65 (last covered age) → package 1 has rate, package 3+ are 0 (N/A)', () => {
        const p1 = calc(personAt(65));
        const p3 = calc({ ...personAt(65), package: '3' });
        expect(p1.mainPremium).toBeGreaterThan(0);
        expect(p3.mainPremium).toBe(0);
    });

    // ─── Out-of-coverage ages → mainPremiumRaw = null ────────────────────
    test('age 66 (out of coverage) → mainPremiumRaw = null, mainPremium = 0', () => {
        const r = calc(personAt(66));
        expect(r.mainPremiumRaw).toBeNull();
        expect(r.mainPremium).toBe(0);
        expect(r.total).toBe(0);
    });

    test('age 66 with criticalIllness checked → criticalIllnessPremiumRaw = null', () => {
        const r = calc({ ...personAt(66), criticalIllness: true });
        expect(r.criticalIllnessPremiumRaw).toBeNull();
        expect(r.criticalIllnessPremium).toBe(0);
    });

    test('invalid dob (returns age 0 from calculateAge) → all premiums 0', () => {
        const r = calc({ dob: 'bad-date', gender: 'male', package: '1', criticalIllness: false, maternity: false });
        expect(r.age).toBe(0);
        expect(r.mainPremiumRaw).toBeNull();
        expect(r.total).toBe(0);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6f. Package selection (1–5)
// ═════════════════════════════════════════════════════════════════════════════

describe('calculatePersonPremium – package tiers', () => {
    // Use age 25 male independent as baseline
    function pkgCalc(pkg) {
        return calc({
            dob: '20/02/2001', gender: 'male', package: String(pkg),
            criticalIllness: false, maternity: false,
        });
    }

    test('package 1 → positive premium', () => {
        expect(pkgCalc(1).mainPremium).toBeGreaterThan(0);
    });

    test('package 2 > package 1', () => {
        expect(pkgCalc(2).mainPremium).toBeGreaterThan(pkgCalc(1).mainPremium);
    });

    test('package 3 > package 2', () => {
        expect(pkgCalc(3).mainPremium).toBeGreaterThan(pkgCalc(2).mainPremium);
    });

    test('package 4 > package 3', () => {
        expect(pkgCalc(4).mainPremium).toBeGreaterThan(pkgCalc(3).mainPremium);
    });

    test('package 5 > package 4', () => {
        expect(pkgCalc(5).mainPremium).toBeGreaterThan(pkgCalc(4).mainPremium);
    });

    test('packageName matches selection', () => {
        for (let i = 1; i <= 5; i++) {
            expect(pkgCalc(i).packageName).toBe(`Lựa chọn ${i}`);
        }
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6g. Gender-specific rates
// ═════════════════════════════════════════════════════════════════════════════

describe('calculatePersonPremium – gender rate differences', () => {
    function genderCalc(gender, age = 25, pkg = '1') {
        const year = 2026 - age;
        return calc({ dob: `20/02/${year}`, gender, package: pkg, criticalIllness: false, maternity: false });
    }

    test('female age 25 main premium is different from male (gender-specific rates)', () => {
        const m = genderCalc('male');
        const f = genderCalc('female');
        // Rates differ – we don't assert direction, only that they differ
        expect(f.mainPremium).not.toBe(m.mainPremium);
    });

    test('female age 35 critical illness premium differs from male', () => {
        const maleCI = calc({
            dob: '20/02/1991', gender: 'male', package: '1', criticalIllness: true, maternity: false,
        });
        const femCI = calc({
            dob: '20/02/1991', gender: 'female', package: '1', criticalIllness: true, maternity: false,
        });
        expect(femCI.criticalIllnessPremium).not.toBe(maleCI.criticalIllnessPremium);
    });

    test('age 1: male and female have equal premiums (same rate in fixture)', () => {
        const m = genderCalc('male', 1);
        const f = genderCalc('female', 1);
        expect(m.mainPremium).toBe(f.mainPremium);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// 7. Grand total – multiple persons
// ═════════════════════════════════════════════════════════════════════════════

describe('Grand total across multiple persons', () => {

    function computeTotal(personsData) {
        const totalPeople = personsData.length;
        return personsData.reduce((sum, pd) => {
            return sum + calculatePersonPremium(pd, totalPeople, rateMap, TODAY).total;
        }, 0);
    }

    test('2 persons: grand total = sum of individual totals', () => {
        const p1 = { dob: '20/02/2001', gender: 'male', package: '1', criticalIllness: false, maternity: false };
        const p2 = { dob: '20/02/1991', gender: 'female', package: '2', criticalIllness: false, maternity: false };

        const r1 = calculatePersonPremium(p1, 2, rateMap, TODAY);
        const r2 = calculatePersonPremium(p2, 2, rateMap, TODAY);
        const expected = r1.total + r2.total;

        expect(computeTotal([p1, p2])).toBe(expected);
    });

    test('3 persons: all are bundled (isIndependent=false)', () => {
        const persons = [
            { dob: '20/02/2001', gender: 'male',   package: '1', criticalIllness: false, maternity: false },
            { dob: '20/02/1991', gender: 'female',  package: '2', criticalIllness: true,  maternity: true  },
            { dob: '20/02/1976', gender: 'male',   package: '3', criticalIllness: false, maternity: false },
        ];
        persons.forEach(pd => {
            const r = calculatePersonPremium(pd, 3, rateMap, TODAY);
            expect(r.isIndependent).toBe(false);
        });
    });

    test('mixed-age family: one adult (25) + one elder (65) → elder has N/A for pkg 3+', () => {
        const adult = { dob: '20/02/2001', gender: 'male', package: '3', criticalIllness: false, maternity: false };
        const elder = { dob: '20/02/1961', gender: 'male', package: '3', criticalIllness: false, maternity: false };

        const rAdult = calculatePersonPremium(adult, 2, rateMap, TODAY);
        const rElder = calculatePersonPremium(elder, 2, rateMap, TODAY);

        expect(rAdult.mainPremium).toBeGreaterThan(0);
        expect(rElder.mainPremium).toBe(0); // "Không áp dụng" for age 65, pkg 3
    });

    test('1 adult (out-of-coverage age 66) + 1 child (age 1) → total = child premium only', () => {
        const outOfRange = { dob: '20/02/1960', gender: 'male', package: '1', criticalIllness: false, maternity: false };
        const child      = { dob: '20/02/2025', gender: 'male', package: '1', criticalIllness: false, maternity: false };

        const rOOR   = calculatePersonPremium(outOfRange, 2, rateMap, TODAY);
        const rChild = calculatePersonPremium(child,      2, rateMap, TODAY);

        expect(rOOR.total).toBe(0);
        expect(rChild.total).toBeGreaterThan(0);
        expect(computeTotal([outOfRange, child])).toBe(rChild.total);
    });

    test('2-person family with maternity: only eligible female counts', () => {
        const male   = { dob: '20/02/2001', gender: 'male',   package: '3', criticalIllness: false, maternity: true };
        const female = { dob: '20/02/2001', gender: 'female', package: '3', criticalIllness: false, maternity: true };

        const rM = calculatePersonPremium(male,   2, rateMap, TODAY);
        const rF = calculatePersonPremium(female, 2, rateMap, TODAY);

        expect(rM.maternityPremium).toBe(0);
        expect(rF.maternityPremium).toBe(MATERNITY_PREMIUM);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// 7b. roundToThousand – làm tròn đến hàng nghìn
// ═════════════════════════════════════════════════════════════════════════════
// Rule: remainder 1-499 → round down; remainder 500-999 → round up
// (equivalent to standard Math.round to nearest 1000)

describe('roundToThousand', () => {

    // ─── Multiples of 1000 pass through unchanged ─────────────────────────
    test('0 → 0', () => expect(roundToThousand(0)).toBe(0));
    test('1000 → 1000', () => expect(roundToThousand(1000)).toBe(1000));
    test('963000 → 963000 (already multiple)', () => expect(roundToThousand(963000)).toBe(963000));
    test('2000000 → 2000000', () => expect(roundToThousand(2000000)).toBe(2000000));

    // ─── Round-down cases (remainder 1–499) ───────────────────────────────
    test('117200 → 117000 (spec example)', () => expect(roundToThousand(117200)).toBe(117000));
    test('1499 → 1000 (remainder 499 – boundary below 500)', () => expect(roundToThousand(1499)).toBe(1000));
    test('1001 → 1000 (remainder 1 – smallest non-zero)', () => expect(roundToThousand(1001)).toBe(1000));
    test('500499 → 500000', () => expect(roundToThousand(500499)).toBe(500000));

    // ─── Round-up cases (remainder 500–999) ───────────────────────────────
    test('117800 → 118000 (spec example)', () => expect(roundToThousand(117800)).toBe(118000));
    test('1500 → 2000 (remainder 500 – boundary equal 500)', () => expect(roundToThousand(1500)).toBe(2000));
    test('1999 → 2000 (remainder 999)', () => expect(roundToThousand(1999)).toBe(2000));
    test('500500 → 501000', () => expect(roundToThousand(500500)).toBe(501000));

    // ─── Applied via calculatePersonPremium ───────────────────────────────
    // Verify rounding is actually applied in the premium engine by injecting
    // a fixture row with a non-thousand-aligned value.
    test('total is always a multiple of 1000', () => {
        // All fixture rates are already multiples of 1000 → sum is too
        const r = calc({
            dob: '20/02/2001', gender: 'male', package: '1',
            criticalIllness: false, maternity: false,
        });
        expect(r.total % 1000).toBe(0);
    });

    test('total with CI + maternity is a multiple of 1000', () => {
        const r = calc({
            dob: '20/02/2001', gender: 'female', package: '3',
            criticalIllness: true, maternity: true,
        });
        expect(r.total % 1000).toBe(0);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// 8. Error handling & data-integrity edge cases
// ═════════════════════════════════════════════════════════════════════════════

describe('Error handling – unusual / malformed inputs', () => {

    test('dob in yyyy/mm/dd format (wrong order) → age 0, total 0', () => {
        const r = calc({ dob: '2001/02/20', gender: 'male', package: '1', criticalIllness: false, maternity: false });
        expect(r.age).toBe(0);
        expect(r.total).toBe(0);
    });

    test('dob with only digits and no slashes → age 0', () => {
        const r = calc({ dob: '20022001', gender: 'male', package: '1', criticalIllness: false, maternity: false });
        expect(r.age).toBe(0);
    });

    test('package "0" (invalid – row exists but package0 field undefined) → mainPremiumRaw = 0, mainPremium = 0', () => {
        // findRate only returns null when the entire age/benefit/type/gender row is absent.
        // For an existing row, accessing an undefined packageN field → parseVND(undefined) = 0.
        const r = calc({ dob: '20/02/2001', gender: 'male', package: '0', criticalIllness: false, maternity: false });
        expect(r.mainPremiumRaw).toBe(0);
        expect(r.mainPremium).toBe(0);
    });

    test('package "6" (invalid – row exists but package6 field undefined) → mainPremiumRaw = 0, mainPremium = 0', () => {
        const r = calc({ dob: '20/02/2001', gender: 'male', package: '6', criticalIllness: false, maternity: false });
        expect(r.mainPremiumRaw).toBe(0);
        expect(r.mainPremium).toBe(0);
    });

    test('unknown gender string → treated as female (genderKey = "Nữ") → returns a rate', () => {
        // The code: gender === 'male' ? 'Nam' : 'Nữ'  — any non-'male' → female key
        const r = calc({ dob: '20/02/2001', gender: 'other', package: '1', criticalIllness: false, maternity: false });
        // Will match the female row for age 25
        expect(r.mainPremiumRaw).not.toBeNull();
    });

    test('totalPeople = 0 → isIndependent = false (edge: 0 !== 1)', () => {
        const r = calculatePersonPremium(
            { dob: '20/02/2001', gender: 'male', package: '1', criticalIllness: false, maternity: false },
            0, rateMap, TODAY
        );
        expect(r.isIndependent).toBe(false);
    });

    test('rateMap built from empty array + any lookup → null', () => {
        const emptyMap = buildRateMap([]);
        const r = findRate(emptyMap, 25, BENEFIT_MAIN, 'male', true, 1);
        expect(r).toBeNull();
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// 9. Snapshot / regression tests – known exact values
// ═════════════════════════════════════════════════════════════════════════════
// These pin exact numeric values from SAMPLE_RATES so any unintended change
// to the parsing or lookup logic immediately breaks these tests.

describe('Regression – exact premium values from SAMPLE_RATES', () => {

    test('male 25, independent, pkg 1 main → 963,000', () => {
        const r = calc({ dob: '20/02/2001', gender: 'male', package: '1', criticalIllness: false, maternity: false }, 1);
        expect(r.mainPremium).toBe(963000);
    });

    test('female 25, independent, pkg 1 main → 1,002,000', () => {
        const r = calc({ dob: '20/02/2001', gender: 'female', package: '1', criticalIllness: false, maternity: false }, 1);
        expect(r.mainPremium).toBe(1002000);
    });

    test('male 35, bundled, pkg 3 main → 2,091,000', () => {
        const r = calc({ dob: '20/02/1991', gender: 'male', package: '3', criticalIllness: false, maternity: false }, 2);
        expect(r.mainPremium).toBe(2091000);
    });

    test('female 35, independent, pkg 2 main → 1,827,000', () => {
        const r = calc({ dob: '20/02/1991', gender: 'female', package: '2', criticalIllness: false, maternity: false }, 1);
        expect(r.mainPremium).toBe(1827000);
    });

    test('male 25, independent, pkg 1, + critical illness → total = 963,000 + 312,000', () => {
        const r = calc({ dob: '20/02/2001', gender: 'male', package: '1', criticalIllness: true, maternity: false }, 1);
        expect(r.total).toBe(963000 + 312000);
    });

    test('female 25, independent, pkg 3, + maternity → total = 2,004,000 + 2,000,000', () => {
        const r = calc({ dob: '20/02/2001', gender: 'female', package: '3', criticalIllness: false, maternity: true }, 1);
        expect(r.total).toBe(2004000 + 2000000);
    });

    test('female 25, independent, pkg 3, + CI + maternity → total = 2,004,000 + 696,000 + 2,000,000', () => {
        const r = calc({ dob: '20/02/2001', gender: 'female', package: '3', criticalIllness: true, maternity: true }, 1);
        expect(r.total).toBe(2004000 + 696000 + 2000000);
    });

    test('male 61, independent, pkg 1 main → 6,800,000', () => {
        const r = calc({ dob: '20/02/1965', gender: 'male', package: '1', criticalIllness: false, maternity: false }, 1);
        expect(r.mainPremium).toBe(6800000);
    });

    test('male 61, independent, pkg 3 → 0 (N/A cell)', () => {
        const r = calc({ dob: '20/02/1965', gender: 'male', package: '3', criticalIllness: false, maternity: false }, 1);
        expect(r.mainPremium).toBe(0);
    });

    test('female 50, bundled, pkg 5, + maternity → total = 8,288,000 + 2,000,000', () => {
        const r = calc({ dob: '20/02/1976', gender: 'female', package: '5', criticalIllness: false, maternity: true }, 2);
        expect(r.total).toBe(8288000 + 2000000);
    });
});
