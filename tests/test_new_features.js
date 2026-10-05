/**
 * Test New Features Suite:
 *   1. Inequality Parsing & Detection (parseGraphExpression)
 *   2. Inequality Expression Validation (validateExpression)
 *   3. Inequality Slider Detection (syncSliders)
 *   4. Table of Values Generation (format, evaluation, step range)
 *   5. Shareable Graph State Roundtrip (exportGraphStateToUrl / importGraphStateFromUrl)
 *
 * Run with: node test_new_features.js (from tests/ directory)
 */

const fs = require('fs');
const path = require('path');

let failed = 0;
let passed = 0;

function ok(msg) {
  passed++;
  console.log('  ✓ ' + msg);
}

function fail(msg) {
  failed++;
  console.error('  ✗ ' + msg);
}

function assert(cond, msg) {
  if (cond) ok(msg);
  else fail(msg);
}

function section(name) {
  console.log('\n── ' + name + ' ──');
}

console.log('\n══════════════════════════════════════════');
console.log('  NEW FEATURES VERIFICATION SUITE');
console.log('══════════════════════════════════════════');

// Load engine and graph modules in a sandboxed context
const graphSrc = fs.readFileSync(path.join(__dirname, '../src/graph.js'), 'utf8');
const engineSrc = fs.readFileSync(path.join(__dirname, '../src/engine.js'), 'utf8');

// Minimal DOM stub for graph.js initialization
function stubElement(id) {
  const obj = {
    id: id || '',
    value: id === 'tableXStart' ? '-5' : id === 'tableXEnd' ? '5' : id === 'tableXStep' ? '1' : '',
    textContent: '',
    children: [],
    style: {},
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, removeEventListener() {},
    appendChild() {}, remove() {}, focus() {}, click() {},
    setAttribute() {}, getAttribute() { return null; },
    querySelector() { return stubElement(); },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { width: 800, height: 600 }; },
    getContext() {
      return new Proxy({}, { get() { return function() { return {}; }; } });
    }
  };
  return new Proxy(obj, {
    get(t, p) { return (p in t) ? t[p] : function() { return undefined; }; },
    set(t, p, v) { t[p] = v; return true; }
  });
}

global.document = {
  getElementById: (id) => stubElement(id),
  createElement: (tag) => stubElement(tag),
  querySelectorAll: () => [],
  addEventListener: () => {}
};
global.window = {
  location: { href: 'https://example.com/calculator.html', origin: 'https://example.com', pathname: '/calculator.html', hash: '' },
  addEventListener: () => {}
};
global.getComputedStyle = () => ({ getPropertyValue() { return ''; } });
global.location = global.window.location;

// Execute engine and graph code
const cleanEngine = engineSrc.replace(/export\s*\{[\s\S]*?\};?/g, '');
const cleanGraph = graphSrc.replace(/import\s*\{[\s\S]*?\}\s*from\s*['"][^'"]+['"]\s*;?/g, '')
                            .replace(/export\s*\{[\s\S]*?\};?/g, '');

const sandbox = new Function(cleanEngine + '\n' + cleanGraph + `
return {
  parseGraphExpression,
  validateExpression,
  syncSliders,
  graphState,
  getTablePlottableFunctions,
  exportGraphStateToUrl,
  importGraphStateFromUrl
};
`)();

const {
  parseGraphExpression,
  validateExpression,
  syncSliders,
  graphState,
  getTablePlottableFunctions,
  exportGraphStateToUrl,
  importGraphStateFromUrl
} = sandbox;

// ── 1. Inequality Detection ──
section('1. Inequality Parsing & Detection');

let p = parseGraphExpression('y <= x^2');
assert(p.kind === 'inequality' && p.subtype === 'y' && p.op === '<=' && !p.strict && p.yExpr === 'x^2', 'y <= x^2 parsed as non-strict cartesian inequality');

p = parseGraphExpression('y < 2x + 1');
assert(p.kind === 'inequality' && p.subtype === 'y' && p.op === '<' && p.strict && p.yExpr === '2x + 1', 'y < 2x + 1 parsed as strict cartesian inequality');

p = parseGraphExpression('y >= sin(x)');
assert(p.kind === 'inequality' && p.subtype === 'y' && p.op === '>=' && !p.strict && p.yExpr === 'sin(x)', 'y >= sin(x) parsed as non-strict upper inequality');

p = parseGraphExpression('y > cos(x)');
assert(p.kind === 'inequality' && p.subtype === 'y' && p.op === '>' && p.strict && p.yExpr === 'cos(x)', 'y > cos(x) parsed as strict upper inequality');

p = parseGraphExpression('y ≤ x^3');
assert(p.kind === 'inequality' && p.subtype === 'y' && p.op === '<=' && !p.strict && p.yExpr === 'x^3', 'Unicode ≤ parsed as <=');

p = parseGraphExpression('y ≥ x^3');
assert(p.kind === 'inequality' && p.subtype === 'y' && p.op === '>=' && !p.strict && p.yExpr === 'x^3', 'Unicode ≥ parsed as >=');

p = parseGraphExpression('y \\le x^2');
assert(p.kind === 'inequality' && p.subtype === 'y' && p.op === '<=' && p.yExpr === 'x^2', 'LaTeX \\le parsed as <=');

p = parseGraphExpression('y \\ge x^2');
assert(p.kind === 'inequality' && p.subtype === 'y' && p.op === '>=' && p.yExpr === 'x^2', 'LaTeX \\ge parsed as >=');

p = parseGraphExpression('x^2 >= y');
assert(p.kind === 'inequality' && p.subtype === 'y' && p.op === '<=' && p.yExpr === 'x^2', 'x^2 >= y flipped to y <= x^2');

p = parseGraphExpression('x <= 3');
assert(p.kind === 'inequality' && p.subtype === 'x' && p.op === '<=' && p.xVal === '3', 'x <= 3 parsed as vertical inequality');

p = parseGraphExpression('x > -2');
assert(p.kind === 'inequality' && p.subtype === 'x' && p.op === '>' && p.strict && p.xVal === '-2', 'x > -2 parsed as strict vertical inequality');

p = parseGraphExpression('x^2 + y^2 <= 25');
assert(p.kind === 'inequality' && p.subtype === 'implicit' && p.op === '<=' && p.lhsExpr === 'x^2 + y^2' && p.rhsExpr === '25', 'x^2 + y^2 <= 25 parsed as implicit circular inequality');

p = parseGraphExpression("y' <= 3x");
assert(p.kind === 'inequality' && p.subtype === 'derivative' && p.order === 1 && p.op === '<=', "y' <= 3x parsed as derivative inequality");

// ── 2. Validation ──
section('2. Inequality Validation');

assert(validateExpression('y <= x^2') === '', 'y <= x^2 validates with no errors');
assert(validateExpression('y < 2x + 1') === '', 'y < 2x + 1 validates with no errors');
assert(validateExpression('x <= 3') === '', 'x <= 3 validates with no errors');
assert(validateExpression('x^2 + y^2 <= 25') === '', 'x^2 + y^2 <= 25 validates with no errors');
assert(validateExpression('y <= unknownFunc(x)') !== '', 'y <= unknownFunc(x) reports unknown identifier error');
assert(validateExpression('y <= (x + 1') === 'Missing ")"', 'Unbalanced paren in inequality caught properly');

// ── 3. Sliders on Inequalities ──
section('3. Slider Synchronization on Inequalities');

const sliderExpr = { text: 'y <= a*x^2 + b', sliders: {} };
syncSliders(sliderExpr);
assert(sliderExpr.sliders.a && sliderExpr.sliders.b && !sliderExpr.sliders.x && !sliderExpr.sliders.y, 'Sliders created for a and b, ignoring axis variable x');

// ── 4. Table of Values Functions ──
section('4. Table of Values Plottable Functions');

graphState.expressions = [
  { text: 'y = x^2', visible: true, color: '#ff0000', sliders: {} },
  { text: 'y <= 2x', visible: true, color: '#00ff00', sliders: {} },
  { text: 'x^2 + y^2 = 25', visible: true, color: '#0000ff', sliders: {} }, // non-function of x skipped
  { text: 'sin(x)', visible: false, color: '#ffff00', sliders: {} } // hidden skipped
];

const plottable = getTablePlottableFunctions();
assert(plottable.length === 2, 'Exactly 2 plottable functions extracted for Table of Values');
assert(plottable[0].fn(3) === 9, 'Plottable function y=x^2 evaluated at x=3 gives 9');
assert(plottable[1].fn(3) === 6, 'Plottable function y<=2x evaluated at x=3 gives 6');

// ── 5. Shareable Graph State Roundtrip ──
section('5. Shareable Graph State URL Roundtrip');

graphState.expressions = [
  { text: 'y = sin(x)', visible: true, color: '#58a6ff', sliders: {} },
  { text: 'y <= x^2', visible: true, color: '#f778ba', sliders: {} }
];
graphState.xMin = -5;
graphState.xMax = 5;
graphState.yMin = -3;
graphState.yMax = 7;

const exported = exportGraphStateToUrl();
assert(exported.url.includes('#graph='), 'Exported URL contains #graph= parameter');

// Clear graphState and import back
graphState.expressions = [];
const importedOk = importGraphStateFromUrl(exported.hash);
assert(importedOk, 'importGraphStateFromUrl returns true');
assert(graphState.expressions.length === 2, 'Imported state restored 2 expressions');
assert(graphState.expressions[0].text === 'y = sin(x)', 'First expression restored verbatim');
assert(graphState.expressions[1].text === 'y <= x^2', 'Second inequality expression restored verbatim');
assert(graphState.xMin === -5 && graphState.xMax === 5, 'Viewport x bounds restored');
assert(graphState.yMin === -3 && graphState.yMax === 7, 'Viewport y bounds restored');

// ── Final Summary ──
console.log('\n══════════════════════════════════════════');
console.log(`  TOTAL: ${passed + failed} checks`);
console.log(`  PASSED: ${passed}`);
console.log(`  FAILED: ${failed}`);
console.log('══════════════════════════════════════════\n');

if (failed > 0) process.exit(1);
