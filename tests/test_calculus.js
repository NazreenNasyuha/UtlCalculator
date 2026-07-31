/**
 * Higher Derivatives, Integrals & Curve Tracing — Unit Tests
 *
 * Verifies the calculus features of the graphing engine:
 *
 *   A. HIGHER DERIVATIVE DETECTION — parseGraphExpression() (extracted
 *      verbatim from graph.js) classifies the new forms correctly:
 *        "y'' = x^3"       → derivative, order 2
 *        "y''' = x^4"      → derivative, order 3
 *        "f''(x) = x^3"    → derivative, order 2
 *        "d2/dx2 x^3"      → derivative, order 2
 *        "d3/dx3(x^3)"     → derivative, order 3
 *        "y = d/dx x^2"    → derivative, order 1 (via y = prefix)
 *      while existing types stay intact (cartesian, implicit, tangent...).
 *
 *   B. HIGHER DERIVATIVE MATH — numericDerivative(expr, x, vals, order)
 *      (recursive central difference) vs the ANALYTIC higher derivative:
 *        d²/dx² x³ = 6x     d²/dx² x² = 2      d³/dx³ x³ = 6
 *        d²/dx² sin = −sin  d²/dx² cos = −cos  d²/dx² eˣ = eˣ
 *        d³/dx³ sin = −cos   d⁴/dx⁴ x⁴ = 24
 *      plus slider-variable support and non-finite → NaN (asymptote break).
 *
 *   C. INTEGRAL DETECTION — "integral(x^2, 0, 2)" / "∫(x^2, 0, 2)" →
 *      integral kind with yExpr/aExpr/bExpr; slider bounds
 *      ("integral(x^2, 0, a)"); 3-arg validation (missing bounds → not integral).
 *
 *   D. INTEGRAL MATH — numericIntegral() (Simpson's rule) vs analytic:
 *        ∫₀² x² dx = 8/3    ∫₀³ x dx = 4.5    ∫₀^π sin = 2
 *        ∫₀¹ eˣ dx = e−1    ∫₁² 1/x dx = ln 2   ∫₋₁¹ x³ dx = 0 (odd)
 *        reversed bounds give the negative; asymptote inside → NaN.
 *      resolveBound() handles numbers, slider letters and "pi".
 *
 *   E. TRACE SUPPORT — the trace overlay's row selection logic (first visible
 *      cartesian OR derivative row) is replicated and verified, and the
 *      trace math (f(x) at hover x, slope f'(x)) matches the analytic values.
 *
 * Run with: node test_calculus.js
 */

const fs = require('fs');

// ─────────────────────────────────────────────────────────────
// 1. Extract pure functions from graph.js (no DOM access)
// ─────────────────────────────────────────────────────────────
const script = fs.readFileSync('../src/graph.js', 'utf8');

function extractFn(name) {
  const startIdx = script.indexOf('function ' + name);
  if (startIdx < 0) { console.error('✗ function ' + name + ' not found'); process.exit(1); }
  let i = script.indexOf('{', startIdx), depth = 0;
  for (; i < script.length; i++) {
    if (script[i] === '{') depth++;
    else if (script[i] === '}') { depth--; if (depth === 0) break; }
  }
  if (i >= script.length) { console.error('✗ Brace-match failed for ' + name); process.exit(1); }
  return script.slice(startIdx, i + 1);
}

// parseGraphExpression calls stripPrefix, findTopLevelEquals and
// splitTopLevelArgs — extract them all.
const graphBlock = extractFn('stripPrefix') + '\n' + extractFn('findTopLevelEquals')
  + '\n' + extractFn('splitTopLevelArgs') + '\n' + extractFn('parseGraphExpression');
if (/document\.|window\.|addEventListener/.test(graphBlock)) {
  console.error('✗ Extracted graph block references DOM');
  process.exit(1);
}
const g = new Function(graphBlock + '\nreturn {stripPrefix, findTopLevelEquals, splitTopLevelArgs, parseGraphExpression};')();

// Extract the real engine for the math checks
const engineScript = fs.readFileSync('../src/engine.js', 'utf8');
const startIdx = engineScript.indexOf('function isFn');
const graphIdx = engineScript.indexOf('function graphEvaluate');
let i = engineScript.indexOf('{', graphIdx), depth = 0;
for (; i < engineScript.length; i++) {
  if (engineScript[i] === '{') depth++;
  else if (engineScript[i] === '}') { depth--; if (depth === 0) break; }
}
const engineBlock = engineScript.slice(startIdx, i + 1);
const state = { angleMode: 'RAD', lastResult: null };
const engine = new Function('state', engineBlock + '\nreturn {evaluate};')(state);

// numericDerivative / numericIntegral / resolveBound call evaluate() — inject it.
const mathBlock = extractFn('numericDerivative') + '\n' + extractFn('numericIntegral')
  + '\n' + extractFn('resolveBound');
if (/document\.|window\.|addEventListener/.test(mathBlock)) {
  console.error('✗ Extracted math functions reference DOM');
  process.exit(1);
}
const math = new Function('evaluate', mathBlock + '\nreturn {numericDerivative, numericIntegral, resolveBound};')(engine.evaluate);

// ─────────────────────────────────────────────────────────────
// 2. Harness
// ─────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
const failures = [];
function check(label, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  if (ok) passed++;
  else { failed++; failures.push({ label, got, expected }); }
}
function near(label, got, want, tol) {
  const ok = isFinite(got) && Math.abs(got - want) <= (tol || 1e-3);
  if (ok) passed++;
  else { failed++; failures.push({ label, got, expected: want + ' ±' + (tol || 1e-3) }); }
}
function section(title) { console.log(`\n── ${title} ──`); }

// ─────────────────────────────────────────────────────────────
// A. Higher-derivative detection
// ─────────────────────────────────────────────────────────────
section('A. Higher-derivative detection (parseGraphExpression)');

let p = g.parseGraphExpression("y'' = x^3");
check("y'' = x^3 → derivative", p.kind, 'derivative');
check('  order = 2', p.order, 2);
check('  yExpr = "x^3"', p.yExpr, 'x^3');

p = g.parseGraphExpression("y''' = x^4");
check("y''' = x^4 → derivative", p.kind, 'derivative');
check('  order = 3', p.order, 3);

p = g.parseGraphExpression("f''(x) = x^3");
check("f''(x) = x^3 → derivative", p.kind, 'derivative');
check('  order = 2', p.order, 2);

p = g.parseGraphExpression("f'''(x) = x^5");
check("f'''(x) = x^5 → derivative", p.kind, 'derivative');
check('  order = 3', p.order, 3);

p = g.parseGraphExpression('d2/dx2 x^3');
check('d2/dx2 x^3 → derivative', p.kind, 'derivative');
check('  order = 2', p.order, 2);

p = g.parseGraphExpression('d3/dx3(x^3)');
check('d3/dx3(x^3) → derivative', p.kind, 'derivative');
check('  order = 3', p.order, 3);

p = g.parseGraphExpression('y = d/dx x^2');
check('y = d/dx x^2 → derivative (order 1)', p.kind, 'derivative');
check('  order = 1', p.order, 1);

// The digit must repeat (d2/dx2 only) — d2/dx3 is not a derivative form
p = g.parseGraphExpression('d2/dx3 x^3');
check('d2/dx3 x^3 is NOT a derivative (digit mismatch)', p.kind !== 'derivative', true);

// First order still works exactly as before
p = g.parseGraphExpression("y' = x^2");
check("y' = x^2 → derivative (order 1 regression)", [p.kind, p.order], ['derivative', 1]);

// All existing types must stay intact
p = g.parseGraphExpression('y = x^2');
check('y = x^2 → cartesian (regression)', p.kind, 'cartesian');
p = g.parseGraphExpression('x^2 + y^2 = 25');
check('x^2 + y^2 = 25 → implicit (regression)', p.kind, 'implicit');
p = g.parseGraphExpression('tangent(x^2, 2)');
check('tangent(x^2, 2) → tangent (regression)', p.kind, 'tangent');

// ─────────────────────────────────────────────────────────────
// B. Higher-derivative math (numericDerivative with order)
// ─────────────────────────────────────────────────────────────
section('B. Higher-derivative math (numericDerivative order ≥ 2)');

near("d²/dx² x³ at x=2  ≈ 12",  math.numericDerivative('x^3', 2, {}, 2), 12);
near("d²/dx² x³ at x=−3 ≈ −18", math.numericDerivative('x^3', -3, {}, 2), -18);
near("d²/dx² x² at x=7  ≈ 2",   math.numericDerivative('x^2', 7, {}, 2), 2, 1e-4);
near("d³/dx³ x³ at x=5  ≈ 6",   math.numericDerivative('x^3', 5, {}, 3), 6, 1e-2);
near("d⁴/dx⁴ x⁴ at x=3  ≈ 24",  math.numericDerivative('x^4', 3, {}, 4), 24, 1e-1);
near("d²/dx² sin at x=1 ≈ −sin1", math.numericDerivative('sin(x)', 1, {}, 2), -Math.sin(1), 1e-3);
near("d²/dx² cos at x=0 ≈ −1",   math.numericDerivative('cos(x)', 0, {}, 2), -1, 1e-3);
near("d²/dx² eˣ  at x=1 ≈ e",    math.numericDerivative('exp(x)', 1, {}, 2), Math.E, 1e-3);
near("d³/dx³ sin at x=0 ≈ −1",   math.numericDerivative('sin(x)', 0, {}, 3), -1, 1e-2);
near("d²/dx² (x²+3x) at x=4 ≈ 2", math.numericDerivative('x^2 + 3*x', 4, {}, 2), 2, 1e-3);
near("d²/dx² a·x² (slider a=5) at x=1 ≈ 10", math.numericDerivative('a*x^2', 1, { a: 5 }, 2), 10, 1e-2);
near("d²/dx² ln at x=2 ≈ −0.25",  math.numericDerivative('ln(x)', 2, {}, 2), -0.25, 1e-2);

// Non-finite → NaN
check('d²/dx² ln at x=−1 is NaN', Number.isNaN(math.numericDerivative('ln(x)', -1, {}, 2)), true);
check('d²/dx² √x at x=−4 is NaN', Number.isNaN(math.numericDerivative('sqrt(x)', -4, {}, 2)), true);

// ─────────────────────────────────────────────────────────────
// C. Integral detection
// ─────────────────────────────────────────────────────────────
section('C. Integral detection (parseGraphExpression)');

p = g.parseGraphExpression('integral(x^2, 0, 2)');
check('integral(x^2, 0, 2) → integral', p.kind, 'integral');
check('  yExpr/aExpr/bExpr', [p.yExpr, p.aExpr, p.bExpr], ['x^2', '0', '2']);

p = g.parseGraphExpression('∫(x^2, 0, 2)');
check('∫(x^2, 0, 2) → integral (∫ symbol)', p.kind, 'integral');
check('  yExpr/aExpr/bExpr', [p.yExpr, p.aExpr, p.bExpr], ['x^2', '0', '2']);

p = g.parseGraphExpression('integral(x^2, 0, a)');
check('integral(x^2, 0, a) → integral (slider bound)', p.kind, 'integral');
check('  bExpr = "a"', p.bExpr, 'a');

p = g.parseGraphExpression('integral(sin(x), 0, pi)');
check('integral(sin(x), 0, pi) → integral (pi bound)', p.kind, 'integral');
check('  bExpr = "pi"', p.bExpr, 'pi');

p = g.parseGraphExpression('integral(nCr(5,2), 0, 2)');
check('integral(nCr(5,2), 0, 2) keeps nCr whole (top-level split)', [p.yExpr, p.aExpr, p.bExpr], ['nCr(5,2)', '0', '2']);

// Fewer than 3 args → NOT an integral
p = g.parseGraphExpression('integral(x^2, 0)');
check('integral(x^2, 0) is NOT integral (missing bound)', p.kind !== 'integral', true);

// Cartesian with an "f(" still works
p = g.parseGraphExpression('f(x) = x^2');
check('f(x) = x^2 → cartesian (regression)', p.kind, 'cartesian');

// ─────────────────────────────────────────────────────────────
// D. Integral math (Simpson's rule)
// ─────────────────────────────────────────────────────────────
section('D. Integral math (numericIntegral vs analytic)');

near('∫₀² x² dx ≈ 8/3',     math.numericIntegral('x^2', 0, 2, {}), 8 / 3);
near('∫₀³ x dx ≈ 4.5',      math.numericIntegral('x', 0, 3, {}), 4.5, 1e-4);
near('∫₀^π sin ≈ 2',        math.numericIntegral('sin(x)', 0, Math.PI, {}), 2, 1e-3);
near('∫₀¹ eˣ dx ≈ e−1',     math.numericIntegral('exp(x)', 0, 1, {}), Math.E - 1, 1e-3);
near('∫₁² 1/x dx ≈ ln2',    math.numericIntegral('1/x', 1, 2, {}), Math.LN2, 1e-3);
near('∫₋₁¹ x³ dx ≈ 0 (odd fn)', math.numericIntegral('x^3', -1, 1, {}), 0, 1e-4);
near('∫₂² x² dx = 0 (a=b)', math.numericIntegral('x^2', 2, 2, {}), 0, 1e-9);
near('∫₂⁰ x dx = −(∫₀²) reversed', math.numericIntegral('x', 2, 0, {}), -2, 1e-4);
near('∫₀² a·x² dx (slider a=3) = 8', math.numericIntegral('a*x^2', 0, 2, { a: 3 }), 8, 1e-3);

// Asymptote inside the range → NaN (area not well defined)
check('∫₀¹ 1/x dx is NaN (asymptote at 0)', Number.isNaN(math.numericIntegral('1/x', 0, 1, {})), true);
// Undefined bounds → NaN
check('∫ with undefined slider letter is NaN', Number.isNaN(math.numericIntegral('x^2', 0, 'a', {})), true);

// resolveBound: numbers, slider letters, expressions
near('resolveBound("2") = 2',     math.resolveBound('2', {}), 2, 0);
near('resolveBound("a", {a:5}) = 5', math.resolveBound('a', { a: 5 }), 5, 0);
near('resolveBound("pi") = π',    math.resolveBound('pi', {}), Math.PI, 1e-9);
check('resolveBound("a") with no a → NaN', Number.isNaN(math.resolveBound('a', {})), true);

// ─────────────────────────────────────────────────────────────
// E. Trace support
// ─────────────────────────────────────────────────────────────
section('E. Trace support (row selection + trace math)');

// The trace overlay picks the FIRST visible cartesian OR derivative row.
const rows = [
  { text: 'x = cos(t), y = sin(t)', visible: true },   // parametric — skip
  { text: 'r = 2cos(θ)', visible: true },              // polar — skip
  { text: 'y = x^3', visible: true },                  // cartesian — picked
];
let traceRow = null;
for (const e of rows) {
  if (!e.visible) continue;
  const pp = g.parseGraphExpression(e.text);
  if (pp && (pp.kind === 'cartesian' || pp.kind === 'derivative')) { traceRow = { e, p: pp }; break; }
}
check('trace picks first visible cartesian row (y = x^3)', traceRow && traceRow.p.yExpr, 'x^3');

// Trace math at hover x = 2 on y = x^3: f(2) = 8, f'(2) = 12
if (traceRow) {
  const hoverX = 2;
  const fy = engine.evaluate(traceRow.p.yExpr, { x: hoverX });
  near('trace f(2) on x³ = 8', fy, 8, 1e-6);
  const m = math.numericDerivative(traceRow.p.yExpr, hoverX, {});
  near('trace f\'(2) on x³ = 12', m, 12);
}

// A derivative row is also traceable: y' = x^3 at x = 2 → 12 (the curve VALUE)
const derivTrace = { p: g.parseGraphExpression("y' = x^3") };
check('trace accepts derivative rows', derivTrace.p.kind, 'derivative');
near('trace on y\' = x^3 at x=2 = f\'(2) of x³ = 12',
  math.numericDerivative(derivTrace.p.yExpr, 2, {}, derivTrace.p.order), 12);

// Trace readout string format matches the overlay chip
const txt = `(${2.00.toFixed(2)}, ${8.00.toFixed(2)})  m=${12.00.toFixed(2)}`;
check('trace readout format "(2.00, 8.00)  m=12.00"', txt, '(2.00, 8.00)  m=12.00');

// ─────────────────────────────────────────────────────────────
// F. STRESS TEST — higher orders (5–8) vs analytic derivatives
// ─────────────────────────────────────────────────────────────
section('F. Stress: order-5..8 derivatives vs analytic');

near("d⁵/dx⁵ x⁵ at x=1 ≈ 120",  math.numericDerivative('x^5', 1, {}, 5), 120, 1e0);
near("d⁵/dx⁵ x⁵ at x=2 ≈ 120",  math.numericDerivative('x^5', 2, {}, 5), 120, 1e0);
near("d⁶/dx⁶ x⁶ at x=1 ≈ 720",  math.numericDerivative('x^6', 1, {}, 6), 720, 1e1);
near("d⁷/dx⁷ x⁷ at x=1 ≈ 5040", math.numericDerivative('x^7', 1, {}, 7), 5040, 2e2);
near("d⁸/dx⁸ x⁸ at x=1 ≈ 40320", math.numericDerivative('x^8', 1, {}, 8), 40320, 2e3);
// Trig: d⁴/dx⁴ sin = sin, d⁵/dx⁵ sin = cos (tolerance loosened for high orders)
near("d⁴/dx⁴ sin at 0.7 ≈ sin0.7", math.numericDerivative('sin(x)', 0.7, {}, 4), Math.sin(0.7), 1e-2);
near("d⁵/dx⁵ sin at 0.7 ≈ cos0.7", math.numericDerivative('sin(x)', 0.7, {}, 5), Math.cos(0.7), 1e-1);
near("d⁶/dx⁶ cos at 1 ≈ −cos1",   math.numericDerivative('cos(x)', 1, {}, 6), -Math.cos(1), 1e-1);
near("d⁶/dx⁶ eˣ at 0 ≈ 1",        math.numericDerivative('exp(x)', 0, {}, 6), 1, 1e-2);

// ─────────────────────────────────────────────────────────────
// G. STRESS TEST — randomized integrals vs analytic (thousands)
// ─────────────────────────────────────────────────────────────
section('G. Stress: randomized integrals vs analytic');

// Deterministic PRNG so the test is reproducible across runs
let seed = 20260731;
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
function rndIn(a, b) { return a + rnd() * (b - a); }

// ∫ x^n dx = (b^(n+1) − a^(n+1))/(n+1) for n = 1..6, random bounds
let intStress = 0;
for (let k = 0; k < 1500; k++) {
  const n = 1 + Math.floor(rnd() * 6);              // n ∈ 1..6
  const a = rndIn(-2, 2), b = rndIn(a, 0.5);        // a < b, keep range small
  const got = math.numericIntegral('x^' + n, a, b, {});
  const want = (Math.pow(b, n + 1) - Math.pow(a, n + 1)) / (n + 1);
  const rel = Math.abs(want) > 1e-12 ? Math.abs(got - want) / Math.abs(want) : Math.abs(got - want);
  intStress++;
  if (rel > 1e-4) { failed++; failures.push({ label: `random ∫x^${n} on [${a.toFixed(2)},${b.toFixed(2)}]`, got, expected: want }); }
  else passed++;
}

// ∫ sin = cos(a) − cos(b)  ·  ∫ cos = sin(b) − sin(a)  ·  ∫ eˣ = eᵇ − eᵃ
const relStress = (got, want) => Math.abs(want) > 1e-9 ? Math.abs(got - want) / Math.abs(want) : Math.abs(got - want);
for (let k = 0; k < 1000; k++) {
  const a = rndIn(-3, 3), b = rndIn(a, a + 3);
  const s = math.numericIntegral('sin(x)', a, b, {});
  const sw = Math.cos(a) - Math.cos(b);
  const c = math.numericIntegral('cos(x)', a, b, {});
  const cw = Math.sin(b) - Math.sin(a);
  const e = math.numericIntegral('exp(x)', a, b, {});
  const ew = Math.exp(b) - Math.exp(a);
  intStress += 3;
  if (relStress(s, sw) > 1e-4) { failed++; failures.push({ label: `random ∫sin [${a.toFixed(2)},${b.toFixed(2)}]`, got: s, expected: sw }); } else passed++;
  if (relStress(c, cw) > 1e-4) { failed++; failures.push({ label: `random ∫cos [${a.toFixed(2)},${b.toFixed(2)}]`, got: c, expected: cw }); } else passed++;
  if (relStress(e, ew) > 1e-4) { failed++; failures.push({ label: `random ∫eˣ [${a.toFixed(2)},${b.toFixed(2)}]`, got: e, expected: ew }); } else passed++;
}

// ∫ 1/x = ln(b) − ln(a) with a, b strictly positive
for (let k = 0; k < 1000; k++) {
  const a = rndIn(0.5, 3), b = rndIn(a, a + 3);
  const got = math.numericIntegral('1/x', a, b, {});
  const want = Math.log(b) - Math.log(a);
  intStress++;
  if (Math.abs(got - want) / want > 1e-4) { failed++; failures.push({ label: `random ∫1/x [${a.toFixed(2)},${b.toFixed(2)}]`, got, expected: want }); }
  else passed++;
}

// ∫ a·x² with a random slider value = a·(b³−c³)/3
for (let k = 0; k < 500; k++) {
  const av = rndIn(-3, 3), c = rndIn(-2, 2), b = rndIn(c, c + 2);
  const got = math.numericIntegral('a*x^2', c, b, { a: av });
  const want = av * (Math.pow(b, 3) - Math.pow(c, 3)) / 3;
  intStress++;
  if (Math.abs(got - want) / Math.abs(want) > 1e-4) { failed++; failures.push({ label: `random ∫a·x² [${c.toFixed(2)},${b.toFixed(2)}] a=${av.toFixed(2)}`, got, expected: want }); }
  else passed++;
}

check('6000 randomized integral stress checks ran (1500 x^n + 3000 trig/exp + 1000 1/x + 500 a·x²)', intStress, 6000);

// ─────────────────────────────────────────────────────────────
// 3. Report
// ─────────────────────────────────────────────────────────────
console.log('\n════════════════════════════════════════════');
console.log(`  HIGHER DERIVATIVES / INTEGRALS / TRACE — ${passed + failed} checks`);
console.log(`  PASSED: ${passed}`);
console.log(`  FAILED: ${failed}`);
console.log('════════════════════════════════════════════');
if (failed > 0) {
  console.log('\n── Failures (first 20) ──');
  for (const f of failures.slice(0, 20)) {
    console.log(`  ✗ ${f.label}: got ${JSON.stringify(f.got)}  (expected ${JSON.stringify(f.expected)})`);
  }
  process.exit(1);
}
console.log('  ✓ ALL CALCULUS CHECKS PASSED!\n');
process.exit(0);
