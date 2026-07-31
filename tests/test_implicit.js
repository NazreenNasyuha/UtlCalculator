/**
 * Implicit Curves — Unit Tests
 *
 * Verifies the implicit-equation feature of the graphing engine:
 *
 *   A. DETECTION — parseGraphExpression() (extracted verbatim from graph.js)
 *      classifies equations with a top-level '=' as IMPLICIT:
 *        "x^2 + y^2 = 25"   → implicit  (lhs "x^2 + y^2", rhs "25")
 *        "x = 3"            → implicit  (vertical line: lhs "x", rhs "3")
 *        "sin(x) = cos(y)"  → implicit
 *      while keeping every other curve type intact:
 *        "y = x^2"          → cartesian
 *        "x^2"              → cartesian
 *        "x = cos(t), y = sin(t)" → parametric
 *        "r = 2cos(θ)"      → polar
 *   B. MATH — the engine evaluates both sides correctly, so the marching-squares
 *      renderer's f(x,y) = lhs − rhs really is zero on the curve:
 *        f(3,4) ≈ 0 for x^2 + y^2 = 25      (3² + 4² = 25)
 *        f(3,4) ≠ 0 for the wrong circle
 *
 * Run with: node test_implicit.js
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
function section(title) { console.log(`\n── ${title} ──`); }

// ─────────────────────────────────────────────────────────────
// A. Detection
// ─────────────────────────────────────────────────────────────
section('A. Implicit-curve detection (parseGraphExpression)');

// Implicit equations
let p = g.parseGraphExpression('x^2 + y^2 = 25');
check('x^2 + y^2 = 25 → implicit', p.kind, 'implicit');
check('  lhs = "x^2 + y^2"', p.lhsExpr, 'x^2 + y^2');
check('  rhs = "25"', p.rhsExpr, '25');

p = g.parseGraphExpression('x = 3');
check('x = 3 → implicit (vertical line)', p.kind, 'implicit');
check('  lhs = "x", rhs = "3"', [p.lhsExpr, p.rhsExpr], ['x', '3']);

p = g.parseGraphExpression('sin(x) = cos(y)');
check('sin(x) = cos(y) → implicit', p.kind, 'implicit');
check('  lhs/rhs', [p.lhsExpr, p.rhsExpr], ['sin(x)', 'cos(y)']);

p = g.parseGraphExpression('x^2 + y^2 = a^2');
check('x^2 + y^2 = a^2 → implicit (slider var a)', p.kind, 'implicit');
check('  lhs/rhs', [p.lhsExpr, p.rhsExpr], ['x^2 + y^2', 'a^2']);

// Parens: the '=' inside parens must NOT be treated as the equation split
p = g.parseGraphExpression('(x-1)^2 + (y+2)^2 = 9');
check('(x-1)^2 + (y+2)^2 = 9 → implicit', p.kind, 'implicit');
check('  lhs/rhs', [p.lhsExpr, p.rhsExpr], ['(x-1)^2 + (y+2)^2', '9']);

// Non-implicit types must stay intact
p = g.parseGraphExpression('y = x^2');
check('y = x^2 → cartesian', p.kind, 'cartesian');
check('  yExpr', p.yExpr, 'x^2');

p = g.parseGraphExpression('x^2');
check('x^2 → cartesian (no =)', p.kind, 'cartesian');
check('  yExpr', p.yExpr, 'x^2');

p = g.parseGraphExpression('f(x) = x^2+1');
check('f(x) = x^2+1 → cartesian', p.kind, 'cartesian');
check('  yExpr', p.yExpr, 'x^2+1');

p = g.parseGraphExpression('x = cos(t), y = sin(t)');
check('x = cos(t), y = sin(t) → parametric', p.kind, 'parametric');
check('  xExpr/yExpr', [p.xExpr, p.yExpr], ['cos(t)', 'sin(t)']);

p = g.parseGraphExpression('r = 2cos(θ)');
check('r = 2cos(θ) → polar', p.kind, 'polar');
check('  rExpr', p.rExpr, '2cos(θ)');

p = g.parseGraphExpression('r = 2');
check('r = 2 → polar (circle)', p.kind, 'polar');

// findTopLevelEquals unit checks
check('findTopLevelEquals("x^2 + y^2 = 25") = 10', g.findTopLevelEquals('x^2 + y^2 = 25'), 10);
check('findTopLevelEquals("x = 3") = 2', g.findTopLevelEquals('x = 3'), 2);
check('findTopLevelEquals("(x=2)+3") = -1 (skip inner =)', g.findTopLevelEquals('(x=2)+3'), -1);
check('findTopLevelEquals("abc") = -1', g.findTopLevelEquals('abc'), -1);

// ─────────────────────────────────────────────────────────────
// B. Math — f(x,y) = lhs − rhs is zero ON the curve
// ─────────────────────────────────────────────────────────────
section('B. Implicit math (engine evaluate with x AND y bound)');
const lhs = 'x^2 + y^2', rhs = '25';
const f = (x, y) => engine.evaluate(lhs, { x, y }) - engine.evaluate(rhs, { x, y });
check('f(3,4) ≈ 0 for x^2+y^2=25', Math.abs(f(3, 4)) < 1e-9, true);
check('f(0,5) ≈ 0 for x^2+y^2=25', Math.abs(f(0, 5)) < 1e-9, true);
check('f(-3,-4) ≈ 0 for x^2+y^2=25', Math.abs(f(-3, -4)) < 1e-9, true);
check('f(10,0) ≠ 0 (outside the circle)', Math.abs(f(10, 0)) > 1, true);
// vertical line x = 3 → f(x,y) = x - 3
const gv = (x) => engine.evaluate('x', { x, y: 0 }) - engine.evaluate('3', { x, y: 0 });
check('g(3) ≈ 0 for x = 3', Math.abs(gv(3)) < 1e-9, true);
check('g(7) ≠ 0 for x = 3', Math.abs(gv(7)) > 1, true);
// sliders participate: x^2 + y^2 = a^2 → f(3,4) with a=5 is 0
const fa = (x, y, a) => engine.evaluate('x^2 + y^2', { x, y, a }) - engine.evaluate('a^2', { x, y, a });
check('f(3,4) with a=5 ≈ 0', Math.abs(fa(3, 4, 5)) < 1e-9, true);
check('f(3,4) with a=1 ≠ 0', Math.abs(fa(3, 4, 1)) > 1, true);

// ─────────────────────────────────────────────────────────────
// C. Curve sampling — points ON an implicit curve must satisfy
//    f(x,y) = lhs − rhs ≈ 0 (this is exactly what the adaptive
//    marching-squares renderer relies on). We sample classic curves
//    at exact, known points.
// ─────────────────────────────────────────────────────────────
section('C. Implicit curve sampling (f(x,y) ≈ 0 on the curve)');
const fAt = (lhs, rhs, x, y, extra) => {
  const ctx = { x, y, ...(extra || {}) };
  return engine.evaluate(lhs, ctx) - engine.evaluate(rhs, ctx);
};

// C1. Circle: x² + y² = 25  (radius 5)
for (const t of [0, Math.PI / 6, Math.PI / 4, Math.PI / 3, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
  const x = 5 * Math.cos(t), y = 5 * Math.sin(t);
  check(`circle x²+y²=25 at (${x.toFixed(3)}, ${y.toFixed(3)})`, Math.abs(fAt('x^2 + y^2', '25', x, y)) < 1e-9, true);
}
check('circle: (10, 0) is OFF the curve', Math.abs(fAt('x^2 + y^2', '25', 10, 0)) > 1, true);

// C2. Vertical line: x = 3
for (const y of [-9, -0.5, 0, 2.5, 9]) {
  check(`x=3 at y=${y}`, Math.abs(fAt('x', '3', 3, y)) < 1e-9, true);
}
check('x=3: (5, 0) is OFF the line', Math.abs(fAt('x', '3', 5, 0)) > 1, true);

// C3. Ellipse: x²/9 + y²/4 = 1  (semi-axes 3 and 2)
for (const t of [0, Math.PI / 4, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
  const x = 3 * Math.cos(t), y = 2 * Math.sin(t);
  check(`ellipse x²/9+y²/4=1 at (${x.toFixed(3)}, ${y.toFixed(3)})`, Math.abs(fAt('x^2/9 + y^2/4', '1', x, y)) < 1e-9, true);
}
check('ellipse: (3, 3) is OFF', Math.abs(fAt('x^2/9 + y^2/4', '1', 3, 3)) > 0.5, true);

// C4. Hyperbola: x² − y² = 9
for (const [x, y] of [[5, 4], [Math.sqrt(13), 2], [-5, 4], [Math.sqrt(34), 5]]) {
  check(`hyperbola x²−y²=9 at (${x.toFixed(3)}, ${y.toFixed(3)})`, Math.abs(fAt('x^2 - y^2', '9', x, y)) < 1e-9, true);
}
check('hyperbola: (1, 1) is OFF', Math.abs(fAt('x^2 - y^2', '9', 1, 1)) > 1, true);

// C5. Slider-parametrized circle: x² + y² = a²  (a = 5)
for (const t of [0, Math.PI / 3, Math.PI, (4 * Math.PI) / 3]) {
  const x = 5 * Math.cos(t), y = 5 * Math.sin(t);
  check(`slider circle x²+y²=a² with a=5 at (${x.toFixed(3)}, ${y.toFixed(3)})`, Math.abs(fAt('x^2 + y^2', 'a^2', x, y, { a: 5 })) < 1e-9, true);
}
check('slider circle with a=1: (3,4) is OFF', Math.abs(fAt('x^2 + y^2', 'a^2', 3, 4, { a: 1 })) > 1, true);

// C6. Trig implicit: sin(x) = cos(y) — (π/4, π/4) satisfies it
check('sin(x)=cos(y) at (π/4, π/4)', Math.abs(fAt('sin(x)', 'cos(y)', Math.PI / 4, Math.PI / 4)) < 1e-9, true);

// ─────────────────────────────────────────────────────────────
// 3. Report
// ─────────────────────────────────────────────────────────────
console.log('\n════════════════════════════════════════════');
console.log(`  IMPLICIT CURVES — ${passed + failed} checks`);
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
console.log('  ✓ ALL IMPLICIT CHECKS PASSED!\n');
process.exit(0);
