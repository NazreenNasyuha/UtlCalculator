/**
 * Scientific Calculator Test Suite — validates the REAL engine extracted
 * from engine.js (the split-out calculation engine): tokenize / toRPN /
 * evaluateRPN / evaluate.
 *
 * Covers: trig (RAD + DEG), inverse trig, hyperbolic + inverses, reciprocal
 * trig, logs, exp, roots, factorial, percent, powers/exponents, constants,
 * multi-arg functions (nCr/nPr/gcd/lcm/mod/nthroot), implicit multiplication,
 * and ans. Plus randomized comparisons against Math for trig/log/exp/sqrt.
 *
 * Run with: node test_scientific_suite.js
 */

const fs = require('fs');

// ── Extract the real engine from engine.js (the split-out engine file) ──
const script = fs.readFileSync('../src/engine.js', 'utf8');

const startIdx = script.indexOf('function isFn');
const evalIdx = script.indexOf('function evaluate(expr');   // NB: signature is evaluate(expr, vars)
if (startIdx < 0 || evalIdx < 0) { console.error('Engine markers not found'); process.exit(1); }
let i = script.indexOf('{', evalIdx), depth = 0;
for (; i < script.length; i++) {
  if (script[i] === '{') depth++;
  else if (script[i] === '}') { depth--; if (depth === 0) break; }
}
if (i >= script.length) { console.error('Brace-match failed'); process.exit(1); }
const engineBlock = script.slice(startIdx, i + 1);
if (/document\.|window\.|addEventListener/.test(engineBlock)) {
  console.error('Engine block references DOM:', engineBlock.match(/document\.\w+|window\.\w+|addEventListener/g));
  process.exit(1);
}

const state = { angleMode: 'RAD', lastResult: null };
const engine = new Function('state', engineBlock + '\nreturn {tokenize,toRPN,evaluateRPN,evaluate};')(state);

// ── Test harness ──
let passed = 0, failed = 0, testNum = 0;
const failures = [];

function run(name, expr, expected) {
  testNum++;
  let r;
  try { r = engine.evaluate(expr); } catch (e) { r = 'THREW:' + e.message; }
  const ok = (typeof expected === 'number' && isNaN(expected)) ? (typeof r === 'number' && isNaN(r))
            : (typeof r === 'number' && typeof expected === 'number' && (Object.is(r, expected) || Math.abs(r - expected) <= 1e-9 * Math.max(1, Math.abs(expected))));
  if (ok) passed++;
  else { failed++; failures.push({ expr, expected, r }); }
}

function runDeg(name, expr, expected) {
  const m = state.angleMode;
  state.angleMode = 'DEG';
  run(name + ' (DEG)', expr, expected);
  state.angleMode = m;
}

function closeEnough(a, b) { return Object.is(a, b) || Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)); }

console.log('\n════════════════════════════════════════════');
console.log('  SCIENTIFIC CALCULATOR — REAL ENGINE');
console.log('════════════════════════════════════════════\n');

// ── 1. Trigonometry (RAD) ──
console.log('── 1. Trigonometry (RAD) ──');
run('sin(0)=0', 'sin(0)', 0);
run('sin(pi/2)=1', 'sin(pi/2)', 1);
run('sin(pi)=0', 'sin(pi)', 0);
run('sin(3pi/2)=-1', 'sin(3*pi/2)', -1);
run('cos(0)=1', 'cos(0)', 1);
run('cos(pi/2)=0', 'cos(pi/2)', 0);
run('cos(pi)=-1', 'cos(pi)', -1);
run('tan(0)=0', 'tan(0)', 0);
run('tan(pi/4)=1', 'tan(pi/4)', 1);
run('tan(pi/2) float (~1.63e16)', 'tan(pi/2)', Math.tan(Math.PI / 2));  // IEEE float; FreeCalc shows undefined symbolically

// ── 2. Trigonometry (DEG) ──
console.log('── 2. Trigonometry (DEG) ──');
runDeg('sin(0)=0', 'sin(0)', 0);
runDeg('sin(90)=1', 'sin(90)', 1);
runDeg('sin(180)=0', 'sin(180)', 0);
runDeg('cos(0)=1', 'cos(0)', 1);
runDeg('cos(90)=0', 'cos(90)', 0);
runDeg('cos(180)=-1', 'cos(180)', -1);
runDeg('tan(45)=1', 'tan(45)', 1);

// ── 3. Inverse trig ──
console.log('── 3. Inverse trig ──');
run('asin(1)=pi/2', 'asin(1)', Math.PI / 2);
run('acos(0)=pi/2', 'acos(0)', Math.PI / 2);
run('atan(1)=pi/4', 'atan(1)', Math.PI / 4);
run('asin(-1)=-pi/2', 'asin(-1)', -Math.PI / 2);
run('acos(-1)=pi', 'acos(-1)', Math.PI);
run('asin(2)=NaN', 'asin(2)', NaN);
runDeg('asin(1)=90', 'asin(1)', 90);
runDeg('acos(0)=90', 'acos(0)', 90);
runDeg('atan(1)=45', 'atan(1)', 45);

// ── 4. Hyperbolic + inverses ──
console.log('── 4. Hyperbolic + inverses ──');
run('sinh(0)=0', 'sinh(0)', 0);
run('sinh(1)', 'sinh(1)', Math.sinh(1));
run('cosh(0)=1', 'cosh(0)', 1);
run('cosh(1)', 'cosh(1)', Math.cosh(1));
run('tanh(0)=0', 'tanh(0)', 0);
run('tanh(1)', 'tanh(1)', Math.tanh(1));
run('asinh(0)=0', 'asinh(0)', 0);
run('asinh(1)', 'asinh(1)', Math.asinh(1));
run('acosh(1)=0', 'acosh(1)', 0);
run('acosh(0)=NaN', 'acosh(0)', NaN);
run('atanh(0)=0', 'atanh(0)', 0);
run('atanh(0.5)', 'atanh(0.5)', Math.atanh(0.5));

// ── 5. Reciprocal trig ──
console.log('── 5. Reciprocal trig ──');
run('csc(pi/2)=1', 'csc(pi/2)', 1);
run('sec(0)=1', 'sec(0)', 1);
run('cot(pi/4)=1', 'cot(pi/4)', 1);
runDeg('csc(90)=1', 'csc(90)', 1);
runDeg('sec(0)=1', 'sec(0)', 1);
runDeg('cot(45)=1', 'cot(45)', 1);

// ── 6. Logs ──
console.log('── 6. Logarithms ──');
run('ln(1)=0', 'ln(1)', 0);
run('ln(e)=1', 'ln(e)', 1);
run('ln(e^2)=2', 'ln(e^2)', 2);
run('ln(0)=NaN', 'ln(0)', NaN);
run('ln(-1)=NaN', 'ln(-1)', NaN);
run('log(1)=0', 'log(1)', 0);
run('log(10)=1', 'log(10)', 1);
run('log(100)=2', 'log(100)', 2);
run('log(0)=NaN', 'log(0)', NaN);
run('log(-5)=NaN', 'log(-5)', NaN);

// ── 7. exp, roots, factorial ──
console.log('── 7. exp / roots / factorial ──');
run('exp(0)=1', 'exp(0)', 1);
run('exp(1)=e', 'exp(1)', Math.E);
run('exp(2)=e^2', 'exp(2)', Math.E * Math.E);
run('sqrt(144)=12', 'sqrt(144)', 12);
run('sqrt(2)', 'sqrt(2)', Math.SQRT2);
run('sqrt(0)=0', 'sqrt(0)', 0);
run('sqrt(-1)=NaN', 'sqrt(-1)', NaN);
run('cbrt(27)=3', 'cbrt(27)', 3);
run('cbrt(-8)=-2', 'cbrt(-8)', -2);
run('5!=120', '5!', 120);
run('0!=1', '0!', 1);
run('10!=3628800', '10!', 3628800);
run('3.5!=NaN', '3.5!', NaN);
run('(-2)!=NaN', '(-2)!', NaN);

// ── 8. Percent ──
console.log('── 8. Percent ──');
run('50%=0.5', '50%', 0.5);
run('200%=2', '200%', 2);
run('100%=1', '100%', 1);
run('0%=0', '0%', 0);
run('5% of 200=10', '5%*200', 10);
run('50%+2=2.5', '50%+2', 2.5);

// ── 9. Powers / exponents ──
console.log('── 9. Powers / exponents ──');
run('2^10=1024', '2^10', 1024);
run('2^3^2=512 (right-assoc)', '2^3^2', 512);
run('3^4=81', '3^4', 81);
run('9^0.5=3', '9^0.5', 3);
run('2^(-1)=0.5', '2^(-1)', 0.5);
run('10^0=1', '10^0', 1);
run('-5^2=-25', '-5^2', -25);
run('2^-3=0.125', '2^-3', 0.125);
run('(-2)^2=4', '(-2)^2', 4);
run('10^3=1000', '10^3', 1000);
run('5^(-1)=0.2 (invx)', '5^(-1)', 0.2);

// ── 10. Multi-arg functions ──
console.log('── 10. Multi-arg functions ──');
run('nCr(5,2)=10', 'nCr(5,2)', 10);
run('nCr(10,3)=120', 'nCr(10,3)', 120);
run('nCr(5,0)=1', 'nCr(5,0)', 1);
run('nPr(5,2)=20', 'nPr(5,2)', 20);
run('nPr(10,3)=720', 'nPr(10,3)', 720);
run('nPr(5,5)=120', 'nPr(5,5)', 120);
run('gcd(12,8)=4', 'gcd(12,8)', 4);
run('gcd(17,5)=1', 'gcd(17,5)', 1);
run('gcd(0,5)=5', 'gcd(0,5)', 5);
run('lcm(4,6)=12', 'lcm(4,6)', 12);
run('mod(17,5)=2', 'mod(17,5)', 2);
run('mod(-1,5)=4', 'mod(-1,5)', 4);
run('mod(7,0)=NaN', 'mod(7,0)', NaN);
run('nthroot(8,3)=2', 'nthroot(8,3)', 2);

// ── 11. Constants & implicit mult ──
console.log('── 11. Constants & implicit multiplication ──');
run('pi', 'pi', Math.PI);
run('e', 'e', Math.E);
run('tau=2pi', 'tau', 2 * Math.PI);
run('2pi=2*pi', '2pi', 2 * Math.PI);
run('2(3+4)=14', '2(3+4)', 14);
run('(1+2)(3+4)=21', '(1+2)(3+4)', 21);
run('2tau=4pi', '2tau', 4 * Math.PI);
run('sin(pi/2)*2=2', 'sin(pi/2)*2', 2);

// ── 12. Complex expressions ──
console.log('── 12. Complex expressions ──');
run('sqrt(3^2+4^2)=5', 'sqrt(3^2+4^2)', 5);
run('(2+3)*4-(6/2)+(5-1)=21', '(2+3)*4-(6/2)+(5-1)', 21);
run('1/(1+1/(1+1/(1+1)))=0.6', '1/(1+1/(1+1/(1+1)))', 0.6);
run('sin(pi/4)^2+cos(pi/4)^2=1', 'sin(pi/4)^2+cos(pi/4)^2', 1);
run('10*ln(e)+5*log(100)=20', '10*ln(e)+5*log(100)', 20);
run('sin(sqrt(pi))', 'sin(sqrt(pi))', Math.sin(Math.sqrt(Math.PI)));
run('ln(abs(-5))', 'ln(abs(-5))', Math.log(5));
run('sqrt(abs(-9))=3', 'sqrt(abs(-9))', 3);
run('2sin(30) (implicit mult + fn)', '2sin(30)', 2 * Math.sin(30));
run('0.1+0.2', '0.1+0.2', 0.30000000000000004);
run('7/0=NaN', '7/0', NaN);
run('empty=NaN', '', NaN);

// ── 13. ans ──
console.log('── 13. ans ──');
state.lastResult = 5;
run('ans=5', 'ans', 5);
run('ans+3=8', 'ans+3', 8);
run('ans*ans=25', 'ans*ans', 25);
run('sqrt(ans)=~2.236', 'sqrt(ans)', Math.sqrt(5));
run('2ans=10 (implicit mult)', '2ans', 10);
state.lastResult = null;
run('ans=0 (no prior)', 'ans', 0);

// ── 14. Randomized comparisons vs Math ──
console.log('── 14. Randomized vs Math (3000 samples) ──');
state.angleMode = 'RAD';
let randPass = 0;
for (let n = 0; n < 300; n++) {
  const v = (Math.random() * 6.28) - 3.14;
  const v2 = (Math.random() * 4) + 0.05;      // positive, nonzero
  const v3 = (Math.random() * 10) + 0.001;    // positive
  const ri = Math.floor(Math.random() * 8) + 1;
  const samples = [
    ['sin(' + v + ')', Math.sin(v)],
    ['cos(' + v + ')', Math.cos(v)],
    ['tan(' + v + ')', Math.tan(v)],
    ['ln(' + v2 + ')', Math.log(v2)],
    ['log(' + v3 + ')', Math.log10(v3)],
    ['exp(' + v + ')', Math.exp(v)],
    ['sqrt(' + v3 + ')', Math.sqrt(v3)],
    ['sinh(' + v + ')', Math.sinh(v)],
    ['cosh(' + v + ')', Math.cosh(v)],
    ['(' + ri + ')^(' + ri + ')', Math.pow(ri, ri)],
  ];
  for (const [expr, expected] of samples) {
    const r = engine.evaluate(expr);
    if (closeEnough(r, expected)) randPass++;
    else { failed++; failures.push({ expr, expected, r }); }
  }
  testNum += samples.length;
}
passed += randPass;

// ── Report ──
console.log('\n════════════════════════════════════════════');
console.log(`  TOTAL: ${testNum} tests`);
console.log(`  PASSED: ${passed}`);
console.log(`  FAILED: ${failed}`);
console.log('════════════════════════════════════════════');
if (failed > 0) {
  console.log('\n── Failures ──');
  for (const f of failures.slice(0, 30)) {
    console.log(`  "${f.expr}" → ${f.r}  (expected ${f.expected})`);
  }
  if (failures.length > 30) console.log(`  ... and ${failures.length - 30} more`);
  process.exit(1);
}
console.log('  ✓ ALL SCIENTIFIC TESTS PASSED!\n');
process.exit(0);
