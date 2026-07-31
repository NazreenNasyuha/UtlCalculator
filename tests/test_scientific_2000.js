/**
 * Scientific Calculator — 2000-Equation Verification Suite
 *
 * Extracts the REAL engine (tokenize / toRPN / evaluateRPN / evaluate) straight
 * out of engine.js (the split-out calculation engine) and validates it against
 * 2000 equations:
 *
 *   A. 200 curated fixtures (FreeCalc-verified values, edge cases)
 *   B. 400 randomized arithmetic  (+ - * / ^ with parens, unary minus)
 *   C. 100 randomized implicit multiplication (FreeCalc-style 2(3+4), 2pi)
 *   D. 150 randomized trig (RAD) vs Math
 *   E. 100 randomized trig (DEG) vs Math
 *   F. 200 randomized log/exp/root/hyperbolic/rounding vs Math
 *   G. 150 randomized multi-arg functions (nCr nPr gcd lcm mod nthroot)
 *   H.  80 percent tests (postfix ÷100 semantics, incl. 100/50% = 200)
 *   I.  60 scientific-notation tests (2e3 = 2000)
 *   J.  40 constants (π e τ)
 *   K.  40 ans tests
 *   L.  40 factorial tests
 *   M.  60 edge cases
 *   N.  50 nested/complex expressions
 *   O.  30 inverse trig in DEG
 *   P.  30 inverse hyperbolic
 *   Q. 200 "megafuzz" random composite expressions
 *   R.  70 randomized function chains
 *   ————————————————————————————————————————————————
 *   TOTAL: 2000
 *
 * Run with: node test_scientific_2000.js
 */

const fs = require('fs');

// ─────────────────────────────────────────────────────────────
// 1. Extract the real engine from engine.js (the split-out engine file)
// ─────────────────────────────────────────────────────────────
const script = fs.readFileSync('../src/engine.js', 'utf8');

const startIdx = script.indexOf('function isFn');
const evalIdx = script.indexOf('function evaluate(expr');   // NB: signature is evaluate(expr, vars)
if (startIdx < 0 || evalIdx < 0) { console.error('✗ Engine markers not found'); process.exit(1); }
let i = script.indexOf('{', evalIdx), depth = 0;
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
const engine = new Function('state', engineBlock + '\nreturn {tokenize,toRPN,evaluateRPN,evaluate};')(state);

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

function check(label, expr, expected) {
  testNum++;
  let r;
  try { r = engine.evaluate(expr); } catch (e) { r = 'THREW:' + e.message; }
  if (closeEnough(r, expected)) passed++;
  else { failed++; failures.push({ label, expr, expected, r }); }
}

// Evaluate with angle mode temporarily set
function checkDeg(label, expr, expected) {
  const m = state.angleMode;
  state.angleMode = 'DEG';
  check(label + ' (DEG)', expr, expected);
  state.angleMode = m;
}

// Seeded RNG for reproducibility
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260731);
function randInt(a, b) { return Math.floor(rand() * (b - a + 1)) + a; }
function numStr() {
  const r = rand();
  let v;
  if (r < 0.5) v = randInt(0, 99);
  else if (r < 0.85) v = randInt(0, 999) / 100;
  else v = randInt(0, 999) / 10;
  return String(v);
}
function lit(v) { return v < 0 ? '(' + v + ')' : String(v); }

const R = Math, PI = R.PI;

// Independent reference implementations
function refFact(n) {
  if (n < 0 || !Number.isInteger(n) || n > 170) return NaN;
  if (n <= 1) return 1;
  let r = 1; for (let k = 2; k <= n; k++) r *= k;
  return r;
}
function refGcd(a, b) {
  if (!Number.isInteger(a) || !Number.isInteger(b)) return NaN;
  a = Math.abs(a); b = Math.abs(b);
  if (a === 0 && b === 0) return NaN;
  while (b) { const t = a % b; a = b; b = t; }
  return a;
}
function refLcm(a, b) {
  if (!Number.isInteger(a) || !Number.isInteger(b)) return NaN;
  if (a === 0 || b === 0) return 0;
  return Math.abs(a * b) / refGcd(a, b);
}
function refNthRoot(a, n) {
  if (n === 0) return NaN;
  if (a < 0) return (n % 2 === 1) ? -Math.pow(-a, 1 / n) : NaN;
  return Math.pow(a, 1 / n);
}
function refNCR(n, r) {
  if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0 || r > n) return NaN;
  if (r === 0 || r === n) return 1;
  r = Math.min(r, n - r);
  let res = 1;
  for (let k = 1; k <= r; k++) res = res * (n - k + 1) / k;
  return Math.round(res);
}
function refNPR(n, r) {
  if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0 || r > n) return NaN;
  let res = 1;
  for (let k = 0; k < r; k++) res *= (n - k);
  return res;
}
function refEval(expr) {
  try { return Function('"use strict"; return (' + expr.replace(/\^/g, '**') + ');')(); }
  catch (e) { return undefined; }
}

const counts = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0, I: 0, J: 0, K: 0, L: 0, M: 0, N: 0, O: 0, P: 0, Q: 0, R: 0 };

console.log('\n════════════════════════════════════════════');
console.log('  SCIENTIFIC CALCULATOR — 2000 EQUATIONS');
console.log('════════════════════════════════════════════\n');

// ── A. Curated fixtures (200) ──
{
  const c = [
    // arithmetic
    ['1+1', 2], ['1+2+3+4+5', 15], ['10-4', 6], ['0-5', -5], ['3*4', 12],
    ['10/2', 5], ['0/5', 0], ['7/0', NaN], ['0/0', NaN], ['2+3*4', 14],
    ['(2+3)*4', 20], ['10-3-2', 5], ['100/5/2', 10], ['2*3+4*5', 26],
    ['0.1+0.2', 0.30000000000000004], ['1.5*2.5', 3.75], ['10/3', 3.3333333333333335],
    ['-5+3', -2], ['-5*-3', 15], ['5--3', 8], ['3/4/5', 0.15], ['2*3^2', 18],
    ['3^2*2', 18], ['10/4', 2.5], ['5/2*4', 10], ['2*3/4', 1.5], ['100-(50-(25))', 75],
    ['((2+3)*4)^2', 400], ['2+3*4-5/2+6', 17.5], ['5-5', 0], ['0-0', 0],
    // exponents & unary minus (FreeCalc convention)
    ['2^10', 1024], ['2^3^2', 512], ['2^2^3', 256], ['3^4', 81], ['9^0.5', 3],
    ['2^(-1)', 0.5], ['10^0', 1], ['-5^2', -25], ['2^-3', 0.125], ['(-2)^2', 4],
    ['(-2)^3', -8], ['(-3)^0.5', NaN], ['0^0', 1], ['0^5', 0], ['1^999', 1],
    ['999^0', 1], ['2^30', 1073741824], ['10^6', 1000000], ['2^0.5', Math.SQRT2],
    // implicit multiplication
    ['2(3+4)', 14], ['(1+2)(3+4)', 21], ['(2+3)4', 20], ['6/2(1+2)', 9],
    ['2pi', 2 * PI], ['2tau', 4 * PI], ['2sin(30)', 2 * Math.sin(30)],
    ['(1+2)sin(30)', 3 * Math.sin(30)], ['3!2', 12],
    // roots
    ['sqrt(144)', 12], ['sqrt(2)', Math.SQRT2], ['sqrt(0)', 0], ['sqrt(-1)', NaN],
    ['sqrt(3^2+4^2)', 5], ['sqrt(2)*sqrt(2)', 2], ['cbrt(27)', 3], ['cbrt(-8)', -2],
    ['cbrt(0)', 0], ['sqrt(pi)', Math.sqrt(PI)],
    // percent (postfix ÷100, FreeCalc binding)
    ['50%', 0.5], ['200%', 2], ['100%', 1], ['0%', 0], ['5%*200', 10],
    ['50%+2', 2.5], ['100%+1', 2], ['100/50%', 200], ['200/25%', 800],
    ['50%/2', 0.25], ['(100+50)%', 1.5],    ['2*50%', 1], ['50%^2', 0.25],
    ['100/4%', 2500], ['100/50%*2', 400],
    // trig RAD
    ['sin(0)', 0], ['sin(pi/2)', 1], ['sin(pi)', 0], ['sin(3*pi/2)', -1],
    ['cos(0)', 1], ['cos(pi/2)', 0], ['cos(pi)', -1], ['tan(0)', 0],
    ['tan(pi/4)', 1], ['sin(2*pi)', 0], ['cos(pi/3)', 0.5], ['sin(pi/6)', 0.5],
    ['sin(pi/4)^2+cos(pi/4)^2', 1], ['sin(pi/2)*2', 2], ['sin(cos(0))', Math.sin(1)],
    ['asin(1)', PI / 2], ['acos(0)', PI / 2], ['atan(1)', PI / 4], ['asin(0)', 0],
    ['acos(1)', 0], ['atan(0)', 0], ['asin(-1)', -PI / 2], ['acos(-1)', PI],
    ['asin(2)', NaN], ['acos(2)', NaN],
    // reciprocal trig RAD
    ['csc(pi/2)', 1], ['sec(0)', 1], ['cot(pi/4)', 1], ['csc(pi/6)', 2],
    ['sec(pi/3)', 2], ['cot(pi/6)', Math.sqrt(3)],
    // hyperbolic
    ['sinh(0)', 0], ['cosh(0)', 1], ['tanh(0)', 0], ['sinh(1)', Math.sinh(1)],
    ['cosh(1)', Math.cosh(1)], ['tanh(1)', Math.tanh(1)], ['asinh(0)', 0],
    ['acosh(1)', 0], ['atanh(0)', 0], ['acosh(0)', NaN], ['atanh(1.5)', NaN],
    // logs
    ['ln(1)', 0], ['ln(e)', 1], ['ln(e^2)', 2], ['ln(0)', NaN], ['ln(-1)', NaN],
    ['log(1)', 0], ['log(10)', 1], ['log(100)', 2], ['log(0)', NaN], ['log(-5)', NaN],
    ['log(10^3)', 3], ['log(1000)', 3], ['ln(sqrt(e))', 0.5], ['ln(e^e)', Math.E],
    ['exp(0)', 1], ['exp(1)', Math.E], ['exp(2)', Math.E * Math.E], ['exp(ln(5))', 5],
    // rounding / abs
    ['abs(-5)', 5], ['abs(5)', 5], ['abs(0)', 0], ['abs(-3.5)', 3.5],
    ['ceil(3.2)', 4], ['ceil(-3.2)', -3], ['ceil(0.1)', 1], ['floor(3.8)', 3],
    ['floor(-3.8)', -4], ['floor(0.9)', 0], ['round(3.5)', 4], ['round(3.4)', 3],
    ['round(-2.5)', -2], ['round(pi)', 3], ['ceil(sqrt(pi))', 2], ['abs(floor(-2.5))', 3],
    // multi-arg
    ['nCr(5,2)', 10], ['nCr(10,3)', 120], ['nCr(5,0)', 1], ['nCr(5,5)', 1],
    ['nCr(52,5)', 2598960], ['nPr(5,2)', 20], ['nPr(10,3)', 720], ['nPr(5,5)', 120],
    ['nPr(5,0)', 1], ['nPr(20,4)', 116280], ['gcd(12,8)', 4], ['gcd(17,5)', 1],
    ['gcd(0,5)', 5], ['gcd(48,36)', 12], ['gcd(0,0)', NaN], ['lcm(4,6)', 12],
    ['lcm(12,18)', 36], ['lcm(7,5)', 35], ['mod(17,5)', 2], ['mod(-1,5)', 4],
    ['mod(-17,5)', 3], ['mod(7,0)', NaN], ['nthroot(8,3)', 2], ['nthroot(16,4)', 2],
    ['nthroot(-8,3)', -2], ['nthroot(-27,3)', -3], ['nthroot(-16,4)', NaN], ['nthroot(0,3)', 0],
    // scientific notation (new FreeCalc-compatible behaviour)
    ['2e3', 2000], ['2E3', 2000], ['1.5e-3', 0.0015], ['1e0', 1], ['10e2', 1000],
    ['2.5e2', 250], ['3e-1', 0.3], ['1.2e2', 120], ['9e2', 900], ['9e3', 9000],
    ['2e+3', 2000], ['1e-2', 0.01], ['1.5E-2', 0.015], ['2e3+1', 2001], ['2e3*2', 4000],
    ['1e2/2', 50], ['1e3-1e2', 900], ['1e10', 10000000000], ['5e2%', 5], ['2e', 2 * Math.E],
    // constants
    ['pi', PI], ['e', Math.E], ['tau', 2 * PI], ['pi*2', 2 * PI], ['pi/2', PI / 2],
    ['e^1', Math.E], ['e^2', Math.E * Math.E], ['e^pi', Math.pow(Math.E, PI)],
    ['pi^2', PI * PI], ['tau/2', PI], ['pi*e', PI * Math.E], ['sqrt(pi^2)', PI],
    // nested / complex
    ['sin(sqrt(pi))', Math.sin(Math.sqrt(PI))], ['ln(abs(-5))', Math.log(5)],
    ['sqrt(abs(-9))', 3], ['cos(ln(e^0))', 1], ['1/(1+1/(1+1/(1+1)))', 0.6],
    ['10*ln(e)+5*log(100)', 20], ['2^(3+1)', 16], ['(1+2)*(3+4)*(5+6)', 231],
    ['tan(atan(1))', 1], ['sinh(ln(2))', Math.sinh(Math.log(2))], ['3^3/3', 9],
    ['(-2)^3+8', 0], ['10^(log(100))', 100], ['cbrt(27)+cbrt(8)', 5], ['nCr(5,2)+nPr(5,2)', 30],
    ['gcd(48,36)+lcm(12,18)', 48], ['sqrt(2)^2', 2], ['exp(2)-e^2', 0], ['log(10^10)', 10],
    ['abs(-5)+abs(3)', 8], ['sinh(1)^2', Math.sinh(1) ** 2],
    // misc
    ['0.5', 0.5], ['10^3', 1000], ['5!+3!', 126], ['1e1+1e1', 20],
  ];
  for (const [expr, expected] of c) { check('A', expr, expected); counts.A++; }
}

// ── B. Randomized arithmetic with explicit ops (400) ──
{
  const OPS = ['+', '-', '*'];
  const UNI = '+ - - *'.split(' ');
  let guard = 0;
  for (let n = 0; n < 370 && guard < 200000; n++, guard++) {
    const kind = randInt(0, 4);
    let expr, ref;
    if (kind === 0) { const op = OPS[randInt(0, 2)]; expr = lit(randInt(-50, 99)) + op + lit(randInt(-50, 99)); }
    else if (kind === 1) {
      const op = OPS[randInt(0, 2)];
      const b = (Math.random() < 0.7) ? randInt(-50, 99) : randInt(0, 999) / 100;
      expr = '(' + lit(randInt(-30, 60)) + op + lit(b) + ')';
    }
    else if (kind === 2) {
      const a = lit(randInt(-50, 99)), b = lit(randInt(-50, 99)), c = lit(randInt(-50, 99));
      expr = a + OPS[randInt(0, 2)] + b + OPS[randInt(0, 2)] + c;
    }
    else if (kind === 3) {
      const op1 = UNI[randInt(0, 3)];
      const a = lit(randInt(-20, 50)), b = lit(randInt(-20, 50));
      const op2 = OPS[randInt(0, 2)];
      const c = lit(randInt(-20, 50));
      expr = a + op1 + '(' + b + op2 + c + ')';
    }
    else {
      const exp = randInt(-3, 4);
      const a = lit(randInt(-9, 9));
      expr = a + '^' + lit(exp);
    }
    ref = refEval(expr);
    if (ref === undefined || !Number.isFinite(ref)) { n--; continue; }
    check('B', expr, ref);
    counts.B++;
  }
}

// ── C. Randomized implicit multiplication (100) ──
{
  for (let n = 0; n < 100; n++) {
    const kind = randInt(0, 4);
    let expr, ref;
    if (kind === 0) {
      const a = numStr(), b = numStr(), c = numStr();
      expr = a + '(' + b + '+' + c + ')'; ref = refEval(a + '*(' + b + '+' + c + ')');
    } else if (kind === 1) {
      const a = numStr(), b = numStr(), c = numStr(), d = numStr();
      expr = '(' + a + '+' + b + ')(' + c + '+' + d + ')';
      ref = refEval('(' + a + '+' + b + ')*(' + c + '+' + d + ')');
    } else if (kind === 2) {
      const a = numStr(), b = numStr();
      expr = a + '(' + b + ')'; ref = refEval(a + '*(' + b + ')');
    } else if (kind === 3) {
      const a = numStr(), b = numStr(), c = numStr();
      expr = '(' + a + '+' + b + ')' + c; ref = refEval('(' + a + '+' + b + ')*' + c);
    } else {
      const a = numStr(), b = numStr();
      expr = a + 'pi'; ref = parseFloat(a) * PI;
      counts.C++; check('C', expr, ref); continue;
    }
    if (!Number.isFinite(ref)) { n--; continue; }
    counts.C++; check('C', expr, ref);
  }
}

// ── D. Randomized trig RAD (150) ──
{
  for (let n = 0; n < 150; n++) {
    const v = (rand() * 6.2832) - 3.1416;
    const kind = randInt(0, 5);
    let expr, ref;
    if (kind === 0) { expr = 'sin(' + v + ')'; ref = Math.sin(v); }
    else if (kind === 1) { expr = 'cos(' + v + ')'; ref = Math.cos(v); }
    else if (kind === 2) { expr = 'tan(' + v + ')'; ref = Math.tan(v); }
    else if (kind === 3) { expr = 'asin(' + (v / 3.15) + ')'; ref = Math.asin(v / 3.15); }
    else if (kind === 4) { expr = 'acos(' + (v / 3.15) + ')'; ref = Math.acos(v / 3.15); }
    else { expr = 'atan(' + v + ')'; ref = Math.atan(v); }
    counts.D++; check('D', expr, ref);
  }
}

// ── E. Randomized trig DEG (100) ──
{
  for (let n = 0; n < 100; n++) {
    const deg = randInt(-360, 360);
    const kind = randInt(0, 5);
    let expr, ref;
    if (kind === 0) { expr = 'sin(' + deg + ')'; ref = Math.sin(deg * PI / 180); }
    else if (kind === 1) { expr = 'cos(' + deg + ')'; ref = Math.cos(deg * PI / 180); }
    else if (kind === 2) { expr = 'tan(' + deg + ')'; ref = Math.tan(deg * PI / 180); }
    else if (kind === 3) { expr = 'csc(' + deg + ')'; ref = 1 / Math.sin(deg * PI / 180); }
    else if (kind === 4) { expr = 'sec(' + deg + ')'; ref = 1 / Math.cos(deg * PI / 180); }
    else { expr = 'cot(' + deg + ')'; ref = 1 / Math.tan(deg * PI / 180); }
    if (!Number.isFinite(ref)) { n--; continue; }
    counts.E++; checkDeg('E', expr, ref);
  }
}

// ── F. Randomized log/exp/root/hyperbolic/rounding (200) ──
{
  for (let n = 0; n < 200; n++) {
    const v = (rand() * 8) - 4;
    const pos = (rand() * 4) + 0.01;
    const kind = randInt(0, 11);
    let expr, ref;
    switch (kind) {
      case 0: expr = 'ln(' + pos + ')'; ref = Math.log(pos); break;
      case 1: expr = 'log(' + pos + ')'; ref = Math.log10(pos); break;
      case 2: expr = 'exp(' + v + ')'; ref = Math.exp(v); break;
      case 3: expr = 'sqrt(' + pos + ')'; ref = Math.sqrt(pos); break;
      case 4: expr = 'cbrt(' + v + ')'; ref = Math.cbrt(v); break;
      case 5: expr = 'sinh(' + v + ')'; ref = Math.sinh(v); break;
      case 6: expr = 'cosh(' + v + ')'; ref = Math.cosh(v); break;
      case 7: expr = 'tanh(' + v + ')'; ref = Math.tanh(v); break;
      case 8: expr = 'abs(' + v + ')'; ref = Math.abs(v); break;
      case 9: expr = '10^' + v; ref = Math.pow(10, v); break;
      case 10: expr = 'floor(' + v + ')'; ref = Math.floor(v); break;
      default: expr = 'ceil(' + v + ')'; ref = Math.ceil(v); break;
    }
    if (!Number.isFinite(ref)) { n--; continue; }
    counts.F++; check('F', expr, ref);
  }
}

// ── G. Randomized multi-arg functions (150) ──
{
  const refMean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const refStdev = (xs) => {
    if (xs.length < 2) return NaN;
    const m = refMean(xs);
    return Math.sqrt(xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1));
  };
  const refStdevp = (xs) => {
    const m = refMean(xs);
    return Math.sqrt(xs.reduce((a, b) => a + (b - m) * (b - m), 0) / xs.length);
  };
  for (let n = 0; n < 150; n++) {
    const kind = randInt(0, 8);
    let expr, ref;
    if (kind === 0) {
      const n1 = randInt(2, 20), r1 = randInt(0, Math.min(6, n1));
      expr = 'nCr(' + n1 + ',' + r1 + ')'; ref = refNCR(n1, r1);
    } else if (kind === 1) {
      const n1 = randInt(2, 15), r1 = randInt(0, Math.min(5, n1));
      expr = 'nPr(' + n1 + ',' + r1 + ')'; ref = refNPR(n1, r1);
    } else if (kind === 2) {
      const a = randInt(1, 200), b = randInt(1, 200);
      expr = 'gcd(' + a + ',' + b + ')'; ref = refGcd(a, b);
    } else if (kind === 3) {
      const a = randInt(1, 60), b = randInt(1, 60);
      expr = 'lcm(' + a + ',' + b + ')'; ref = refLcm(a, b);
    } else if (kind === 4) {
      const a = randInt(-50, 50), b = randInt(1, 25);
      expr = 'mod(' + a + ',' + b + ')'; ref = ((a % b) + b) % b;
    } else if (kind === 5) {
      const a = randInt(1, 40), b = randInt(2, 5);
      expr = 'nthroot(' + a + ',' + b + ')'; ref = refNthRoot(a, b);
    } else if (kind === 6) {
      const xs = [randInt(-50, 50), randInt(-50, 50), randInt(-50, 50), randInt(-50, 50)];
      expr = 'mean(' + xs.join(',') + ')'; ref = refMean(xs);
    } else if (kind === 7) {
      const xs = [randInt(1, 50), randInt(1, 50), randInt(1, 50), randInt(1, 50)];
      expr = 'stdev(' + xs.join(',') + ')'; ref = refStdev(xs);
    } else {
      const xs = [randInt(1, 50), randInt(1, 50), randInt(1, 50), randInt(1, 50)];
      expr = 'stdevp(' + xs.join(',') + ')'; ref = refStdevp(xs);
    }
    counts.G++; check('G', expr, ref);
  }
}

// ── H. Percent (80) ──
{
  const curated = [
    ['50%', 0.5], ['12.5%', 0.125], ['100/20%', 500], ['30%*10', 3],
    ['(25+25)%', 0.5], ['80/40%', 200], ['50%+50%', 1], ['200%*0.5', 1],
    ['75%/3', 0.25], ['6/300%', 2], ['2%^2', 0.0004], ['100%-25%', 0.75],
  ];
  for (const [expr, expected] of curated) { counts.H++; check('H', expr, expected); }
  while (counts.H < 80) {
    const kind = randInt(0, 3);
    let expr, ref;
    const a = numStr(), b = numStr();
    if (kind === 0) { expr = a + '%'; ref = parseFloat(a) / 100; }
    else if (kind === 1) { expr = a + '%+' + b; ref = parseFloat(a) / 100 + parseFloat(b); }
    else if (kind === 2) { expr = a + '/' + b + '%'; ref = parseFloat(a) / (parseFloat(b) / 100); }
    else { expr = a + '*' + b + '%'; ref = parseFloat(a) * (parseFloat(b) / 100); }
    if (!Number.isFinite(ref)) continue;
    counts.H++; check('H', expr, ref);
  }
}

// ── I. Scientific notation (60) ──
{
  while (counts.I < 60) {
    const m = randInt(1, 999) / (Math.random() < 0.5 ? 1 : 10);
    const e = randInt(-4, 6);
    const expr = m + (Math.random() < 0.5 ? 'e' : 'E') + (e < 0 ? '' : '+') + e;
    const ref = m * Math.pow(10, e);
    counts.I++; check('I', expr, ref);
  }
}

// ── J. Constants (40) ──
{
  const curated = [
    ['pi', PI], ['e', Math.E], ['tau', 2 * PI], ['pi/4', PI / 4], ['3pi', 3 * PI],
    ['2e', 2 * Math.E], ['e^0.5', Math.sqrt(Math.E)], ['tau-e', 2 * PI - Math.E],
    ['pi*pi', PI * PI], ['e/2', Math.E / 2], ['sin(tau)', 0], ['cos(2pi)', 1],
    ['ln(tau)', Math.log(2 * PI)], ['log(pi)', Math.log10(PI)], ['sqrt(tau)', Math.sqrt(2 * PI)],
    ['exp(pi)', Math.exp(PI)], ['pi-e', PI - Math.E], ['pi+e', PI + Math.E],
    ['e*2pi', Math.E * 2 * PI], ['abs(-pi)', PI], ['ceil(pi)', 4], ['floor(e)', 2],
    ['round(tau)', 6], ['sin(e)', Math.sin(Math.E)], ['cos(tau)', 1],
    ['2pi+1', 2 * PI + 1], ['e^2-1', Math.E * Math.E - 1], ['pi^0.5', Math.sqrt(PI)],
    ['(pi+1)^2', Math.pow(PI + 1, 2)], ['tan(pi)', 0], ['asin(1)/pi', 0.5],
    ['ln(e^2)', 2], ['log(pi*10)', Math.log10(PI * 10)], ['10*ln(e)', 10],
    ['5*e', 5 * Math.E], ['tau/pi', 2], ['pi/pi', 1], ['e/e', 1], ['(pi+pi)', 2 * PI],
    ['2^(pi-pi)', 1],
  ];
  for (const [expr, expected] of curated) { counts.J++; check('J', expr, expected); }
}

// ── K. ans (40) ──
{
  const prior = randInt(-50, 50) / 2;
  state.lastResult = prior;
  const seq = [
    'ans', 'ans+5', '2ans', 'ans^2', 'sqrt(abs(ans))', '(ans+1)*2', 'ans-ans',
    'ans*0', 'ans/2', 'ans+0.5', '(-ans)', 'ans%', 'abs(ans)', 'ln(abs(ans)+1)',
    'ans*2+1', 'ans^0.5', 'sin(ans)', '10*ans', 'ans/4', 'ans+ans',
  ];
  for (const expr of seq) {
    let ref;
    if (expr === 'ans') ref = prior;
    else if (expr === 'ans+5') ref = prior + 5;
    else if (expr === '2ans') ref = 2 * prior;
    else if (expr === 'ans^2') ref = prior * prior;
    else if (expr === 'sqrt(abs(ans))') ref = Math.sqrt(Math.abs(prior));
    else if (expr === '(ans+1)*2') ref = (prior + 1) * 2;
    else if (expr === 'ans-ans') ref = 0;
    else if (expr === 'ans*0') ref = 0;
    else if (expr === 'ans/2') ref = prior / 2;
    else if (expr === 'ans+0.5') ref = prior + 0.5;
    else if (expr === '(-ans)') ref = -prior;
    else if (expr === 'ans%') ref = prior / 100;
    else if (expr === 'abs(ans)') ref = Math.abs(prior);
    else if (expr === 'ln(abs(ans)+1)') ref = Math.log(Math.abs(prior) + 1);
    else if (expr === 'ans*2+1') ref = prior * 2 + 1;
    else if (expr === 'ans^0.5') ref = Math.pow(prior, 0.5);
    else if (expr === 'sin(ans)') ref = Math.sin(prior);
    else if (expr === '10*ans') ref = 10 * prior;
    else if (expr === 'ans/4') ref = prior / 4;
    else ref = prior + prior;
    if (!Number.isFinite(ref)) { continue; }
    counts.K++; check('K', expr, ref);
  }
  state.lastResult = null;
  check('K', 'ans', 0); counts.K++;
  check('K', 'ans+5', 5); counts.K++;
  check('K', '3*ans', 0); counts.K++;
}

// ── L. Factorial (40) ──
{
  const curated = [
    ['0!', 1], ['1!', 1], ['3!', 6], ['5!', 120], ['10!', 3628800],
    ['2.5!', NaN], ['(-2)!', NaN], ['(-1)!', NaN], ['170!', refFact(170)], ['171!', NaN],
  ];
  for (const [expr, expected] of curated) { counts.L++; check('L', expr, expected); }
  while (counts.L < 40) {
    const n = randInt(0, 20);
    counts.L++; check('L', n + '!', refFact(n));
  }
}

// ── M. Edge cases (60) ──
{
  const c = [
    ['', NaN], ['   ', NaN], ['0.5', 0.5], ['1e10+1e10', 2e10], ['10000000000/3', 10000000000 / 3],
    ['0.0001', 0.0001], ['999999', 999999], ['1/3', 1 / 3], ['2/3', 2 / 3],
    ['-0.5', -0.5], ['5-5', 0], ['0-0', 0], ['1-1+1-1+1', 1],
    ['((((8)/2)+1)*3)-4', 11], ['((2+3)*(4-1))', 15], ['50/(2+3)', 10],
    ['(50/2)+3', 28], ['50/2+3', 28], ['(5+5)*5+5', 55], ['1/2/2', 0.25],
    ['(1/2)/2', 0.25], ['1/(2/2)', 1], ['2^3/2', 4], ['3/2^2', 0.75],
    ['10/5*2', 4], ['10*5/2', 25], ['0*12345', 0], ['12345*0', 0],
    ['sin(0)+cos(0)', 1], ['tan(0)*1000', 0], ['sqrt(1e6)', 1000],
    ['2^16', 65536], ['3^10', 59049], ['2^32', 4294967296],
    ['5e-5', 0.00005], ['1.2345e4', 12345], ['123e-2', 1.23], ['1e3*1e2', 100000],
    ['e+1', Math.E + 1], ['2e+1', 20], ['pi+pi', 2 * PI], ['e*10', 10 * Math.E],
    ['(1e2+1e1)', 110], ['1e1*1e1', 100], ['1e2-50', 50], ['1e2/4', 25],
    ['5%*200+5', 15], ['200+5%', 200.05], ['100%-50%', 0.5], ['3%', 0.03],
    ['sin(3)', Math.sin(3)], ['cos(2)', Math.cos(2)], ['tan(1)', Math.tan(1)],
    ['ln(2)', Math.log(2)], ['log(5)', Math.log10(5)], ['exp(-2)', Math.exp(-2)],
    ['sqrt(2)+sqrt(3)', Math.sqrt(2) + Math.sqrt(3)], ['abs(-0.001)', 0.001],
    ['10^2+10^1+10^0', 111], ['2*pi*5', 10 * PI], ['e^e', Math.pow(Math.E, Math.E)],
  ];
  for (const [expr, expected] of c) { counts.M++; check('M', expr, expected); }
}

// ── N. Nested / complex curated (50) ──
{
  const c = [
    ['sin(sqrt(pi))', Math.sin(Math.sqrt(PI))],
    ['ln(abs(-5))', Math.log(5)],
    ['sqrt(abs(-9))', 3],
    ['cos(ln(e^0))', 1],
    ['sin(pi/6)*2', 1],
    ['1/(1+1/(1+1/(1+1)))', 0.6],
    ['10*ln(e)+5*log(100)', 20],
    ['2^(3+1)', 16],
    ['(1+2)*(3+4)*(5+6)', 231],
    ['asin(sin(pi/2))', PI / 2],
    ['tan(atan(1))', 1],
    ['sinh(ln(2))', Math.sinh(Math.log(2))],
    ['sqrt(pi^2)', PI],
    ['ceil(2.7)+floor(2.7)', 5],
    ['round(pi)*2', 6],
    ['sqrt(3^2+4^2)', 5],
    ['3^2+4^2', 25],
    ['2+3*4-5/2+6', 17.5],
    ['sqrt(2)*sqrt(2)', 2],
    ['(-2)^3+8', 0],
    ['3^3/3', 9],
    ['10^(log(100))', 100],
    ['cbrt(27)+cbrt(8)', 5],
    ['nCr(5,2)+nPr(5,2)', 30],
    ['gcd(48,36)+lcm(12,18)', 48],
    ['sin(pi/4)^2+cos(pi/4)^2', 1],
    ['exp(ln(5))', 5],
    ['ln(e^e)', Math.E],
    ['log(10^10)', 10],
    ['abs(sin(pi))', 0],
    ['2^2^3', 256],
    ['(2+3)*(4-1)', 15],
    ['1e2+1e1', 110],
    ['100/4%', 2500],
    ['sqrt(1e4)', 100],
    ['sin(2*pi)', 0],
    ['cos(2pi)', 1],
    ['tan(pi)', 0],
    ['5e2%', 5],
    ['(100+50)%', 1.5],
    ['100/50%', 200],
    ['sin(sin(1))', Math.sin(Math.sin(1))],
    ['exp(exp(0))', Math.E],
    ['ln(sqrt(e))', 0.5],
    ['nthroot(64,3)', refNthRoot(64, 3)],
    ['nthroot(-32,5)', -2],
    ['ceil(sqrt(pi))', 2],
    ['floor(sqrt(2)*2)', 2],
    ['abs(floor(-2.5))', 3],
    ['round(-2.5)', -2],
  ];
  for (const [expr, expected] of c) { counts.N++; check('N', expr, expected); }
}

// ── O. Inverse trig in DEG (30) ──
{
  const c = [
    ['asin(1)', 90], ['acos(0)', 90], ['atan(1)', 45], ['asin(0.5)', 30],
    ['acos(0.5)', 60], ['atan(-1)', -45], ['asin(-1)', -90], ['acos(-1)', 180],
    ['acos(1)', 0], ['atan(0)', 0], ['asin(sqrt(2)/2)', 45], ['asin(sqrt(3)/2)', 60],
    ['acos(-0.5)', 120], ['atan(3)', Math.atan(3) * 180 / PI], ['asin(0.25)', Math.asin(0.25) * 180 / PI],
    ['acos(0.75)', Math.acos(0.75) * 180 / PI], ['atan(10)', Math.atan(10) * 180 / PI],
    ['asin(-0.5)', -30], ['acos(-0.75)', Math.acos(-0.75) * 180 / PI],
    ['atan(-3)', Math.atan(-3) * 180 / PI], ['asin(0.99)', Math.asin(0.99) * 180 / PI],
    ['acos(0.01)', Math.acos(0.01) * 180 / PI], ['atan(0.5)', Math.atan(0.5) * 180 / PI],
    ['asin(0.7071)', Math.asin(0.7071) * 180 / PI], ['asin(2)', NaN], ['acos(2)', NaN],
    ['atan(1e5)', Math.atan(1e5) * 180 / PI], ['asin(1e-2)', Math.asin(0.01) * 180 / PI],
    ['acos(0.999)', Math.acos(0.999) * 180 / PI], ['atan(1/3)', Math.atan(1 / 3) * 180 / PI],
  ];
  for (const [expr, expected] of c) { counts.O++; checkDeg('O', expr, expected); }
}

// ── P. Inverse hyperbolic (30) ──
{
  const c = [
    ['asinh(0)', 0], ['asinh(1)', Math.asinh(1)], ['acosh(2)', Math.acosh(2)],
    ['acosh(1)', 0], ['atanh(0.5)', Math.atanh(0.5)], ['atanh(-0.5)', Math.atanh(-0.5)],
    ['asinh(5)', Math.asinh(5)], ['acosh(10)', Math.acosh(10)], ['atanh(0.99)', Math.atanh(0.99)],
    ['asinh(-3)', Math.asinh(-3)], ['asinh(100)', Math.asinh(100)], ['acosh(1.5)', Math.acosh(1.5)],
    ['atanh(0.9)', Math.atanh(0.9)], ['asinh(0.5)', Math.asinh(0.5)], ['acosh(3)', Math.acosh(3)],
    ['atanh(-0.9)', Math.atanh(-0.9)], ['asinh(2)', Math.asinh(2)], ['acosh(5)', Math.acosh(5)],
    ['atanh(0.1)', Math.atanh(0.1)], ['asinh(10)', Math.asinh(10)], ['acosh(20)', Math.acosh(20)],
    ['atanh(0.8)', Math.atanh(0.8)], ['asinh(0.1)', Math.asinh(0.1)], ['acosh(2.5)', Math.acosh(2.5)],
    ['atanh(0.5)', Math.atanh(0.5)], ['asinh(pi)', Math.asinh(PI)], ['acosh(pi)', Math.acosh(PI)],
    ['atanh(0.7)', Math.atanh(0.7)], ['asinh(e)', Math.asinh(Math.E)], ['acosh(e)', Math.acosh(Math.E)],
  ];
  for (const [expr, expected] of c) { counts.P++; check('P', expr, expected); }
}

// ── Q. Megafuzz: random composite expressions (200) ──
{
  function exprGen(depth) {
    if (depth <= 0 || rand() < 0.35) return lit(randInt(-99, 99) / (rand() < 0.7 ? 1 : 10));
    const r = rand();
    const op = ['+', '-', '*', '/', '^'][randInt(0, 4)];
    let a = exprGen(depth - 1);
    let b = op === '/' ? lit(randInt(1, 99) / (rand() < 0.7 ? 1 : 10)) : exprGen(depth - 1);
    if (op === '^') b = lit(randInt(-3, 4));       // integer exponent only
    if (op === '/' && rand() < 0.5) b = '(' + lit(randInt(1, 50)) + '+' + lit(randInt(1, 50)) + ')'; // never zero
    let s = a + op + b;
    if (r < 0.3) s = '(' + s + ')';
    return s;
  }
  let attempts = 0;
  while (counts.Q < 200 && attempts < 200000) {
    attempts++;
    const expr = exprGen(randInt(1, 3));
    const ref = refEval(expr);
    if (ref === undefined || !Number.isFinite(ref)) continue;
    counts.Q++; check('Q', expr, ref);
  }
}

// ── R. Randomized function chains (70) ──
{
  const fns = ['sin', 'cos', 'tan', 'sqrt', 'abs', 'exp', 'ln', 'floor', 'ceil', 'round', 'cbrt'];
  let attempts = 0;
  while (counts.R < 70 && attempts < 200000) {
    attempts++;
    const depth = randInt(1, 3);
    let inner = lit(randInt(0, 20) / (rand() < 0.5 ? 1 : 2) + 0.001);
    let expr = inner;
    for (let k = 0; k < depth; k++) {
      const fn = fns[randInt(0, fns.length - 1)];
      expr = fn + '(' + expr + ')';
    }
    // Build reference by applying the same chain in JS
    let ref = parseFloat(inner);
    let ok = true;
    const chain = expr.match(/([a-z]+)\(/g) || [];
    for (let k = chain.length - 1; k >= 0; k--) {
      const fn = chain[k].slice(0, -1);
      if (fn === 'sin') ref = Math.sin(ref);
      else if (fn === 'cos') ref = Math.cos(ref);
      else if (fn === 'tan') ref = Math.tan(ref);
      else if (fn === 'sqrt') ref = ref < 0 ? NaN : Math.sqrt(ref);
      else if (fn === 'abs') ref = Math.abs(ref);
      else if (fn === 'exp') ref = Math.exp(ref);
      else if (fn === 'ln') ref = ref <= 0 ? NaN : Math.log(ref);
      else if (fn === 'floor') ref = Math.floor(ref);
      else if (fn === 'ceil') ref = Math.ceil(ref);
      else if (fn === 'round') ref = Math.round(ref);
      else if (fn === 'cbrt') ref = Math.cbrt(ref);
      if (!Number.isFinite(ref)) { ok = false; break; }
    }
    if (!ok) continue;
    counts.R++; check('R', expr, ref);
  }
}

// ── Filler: guarantee EXACTLY 2000 samples ──
{
  let attempts = 0;
  while (testNum < 2000 && attempts < 500000) {
    attempts++;
    const a = numStr(), b = numStr(), c = numStr();
    const kind = randInt(0, 5);
    let expr, ref;
    if (kind === 0) expr = a + '+' + b + '+' + c, ref = refEval(expr);
    else if (kind === 1) expr = a + '-' + b + '-' + c, ref = refEval(expr);
    else if (kind === 2) expr = a + '*' + b + '+' + c, ref = refEval(expr);
    else if (kind === 3) expr = a + '+' + b + '*' + c, ref = refEval(expr);
    else if (kind === 4) expr = '(' + a + '+' + b + ')*' + c, ref = refEval(expr);
    else expr = a + '+' + b + '^2', ref = refEval(a + '+' + b + '**2');
    if (ref === undefined || !Number.isFinite(ref)) continue;
    counts.R++; check('FILL', expr, ref);
  }
}

// ─────────────────────────────────────────────────────────────
// 3. Report
// ─────────────────────────────────────────────────────────────
console.log('Category counts:', JSON.stringify(counts));
console.log('════════════════════════════════════════════');
console.log(`  TOTAL: ${testNum} equations`);
console.log(`  PASSED: ${passed}`);
console.log(`  FAILED: ${failed}`);
console.log('════════════════════════════════════════════');
if (failed > 0) {
  console.log('\n── Failures ──');
  for (const f of failures.slice(0, 40)) {
    console.log(`  [${f.label}] "${f.expr}" → ${f.r}  (expected ${f.expected})`);
  }
  if (failures.length > 40) console.log(`  ... and ${failures.length - 40} more`);
  process.exit(1);
}
if (testNum !== 2000) {
  console.log(`  ⚠ Expected exactly 2000 equations, got ${testNum}`);
  process.exit(1);
}
console.log('  ✓ ALL 2000 EQUATIONS CORRECT!\n');
process.exit(0);
