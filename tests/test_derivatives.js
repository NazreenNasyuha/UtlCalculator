/**
 * Derivatives & Tangent Lines — Unit Tests
 *
 * Verifies the new calculus features of the graphing engine:
 *
 *   A. DETECTION — parseGraphExpression() (extracted verbatim from graph.js)
 *      classifies the new curve types correctly:
 *        "y' = x^3"         → derivative  (yExpr "x^3")
 *        "f'(x) = x^3"      → derivative  (yExpr "x^3")
 *        "d/dx x^3"         → derivative  (yExpr "x^3")
 *        "d/dx(x^3)"        → derivative  (yExpr "x^3")
 *        "tangent(x^2, 2)"  → tangent     (yExpr "x^2", point "2")
 *        "tangent(x^2, a)"  → tangent     (point "a" → gets a slider)
 *      while every existing type stays intact (cartesian, parametric, polar,
 *      implicit — crucially "y' = x^2" must NOT be misread as an implicit
 *      equation even though it contains an '=').
 *
 *   B. NUMERIC DERIVATIVE — numericDerivative() (also extracted from graph.js)
 *      is compared against the ANALYTIC derivative for classic functions:
 *        d/dx x^2  at x=3 ≈ 6         d/dx x^3 at x=2 ≈ 12
 *        d/dx sin  at x=0 ≈ 1         d/dx cos at x=π ≈ 0
 *        d/dx e^x  at x=1 ≈ e         d/dx ln  at x=2 ≈ 0.5
 *        d/dx 1/x  at x=2 ≈ −0.25     d/dx of a constant ≈ 0
 *      and that non-finite points (e.g. ln(x) at x ≤ 0) yield NaN so the
 *      plotter breaks the line exactly like an asymptote.
 *
 *   C. TANGENT LINES — for "tangent(f, a)" the drawn line is
 *      y = f(a) + f'(a)·(x − a): verify it passes through the curve at x = a
 *      and has the analytic slope — including with a slider point
 *      ("tangent(x^2, a)" at a = 3 → slope 6, through (3, 9)).
 *
 *   D. CURVE SAMPLE — plot d/dx sin(x) across samples and confirm it tracks
 *      cos(x) (the engine's derivative curve really is the derivative).
 *
 * Run with: node test_derivatives.js
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

// parseGraphExpression calls stripPrefix and findTopLevelEquals — extract all three.
const graphBlock = extractFn('stripPrefix') + '\n' + extractFn('findTopLevelEquals') + '\n' + extractFn('parseGraphExpression');
if (/document\.|window\.|addEventListener/.test(graphBlock)) {
  console.error('✗ Extracted graph block references DOM');
  process.exit(1);
}
const g = new Function(graphBlock + '\nreturn {stripPrefix, findTopLevelEquals, parseGraphExpression};')();

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

// numericDerivative() in graph.js calls evaluate() (imported from engine.js).
// Inject the engine's evaluate as a parameter so the extracted function works.
const derivBlock = extractFn('numericDerivative');
if (/document\.|window\.|addEventListener/.test(derivBlock)) {
  console.error('✗ Extracted numericDerivative references DOM');
  process.exit(1);
}
const math = new Function('evaluate', derivBlock + '\nreturn {numericDerivative};')(engine.evaluate);

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
// A. Detection
// ─────────────────────────────────────────────────────────────
section('A. Derivative & tangent detection (parseGraphExpression)');

// Derivative forms
let p = g.parseGraphExpression("y' = x^3");
check("y' = x^3 → derivative", p.kind, 'derivative');
check("  yExpr = \"x^3\"", p.yExpr, 'x^3');

p = g.parseGraphExpression("f'(x) = x^3");
check("f'(x) = x^3 → derivative", p.kind, 'derivative');
check("  yExpr = \"x^3\"", p.yExpr, 'x^3');

p = g.parseGraphExpression('d/dx x^3');
check('d/dx x^3 → derivative', p.kind, 'derivative');
check("  yExpr = \"x^3\"", p.yExpr, 'x^3');

p = g.parseGraphExpression('d/dx(x^3 + 1)');
check('d/dx(x^3 + 1) → derivative', p.kind, 'derivative');
check('  yExpr = \"x^3 + 1\"', p.yExpr, 'x^3 + 1');

p = g.parseGraphExpression('y = d/dx x^2');
check('y = d/dx x^2 → derivative (via y = prefix)', p.kind, 'derivative');
check("  yExpr = \"x^2\"", p.yExpr, 'x^2');

p = g.parseGraphExpression('d/dx');
check('bare "d/dx" → empty derivative scaffold', [p.kind, p.yExpr], ['derivative', '']);

// Tangent forms
p = g.parseGraphExpression('tangent(x^2, 2)');
check('tangent(x^2, 2) → tangent', p.kind, 'tangent');
check('  yExpr = \"x^2\", point = \"2\"', [p.yExpr, p.point], ['x^2', '2']);

p = g.parseGraphExpression('tangent(x^2, a)');
check('tangent(x^2, a) → tangent (slider point)', p.kind, 'tangent');
check('  point = \"a\"', p.point, 'a');

p = g.parseGraphExpression('tangent(sin(x), 0.5)');
check('tangent(sin(x), 0.5) → tangent (decimal point)', p.kind, 'tangent');
check('  point = \"0.5\"', p.point, '0.5');

// CRITICAL regression: "y' = x^2" contains '=' but must NOT be implicit
p = g.parseGraphExpression("y' = x^2");
check("y' = x^2 is NOT implicit (has = but is a derivative)", p.kind !== 'implicit', true);

// All existing types must stay intact
p = g.parseGraphExpression('y = x^2');
check('y = x^2 → cartesian (regression)', p.kind, 'cartesian');
p = g.parseGraphExpression('x^2 + y^2 = 25');
check('x^2 + y^2 = 25 → implicit (regression)', p.kind, 'implicit');
p = g.parseGraphExpression('x = cos(t), y = sin(t)');
check('x = cos(t), y = sin(t) → parametric (regression)', p.kind, 'parametric');
p = g.parseGraphExpression('r = 2cos(θ)');
check('r = 2cos(θ) → polar (regression)', p.kind, 'polar');

// ─────────────────────────────────────────────────────────────
// B. Numeric derivative vs analytic
// ─────────────────────────────────────────────────────────────
section('B. Numeric derivative (central difference) vs analytic');

near("d/dx x^2  at x=3  ≈ 6",  math.numericDerivative('x^2', 3, {}), 6);
near("d/dx x^3  at x=2  ≈ 12", math.numericDerivative('x^3', 2, {}), 12);
near("d/dx sin  at x=0  ≈ 1",  math.numericDerivative('sin(x)', 0, {}), 1);
near("d/dx cos  at x=π  ≈ 0",  math.numericDerivative('cos(x)', Math.PI, {}), 0, 1e-3);
near("d/dx e^x  at x=1  ≈ e",  math.numericDerivative('exp(x)', 1, {}), Math.E);
near("d/dx ln   at x=2  ≈ 0.5", math.numericDerivative('ln(x)', 2, {}), 0.5);
near("d/dx 1/x  at x=2  ≈ −0.25", math.numericDerivative('1/x', 2, {}), -0.25);
near("d/dx 5    at x=9  ≈ 0 (constant)", math.numericDerivative('5', 9, {}), 0, 1e-6);
near("d/dx x^2  at x=−4 ≈ −8", math.numericDerivative('x^2', -4, {}), -8);
near("d/dx √x   at x=4  ≈ 0.25", math.numericDerivative('sqrt(x)', 4, {}), 0.25);
near("d/dx a·x^2 with slider a=3 at x=2 ≈ 12", math.numericDerivative('a*x^2', 2, { a: 3 }), 12);

// Non-finite → NaN (line break like an asymptote)
check('d/dx ln at x=-1 is NaN (undefined)', Number.isNaN(math.numericDerivative('ln(x)', -1, {})), true);
check('d/dx √x at x=-4 is NaN', Number.isNaN(math.numericDerivative('sqrt(x)', -4, {})), true);

// ─────────────────────────────────────────────────────────────
// C. Tangent lines
// ─────────────────────────────────────────────────────────────
section('C. Tangent line math (y = f(a) + f\'(a)·(x − a))');

// Replicate the drawScene tangent computation for tangent(x^2, 2):
const tang = (expr, point, vals) => {
  const a = /^[a-zA-Z]$/.test(point) ? (vals[point] ?? NaN) : parseFloat(point);
  const fa = engine.evaluate(expr, { x: a, ...(vals || {}) });
  const ma = math.numericDerivative(expr, a, vals || {});
  return { a, fa, ma };
};

let t = tang('x^2', '2', {});
near('tangent(x^2, 2): touch point a = 2', t.a, 2, 0);
near('tangent(x^2, 2): f(2) = 4 (curve value)', t.fa, 4, 1e-6);
near('tangent(x^2, 2): slope f\'(2) ≈ 4', t.ma, 4);
// The line y = fa + ma(x − a) must equal the curve at x = a...
near('line value at x=a equals curve', t.fa + t.ma * (t.a - t.a), t.fa, 1e-9);
// ...and approximate it nearby: at x = 2.1 the line ≈ 4 + 4·0.1 = 4.4 (x² = 4.41)
near('line at x=2.1 ≈ 4.4 (secant close to 4.41)', t.fa + t.ma * (2.1 - t.a), 4.4, 0.05);

// tangent(x^2, a) with the slider set to a = 3 → slope 6, through (3, 9)
t = tang('x^2', 'a', { a: 3 });
near('tangent(x^2, a) with a=3: f(3) = 9', t.fa, 9, 1e-6);
near('tangent(x^2, a) with a=3: slope ≈ 6', t.ma, 6);
near('line at x=4 with a=3: 9 + 6·1 = 15', t.fa + t.ma * (4 - t.a), 15, 0.01);

// tangent(sin(x), 0) → slope 1 (cos(0)=1), through (0, 0)
t = tang('sin(x)', '0', {});
near('tangent(sin(x), 0): slope ≈ 1', t.ma, 1);
near('tangent(sin(x), 0): f(0) ≈ 0', t.fa, 0, 1e-6);
near('line at x=0.5 ≈ 0.5 (sin ≈ 0.479)', t.fa + t.ma * (0.5 - t.a), 0.5, 0.05);

// tangent with slider point on the circle-adjacent curve: a·sin(x), a=2, point a=1
t = tang('a*sin(x)', 'a', { a: 2 });
near('tangent(a*sin(x), a) a=2: f(2) = 2·sin2 ≈ 1.819', t.fa, 2 * Math.sin(2), 1e-4);
near('tangent(a*sin(x), a) a=2: slope ≈ 2·cos2 − sin2·? no: d/dx = 2·cos2 + 0', t.ma, 2 * Math.cos(2), 0.02);

// ─────────────────────────────────────────────────────────────
// D. Curve sample — d/dx sin(x) tracks cos(x) across the viewport
// ─────────────────────────────────────────────────────────────
section('D. Derivative curve sampling (d/dx sin(x) vs cos(x))');
let curveOk = true;
for (let k = -20; k <= 20; k++) {
  const x = (k / 20) * 6;                     // sample x ∈ [−6, 6]
  const d = math.numericDerivative('sin(x)', x, {});
  if (Math.abs(d - Math.cos(x)) > 1e-3) { curveOk = false; console.log('  ✗ at x=' + x + ' got ' + d); break; }
}
check('d/dx sin(x) ≈ cos(x) at 41 samples across [−6,6]', curveOk, true);

// Also confirm the constant rule on a polynomial derivative curve
let polyOk = true;
for (let k = 0; k <= 10; k++) {
  const x = -5 + k;                            // x ∈ [−5, 5]
  const d = math.numericDerivative('x^2 + 3*x + 1', x, {});
  if (Math.abs(d - (2 * x + 3)) > 1e-3) { polyOk = false; console.log('  ✗ at x=' + x + ' got ' + d); break; }
}
check('d/dx (x²+3x+1) ≈ 2x+3 at 11 samples', polyOk, true);

// ─────────────────────────────────────────────────────────────
// 3. Report
// ─────────────────────────────────────────────────────────────
console.log('\n════════════════════════════════════════════');
console.log(`  DERIVATIVES & TANGENTS — ${passed + failed} checks`);
console.log(`  PASSED: ${passed}`);
console.log(`  FAILED: ${failed}`);
console.log('════════════════════════════════════════════');
if (failed > 0) {
  console.log('\n── Failures ──');
  for (const f of failures.slice(0, 20)) {
    console.log(`  ✗ ${f.label}: got ${JSON.stringify(f.got)}  (expected ${JSON.stringify(f.expected)})`);
  }
  process.exit(1);
}
console.log('  ✓ ALL DERIVATIVE & TANGENT CHECKS PASSED!\n');
process.exit(0);
