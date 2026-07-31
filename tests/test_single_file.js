/**
 * Single-File Bundle Smoke Test — verifies FreeCalc-single-file.html works.
 *
 * The normal test suites run the SOURCE modules (src/*.js). This test targets
 * the BUILD OUTPUT instead: it extracts the inline <script> from the bundled
 * HTML, executes it inside Node with a minimal stub DOM, and checks that:
 *
 *   1. The bundle boots without throwing (all top-level code runs)
 *   2. The expression engine actually computes (3+4*2 = 11, sin, powers…)
 *   3. The HTML contains exactly one <script> and one <style> (fully inlined)
 *
 * Run with:   node build-single-file.js   (first, to (re)build the bundle)
 *             node test_single_file.js    (from the tests/ folder)
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BUNDLE = path.join(__dirname, '..', 'FreeCalc-single-file.html');
let failed = 0;
function fail(msg) { failed++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }

console.log('\n══════════════════════════════════════════');
console.log('  SINGLE-FILE BUNDLE SMOKE TEST');
console.log('══════════════════════════════════════════\n');

if (!fs.existsSync(BUNDLE)) {
  console.error('  ✗ ' + path.basename(BUNDLE) + ' not found.\n');
  console.error('    Run `node build-single-file.js` from the repo root first.\n');
  process.exit(1);
}

const html = fs.readFileSync(BUNDLE, 'utf8');

// ── 1. Fully inlined: exactly one <script> + one <style>, no external refs ──
console.log('── 1. bundle structure');
const scripts = (html.match(/<script>/g) || []).length;
const styles = (html.match(/<style>/g) || []).length;
const links = (html.match(/<link[^>]*>/g) || []).length;
const leftovers = html.match(/^\s*(import|export)\s/m) || [];
if (scripts === 1) ok('exactly one inline <script>');
else fail('expected 1 inline <script>, found ' + scripts);
if (styles === 1) ok('exactly one inline <style>');
else fail('expected 1 inline <style>, found ' + styles);
if (links === 0) ok('no external <link> tags (CSS is inlined)');
else fail('external <link> tags remain: ' + links);
if (leftovers.length === 0) ok('no leftover import/export syntax');
else fail('leftover module syntax: ' + leftovers.slice(0, 3).join(', '));
// The <style> must actually carry real CSS (not be empty / silently dropped)
const styleBody = (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
if (styleBody.includes('--canvas-bg') && styleBody.includes('.key-btn')) ok('inlined CSS has real rules (--canvas-bg, .key-btn)');
else fail('inlined <style> looks empty or wrong');
// NOTE: this test intentionally does NOT exercise canvas/graph rendering — the
// stub DOM's getContext returns a no-op, so boot is proven but pixels are not.

// ── 2. Extract the bundled JS ──
const m = html.match(/<script>\n([\s\S]*?)\n<\/script>/);
if (!m) { fail('could not extract inline script'); process.exit(1); }
const js = m[1];

// ── 3. Execute it with a stub DOM ──
// The bundle's top-level code calls document.getElementById / querySelectorAll /
// addEventListener, localStorage, window, location… A tiny stub satisfies all
// of them so the boot path runs for real.
function stubElement() {
  return new Proxy({
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    style: {},
    dataset: {},
    addEventListener(){}, removeEventListener(){},
    appendChild(){}, remove(){}, focus(){}, click(){},
    setAttribute(){}, getAttribute(){ return null; },
    setSelectionRange(){},
    querySelector(){ return stubElement(); },
    querySelectorAll(){ return []; },
    getBoundingClientRect(){ return { width: 800, height: 600 }; },
    children: [],
    textContent: '', value: '', innerHTML: '', href: '', download: '',
    offsetWidth: 0, offsetHeight: 0,
    closest(){ return null; },
  }, {
    get(t, p) { return (p in t) ? t[p] : function(){ return undefined; }; },
    set(t, p, v) { t[p] = v; return true; },
  });
}

const context = vm.createContext({
  console,
  Math, JSON, Number, String, Array, Object, Date, parseFloat, parseInt, isNaN, isFinite,
  setTimeout, clearTimeout,
  document: {
    getElementById(){ return stubElement(); },
    querySelectorAll(){ return []; },
    querySelector(){ return stubElement(); },
    createElement(){ return stubElement(); },
    addEventListener(){}, removeEventListener(){},
    documentElement: stubElement(),
    body: stubElement(),
  },
  window: { addEventListener(){}, devicePixelRatio: 1 },
  location: { hash: '' },
  localStorage: { getItem(){ return null; }, setItem(){}, removeItem(){} },
  navigator: { userAgent: 'test' },
});

console.log('── 2. bundle boots');
let booted = false;
try {
  vm.runInContext(js, context, { timeout: 10000 });
  booted = true;
  ok('top-level code executed without throwing');
} catch (e) {
  fail('bundle threw at boot: ' + (e && e.message));
}

// ── 4. The engine still computes after bundling ──
// In a classic script, top-level `function` declarations land on the global
// object, so evaluate / tokenize / toRPN are reachable from the context.
console.log('── 3. engine works inside the bundle');
if (booted && typeof context.evaluate === 'function') {
  const checks = [
    ['3+4*2', 11],
    ['2^3^2', 512],          // right-associative power
    ['sin(pi/2)', 1],
    ['2pi', 2 * Math.PI],    // implicit multiplication
    ['sqrt(144)', 12],
  ];
  let allPass = true;
  for (const [expr, want] of checks) {
    const got = context.evaluate(expr);
    if (Math.abs(got - want) > 1e-9) { fail(expr + ' = ' + got + ' (expected ' + want + ')'); allPass = false; }
  }
  if (allPass) ok('5 engine checks pass (3+4*2, 2^3^2, sin(pi/2), 2pi, sqrt(144))');
} else {
  fail('evaluate() not exposed on the bundle global — check the build');
}

// ── Report ──
console.log('\n══════════════════════════════════════════');
console.log(failed === 0 ? '  ✓ SINGLE-FILE BUNDLE OK' : `  ✗ ${failed} PROBLEMS`);
console.log('══════════════════════════════════════════\n');
process.exit(failed > 0 ? 1 : 0);
