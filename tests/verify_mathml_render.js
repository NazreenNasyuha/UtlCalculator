/**
 * Verify MathML display rendering — checks that every operation button and
 * the π / e constants actually show up in the rendered MathML display.
 *
 * Extracts the REAL parser functions (esc, tokD, parseMML, parseAdd, parseMul,
 * parsePow, parseUn) straight out of mathml-renderer.js (the split-out
 * renderer file) and validates that
 * incomplete / implicit expressions such as "5+", "2π", "2e" render visibly.
 *
 * Run with: node verify_mathml_render.js
 */
const fs = require('fs');
// The MathML parser now lives in its own file (mathml-renderer.js)
const script = fs.readFileSync('../src/mathml-renderer.js', 'utf8');

// Extract the parser block: from `function esc` through the end of `function parseUn`
const startIdx = script.indexOf('function esc');
const endMarker = script.indexOf('function renderExpression');
if (startIdx < 0 || endMarker < 0 || endMarker < startIdx) {
  console.error('✗ Parser markers not found');
  process.exit(1);
}
const parserBlock = script.slice(startIdx, endMarker);
if (/document\.|window\.|addEventListener/.test(parserBlock)) {
  console.error('✗ Parser block unexpectedly references the DOM');
  process.exit(1);
}

// Render helper identical to renderExpression's MathML path
const render = new Function(parserBlock + '\nreturn function(expr){ return parseMML(expr); };')();

let passed = 0, failed = 0;
function check(label, expr, mustContain) {
  let out;
  try { out = render(expr); } catch (e) { out = 'THREW:' + e.message; }
  const ok = typeof out === 'string' && mustContain.every(s => out.includes(s));
  if (ok) { passed++; console.log(`  ✓ ${label}: "${expr}" -> ${out.slice(0, 90)}`); }
  else { failed++; console.log(`  ✗ FAIL ${label}: "${expr}" -> ${out}`); }
}

console.log('\n══════════════════════════════════════════');
console.log('  MATHML DISPLAY RENDER VERIFICATION');
console.log('══════════════════════════════════════════\n');

console.log('── Numbers ──');
check('number', '5', ['<mn>5</mn>']);
check('decimal', '5.25', ['<mn>5.25</mn>']);

console.log('\n── Trailing operators (the reported bug) ──');
check('5+', '5+', ['5', '<mo>+</mo>']);
check('5-', '5-', ['5', '<mo>−</mo>']);
check('5*', '5*', ['5', '<mo>×</mo>']);
check('5/', '5/', ['5', '<mfrac>']);
check('5^', '5^', ['5', '<msup>']);

console.log('\n── Complete operations ──');
check('5+3', '5+3', ['<mo>+</mo>']);
check('5-3', '5-3', ['<mo>−</mo>']);
check('5*3', '5*3', ['<mo>×</mo>']);
check('5/3', '5/3', ['<mfrac>']);
check('5^3', '5^3', ['<msup>']);

console.log('\n── Constants π and e ──');
check('π alone', 'π', ['<mi>π</mi>']);
check('e alone', 'e', ['<mi>e</mi>']);
check('2π implicit', '2π', ['<mi>π</mi>', '<mo>×</mo>']);
check('2e implicit', '2e', ['<mi>e</mi>', '<mo>×</mo>']);
check('π+2', 'π+2', ['<mi>π</mi>', '<mo>+</mo>']);
check('e^2', 'e^2', ['<mi>e</mi>', '<msup>']);
check('π(', 'π(', ['<mi>π</mi>']);
check('sin(π)', 'sin(π)', ['<mi>sin</mi>', '<mi>π</mi>']);

console.log('\n── Functions (buttons: sin cos tan log ln sqrt etc.) ──');
check('sin(', 'sin(', ['<mi>sin</mi>', '<mo>(</mo>']);
check('sin(30)', 'sin(30)', ['<mi>sin</mi>', '<mn>30</mn>']);
check('cos(', 'cos(', ['<mi>cos</mi>']);
check('tan(', 'tan(', ['<mi>tan</mi>']);
check('log(', 'log(', ['<mi>log</mi>']);
check('ln(', 'ln(', ['<mi>ln</mi>']);
check('sqrt(', 'sqrt(', ['<mi>√</mi>']);
check('abs(', 'abs(', ['<mi>abs</mi>']);
check('2sin(30)', '2sin(30)', ['<mo>×</mo>', '<mi>sin</mi>']);

console.log('\n── Parentheses ──');
check('2(3+4)', '2(3+4)', ['<mo>×</mo>', '<mo>(</mo>']);
check('(1+2)(3+4)', '(1+2)(3+4)', ['<mo>×</mo>']);
check('( trailing', '(', ['<mo>(</mo>']);
check('(2+3)4 implicit', '(2+3)4', ['<mo>×</mo>', '<mn>4</mn>']);
check('3!2 implicit', '3!2', ['<mo>×</mo>', '<mn>2</mn>']);
check('50%2 implicit', '50%2', ['<mo>×</mo>', '<mn>2</mn>']);

console.log('\n── Postfix % and ! ──');
check('50%', '50%', ['<mo>%</mo>']);
check('5!', '5!', ['<mo>!</mo>']);
check('5%!', '5%!', ['<mo>%</mo>', '<mo>!</mo>']);

console.log('\n══════════════════════════════════════════');
console.log(`  PASSED: ${passed}`);
console.log(`  FAILED: ${failed}`);
console.log('══════════════════════════════════════════');
process.exit(failed > 0 ? 1 : 0);
