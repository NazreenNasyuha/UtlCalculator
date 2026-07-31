/**
 * Engine Fixes — Targeted Unit Tests
 *
 * Verifies the graphing-engine fixes added to engine.js:
 *
 *   A. IDENTIFIER SPLITTING  — letter-greedy names are split into
 *      variable × function / constant products, like a graphing calculator:
 *        xsin(x)  = x·sin(x)      xln(abs(x))  = x·ln(|x|)
 *        2xexp(-x^2) = 2·x·exp(-x²)      xpi = x·π       xpi^2 = x·π²
 *   B. REAL NTH ROOTS — negative base with 1/(odd integer) exponent:
 *        (-8)^(1/3) = -2  (not NaN), while x^(1/2) stays NaN for x<0.
 *   C. θ (theta) VARIABLES — the tokenizer accepts 'θ' and 'theta' as the
 *      same variable so polar curves (r = 2cos(θ)) can be evaluated.
 *   D. REGRESSION GUARDS — constants (pi, e, ans), scientific notation (2e3)
 *      and multi-letter functions (sinh, asinh, stdevp, nCr) are untouched.
 *
 * Run with: node test_engine_fixes.js
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
let passed = 0, failed = 0;
const failures = [];
const PI = Math.PI, E = Math.E;

function closeEnough(a, b) {
  if (Number.isNaN(a) && Number.isNaN(b)) return true;
  if (Object.is(a, b)) return true;
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  return Math.abs(a - b) <= 1e-9 * scale;
}

function check(label, got, expected) {
  if (closeEnough(got, expected)) passed++;
  else { failed++; failures.push({ label, got, expected }); }
}

function section(title) {
  console.log(`\n── ${title} ──`);
}

// ─────────────────────────────────────────────────────────────
// A. Identifier splitting (variable × function / constant)
// ─────────────────────────────────────────────────────────────
section('A. Identifier splitting (xsin → x·sin, xpi → x·π)');
for (const x of [-9.5, -2, -0.5, 0.5, 1.5, 9.5]) {
  check(`xsin(x) at x=${x}`, engine.graphEvaluate('xsin(x)', x), x * Math.sin(x));
  check(`xcos(x) at x=${x}`, engine.graphEvaluate('xcos(x)', x), x * Math.cos(x));
  check(`xln(abs(x)) at x=${x}`, engine.graphEvaluate('xln(abs(x))', x), x * Math.log(Math.abs(x)));
  check(`2xsin(x) at x=${x}`, engine.graphEvaluate('2xsin(x)', x), 2 * x * Math.sin(x));
  check(`2xexp(-x^2) at x=${x}`, engine.graphEvaluate('2xexp(-x^2)', x), 2 * x * Math.exp(-x * x));
  check(`xsin(x)^2 at x=${x}`, engine.graphEvaluate('xsin(x)^2', x), x * Math.sin(x) ** 2);
  check(`xsin(x)+cos(x) at x=${x}`, engine.graphEvaluate('xsin(x)+cos(x)', x), x * Math.sin(x) + Math.cos(x));
}
// variable × constant (π)
for (const x of [-3, 0.25, 7]) {
  check(`xpi at x=${x}`, engine.graphEvaluate('xpi', x), x * PI);
  check(`2xpi at x=${x}`, engine.graphEvaluate('2xpi', x), 2 * x * PI);
  check(`xpi^2 at x=${x}`, engine.graphEvaluate('xpi^2', x), x * PI * PI);   // ^ binds tighter: x·π²
  check(`x*pi at x=${x} (explicit)`, engine.graphEvaluate('x*pi', x), x * PI);
}
// 'e' prefix → Euler's number, not a variable
check('esin(0) = e·sin(0) = 0', engine.graphEvaluate('esin(0.5)', 0.5), E * Math.sin(0.5));
// greek theta in identifier context: x·θ with a space works via implicit mult
check('x θ at x=2, θ=3 → 6', engine.evaluate('x θ', { x: 2, θ: 3 }), 6);

// ─────────────────────────────────────────────────────────────
// B. Real nth roots (negative base, 1/(odd integer) exponents)
// ─────────────────────────────────────────────────────────────
section('B. Real nth roots ((-8)^(1/3) = -2, not NaN)');
check('(-8)^(1/3) = -2', engine.evaluate('(-8)^(1/3)'), -2);
check('(-27)^(1/3) = -3', engine.evaluate('(-27)^(1/3)'), -3);
check('8^(1/3) = 2 (positive base)', engine.evaluate('8^(1/3)'), 2);
check('x^(1/3) at x=-9.5 = cbrt', engine.graphEvaluate('x^(1/3)', -9.5), Math.cbrt(-9.5));
check('x^(1/5) at x=-32 = -2', engine.graphEvaluate('x^(1/5)', -32), -2);
check('x^(1/2) at x=-4 stays NaN', engine.graphEvaluate('x^(1/2)', -4), NaN);
check('x^(1/2) at x=4 = 2', engine.graphEvaluate('x^(1/2)', 4), 2);
check('x^(2/3) at x=-8 stays NaN', engine.graphEvaluate('x^(2/3)', -8), NaN);   // 3/2 is not an odd-denominator root
check('(-8)^(-1/3) = -0.5', engine.evaluate('(-8)^(-1/3)'), -0.5);
check('(-1)^(1/3) = -1', engine.evaluate('(-1)^(1/3)'), -1);
// integer exponents unaffected (existing behavior)
check('-8^2 = -64', engine.evaluate('-8^2'), -64);
check('(-8)^3 = -512', engine.evaluate('(-8)^3'), -512);
// float tolerance: 1/(1/3) rounds to 3.0000000000000004 → still detected
check('x^(1/3) via 1/3 literal at -9.5', engine.evaluate('x^(1/3)', { x: -9.5 }), Math.cbrt(-9.5));

// ─────────────────────────────────────────────────────────────
// C. θ / theta variable support (for polar curves)
// ─────────────────────────────────────────────────────────────
section('C. θ (theta) variables');
check('r = 2cos(θ) at θ=0 → 2', engine.evaluate('2cos(θ)', { θ: 0 }), 2);
check('r = 2cos(θ) at θ=π → -2', engine.evaluate('2cos(θ)', { θ: PI }), -2);
check('2θ at θ=3 → 6 (implicit mult)', engine.evaluate('2θ', { θ: 3 }), 6);
check('θ^2 at θ=4 → 16', engine.evaluate('θ^2', { θ: 4 }), 16);
check('theta spelled out: 2theta at θ=3 → 6', engine.evaluate('2theta', { θ: 3 }), 6);
check('theta spelled out: cos(theta) at θ=π → -1', engine.evaluate('cos(theta)', { θ: PI }), -1);
check('sin(θ) at θ=π/2 → 1', engine.evaluate('sin(θ)', { θ: PI / 2 }), 1);
// token-level check: 'theta' and 'θ' produce the same variable token
const tokA = engine.tokenize('2theta').map(t => t.type + ':' + t.value).join(' ');
const tokB = engine.tokenize('2θ').map(t => t.type + ':' + t.value).join(' ');
check('tokenize("2theta") == tokenize("2θ")', tokA === tokB, true);
check('tokenize("2θ") produces variable θ', tokB.includes('variable:θ'), true);

// ─────────────────────────────────────────────────────────────
// D. Regression guards (existing behavior untouched)
// ─────────────────────────────────────────────────────────────
section('D. Regression guards');
check('pi = π', engine.evaluate('pi'), PI);
check('2pi = 2π', engine.evaluate('2pi'), 2 * PI);
check('tau = 2π', engine.evaluate('tau'), 2 * PI);
check('e = E', engine.evaluate('e'), E);
check('2e = 2E (no sci-notation confusion)', engine.evaluate('2e'), 2 * E);
check('2e3 = 2000 (scientific notation)', engine.evaluate('2e3'), 2000);
check('1.5e-3 = 0.0015', engine.evaluate('1.5e-3'), 0.0015);
check('sinh(1)', engine.evaluate('sinh(1)'), Math.sinh(1));
check('asinh(0.5)', engine.evaluate('asinh(0.5)'), Math.asinh(0.5));
check('stdevp(1,2,3,4)', engine.evaluate('stdevp(1,2,3,4)'), Math.sqrt(5 / 4));
check('nCr(5,2) = 10', engine.evaluate('nCr(5,2)'), 10);
check('nPr(5,2) = 20', engine.evaluate('nPr(5,2)'), 20);
check('ans uses lastResult', engine.evaluate('ans+1'), 1);   // lastResult starts null → 0
check('sqrt(-1) = NaN', engine.evaluate('sqrt(-1)'), NaN);
check('log(-1) = NaN', engine.evaluate('log(-1)'), NaN);
check('50%^2 = 0.25 (% binds before ^)', engine.evaluate('50%^2'), 0.25);
check('100/50% = 200', engine.evaluate('100/50%'), 200);
check('x(x+1) at x=3 → 12 (implicit paren mult)', engine.graphEvaluate('x(x+1)', 3), 12);
check('sin(2x) at x=1.5', engine.graphEvaluate('sin(2x)', 1.5), Math.sin(3));
check('e^x at x=2', engine.graphEvaluate('e^x', 2), E * E);
// letter×letter implicit multiplication: ax → a·x, xs → x·s (slider-friendly)
check('ax at a=2, x=3 → 6', engine.evaluate('ax', { a: 2, x: 3 }), 6);
check('ax^2 at a=2, x=3 → 18', engine.evaluate('ax^2', { a: 2, x: 3 }), 18);
check('xs at x=2, s=3 → 6', engine.evaluate('xs', { x: 2, s: 3 }), 6);
check('3-letter unknown stays one variable: abc with {abc:5} → 5', engine.evaluate('abc', { abc: 5 }), 5);

// ─────────────────────────────────────────────────────────────
// 3. Report
// ─────────────────────────────────────────────────────────────
console.log('\n════════════════════════════════════════════');
console.log(`  ENGINE FIXES — ${passed + failed} checks`);
console.log(`  PASSED: ${passed}`);
console.log(`  FAILED: ${failed}`);
console.log('════════════════════════════════════════════');
if (failed > 0) {
  console.log('\n── Failures (first 20) ──');
  for (const f of failures.slice(0, 20)) {
    console.log(`  ✗ ${f.label}: got ${f.got}  (expected ${f.expected})`);
  }
  process.exit(1);
}
console.log('  ✓ ALL ENGINE FIX CHECKS PASSED!\n');
process.exit(0);
