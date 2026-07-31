// ═══════════════════════════════════════════════════════════════════════════════
// build-single-file.js — bundle the whole calculator into ONE standalone HTML
// ═══════════════════════════════════════════════════════════════════════════════
//
// WHY?  The normal app (src/) uses ES modules, which browsers refuse to load
//       over file:// (CORS). So double-clicking src/calculator.html fails.
//       This script inlines every module + the CSS into a single HTML file —
//       that single file works from ANYWHERE: double-click it, email it, or
//       drop it on a USB stick. Zero setup, zero server, zero dependencies.
//
// HOW IT WORKS (3 steps)
//   1. Read calculator.html, styles.css and the 5 JS modules.
//   2. Strip the ES-module syntax (import / export) and concatenate the JS in
//      load order  engine → mathml-renderer → ui → graph → main.
//      (After stripping, every name lives in ONE shared script scope, exactly
//      like a classic <script> tag — so all the cross-file references still
//      resolve, just without the module ceremony.)
//   3. Splice the CSS into <style> and the JS into a single <script> inside
//      the HTML, then save it as FreeCalc-single-file.html.
//
// HOW TO RUN   node build-single-file.js        (from the repo root)
// ═══════════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'src');
const OUT = path.join(__dirname, 'FreeCalc-single-file.html');

// Load order MUST stay engine → mathml-renderer → ui → graph → main
// (each file only uses names defined in earlier files — see README)
const JS_ORDER = ['engine.js', 'mathml-renderer.js', 'ui.js', 'graph.js', 'main.js'];

// ─── Read all sources ──────────────────────────────────────────────
let html = fs.readFileSync(path.join(SRC, 'calculator.html'), 'utf8');
const css = fs.readFileSync(path.join(SRC, 'styles.css'), 'utf8');
const modules = {};
for (const f of JS_ORDER) modules[f] = fs.readFileSync(path.join(SRC, f), 'utf8');

// ─── Strip ES-module syntax (import … from, export { … }) ──────────
// Handles both single-line and multi-line statements (multi-line imports
// appear in ui.js and main.js).
function stripModules(code) {
  return code
    .replace(/import\s*\{[\s\S]*?\}\s*from\s*['"][^'"]+['"]\s*;?/g, '') // import { a, b } from './x.js';
    .replace(/import\s*['"][^'"]+['"]\s*;?/g, '')                       // bare side-effect imports
    .replace(/export\s*\{[\s\S]*?\}\s*;?/g, '');                        // export { a, b };
}

let bundle = '';
for (const f of JS_ORDER) bundle += (bundle ? '\n\n' : '') + stripModules(modules[f]);

// ─── Sanity checks (fail loudly instead of shipping a broken file) ──
const leftoverImports = bundle.match(/^\s*import\s/m) || [];
const leftoverExports = bundle.match(/^\s*export\s/m) || [];
if (leftoverImports.length || leftoverExports.length) {
  console.error('✗ Leftover ES-module syntax found — aborting:');
  if (leftoverImports.length) console.error('  import statements:', leftoverImports.slice(0, 5));
  if (leftoverExports.length) console.error('  export statements:', leftoverExports.slice(0, 5));
  process.exit(1);
}
// Cross-file name collisions: in a classic script every top-level declaration
// shares ONE scope. Two modules declaring the same function name would silently
// override each other (no SyntaxError) — catch that explicitly. Only TRUE
// top-level declarations matter, so match exactly the 4-space module indent
// used across this codebase (function-local declarations sit deeper, at ≥6
// spaces, and are skipped). NOTE: this is a project convention, not a language
// guarantee — a future file using different indentation would escape the check.
// Duplicate top-level const/let are already caught by the new Function() parse
// check below (they throw a SyntaxError).
function topLevelNames(code) {
  const names = [];
  const re = /^\s{4}(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*))/gm;
  let m;
  while ((m = re.exec(code))) names.push(m[1] || m[2]);
  return names;
}
const seen = new Map();
for (const f of JS_ORDER) {
  for (const n of topLevelNames(stripModules(modules[f]))) {
    if (seen.has(n)) {
      if (seen.get(n) === f) {
        console.error('✗ "' + n + '" is declared more than once at top level in ' +
                      f + ' — the bundle would break.');
      } else {
        console.error('✗ Name collision across modules: "' + n + '" declared in both ' +
                      seen.get(n) + ' and ' + f + ' — the bundle would break.');
      }
      process.exit(1);
    }
    seen.set(n, f);
  }
}
// Parse-check: new Function() compiles the code (syntax validation only —
// nothing runs, so DOM calls are safe). Throws if the bundle is broken.
try { new Function(bundle); }
catch (e) { console.error('✗ Bundled JS failed to parse:', e.message); process.exit(1); }
// A raw "</script>" inside any JS string would terminate the inline script tag
// early and break the whole file. Escape it so it is inert inside the HTML.
const bundleHtml = bundle.replace(/<\/script>/gi, '<\\/script>');

// ─── Splice CSS + JS into the HTML ─────────────────────────────────
// 1. Replace the external stylesheet link with an inline <style>
if (!html.includes('<link rel="stylesheet" href="styles.css" />')) {
  console.error('✗ Could not find the stylesheet link in calculator.html'); process.exit(1);
}
html = html.replace(
  '<link rel="stylesheet" href="styles.css" />',
  '<style>\n' + css + '\n</style>'
);

// 2. Remove the five module <script> tags
html = html.replace(/<script type="module" src="[^"]+"><\/script>\s*/g, '');  // 3. Inject the bundled JS just before </body> (title is left unchanged —
  //    the same file is also served as the GitHub Pages homepage)
if (!html.includes('</body>')) { console.error('✗ No </body> found in calculator.html'); process.exit(1); }
html = html.replace('</body>',
  '<!-- ════════════════════════════════════════════════════════════\n' +
  '     SINGLE-FILE BUILD (generated by build-single-file.js)\n' +
  '     All 5 modules + the stylesheet are inlined below, so this\n' +
  '     file works from file:// with no server. Rebuild anytime with:\n' +
  '       node build-single-file.js\n' +
  '     ════════════════════════════════════════════════════════════ -->\n' +
  '<script>\n' + bundleHtml + '\n</script>\n</body>');

// ─── Write the result ──────────────────────────────────────────────
fs.writeFileSync(OUT, html, 'utf8');
const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
console.log('✓ Built ' + path.relative(__dirname, OUT) + ' (' + kb + ' KB)');
console.log('  Double-click it — no server needed. Rebuild after editing src/.');
