/**
 * premium-functions.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Extracted / re-exported pure functions from index.html so they can be
 * tested independently with Jest (Node.js) without a browser.
 *
 * How to use:
 *   1. npm init -y  (inside the project root)
 *   2. npm install --save-dev jest
 *   3. npx jest tests/
 *
 * NOTE: PREMIUM_RATES is imported from the fixture file (tests/fixtures/rates.js).
 *       A minimal subset of real rates is kept there so tests don't rely on the
 *       full 578-record dataset embedded in index.html.
 */

'use strict';

// ─── Date helpers ────────────────────────────────────────────────────────────

function parseDDMMYYYY(str) {
    if (!str || str.length !== 10) return null;
    const parts = str.split('/');
    if (parts.length !== 3) return null;
    const day   = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year  = parseInt(parts[2], 10);
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900) return null;
    const date = new Date(year, month - 1, day);
    if (
        date.getFullYear() !== year ||
        date.getMonth()    !== month - 1 ||
        date.getDate()     !== day
    ) return null;
    return date;
}

/**
 * calculateAge(dob, today?)
 * ─────────────────────────
 * Insurance rounding rule: if the person is NOT on their exact birthday today,
 * add 1 to the natural age.  This makes the calculation deterministic in tests
 * by accepting an optional `today` Date parameter (defaults to `new Date()`).
 */
function calculateAge(dob, today = new Date()) {
    const birthDate = parseDDMMYYYY(dob);
    if (!birthDate) return 0;

    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    const dayDiff   = today.getDate()  - birthDate.getDate();

    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
        age--;
    }

    const isExactBirthday = (monthDiff % 12 === 0) && dayDiff === 0;
    if (!isExactBirthday) {
        age++;
    }

    return age;
}

// ─── Rate helpers ─────────────────────────────────────────────────────────────

function parseVND(vndString) {
    if (!vndString || vndString === 'Không áp dụng') return 0;
    return parseInt(vndString.replace(/,/g, ''), 10);
}

function formatVND(amount) {
    return new Intl.NumberFormat('vi-VN').format(amount);
}

function roundToThousand(amount) {
    return Math.round(amount / 1000) * 1000;
}

/**
 * buildRateMap(PREMIUM_RATES)
 * Build the O(1) lookup map from a rates array.
 */
function buildRateMap(PREMIUM_RATES) {
    const map = new Map();
    for (const r of PREMIUM_RATES) {
        map.set(`${r.age}|${r.benefit}|${r.type}|${r.gender}`, r);
    }
    return map;
}

function findRate(rateMap, age, benefit, gender, isIndependent, packageNum) {
    const type      = isIndependent ? 'Độc lập' : 'Mua kèm';
    const genderKey = gender === 'male' ? 'Nam' : 'Nữ';
    const rate      = rateMap.get(`${age}|${benefit}|${type}|${genderKey}`);
    if (!rate) return null;
    return parseVND(rate[`package${packageNum}`]);
}

// ─── Premium calculation ──────────────────────────────────────────────────────

const MATERNITY_PREMIUM   = 2_000_000;
const MATERNITY_MIN_AGE   = 19;
const MATERNITY_MAX_AGE   = 50;
const MATERNITY_MIN_PKG   = 3;

const BENEFIT_MAIN        = 'Tử vong, nội trú, ngoại trú';
const BENEFIT_CRITICAL    = 'Bệnh hiểm nghèo';

/**
 * calculatePersonPremium(personData, totalPeople, rateMap, today?)
 *
 * Accepts an optional `today` parameter so tests can fix the reference date.
 */
function calculatePersonPremium(personData, totalPeople, rateMap, today = new Date()) {
    const age          = calculateAge(personData.dob, today);
    const isIndependent = totalPeople === 1 || personData.forceIndependent === true;
    const packageNum   = parseInt(personData.package, 10);

    const mainPremiumRaw = findRate(rateMap, age, BENEFIT_MAIN, personData.gender, isIndependent, packageNum);
    const mainPremium    = mainPremiumRaw ?? 0;

    const criticalIllnessPremiumRaw = personData.criticalIllness
        ? findRate(rateMap, age, BENEFIT_CRITICAL, personData.gender, isIndependent, packageNum)
        : 0;
    const criticalIllnessPremium = criticalIllnessPremiumRaw ?? 0;

    let maternityPremium = 0;
    if (
        personData.maternity    &&
        personData.gender === 'female' &&
        age >= MATERNITY_MIN_AGE &&
        age <= MATERNITY_MAX_AGE &&
        packageNum >= MATERNITY_MIN_PKG
    ) {
        maternityPremium = MATERNITY_PREMIUM;
    }

    const total = roundToThousand(mainPremium + criticalIllnessPremium + maternityPremium);

    return {
        age,
        isIndependent,
        mainPremiumRaw,
        mainPremium,
        criticalIllnessPremiumRaw,
        criticalIllnessPremium,
        maternityPremium,
        total,
        packageName: `Lựa chọn ${packageNum}`,
    };
}

/**
 * shouldForceIndependent(dob, relationship, groupCtx, totalPeople, today?)
 * Pure logic — no DOM dependency.
 * groupCtx: { hasAnchor: bool, maxAnchorPackage: int }
 */
function shouldForceIndependent(dob, relationship, groupCtx, totalPeople, today = new Date()) {
    if (totalPeople <= 1) return false;
    const age = calculateAge(dob, today);
    if (age >= 7) return false;
    if (relationship !== 'child') return true;
    return !groupCtx.hasAnchor;
}

module.exports = {
    parseDDMMYYYY,
    calculateAge,
    parseVND,
    formatVND,
    roundToThousand,
    buildRateMap,
    findRate,
    calculatePersonPremium,
    shouldForceIndependent,
    MATERNITY_PREMIUM,
    MATERNITY_MIN_AGE,
    MATERNITY_MAX_AGE,
    MATERNITY_MIN_PKG,
    BENEFIT_MAIN,
    BENEFIT_CRITICAL,
};
