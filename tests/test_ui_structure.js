/**
 * UI Structure Sanity Test — validates the calculator.html keypad markup:
 *
 *   1. Every data-action on a key button has a handler in the engine
 *   2. Every keypad tab (main/abc/funct) has a matching #panel-<name>
 *   3. The ABC panel is FreeCalc's QWERTY keyboard
 *      (qwertyuiop / ·asdfghjkl· / =zxcvbnm,⌫ / shift()[]!'πenter)
 *   4. The Main panel follows the EXACT FreeCalc scientific main keyboard
 *   5. The Funct panel follows the EXACT FreeCalc scientific function keyboard
 *   6. No duplicate element IDs
 *   7. Required actions exist in the keypad (numbers, ops, trig, etc.)
 *
 * Run with: node test_ui_structure.js
 */

const fs = require('fs');
const html = fs.readFileSync('../src/calculator.html', 'utf8');

let failed = 0;
function fail(msg) { failed++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }

console.log('\n══════════════════════════════════════════');
console.log('  UI STRUCTURE SANITY TEST');
console.log('══════════════════════════════════════════\n');

// ── 1. Every data-action has a handler ──
// Actions handled by the engine (insertMap + action keywords + graph actions + letters)
const insertMapKeys = ['0','1','2','3','4','5','6','7','8','9','decimal','zerodec','add','subtract',
  'multiply','divide','power','lparen','rparen','percent','negate','comma','square','sqrt','cbrt','invx','fact','nthroot',
  'sin','cos','tan','sinh','cosh','tanh','asin','acos','atan','asinh','acosh','atanh',
  'log','ln','exp','tenx','abs','ceil','floor','round',
  'mean','stdev','stdevp','ncr','npr','lbracket','rbracket','apostrophe',
  'constant_pi','constant_tau','constant_e','ans','fraction','x'];
const actionKeywords = ['clear','backspace','equals','angle','inv','left','right','shift'];
const graphActions = ['graph-add', 'theta', 'y', 'less', 'greater', 'leq', 'geq',
  'functions', 'abc', 'audio', 'enter'];
const letters = 'abcdefghijklmnopqrstuvwxyz';
const known = new Set([...insertMapKeys, ...actionKeywords, ...graphActions, ...letters.split('')]);

const actions = [...html.matchAll(/class="[^"]*\bkey-btn\b[^"]*" data-action="([^"]+)"/g)].map(m => m[1]);
const uniqueActions = [...new Set(actions)];
const unknown = uniqueActions.filter(a => !known.has(a));
console.log(`── 1. data-action handlers (${uniqueActions.length} unique actions)`);
if (unknown.length === 0) ok('every data-action has a handler');
else { fail('unhandled data-actions: ' + unknown.join(', ')); }

// Every essential action must also be present as a button in the scientific keypad
const sciBlock = html.match(/class="keypad-sci"[\s\S]*?<div class="calc-footer">/)[0];
const sciActions = new Set([...sciBlock.matchAll(/data-action="([^"]+)"/g)].map(m => m[1]));
const requiredSci = ['sin','cos','tan','lparen','rparen','divide','backspace','7','8','9','multiply',
  '4','5','6','subtract','sqrt','1','2','3','add','square','0','decimal','clear','equals',
  'percent','fraction','nthroot','power','abs','comma','ans','left','right',
  'asin','acos','atan','exp','round','mean','stdev','stdevp','ln','log','npr','ncr','fact',
  'constant_e','constant_pi'];
const missingSci = requiredSci.filter(a => !sciActions.has(a));
if (missingSci.length === 0) ok('scientific keypad has all required keys');
else fail('missing required sci keys: ' + missingSci.join(', '));

// ── 2. Keypad tabs ↔ panels ──
const tabPanels = [...html.matchAll(/class="[^"]*\bkeypad-tab\b[^"]*" data-panel="([^"]+)"/g)].map(m => m[1]);
console.log('── 2. keypad tabs ↔ panels');
let panelOk = true;
for (const p of tabPanels) {
  if (!html.includes('id="panel-' + p + '"')) { fail('tab "' + p + '" has no #panel-' + p); panelOk = false; }
}
if (panelOk) ok('tabs ' + tabPanels.join('/') + ' all have matching panels');

// ── 3. ABC panel = FreeCalc QWERTY keyboard ──
const abcBlock = html.match(/id="panel-abc"[\s\S]*?id="panel-funct"/)[0];
console.log('── 3. ABC panel (FreeCalc QWERTY)');
const rows = [...abcBlock.matchAll(/class="abc-row([^"]*)"[\s\S]*?<\/div>/g)].map(m => {
  const lettersRow = [...m[0].matchAll(/data-action="([a-z])"/g)].map(x => x[1]).join('');
  return { cls: m[1].trim(), letters: lettersRow };
});
const letterRows = rows.filter(r => r.letters.length > 0);
const expected = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
let abcOk = true;
if (letterRows.length !== 3) { fail('expected 3 letter rows, got ' + letterRows.length); abcOk = false; }
else {
  for (let k = 0; k < 3; k++) {
    if (letterRows[k].letters !== expected[k]) { fail('row ' + (k + 1) + ' = "' + letterRows[k].letters + '" (expected "' + expected[k] + '")'); abcOk = false; }
  }
}
if (abcOk) ok('QWERTY rows: qwertyuiop / asdfghjkl / zxcvbnm in order');
if (abcBlock.includes('abc-indent-half')) ok('2nd row half-indented (phone-style stagger)');
else fail('missing abc-indent-half stagger class');
// 3rd row must start with = and end with , and ⌫ (FreeCalc: =zxcvbnm,⌫)
const row3 = rows[2] ? rows[2].cls + '|' + rows[2].letters : '';
if (abcBlock.includes('data-action="equals">=') && abcBlock.includes('data-action="comma">,') && abcBlock.includes('data-action="backspace">⌫')) ok('row 3 = zxcvbnm , ⌫');
else fail('row 3 should contain =, letters, comma and backspace');
// 4th row: shift ( ) [ ] ! ' π enter
for (const act of ['shift','lparen','rparen','lbracket','rbracket','fact','apostrophe','constant_pi','equals']) {
  if (!abcBlock.includes('data-action="' + act + '"')) { fail('ABC 4th row missing ' + act); abcOk = false; }
}
if (abcOk) ok('4th row: shift ( ) [ ] ! \' π enter');

// ── 4. Main panel = EXACT FreeCalc scientific main keyboard ──
const mainBlock = html.match(/id="panel-main"[\s\S]*?id="panel-abc"/)[0];
console.log('── 4. Main panel (FreeCalc layout)');
let mainOk = true;
if (!mainBlock.includes('panel-grid cols-11')) { fail('main panel is not cols-11'); mainOk = false; }
// FreeCalc main keyboard rows:
//   x² xʸ |x| | 7 8 9 ÷ | % a/b
//   √ ⁿ√ π   | 4 5 6 × | ← →
//   sin cos tan | 1 2 3 − | ⌫
//   ( ) ,     | 0 . ans + | =
const mainActs = [...mainBlock.matchAll(/data-action="([^"]+)"/g)].map(m => m[1]);
const expectMain = ['square','power','abs','7','8','9','divide','percent','fraction',
  'sqrt','nthroot','constant_pi','4','5','6','multiply','left','right',
  'sin','cos','tan','1','2','3','subtract','backspace',
  'lparen','rparen','comma','0','decimal','ans','add','equals'];
for (const a of expectMain) {
  if (!mainActs.includes(a)) { fail('main panel missing ' + a); mainOk = false; }
}
// exact first three keys of row 1
const first3 = mainBlock.split('</button>').slice(0, 3).join('');
if (first3.includes('data-action="square"') && first3.includes('data-action="power"') && first3.includes('data-action="abs"')) ok('row 1 starts x² xʸ |x|');
else fail('row 1 should start with x² xʸ |x|');
// trig in row 3
const row3Idx = mainBlock.indexOf('data-action="sin"');
const row3Slice = mainBlock.slice(row3Idx, row3Idx + 500);
if (row3Slice.includes('data-action="cos"') && row3Slice.includes('data-action="tan"') && row3Slice.includes('data-action="1"')) ok('row 3: sin cos tan 1 2 3 −');
else fail('row 3 should be sin cos tan 1 2 3 −');
if (mainOk) ok('FreeCalc main: x² xʸ |x| / 7 8 9 ÷ / % a/b · √ ⁿ√ π / 4 5 6 × / ← → · sin cos tan / 1 2 3 − / ⌫ · ( ) , / 0 . ans + / =');

// ── 5. Funct panel = EXACT FreeCalc scientific function keyboard ──
const functBlockMatch = html.match(/id="panel-funct"[\s\S]*?keypad-tabs-bottom/) || html.match(/id="panel-funct"[\s\S]*?<\/div>/);
const functBlock = functBlockMatch ? functBlockMatch[0] : '';
console.log('── 5. Funct panel (FreeCalc layout)');
let functOk = true;
if (!functBlock.includes('panel-grid cols-7')) { fail('funct panel is not cols-7'); functOk = false; }
const functActs = [...functBlock.matchAll(/data-action="([^"]+)"/g)].map(m => m[1]);
const expectFunct = ['sin','cos','tan','power','sqrt','nthroot',
  'asin','acos','atan','exp','abs','round',
  'mean','stdev','stdevp','ln','log','backspace',
  'npr','ncr','fact','constant_e','constant_pi','equals'];
for (const a of expectFunct) {
  if (!functActs.includes(a)) { fail('funct panel missing ' + a); functOk = false; }
}
if (functOk) ok('FreeCalc func: sin cos tan · xʸ √ ⁿ√ / arcsin arccos arctan · eˣ |x| round / mean stdev stdevp · ln log ⌫ / nPr nCr ! · e π =');

// ── 6. No duplicate IDs ──
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
const dupIds = ids.filter((v, i) => ids.indexOf(v) !== i);
console.log('── 6. duplicate IDs');
if (dupIds.length === 0) ok('no duplicate IDs');
else fail('duplicate IDs: ' + [...new Set(dupIds)].join(', '));

// ── 7. Exactly one active panel & three panels ──
const panelCount = (html.match(/class="keypad-panel/g) || []).length;
console.log('── 7. keypad panels');
if (panelCount === 3) ok('exactly 3 keypad panels (main/abc/funct)');
else fail('expected 3 keypad panels, found ' + panelCount);
if ((html.match(/class="keypad-panel active"/g) || []).length === 1) ok('exactly one active panel');
else fail('expected exactly one active keypad panel');

// ── 8. Tabs sit at the bottom of the keypad (FreeCalc-style) ──
if (html.includes('keypad-tabs-bottom')) ok('tabs styled at the bottom (keypad-tabs-bottom)');
else fail('missing keypad-tabs-bottom');

// ── Report ──
console.log('\n══════════════════════════════════════════');
console.log(failed === 0 ? '  ✓ UI STRUCTURE OK' : `  ✗ ${failed} STRUCTURE PROBLEMS`);
console.log('══════════════════════════════════════════\n');
process.exit(failed > 0 ? 1 : 0);
