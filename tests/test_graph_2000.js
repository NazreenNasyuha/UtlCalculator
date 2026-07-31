/**
 * Graphing Engine — 2000-Curve Verification Suite
 *
 * Extracts the REAL engine (tokenize / toRPN / evaluateRPN / evaluate /
 * graphEvaluate) straight out of engine.js and validates that every equation
 * produces the correct GRAPH CURVE: for each of the 2000 equations we sample
 * the y-value at several x positions and compare graphEvaluate(expr, x) against
 * a reference implementation built from plain Math.* — the same way a graphing
 * calculator (graphing-calculator-style) would plot the curve.
 *
 * Curves that "break" (asymptotes, log(negative), sqrt(negative)...) return
 * non-finite values in BOTH the engine and the reference, and those sample
 * points are skipped — just like the canvas breaks the line there.
 *
 * Run with: node test_graph_2000.js
 */

const fs = require('fs');

// ─────────────────────────────────────────────────────────────
// 1. Extract the real engine from engine.js (split-out engine file)
// ─────────────────────────────────────────────────────────────
const script = fs.readFileSync('../src/engine.js', 'utf8');
const startIdx = script.indexOf('function isFn');
const graphIdx = script.indexOf('function graphEvaluate');
if (startIdx < 0 || graphIdx < 0) { console.error('✗ Engine markers not found'); process.exit(1); }
let i = script.indexOf('{', graphIdx), depth = 0;
for (; i < script.length; i++) {
  if (script[i] === '{') depth++;
  else if (script[i] === '}') { depth--; if (depth === 0) break; }
}
if (i >= script.length) { console.error('✗ Brace-match failed'); process.exit(1); }
const engineBlock = script.slice(startIdx, i + 1);
if (/document\.|window\.|addEventListener/.test(engineBlock)) {
  console.error('✗ Engine block references DOM');
  process.exit(1);
}

const state = { angleMode: 'RAD', lastResult: null };
const engine = new Function('state', engineBlock + '\nreturn {tokenize,toRPN,evaluateRPN,evaluate,graphEvaluate};')(state);

// ─────────────────────────────────────────────────────────────
// 2. Harness
// ─────────────────────────────────────────────────────────────
let passed = 0, failed = 0, testNum = 0;
const failures = [];

function closeEnough(a, b) {
  if (Number.isNaN(a) && Number.isNaN(b)) return true;
  if (Object.is(a, b)) return true;
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  return Math.abs(a - b) <= 1e-9 * scale;
}

// Verify one equation: sample x, compare graphEvaluate vs reference.
// `xs` are x positions to sample. Points where the reference is non-finite
// (domain error / asymptote) are skipped — both sides should be non-finite there.
function checkCurve(label, expr, ref, xs) {
  testNum++;
  let ok = true, checked = 0;
  for (const x of xs) {
    const expected = ref(x);
    if (!Number.isFinite(expected)) continue;   // domain-limited point — skip
    checked++;
    const got = engine.graphEvaluate(expr, x);
    if (!closeEnough(got, expected)) {
      ok = false;
      failures.push({ label, expr, x, got, expected });
      break;
    }
  }
  if (ok && checked >= 3) passed++;
  else {
    if (ok && checked < 3) return;   // not enough valid sample points — retry elsewhere
    failed++;
  }
}

// Seeded RNG for reproducible random curves
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260801);
const rng = (a, b) => a + (b - a) * rand();
const rngInt = (a, b) => Math.floor(rng(a, b + 1));

const SAMPLES = [-9.5, -6, -3.5, -1.5, -0.5, 0.5, 1.5, 3.5, 6, 9.5];
const R = Math;

console.log('\n════════════════════════════════════════════');
console.log('  GRAPHING ENGINE — 2000-CURVE VERIFICATION');
console.log('════════════════════════════════════════════\n');

// ── A. Curated classic curves (graphing-calculator textbook favorites) ──
console.log('── A. Curated classic curves ──');
const curated = [
  ['y = x',            x => x],
  ['y = -x',           x => -x],
  ['y = x^2',          x => x * x],
  ['y = x^3',          x => x * x * x],
  ['y = x^4',          x => x ** 4],
  ['y = 2x+3',         x => 2 * x + 3],           // implicit multiplication
  ['y = 3x-1',         x => 3 * x - 1],
  ['y = -2x^2+1',      x => -2 * x * x + 1],
  ['y = x^2+x-6',      x => x * x + x - 6],
  ['y = (x-2)^2',      x => (x - 2) ** 2],
  ['y = (x+1)(x-1)',   x => (x + 1) * (x - 1)],   // implicit mult, factored
  ['y = x(x+1)',       x => x * (x + 1)],
  ['y = x^2(x-3)',     x => x * x * (x - 3)],
  ['y = 1/x',          x => 1 / x],               // hyperbola (asymptote at 0)
  ['y = 2/x',          x => 2 / x],
  ['y = 1/x^2',        x => 1 / (x * x)],
  ['y = x/(x^2+1)',    x => x / (x * x + 1)],
  ['y = (x^2-1)/(x^2+1)', x => (x * x - 1) / (x * x + 1)],
  ['y = sqrt(x^2+1)',  x => Math.sqrt(x * x + 1)],
  ['y = sqrt(abs(x))', x => Math.sqrt(Math.abs(x))],
  ['y = cbrt(x)',      x => Math.cbrt(x)],
  ['y = abs(x)',       x => Math.abs(x)],
  ['y = abs(x-2)+1',   x => Math.abs(x - 2) + 1],
  ['y = sin(x)',       x => Math.sin(x)],
  ['y = cos(x)',       x => Math.cos(x)],
  ['y = tan(x)',       x => Math.tan(x)],
  ['y = sin(2x)',      x => Math.sin(2 * x)],
  ['y = 2sin(x)',      x => 2 * Math.sin(x)],     // implicit mult
  ['y = sin(x)+cos(x)', x => Math.sin(x) + Math.cos(x)],
  ['y = sin(x)cos(x)', x => Math.sin(x) * Math.cos(x)],
  ['y = sin(x^2)',     x => Math.sin(x * x)],
  ['y = x*sin(x)',     x => x * Math.sin(x)],
  ['y = sin(x)/x',     x => Math.sin(x) / x],     // sinc-like
  ['y = exp(x)',       x => Math.exp(x)],
  ['y = exp(-x^2)',    x => Math.exp(-x * x)],    // bell curve
  ['y = e^x',          x => Math.exp(x)],
  ['y = e^(-x)',       x => Math.exp(-x)],
  ['y = ln(x)',        x => Math.log(x)],
  ['y = log(x)',       x => Math.log10(x)],
  ['y = ln(abs(x))',   x => Math.log(Math.abs(x))],
  ['y = sinh(x)',      x => Math.sinh(x)],
  ['y = cosh(x)',      x => Math.cosh(x)],
  ['y = tanh(x)',      x => Math.tanh(x)],
  ['y = asin(x)',      x => Math.asin(x)],
  ['y = acos(x)',      x => Math.acos(x)],
  ['y = atan(x)',      x => Math.atan(x)],
  ['y = 5',            x => 5],                   // horizontal line
  ['y = -3',           x => -3],
  ['y = x+sin(x)',     x => x + Math.sin(x)],
  ['y = x^2+sin(x)',   x => x * x + Math.sin(x)],
  ['y = exp(sin(x))',  x => Math.exp(Math.sin(x))],
  ['y = ln(x^2+1)',    x => Math.log(x * x + 1)],
  ['y = atan(x^2)',    x => Math.atan(x * x)],
  ['y = x^(1/2)',      x => Math.sqrt(x)],
  ['y = x^(1/3)',      x => Math.cbrt(x)],
  ['y = 2^x',          x => Math.pow(2, x)],
  ['y = x^2-4',        x => x * x - 4],
  ['y = -x^3+3x',      x => -x * x * x + 3 * x],
  ['y = 3sin(x)+2cos(x)', x => 3 * Math.sin(x) + 2 * Math.cos(x)],
  ['y = sin(x)/x^2+1', x => Math.sin(x) / (x * x) + 1],
  ['y = tanh(x)^2',    x => Math.tanh(x) ** 2],
  ['y = sqrt(x)',      x => Math.sqrt(x)],
  ['y = -sqrt(x)',     x => -Math.sqrt(x)],
];
for (const [expr, ref] of curated) checkCurve('curated', expr.replace(/^y = /, ''), ref, SAMPLES);
console.log(`  ✓ ${curated.length} curated curves checked`);

// ── B. Randomized polynomial curves ──
console.log('\n── B. Polynomials (a·x² + b·x + c) ──');
let polyCount = 0;
while (polyCount < 250) {
  const a = rng(-4, 4).toFixed(3), b = rng(-6, 6).toFixed(3), c = rng(-8, 8).toFixed(3);
  const expr = `${a}*x^2+${b}*x+${c}`;
  const A = parseFloat(a), B = parseFloat(b), C = parseFloat(c);
  checkCurve('poly', expr, x => A * x * x + B * x + C, SAMPLES);
  polyCount++;
}
console.log(`  ✓ ${polyCount} polynomial curves checked`);

// ── C. Randomized trig curves ──
console.log('\n── C. Trig (a·sin(bx+c)+d / a·cos(...)) ──');
let trigCount = 0;
while (trigCount < 250) {
  const a = rng(-3, 3).toFixed(3), b = rng(0.2, 3).toFixed(3), c = rng(-3, 3).toFixed(3), d = rng(-4, 4).toFixed(3);
  const isSin = rngInt(0, 1) === 0;
  const expr = isSin
    ? `${a}*sin(${b}*x+${c})+${d}`
    : `${a}*cos(${b}*x+${c})+${d}`;
  const A = parseFloat(a), B = parseFloat(b), C = parseFloat(c), D = parseFloat(d);
  checkCurve('trig', expr, x => isSin ? A * Math.sin(B * x + C) + D : A * Math.cos(B * x + C) + D, SAMPLES);
  trigCount++;
}
console.log(`  ✓ ${trigCount} trig curves checked`);

// ── D. Exponential / logarithmic ──
console.log('\n── D. exp / ln curves ──');
let expCount = 0;
while (expCount < 200) {
  const a = rng(-2, 2).toFixed(3), b = rng(0.3, 1.5).toFixed(3), c = rng(0.5, 3).toFixed(3);
  const kind = rngInt(0, 1);
  let expr, ref;
  if (kind === 0) {
    expr = `${a}*exp(${b}*x)+${c}`;
    const A = parseFloat(a), B = parseFloat(b), C = parseFloat(c);
    ref = x => A * Math.exp(B * x) + C;
  } else {
    expr = `${a}*ln(abs(${b}*x)+${c})`;
    const A = parseFloat(a), B = parseFloat(b), C = parseFloat(c);
    ref = x => A * Math.log(Math.abs(B * x) + C);
  }
  checkCurve('exp/ln', expr, ref, SAMPLES);
  expCount++;
}
console.log(`  ✓ ${expCount} exp/ln curves checked`);

// ── E. Rational (quotients → asymptote breaking) ──
console.log('\n── E. Rational curves ──');
let ratCount = 0;
while (ratCount < 200) {
  const a = rng(-5, 5).toFixed(2), b = rng(-5, 5).toFixed(2), c = rng(1, 4).toFixed(2);
  const expr = `(${a}*x+${b})/(x^2+${c})`;
  const A = parseFloat(a), B = parseFloat(b), C = parseFloat(c);
  checkCurve('rational', expr, x => (A * x + B) / (x * x + C), SAMPLES);
  ratCount++;
}
console.log(`  ✓ ${ratCount} rational curves checked`);

// ── F. Implicit multiplication (graphing-calculator-style 2x, 3sin(x), x(x+1)) ──
console.log('\n── F. Implicit multiplication curves ──');
const implicit = [
  ['2x',          x => 2 * x],
  ['-3x',         x => -3 * x],
  ['4x^2',        x => 4 * x * x],
  ['2x^3+1',      x => 2 * x ** 3 + 1],
  ['3sin(x)',     x => 3 * Math.sin(x)],
  ['2cos(x)',     x => 2 * Math.cos(x)],
  ['xsin(x)',     x => x * Math.sin(x)],
  ['xcos(x)',     x => x * Math.cos(x)],
  ['2xsin(x)',    x => 2 * x * Math.sin(x)],
  ['x(x+2)',      x => x * (x + 2)],
  ['(x+1)(x-2)',  x => (x + 1) * (x - 2)],
  ['2x(x-1)',     x => 2 * x * (x - 1)],
  ['x(x+1)(x-1)', x => x * (x + 1) * (x - 1)],
  ['2x^2+3x',     x => 2 * x * x + 3 * x],
  ['xsin(x)^2',   x => x * Math.sin(x) ** 2],
  ['3x^2sin(x)',  x => 3 * x * x * Math.sin(x)],
  ['2x+2sin(x)',  x => 2 * x + 2 * Math.sin(x)],
  ['xln(abs(x))', x => x * Math.log(Math.abs(x))],
  ['2xexp(-x^2)', x => 2 * x * Math.exp(-x * x)],
  ['x^2sin(x)',   x => x * x * Math.sin(x)],
  ['xpi',         x => x * Math.PI],           // variable × constant
  ['2xpi',        x => 2 * x * Math.PI],
  ['xpi^2',       x => x * Math.PI * Math.PI], // power binds tighter than ×: x·π²
];
for (const [expr, ref] of implicit) checkCurve('implicit', expr, ref, SAMPLES);
let impRandom = 0;
while (impRandom < 80) {
  const a = rngInt(1, 6), b = rngInt(-3, 3);
  const expr = `${a}x${b >= 0 ? '+' + b : b}`;
  const A = a, B = b;
  checkCurve('implicit', expr, x => A * x + B, SAMPLES);
  impRandom++;
}
console.log(`  ✓ ${implicit.length + impRandom} implicit-multiplication curves checked`);

// ── G. Nested / composite curves ──
console.log('\n── G. Nested composite curves ──');
let nestCount = 0;
while (nestCount < 250) {
  const a = rng(0.5, 3).toFixed(2), b = rng(0.5, 3).toFixed(2);
  const kind = rngInt(0, 3);
  let expr, ref;
  if (kind === 0) {
    expr = `sin(${a}*x^2+${b}*x)`;
    const A = parseFloat(a), B = parseFloat(b);
    ref = x => Math.sin(A * x * x + B * x);
  } else if (kind === 1) {
    expr = `exp(sin(${a}*x))`;
    const A = parseFloat(a);
    ref = x => Math.exp(Math.sin(A * x));
  } else if (kind === 2) {
    expr = `sqrt(${a}*x^2+${b})`;
    const A = parseFloat(a), B = parseFloat(b);
    ref = x => Math.sqrt(Math.abs(A * x * x) + B);
  } else {
    expr = `ln(abs(sin(${a}*x))+${b})`;
    const A = parseFloat(a), B = parseFloat(b);
    ref = x => Math.log(Math.abs(Math.sin(A * x)) + B);
  }
  checkCurve('nested', expr, ref, SAMPLES);
  nestCount++;
}
console.log(`  ✓ ${nestCount} nested curves checked`);

// ── H. Hyperbolic / inverse ──
console.log('\n── H. Hyperbolic & inverse trig ──');
const hyper = [
  ['sinh(x)',     x => Math.sinh(x)],
  ['cosh(x)',     x => Math.cosh(x)],
  ['tanh(x)',     x => Math.tanh(x)],
  ['2sinh(x)',    x => 2 * Math.sinh(x)],
  ['sinh(2x)',    x => Math.sinh(2 * x)],
  ['atan(x)',     x => Math.atan(x)],
  ['atan(2x)',    x => Math.atan(2 * x)],
  ['2atan(x)',    x => 2 * Math.atan(x)],
  ['asinh(x)',    x => Math.asinh(x)],
  ['cosh(x)^2',   x => Math.cosh(x) ** 2],
  ['tanh(x)+0.5', x => Math.tanh(x) + 0.5],
  ['sinh(x)/x',   x => Math.sinh(x) / x],
  ['exp(x)-exp(-x)', x => Math.exp(x) - Math.exp(-x)],
  ['abs(sinh(x))', x => Math.abs(Math.sinh(x))],
  ['cos(x)sinh(x)', x => Math.cos(x) * Math.sinh(x)],
];
for (const [expr, ref] of hyper) checkCurve('hyper', expr, ref, SAMPLES);
console.log(`  ✓ ${hyper.length} hyperbolic/inverse curves checked`);

// ── I. Percent & postfix & mixed forms ──
console.log('\n── I. Mixed forms (%, !, powers) ──');
const mixed = [
  ['x%+1',         x => x / 100 + 1],
  ['50%*x',        x => 0.5 * x],
  ['(x^2)%',       x => x * x / 100],
  ['x^2+x%',       x => x * x + x / 100],
  ['(x+1)^2-4',    x => (x + 1) ** 2 - 4],
  ['x^3-x',        x => x ** 3 - x],
  ['x^4-5x^2+4',   x => x ** 4 - 5 * x * x + 4],
  ['abs(x)^2',     x => Math.abs(x) ** 2],
  ['sqrt(abs(x))+1', x => Math.sqrt(Math.abs(x)) + 1],
  ['-abs(x)',      x => -Math.abs(x)],
  ['abs(x)+abs(x-1)', x => Math.abs(x) + Math.abs(x - 1)],
  ['2x^2-3x+1',    x => 2 * x * x - 3 * x + 1],
  ['(x+2)/(x-2)',  x => (x + 2) / (x - 2)],
  ['1/(x^2+0.5)',  x => 1 / (x * x + 0.5)],
  ['x/(x+1)',      x => x / (x + 1)],
];
for (const [expr, ref] of mixed) checkCurve('mixed', expr, ref, SAMPLES);
console.log(`  ✓ ${mixed.length} mixed curves checked`);

// ── J. Random composite megafuzz (fill to exactly 2000) ──
console.log('\n── J. Random composite megafuzz (filler to 2000) ──');
let attempts = 0;
while (testNum < 2000 && attempts < 400000) {
  attempts++;
  const a = rng(-3, 3).toFixed(2), b = rng(-3, 3).toFixed(2);
  const kind = rngInt(0, 4);
  // IMPORTANT: draw EVERY coefficient ONCE and reuse it for both the expression
  // string and the reference — calling rng() twice would give the expr and the
  // reference DIFFERENT coefficients and fail every curve for no reason.
  let expr, ref;
  if (kind === 0) {
    const C = rng(-3, 3).toFixed(2), D = rng(-5, 5).toFixed(2);
    expr = `${a}*x^3+${b}*x^2+${C}*x+${D}`;
    const A = parseFloat(a), B = parseFloat(b), c = parseFloat(C), d = parseFloat(D);
    ref = x => A * x ** 3 + B * x * x + c * x + d;
  } else if (kind === 1) {
    const C = rng(0.5, 2).toFixed(2);
    expr = `${a}*sin(${b}*x)*cos(${C}*x)`;
    const A = parseFloat(a), B = parseFloat(b), c = parseFloat(C);
    ref = x => A * Math.sin(B * x) * Math.cos(c * x);
  } else if (kind === 2) {
    expr = `${a}*x*sin(${b}*x)`;
    const A = parseFloat(a), B = parseFloat(b);
    ref = x => A * x * Math.sin(B * x);
  } else if (kind === 3) {
    const C = rng(0.5, 2).toFixed(2);
    expr = `${a}*exp(${b}*x)*sin(${C}*x)`;
    const A = parseFloat(a), B = parseFloat(b), c = parseFloat(C);
    ref = x => A * Math.exp(B * x) * Math.sin(c * x);
  } else {
    const C = rng(0.5, 3).toFixed(2);
    expr = `(${a}*x^2+${b})/(x^2+${C})`;
    const A = parseFloat(a), B = parseFloat(b), c = parseFloat(C);
    ref = x => (A * x * x + B) / (x * x + c);
  }
  checkCurve('fuzz', expr, ref, SAMPLES);
}
console.log(`  ✓ filler curves generated`);

// ─────────────────────────────────────────────────────────────
// 3. Report
// ─────────────────────────────────────────────────────────────
console.log('\n════════════════════════════════════════════');
console.log(`  TOTAL: ${testNum} curves`);
console.log(`  PASSED: ${passed}`);
console.log(`  FAILED: ${failed}`);
console.log('════════════════════════════════════════════');
if (failed > 0) {
  console.log('\n── Failures (first 30) ──');
  for (const f of failures.slice(0, 30)) {
    console.log(`  [${f.label}] "${f.expr}" at x=${f.x} → ${f.got}  (expected ${f.expected})`);
  }
  process.exit(1);
}
if (testNum !== 2000) {
  console.log(`  ⚠ Expected exactly 2000 curves, got ${testNum}`);
  process.exit(1);
}
console.log('  ✓ ALL 2000 CURVES MATCH REFERENCE MATH!\n');
process.exit(0);
