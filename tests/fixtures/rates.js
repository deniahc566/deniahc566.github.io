/**
 * tests/fixtures/rates.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Minimal, representative subset of PREMIUM_RATES used in unit tests.
 * Values are illustrative and structurally identical to the real dataset.
 *
 * Real data key:
 *   Map key = `${age}|${benefit}|${type}|${gender}`
 *
 * Benefits:
 *   - 'Quyền lợi chính + ngoại trú'  (main benefit – required)
 *   - 'Bệnh hiểm nghèo'              (critical illness – optional)
 *   - 'Chăm sóc Thai sản'            (maternity – fixed 2 000 000, handled in code)
 *
 * Types: 'Độc lập' (independent, 1 person), 'Mua kèm' (bundled, ≥2 people)
 * Genders: 'Nam' (male), 'Nữ' (female)
 * Packages: package1 … package5  (string VND or 'Không áp dụng')
 *
 * Age bands in the real data:
 *   1-3, 4-6, 7-9, 10-18, 19-30, 31-40, 41-50, 51-60, 61-65
 *   (no records for age 0 or age ≥ 66)
 */

'use strict';

// Helper to build a rates row quickly
function row(age, benefit, type, gender, p1, p2, p3, p4, p5) {
    return {
        gender,
        type,
        ageBand: `${age} tuổi`,   // illustrative – tests don't rely on this field
        benefit,
        age,
        package1: p1,
        package2: p2,
        package3: p3,
        package4: p4,
        package5: p5,
    };
}

const NA  = 'Không áp dụng';
const M   = 'Nam';
const F   = 'Nữ';
const IND = 'Độc lập';
const BUN = 'Mua kèm';
const MAIN = 'Tử vong, nội trú, ngoại trú';
const CRIT = 'Bệnh hiểm nghèo';

/**
 * SAMPLE_RATES – rows representative of every major scenario:
 *
 * Age 25  – young adult in prime coverage age (19-30 band)
 * Age 35  – mid-life (31-40 band)
 * Age 50  – oldest maternity-eligible age (41-50 band)
 * Age 18  – child/adolescent boundary (10-18 band)
 * Age 19  – youngest maternity-eligible age (19-30 band)
 * Age 51  – first age beyond maternity eligibility (51-60 band)
 * Age 61  – first age in 61-65 band
 * Age 65  – oldest in coverage range (61-65 band)
 * Age 1   – youngest covered (1-3 band)
 * Age 3   – edge of 1-3 band
 * Age 4   – edge of 4-6 band
 * Age 10  – edge of 10-18 band
 *
 * Age 66  – intentionally ABSENT (no coverage → null from findRate)
 * Age 0   – intentionally ABSENT (invalid → null from findRate)
 */
const SAMPLE_RATES = [

    // ─── Age 25 – young adult ─────────────────────────────────────────────
    row(25, MAIN, IND, M, '963,000',   '1,284,000',  '1,926,000',  '2,247,000',  '2,889,000'),
    row(25, MAIN, IND, F, '1,002,000', '1,336,000',  '2,004,000',  '2,338,000',  '3,006,000'),
    row(25, MAIN, BUN, M, '820,000',   '1,093,000',  '1,640,000',  '1,913,000',  '2,460,000'),
    row(25, MAIN, BUN, F, '853,000',   '1,137,000',  '1,705,000',  '1,989,000',  '2,558,000'),

    row(25, CRIT, IND, M, '312,000',   '416,000',    '624,000',    '728,000',    '936,000'),
    row(25, CRIT, IND, F, '348,000',   '464,000',    '696,000',    '812,000',    '1,044,000'),
    row(25, CRIT, BUN, M, '265,000',   '354,000',    '531,000',    '619,000',    '796,000'),
    row(25, CRIT, BUN, F, '296,000',   '394,000',    '592,000',    '691,000',    '888,000'),

    // ─── Age 35 – mid-life ────────────────────────────────────────────────
    row(35, MAIN, IND, M, '1,230,000', '1,640,000',  '2,460,000',  '2,870,000',  '3,690,000'),
    row(35, MAIN, IND, F, '1,370,000', '1,827,000',  '2,740,000',  '3,197,000',  '4,110,000'),
    row(35, MAIN, BUN, M, '1,046,000', '1,394,000',  '2,091,000',  '2,440,000',  '3,137,000'),
    row(35, MAIN, BUN, F, '1,165,000', '1,553,000',  '2,329,000',  '2,718,000',  '3,494,000'),

    row(35, CRIT, IND, M, '423,000',   '564,000',    '846,000',    '987,000',    '1,269,000'),
    row(35, CRIT, IND, F, '498,000',   '664,000',    '996,000',    '1,162,000',  '1,494,000'),
    row(35, CRIT, BUN, M, '360,000',   '480,000',    '720,000',    '840,000',    '1,080,000'),
    row(35, CRIT, BUN, F, '423,000',   '564,000',    '846,000',    '987,000',    '1,269,000'),

    // ─── Age 50 – upper maternity boundary (41-50 band) ──────────────────
    row(50, MAIN, IND, M, '2,980,000', '3,973,000',  '5,960,000',  '6,953,000',  '8,940,000'),
    row(50, MAIN, IND, F, '3,250,000', '4,333,000',  '6,500,000',  '7,583,000',  '9,750,000'),
    row(50, MAIN, BUN, M, '2,533,000', '3,377,000',  '5,066,000',  '5,910,000',  '7,599,000'),
    row(50, MAIN, BUN, F, '2,763,000', '3,683,000',  '5,525,000',  '6,446,000',  '8,288,000'),

    row(50, CRIT, IND, M, '1,100,000', '1,467,000',  '2,200,000',  '2,567,000',  '3,300,000'),
    row(50, CRIT, IND, F, '1,320,000', '1,760,000',  '2,640,000',  '3,080,000',  '3,960,000'),
    row(50, CRIT, BUN, M, '935,000',   '1,247,000',  '1,870,000',  '2,182,000',  '2,805,000'),
    row(50, CRIT, BUN, F, '1,122,000', '1,496,000',  '2,244,000',  '2,618,000',  '3,366,000'),

    // ─── Age 18 – oldest child boundary (10-18 band) ─────────────────────
    row(18, MAIN, IND, M, '645,000',   '860,000',    '1,290,000',  '1,505,000',  '1,935,000'),
    row(18, MAIN, IND, F, '660,000',   '880,000',    '1,320,000',  '1,540,000',  '1,980,000'),
    row(18, MAIN, BUN, M, '549,000',   '732,000',    '1,098,000',  '1,280,000',  '1,645,000'),
    row(18, MAIN, BUN, F, '561,000',   '748,000',    '1,122,000',  '1,309,000',  '1,683,000'),

    row(18, CRIT, IND, M, '195,000',   '260,000',    '390,000',    '455,000',    '585,000'),
    row(18, CRIT, IND, F, '200,000',   '267,000',    '400,000',    '467,000',    '600,000'),
    row(18, CRIT, BUN, M, '166,000',   '221,000',    '332,000',    '387,000',    '497,000'),
    row(18, CRIT, BUN, F, '170,000',   '227,000',    '340,000',    '397,000',    '510,000'),

    // ─── Age 19 – youngest maternity eligible (19-30 band) ───────────────
    row(19, MAIN, IND, M, '820,000',   '1,093,000',  '1,640,000',  '1,913,000',  '2,460,000'),
    row(19, MAIN, IND, F, '853,000',   '1,137,000',  '1,705,000',  '1,989,000',  '2,558,000'),
    row(19, MAIN, BUN, M, '697,000',   '929,000',    '1,394,000',  '1,626,000',  '2,091,000'),
    row(19, MAIN, BUN, F, '725,000',   '966,000',    '1,449,000',  '1,691,000',  '2,175,000'),

    row(19, CRIT, IND, M, '265,000',   '354,000',    '531,000',    '619,000',    '796,000'),
    row(19, CRIT, IND, F, '296,000',   '394,000',    '592,000',    '691,000',    '888,000'),
    row(19, CRIT, BUN, M, '225,000',   '300,000',    '451,000',    '526,000',    '677,000'),
    row(19, CRIT, BUN, F, '252,000',   '335,000',    '503,000',    '587,000',    '755,000'),

    // ─── Age 51 – beyond maternity, still covered (51-60 band) ───────────
    row(51, MAIN, IND, M, '3,500,000', '4,667,000',  '7,000,000',  '8,167,000',  '10,500,000'),
    row(51, MAIN, IND, F, '3,800,000', '5,067,000',  '7,600,000',  '8,867,000',  '11,400,000'),
    row(51, MAIN, BUN, M, '2,975,000', '3,967,000',  '5,950,000',  '6,942,000',  '8,925,000'),
    row(51, MAIN, BUN, F, '3,230,000', '4,307,000',  '6,460,000',  '7,537,000',  '9,690,000'),

    row(51, CRIT, IND, M, '1,350,000', '1,800,000',  '2,700,000',  '3,150,000',  '4,050,000'),
    row(51, CRIT, IND, F, '1,620,000', '2,160,000',  '3,240,000',  '3,780,000',  '4,860,000'),
    row(51, CRIT, BUN, M, '1,148,000', '1,530,000',  '2,295,000',  '2,678,000',  '3,443,000'),
    row(51, CRIT, BUN, F, '1,377,000', '1,836,000',  '2,754,000',  '3,213,000',  '4,131,000'),

    // ─── Age 61 – oldest band starts (61-65 band) ────────────────────────
    row(61, MAIN, IND, M, '6,800,000', '9,067,000',  NA,           NA,           NA),
    row(61, MAIN, IND, F, '7,200,000', '9,600,000',  NA,           NA,           NA),
    row(61, MAIN, BUN, M, '5,780,000', '7,707,000',  NA,           NA,           NA),
    row(61, MAIN, BUN, F, '6,120,000', '8,160,000',  NA,           NA,           NA),

    row(61, CRIT, IND, M, NA,          NA,           NA,           NA,           NA),
    row(61, CRIT, IND, F, NA,          NA,           NA,           NA,           NA),
    row(61, CRIT, BUN, M, NA,          NA,           NA,           NA,           NA),
    row(61, CRIT, BUN, F, NA,          NA,           NA,           NA,           NA),

    // ─── Age 65 – last covered age (61-65 band) ──────────────────────────
    row(65, MAIN, IND, M, '8,500,000', '11,333,000', NA,           NA,           NA),
    row(65, MAIN, IND, F, '9,000,000', '12,000,000', NA,           NA,           NA),
    row(65, MAIN, BUN, M, '7,225,000', '9,633,000',  NA,           NA,           NA),
    row(65, MAIN, BUN, F, '7,650,000', '10,200,000', NA,           NA,           NA),

    row(65, CRIT, IND, M, NA,          NA,           NA,           NA,           NA),
    row(65, CRIT, IND, F, NA,          NA,           NA,           NA,           NA),
    row(65, CRIT, BUN, M, NA,          NA,           NA,           NA,           NA),
    row(65, CRIT, BUN, F, NA,          NA,           NA,           NA,           NA),

    // ─── Age 1 – youngest covered (1-3 band) ─────────────────────────────
    row(1,  MAIN, IND, M, '450,000',   '600,000',    '900,000',    '1,050,000',  '1,350,000'),
    row(1,  MAIN, IND, F, '450,000',   '600,000',    '900,000',    '1,050,000',  '1,350,000'),
    row(1,  MAIN, BUN, M, '383,000',   '510,000',    '765,000',    '893,000',    '1,148,000'),
    row(1,  MAIN, BUN, F, '383,000',   '510,000',    '765,000',    '893,000',    '1,148,000'),

    row(1,  CRIT, IND, M, '120,000',   '160,000',    '240,000',    '280,000',    '360,000'),
    row(1,  CRIT, IND, F, '120,000',   '160,000',    '240,000',    '280,000',    '360,000'),
    row(1,  CRIT, BUN, M, '102,000',   '136,000',    '204,000',    '238,000',    '306,000'),
    row(1,  CRIT, BUN, F, '102,000',   '136,000',    '204,000',    '238,000',    '306,000'),

    // ─── Age 10 – band boundary (10-18 band) ─────────────────────────────
    row(10, MAIN, IND, M, '570,000',   '760,000',    '1,140,000',  '1,330,000',  '1,710,000'),
    row(10, MAIN, IND, F, '580,000',   '773,000',    '1,160,000',  '1,353,000',  '1,740,000'),
    row(10, MAIN, BUN, M, '485,000',   '646,000',    '969,000',    '1,131,000',  '1,454,000'),
    row(10, MAIN, BUN, F, '493,000',   '657,000',    '986,000',    '1,150,000',  '1,479,000'),

    // NOTE: Age 66 and Age 0 are intentionally omitted → findRate returns null
];

module.exports = { SAMPLE_RATES };
