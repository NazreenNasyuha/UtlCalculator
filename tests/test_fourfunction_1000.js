/**
 * 4-Function Calculator — 1000-Sample Randomized Verification
 *
 * Extracts the REAL math engine (tokenize / toRPN / evaluateRPN / evaluate)
 * straight out of engine.js (the split-out calculation engine) and validates it
 * against 1000 randomized
 * expressions covering: + - * /, parentheses, implicit multiplication
 * (FreeCalc-style: 2(3+4)), and the ans key (including ans chaining and the
 * "no previous result → 0" behavior).
 *
 * Run with: node test_fourfunction_1000.js
 */

const fs = require('fs');

// ─────────────────────────────────────────────────────────────
// 1. Extract the real engine from engine.js (the split-out engine file)
// ─────────────────────────────────────────────────────────────
const script = fs.readFileSync('../src/engine.js', 'utf8');

const startIdx = script.indexOf('function isFn');
const evalIdx = script.indexOf('function evaluate(expr');   // NB: signature is evaluate(expr, vars)
if (startIdx < 0 || evalIdx < 0) { console.error('✗ Engine markers not found'); process.exit(1); }

// Brace-match the end of `function evaluate(...) { ... }`
let i = script.indexOf('{', evalIdx), depth = 0;
for (; i < script.length; i++) {
  if (script[i] === '{') depth++;
  else if (script[i] === '}') { depth--; if (depth === 0) break; }
}
if (i >= script.length) { console.error('✗ Could not brace-match evaluate()'); process.exit(1); }

const engineBlock = script.slice(startIdx, i + 1);
const domRefs = engineBlock.match(/document\.|window\.|addEventListener|getElementById/g);
if (domRefs) { console.error('✗ Engine block unexpectedly references the DOM:', domRefs); process.exit(1); }

const state = { angleMode: 'RAD', lastResult: null, precision: 'auto', expression: '', displayValue: '', justGotResult: false };
const engine = new Function('state', engineBlock + '\nreturn { tokenize, toRPN, evaluateRPN, evaluate };')(state);
if (typeof engine.evaluate !== 'function') { console.error('✗ Engine extraction failed'); process.exit(1); }

// ─────────────────────────────────────────────────────────────
// 2. Helpers
// ─────────────────────────────────────────────────────────────
function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

function numStr() {  // Non-negative numeric literal: int, decimal, or small decimal
  const r = Math.random();
  if (r < 0.6) return String(randInt(0, 99));
  if (r < 0.9) return (randInt(0, 999) / 100).toFixed(2);
  return '0.' + String(randInt(1, 999));
}

function nonzeroNum() {  // Numeric literal guaranteed ≠ 0 (safe as a divisor)
  return Math.random() < 0.5 ? String(randInt(1, 50)) : (randInt(1, 999) / 100).toFixed(2);
}

// Reference evaluator: standard JS (same left-to-right semantics as the engine)
function refEval(expr) { return Function('"use strict"; return (' + expr + ');')(); }

function closeEnough(a, b) {
  if (Number.isNaN(a) && Number.isNaN(b)) return true;
  if (Object.is(a, b)) return true;                 // handles -0 === 0 and exact equality
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  return Math.abs(a - b) <= 1e-9 * scale;
}

// ─────────────────────────────────────────────────────────────
// 3. Generators
// ─────────────────────────────────────────────────────────────
const OPS = ['+', '-', '*', '/'];

// Random arithmetic with optional parentheses (explicit operators only)
function gen(depth) {
  const r = Math.random();
  if (depth <= 0 || r < 0.3) return numStr();
  const op = OPS[randInt(0, 3)];
  const a = gen(depth - 1);
  const b = op === '/' ? nonzeroNum() : gen(depth - 1);  // never divide by a possibly-zero expression
  let s = a + op + b;
  if (Math.random() < 0.5) s = '(' + s + ')';
  return s;
}

// Parens-heavy: every composite is parenthesized, deeply nested
function genParens(depth) {
  if (depth <= 0) return Math.random() < 0.5 ? '(' + numStr() + ')' : numStr();
  const op = OPS[randInt(0, 3)];
  return '(' + genParens(depth - 1) + op + (op === '/' ? nonzeroNum() : genParens(depth - 1)) + ')';
}

// FreeCalc-style implicit multiplication samples (no division → always finite)
function implicitSample() {
  const a = numStr(), b = numStr(), c = numStr(), d = numStr();
  const kind = randInt(0, 4);
  let expr, ref;
  switch (kind) {
    case 0: expr = a + '(' + b + '+' + c + ')';            ref = a + '*(' + b + '+' + c + ')'; break;
    case 1: expr = '(' + a + '+' + b + ')(' + c + '+' + d + ')'; ref = '(' + a + '+' + b + ')*(' + c + '+' + d + ')'; break;
    case 2: expr = a + '(' + b + ')';                      ref = a + '*(' + b + ')'; break;
    case 3: expr = '(' + a + '+' + b + ')' + c;            ref = '(' + a + '+' + b + ')*' + c; break;
    default: expr = a + '(' + b + '-' + c + ')' + d;       ref = a + '*(' + b + '-' + c + ')*' + d; break;
  }
  return { expr, expected: refEval(ref) };
}

// ans samples chained onto a previous result
function ansSample(prior) {
  const r = Math.random();
  let s;
  if (r < 0.15) s = 'ans';
  else if (r < 0.3) s = 'ans+' + numStr();
  else if (r < 0.45) s = numStr() + '-' + 'ans';
  else if (r < 0.6) s = numStr() + '*' + 'ans';
  else if (r < 0.75) s = 'ans/' + nonzeroNum();
  else if (r < 0.9) s = '(' + 'ans' + '+' + numStr() + ')*' + numStr();
  else s = '(' + 'ans' + '+' + numStr() + ')/(' + 'ans' + '+' + numStr() + ')';
  state.lastResult = prior;
  const actual = engine.evaluate(s);
  const expected = refEval(s.split('ans').join('(' + String(prior) + ')'));
  return { expr: s, expected, actual };
}

// ans adjacency without an explicit operator: "2ans" → 2*ans (implicit multiplication)
function ansAdjSample(prior) {
  const a = numStr();
  state.lastResult = prior;
  const expr = a + 'ans';
  return { expr, expected: parseFloat(a) * prior, actual: engine.evaluate(expr) };
}

// ─────────────────────────────────────────────────────────────
// 4. Run the samples
// ─────────────────────────────────────────────────────────────
let passed = 0, failed = 0, sampleNum = 0;
const failures = [];

function check(label, expr, actual, expected) {
  sampleNum++;
  if (closeEnough(actual, expected)) { passed++; }
  else {
    failed++;
    failures.push({ label, expr, actual, expected });
  }
}

console.log('\n══════════════════════════════════════════');
console.log('  4-FUNCTION 1000-SAMPLE VERIFICATION');
console.log('══════════════════════════════════════════\n');

// ── A. Randomized arithmetic: + - * / with parentheses (606 samples) ──
let start = sampleNum;
let attempts = 0;
while ((sampleNum - start) < 606 && attempts < 200000) {
  attempts++;
  const expr = Math.random() < 0.5 ? gen(randInt(1, 3)) : genParens(randInt(2, 4));
  let expected;
  try { expected = refEval(expr); } catch (e) { continue; }
  if (!Number.isFinite(expected)) continue;           // skip div-by-zero edge cases
  check('arithmetic', expr, engine.evaluate(expr), expected);
}

// ── B. FreeCalc-style implicit multiplication (150) ──
start = sampleNum;
attempts = 0;
while ((sampleNum - start) < 150 && attempts < 20000) {
  attempts++;
  const res = implicitSample();
  check('implicit-mult', res.expr, engine.evaluate(res.expr), res.expected);
}

// ── C. ans chaining, adjacency, and no-prior-result (202 samples) ──
let prior = Math.random() * 20 - 10;
start = sampleNum;
attempts = 0;
while ((sampleNum - start) < 180 && attempts < 40000) {
  attempts++;
  const res = ansSample(prior);
  if (!Number.isFinite(res.expected)) continue;        // division-by-zero in ref → skip
  check('ans', res.expr, res.actual, res.expected);
  prior = res.actual;                                  // chain: result feeds next ans
}
start = sampleNum;
attempts = 0;
while ((sampleNum - start) < 18 && attempts < 4000) {
  attempts++;
  const res = ansAdjSample(prior);
  check('ans-implicit', res.expr, res.actual, res.expected);
}
// ans with no previous result → 0 (FreeCalc behavior)
state.lastResult = null;
check('ans-null', 'ans', engine.evaluate('ans'), 0);
check('ans-null', 'ans+5', engine.evaluate('ans+5'), 5);
check('ans-null', '3*ans', engine.evaluate('3*ans'), 0);
state.lastResult = 0;                                  // a legit zero result
check('ans-zero', 'ans', engine.evaluate('ans'), 0);

// ── D. FreeCalc-verified fixtures (32) ──
console.log('\n── FreeCalc-verified fixtures ...');
const FIXTURES = [
  ['1+1', 2], ['10-4', 6], ['3*4', 12], ['10/2', 5],
  ['2+3*4', 14], ['(2+3)*4', 20], ['10-3-2', 5], ['100/5/2', 10],
  ['2*3+4*5', 26], ['0.1+0.2', 0.30000000000000004], ['1.5*2.5', 3.75],
  ['10/3', 3.3333333333333335], ['-5+3', -2], ['-5*-3', 15], ['5--3', 8],
  ['2(3+4)', 14], ['(1+2)(3+4)', 21], ['(2+3)4', 20], ['6/2(1+2)', 9],
  ['1/(2+3)', 0.2], ['(5-(2*3))', -1], ['((((8)/2)+1)*3)-4', 11],
  ['((2+3)*(4-1))', 15], ['0.5+0.25', 0.75], ['100/10/2', 5], ['50/2+3', 28],
  ['(50/2)+3', 28], ['50/(2+3)', 10], ['3+4*2-1', 10], ['(3+4)*2-1', 13],
  ['(5+5)*5+5', 55], ['1/2/2', 0.25], ['(1/2)/2', 0.25], ['1/(2/2)', 1],
  // Percent (scientific mode) — regression guard for the implicit-mult pass
  ['50%', 0.5], ['200%', 2], ['5%*200', 10], ['100%+1', 2],
  // Unary minus vs exponentiation (FreeCalc convention: -5^2 = -(5^2), 2^-3 = 2^(-3))
  ['-5^2', -25], ['2^-3', 0.125],
];
for (const [expr, expected] of FIXTURES) {
  check('fixture', expr, engine.evaluate(expr), expected);
}
// Division-by-zero → NaN (FreeCalc shows "undefined")
check('fixture', '7/0', engine.evaluate('7/0'), NaN);
check('fixture', '0/0', engine.evaluate('0/0'), NaN);

// ─────────────────────────────────────────────────────────────
// 5. Report
// ─────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════');
console.log(`  TOTAL SAMPLES: ${sampleNum}`);
console.log(`  PASSED: ${passed}`);
console.log(`  FAILED: ${failed}`);
console.log('══════════════════════════════════════════');
if (failed > 0) {
  console.log('\n── Failures ──');
  for (const f of failures.slice(0, 25)) {
    console.log(`  [${f.label}] "${f.expr}" → ${f.actual}  (expected ${f.expected})`);
  }
  console.log(`  ... and ${failed - Math.min(failures.length, 25)} more`);
  process.exit(1);
}
console.log('  ✓ ALL 1000 SAMPLES CORRECT!\n');
process.exit(0);
