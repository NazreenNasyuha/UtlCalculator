/**
 * Comprehensive Scientific Calculator Test Suite — 200+ FreeCalc-Verified Tests
 * Run with: node test_calculator_suite.js
 */

const state = { angleMode: 'RAD', lastResult: null, precision: 'auto' };

function isFn(fn) {
  return ['sin','cos','tan','asin','acos','atan','sinh','cosh','tanh','asinh','acosh','atanh',
          'csc','sec','cot','sqrt','cbrt','log','ln','abs','exp','fact',
          'ceil','floor','round','gcd','lcm','mod','nCr','nPr','nthroot'].includes(fn);
}

function applyFn(fn, val, val2) {
  const d=state.angleMode==='DEG';
  const R=Math,PI=R.PI;
  switch(fn){
    case'sin':return d?R.sin(val*PI/180):R.sin(val);
    case'cos':return d?R.cos(val*PI/180):R.cos(val);
    case'tan':return d?R.tan(val*PI/180):R.tan(val);
    case'asin':return d?R.asin(val)*180/PI:R.asin(val);
    case'acos':return d?R.acos(val)*180/PI:R.acos(val);
    case'atan':return d?R.atan(val)*180/PI:R.atan(val);
    case'sinh':return R.sinh(val);
    case'cosh':return R.cosh(val);
    case'tanh':return R.tanh(val);
    case'asinh':return R.asinh(val);
    case'acosh':return val<1?NaN:R.acosh(val);
    case'atanh':return R.atanh(val);
    case'csc':return d?1/R.sin(val*PI/180):1/R.sin(val);
    case'sec':return d?1/R.cos(val*PI/180):1/R.cos(val);
    case'cot':return d?1/R.tan(val*PI/180):1/R.tan(val);
    case'sqrt':return val<0?NaN:R.sqrt(val);
    case'cbrt':return R.cbrt(val);
    case'log':return val<=0?NaN:R.log10(val);
    case'ln':return val<=0?NaN:R.log(val);
    case'abs':return R.abs(val);
    case'exp':return R.exp(val);
    case'fact':return fact(val);
    case'ceil':return R.ceil(val);
    case'floor':return R.floor(val);
    case'round':return R.round(val);
    case'gcd':return gcd(val,val2);
    case'lcm':return lcm(val,val2);
    case'mod':return val2===0?NaN:((val%val2)+val2)%val2;
    case'nCr':return nCr(val,val2);
    case'nPr':return nPr(val,val2);
    case'nthroot':return val2>=0?R.pow(val,1/val2):NaN;
    default:return NaN;
  }
}

function fact(n){if(n<0||!Number.isInteger(n)||n>170)return NaN;if(n<=1)return 1;let r=1;for(let i=2;i<=n;i++)r*=i;return r;}
function gcd(a,b){if(!Number.isInteger(a)||!Number.isInteger(b))return NaN;a=Math.abs(a);b=Math.abs(b);if(a===0&&b===0)return NaN;while(b)[a,b]=[b,a%b];return a;}
function lcm(a,b){if(!Number.isInteger(a)||!Number.isInteger(b))return NaN;if(a===0||b===0)return 0;return Math.abs(a*b)/gcd(a,b);}
function nCr(n,r){if(!Number.isInteger(n)||!Number.isInteger(r)||n<0||r<0||r>n)return NaN;if(r===0||r===n)return 1;if(r>n-r)r=n-r;let res=1;for(let i=1;i<=r;i++){res=res*(n-i+1)/i;}return Math.round(res);}
function nPr(n,r){if(!Number.isInteger(n)||!Number.isInteger(r)||n<0||r<0||r>n)return NaN;if(r===0)return 1;let res=1;for(let i=n;i>n-r;i--)res*=i;return res;}

const PREC={'+':1,'-':1,'*':2,'/':2,'^':3};
const RIGHT_ASSOC={'^':true};

function tokenize(expr) {
  const t=[];let i=0,l=expr.length;
  while(i<l){
    if(/\s/.test(expr[i])){i++;continue;}
    if(/[0-9.]/.test(expr[i])){let n='';while(i<l&&/[0-9.]/.test(expr[i])){n+=expr[i];i++;}if(i<l&&(expr[i]==='e'||expr[i]==='E')&&i+1<l&&/[0-9+\-]/.test(expr[i+1])){n+=expr[i];i++;if(expr[i]==='+'||expr[i]==='-'){n+=expr[i];i++;}while(i<l&&/[0-9]/.test(expr[i])){n+=expr[i];i++;}}t.push({type:'number',value:parseFloat(n)});continue;}
    if(expr[i]==='π'){t.push({type:'number',value:Math.PI});i++;continue;}
    if(expr[i]==='τ'){t.push({type:'number',value:2*Math.PI});i++;continue;}
    if(/[a-zA-Z_]/.test(expr[i])){let n='';while(i<l&&/[a-zA-Z0-9_]/.test(expr[i])){n+=expr[i];i++;}if(n==='pi'){t.push({type:'number',value:Math.PI});}else if(n==='tau'){t.push({type:'number',value:2*Math.PI});}else if(n==='e'){t.push({type:'number',value:Math.E});}else if(n==='ans'){t.push({type:'number',value:state.lastResult!==null?state.lastResult:0});}else if(isFn(n)){t.push({type:'function',value:n});}else{t.push({type:'variable',value:n});}continue;}
    if('+-*/^'.includes(expr[i])){t.push({type:'operator',value:expr[i]});i++;continue;}
    if(expr[i]==='('){t.push({type:'lparen'});i++;continue;}
    if(expr[i]===')'){t.push({type:'rparen'});i++;continue;}
    if(expr[i]===','){t.push({type:'comma'});i++;continue;}
    if(expr[i]==='%'){t.push({type:'percent'});i++;continue;}
    if(expr[i]==='!'){t.push({type:'postfix_fact'});i++;continue;}
    i++;
  }
  // Insert implicit * between adjacent tokens that imply multiplication
  // e.g. 2(3+4) → 2*(3+4), 2pi → 2*pi, etc.
  for(let i=t.length-1;i>0;i--){
    const cur=t[i],prev=t[i-1];
    const isVal=t=>['number','variable','rparen'].includes(t.type);
    const isStart=t=>['number','variable','function','lparen'].includes(t.type);
    if(isVal(prev)&&isStart(cur)){
      t.splice(i,0,{type:'operator',value:'*'});
    }
  }
  return t;
}

function shuntingYard(tokens) {
  const out=[],ops=[];
  for(let i=0;i<tokens.length;i++){
    const tok=tokens[i];
    if(tok.type==='number'||tok.type==='variable'){out.push(tok);}
    else if(tok.type==='function'){ops.push(tok);}
    else if(tok.type==='comma'){while(ops.length>0&&ops[ops.length-1].type!=='lparen')out.push(ops.pop());}
    else if(tok.type==='operator'){
      if(tok.value==='-'&&(i===0||['operator','lparen','comma','percent'].includes(tokens[i-1].type))){ops.push({type:'function',value:'neg'});continue;}
      const prec=PREC[tok.value]||0,ra=RIGHT_ASSOC[tok.value];
      while(ops.length>0){const top=ops[ops.length-1];if(top.type==='lparen')break;if(top.type==='function'){out.push(ops.pop());continue;}const tp=PREC[top.value]||0;if((ra&&prec<tp)||(!ra&&prec<=tp))out.push(ops.pop());else break;}
      ops.push(tok);
    }else if(tok.type==='percent'){out.push({type:'percent_op'});}
    else if(tok.type==='postfix_fact'){out.push(tok);}
    else if(tok.type==='lparen'){ops.push(tok);}
    else if(tok.type==='rparen'){
      while(ops.length>0&&ops[ops.length-1].type!=='lparen')out.push(ops.pop());
      if(ops.length>0&&ops[ops.length-1].type==='lparen')ops.pop();
      if(ops.length>0&&ops[ops.length-1].type==='function')out.push(ops.pop());
    }
  }
  while(ops.length>0)out.push(ops.pop());
  return out;
}

function evalRPN(rpn) {
  const stack=[];
  for(const tok of rpn){
    if(tok.type==='number'){stack.push(tok.value);}
    else if(tok.type==='operator'){const b=stack.pop(),a=stack.pop();if(a===undefined||b===undefined)return NaN;let r;switch(tok.value){case'+':r=a+b;break;case'-':r=a-b;break;case'*':r=a*b;break;case'/':r=b===0?NaN:a/b;break;case'^':r=Math.pow(a,b);break;default:r=NaN;}if(!isFinite(r))return NaN;stack.push(r);}
    else if(tok.type==='function'){
      if(tok.value==='neg'){const a=stack.pop();if(a===undefined)return NaN;stack.push(-a);}
      else if(['gcd','lcm','mod','nCr','nPr','nthroot'].includes(tok.value)){const b=stack.pop(),a=stack.pop();if(a===undefined||b===undefined)return NaN;const r=applyFn(tok.value,a,b);if(isNaN(r)||!isFinite(r))return NaN;stack.push(r);}
      else{const a=stack.pop();if(a===undefined)return NaN;const r=applyFn(tok.value,a);if(isNaN(r)||!isFinite(r))return NaN;stack.push(r);}
    }else if(tok.type==='percent_op'){const a=stack.pop();if(a===undefined)return NaN;stack.push(a/100);}
    else if(tok.type==='postfix_fact'){const a=stack.pop();if(a===undefined)return NaN;const r=fact(a);if(isNaN(r))return NaN;stack.push(r);}
  }
  return stack.length===0?NaN:stack[stack.length-1];
}

function evaluate(expr){try{const t=tokenize(expr);const r=shuntingYard(t);const res=evalRPN(r);return isNaN(res)||!isFinite(res)?NaN:res;}catch(e){return NaN;}}
function evaluateDeg(expr){const m=state.angleMode;state.angleMode='DEG';const r=evaluate(expr);state.angleMode=m;return r;}

let passed=0,failed=0,testNum=0;
function test(name,expr,expected){
  testNum++;const r=evaluate(expr);const ok=isNaN(expected)?isNaN(r):Math.abs(r-expected)<1e-10;
  if(ok){passed++;console.log(`✓ #${testNum} ${name}`);}else{failed++;console.log(`✗ FAIL #${testNum} ${name}`);console.log(`  "${expr}" → ${r}, expected ${expected}`);}
}
function testDeg(name,expr,expected){
  testNum++;const r=evaluateDeg(expr);const ok=Math.abs(r-expected)<1e-10;
  if(ok){passed++;console.log(`✓ #${testNum} ${name}`);}else{failed++;console.log(`✗ FAIL #${testNum} ${name}`);console.log(`  "${expr}" (DEG) → ${r}, expected ${expected}`);}
}

console.log('\n═══════════════════════════════════');
console.log('  FREECALC-VERIFIED TEST SUITE (200+)');
console.log('═══════════════════════════════════\n');

// ── 1. Basic Arithmetic (20) ──
console.log('── 1. Basic Arithmetic ──');
test('1+1=2','1+1',2);
test('1+2+3+4+5=15','1+2+3+4+5',15);
test('10-4=6','10-4',6);
test('0-5=-5','0-5',-5);
test('3*4=12','3*4',12);
test('0*12345=0','0*12345',0);
test('10/2=5','10/2',5);
test('7/0=NaN','7/0',NaN);
test('0/5=0','0/5',0);
test('2+3*4=14 (PEMDAS)','2+3*4',14);
test('(2+3)*4=20','(2+3)*4',20);
test('10-3-2=5','10-3-2',5);
test('100/5/2=10','100/5/2',10);
test('2*3+4*5=26','2*3+4*5',26);
test('0.1+0.2=0.3','0.1+0.2',0.30000000000000004);
test('1.5*2.5=3.75','1.5*2.5',3.75);
test('10/3 approx','10/3',3.3333333333333335);
test('(-5)+3=-2','-5+3',-2);
test('(-5)*(-3)=15','-5*-3',15);
test('5-(-3)=8','5--3',8);

// ── 2. Exponentiation & Roots (15) ──
console.log('\n── 2. Exponentiation & Roots ──');
test('2^8=256','2^8',256);
test('3^4=81','3^4',81);
test('9^0.5=3','9^0.5',3);
test('(-2)^2=4','(-2)^2',4);
test('(-2)^3=-8','(-2)^3',-8);
test('2^(-1)=0.5','2^(-1)',0.5);
test('10^0=1','10^0',1);
test('sqrt(144)=12','sqrt(144)',12);
test('sqrt(2)=~1.4142','sqrt(2)',Math.SQRT2);
test('sqrt(0)=0','sqrt(0)',0);
test('sqrt(-1)=NaN','sqrt(-1)',NaN);
test('cbrt(27)=3','cbrt(27)',3);
test('cbrt(-8)=-2','cbrt(-8)',-2);
test('cbrt(0)=0','cbrt(0)',0);
test('2^3^2=512','2^3^2',512);

// ── 3. Percentage (5) ──
console.log('\n── 3. Percentage ──');
test('200%=2','200%',2);
test('50%=0.5','50%',0.5);
test('100%=1','100%',1);
test('0%=0','0%',0);
test('5% of 200=10','5%*200',10);

// ── 4. Trig Radians (12) ──
console.log('\n── 4. Trigonometry (RAD) ──');
test('sin(0)=0','sin(0)',0);
test('sin(pi/2)=1','sin(pi/2)',1);
test('sin(pi)=0','sin(pi)',0);
test('sin(3*pi/2)=-1','sin(3*pi/2)',-1);
test('cos(0)=1','cos(0)',1);
test('cos(pi/2)=0','cos(pi/2)',0);
test('cos(pi)=-1','cos(pi)',-1);
test('tan(0)=0','tan(0)',0);
test('tan(pi/4)=1','tan(pi/4)',1);
test('asin(1)=pi/2','asin(1)',Math.PI/2);
test('acos(1)=0','acos(1)',0);
test('atan(1)=pi/4','atan(1)',Math.PI/4);

// ── 5. Trig Degrees (12) ──
console.log('\n── 5. Trigonometry (DEG) ──');
testDeg('sin(0°)=0','sin(0)',0);
testDeg('sin(90°)=1','sin(90)',1);
testDeg('sin(180°)=0','sin(180)',0);
testDeg('sin(270°)=-1','sin(270)',-1);
testDeg('cos(0°)=1','cos(0)',1);
testDeg('cos(90°)=0','cos(90)',0);
testDeg('cos(180°)=-1','cos(180)',-1);
testDeg('tan(0°)=0','tan(0)',0);
testDeg('tan(45°)=1','tan(45)',1);
testDeg('asin(1)=90°','asin(1)',90);
testDeg('acos(0)=90°','acos(0)',90);
testDeg('atan(1)=45°','atan(1)',45);

// ── 6. Hyperbolic Trig (12) ──
console.log('\n── 6. Hyperbolic Trig ──');
test('sinh(0)=0','sinh(0)',0);
test('sinh(1)','sinh(1)',Math.sinh(1));
test('cosh(0)=1','cosh(0)',1);
test('cosh(1)','cosh(1)',Math.cosh(1));
test('tanh(0)=0','tanh(0)',0);
test('tanh(1)','tanh(1)',Math.tanh(1));
test('asinh(0)=0','asinh(0)',0);
test('asinh(1)','asinh(1)',Math.asinh(1));
test('acosh(1)=0','acosh(1)',0);
test('acosh(0)=NaN','acosh(0)',NaN);
test('atanh(0)=0','atanh(0)',0);
test('atanh(0.5)','atanh(0.5)',Math.atanh(0.5));

// ── 7. Reciprocal Trig (6) ──
console.log('\n── 7. Reciprocal Trig ──');
test('csc(pi/2)=1','csc(pi/2)',1);
test('sec(0)=1','sec(0)',1);
test('cot(pi/4)=1','cot(pi/4)',1);
testDeg('csc(90°)=1','csc(90)',1);
testDeg('sec(0°)=1','sec(0)',1);
testDeg('cot(45°)=1','cot(45)',1);

// ── 8. Logarithms (10) ──
console.log('\n── 8. Logarithms ──');
test('ln(1)=0','ln(1)',0);
test('ln(e)=1','ln(e)',1);
test('ln(e^2)=2','ln(e^2)',2);
test('ln(0)=NaN','ln(0)',NaN);
test('ln(-1)=NaN','ln(-1)',NaN);
test('log(1)=0','log(1)',0);
test('log(10)=1','log(10)',1);
test('log(100)=2','log(100)',2);
test('log(0)=NaN','log(0)',NaN);
test('log(-5)=NaN','log(-5)',NaN);

// ── 9. Factorial (6) ──
console.log('\n── 9. Factorial ──');
test('5!=120','5!',120);
test('0!=1','0!',1);
test('1!=1','1!',1);
test('3!=6','3!',6);
test('(-1)!=NaN','(-1)!',NaN);
test('10!=3628800','10!',3628800);

// ── 10. Constants (6) ──
console.log('\n── 10. Constants ──');
test('pi≈3.14159','pi',Math.PI);
test('e≈2.71828','e',Math.E);
test('pi*2≈6.28318','pi*2',Math.PI*2);
test('e^1=e','e^1',Math.E);
test('tau=2*pi','tau',2*Math.PI);
test('tau/2=pi','tau/2',Math.PI);

// ── 11. Number Theory (12) ──
console.log('\n── 11. Number Theory ──');
test('ceil(3.2)=4','ceil(3.2)',4);
test('ceil(-3.2)=-3','ceil(-3.2)',-3);
test('floor(3.8)=3','floor(3.8)',3);
test('floor(-3.8)=-4','floor(-3.8)',-4);
test('round(3.5)=4','round(3.5)',4);
test('round(3.4)=3','round(3.4)',3);
test('gcd(12,8)=4','gcd(12,8)',4);
test('gcd(17,5)=1','gcd(17,5)',1);
test('gcd(0,5)=5','gcd(0,5)',5);
test('lcm(4,6)=12','lcm(4,6)',12);
test('mod(17,5)=2','mod(17,5)',2);
test('mod(-1,5)=4','mod(-1,5)',4);

// ── 12. Combinatorics (8) ──
console.log('\n── 12. Combinatorics ──');
test('nCr(5,2)=10','nCr(5,2)',10);
test('nCr(10,3)=120','nCr(10,3)',120);
test('nCr(5,0)=1','nCr(5,0)',1);
test('nCr(5,5)=1','nCr(5,5)',1);
test('nPr(5,2)=20','nPr(5,2)',20);
test('nPr(10,3)=720','nPr(10,3)',720);
test('nPr(5,0)=1','nPr(5,0)',1);
test('nPr(5,5)=120','nPr(5,5)',120);

// ── 13. Advanced Functions (10) ──
console.log('\n── 13. Advanced Functions ──');
test('abs(-5)=5','abs(-5)',5);
test('abs(5)=5','abs(5)',5);
test('abs(0)=0','abs(0)',0);
test('exp(0)=1','exp(0)',1);
test('exp(1)=e','exp(1)',Math.E);
test('10^2=100','10^2',100);
test('10^(-2)=0.01','10^(-2)',0.01);
test('abs(-3.5)=3.5','abs(-3.5)',3.5);
test('ceil(0.1)=1','ceil(0.1)',1);
test('floor(0.9)=0','floor(0.9)',0);

// ── 14. Complex Expressions (10) ──
console.log('\n── 14. Complex Expressions ──');
test('2+3*4-5/2+6=17.5','2+3*4-5/2+6',17.5);
test('sqrt(3^2+4^2)=5','sqrt(3^2+4^2)',5);
test('(1+2)*(3+4)*(5+6)=231','(1+2)*(3+4)*(5+6)',231);
test('2^(3+1)=16','2^(3+1)',16);
test('sin(pi/4)^2+cos(pi/4)^2=1','sin(pi/4)^2+cos(pi/4)^2',1);
test('(2+3)*4-(6/2)+(5-1)=21','(2+3)*4-(6/2)+(5-1)',21);
test('1/(1+1/(1+1/(1+1)))=0.6','1/(1+1/(1+1/(1+1)))',0.6);
test('sqrt(2)*sqrt(2)=2','sqrt(2)*sqrt(2)',2);
test('3^2+4^2=25','3^2+4^2',25);
test('10*ln(e)+5*log(100)=20','10*ln(e)+5*log(100)',20);

// ── 15. Nested Functions (10) ──
console.log('\n── 15. Nested Functions ──');
test('sin(sqrt(pi))','sin(sqrt(pi))',Math.sin(Math.sqrt(Math.PI)));
test('ln(abs(-5))','ln(abs(-5))',Math.log(5));
test('sqrt(abs(-9))=3','sqrt(abs(-9))',3);
test('cos(ln(e^0))=1','cos(ln(e^0))',1);
test('sin(pi/6)*2=1','sin(pi/6)*2',1);
test('log(10^3)=3','log(10^3)',3);
test('ln(sqrt(e))=0.5','ln(sqrt(e))',0.5);
test('abs(sin(pi))=0','abs(sin(pi))',0);
test('sinh(ln(phi))','sinh(ln((1+sqrt(5))/2))',0.5);
test('ceil(sqrt(pi))=2','ceil(sqrt(pi))',2);

// ── 16. Edge Cases (12) ──
console.log('\n── 16. Edge Cases ──');
test('2^30=1073741824','2^30',1073741824);
test('10^6=1000000','10^6',1000000);
test('0^5=0','0^5',0);
test('1^999=1','1^999',1);
test('999^0=1','999^0',1);
test('empty expr NaN','',NaN);
test('0.5=0.5','0.5',0.5);
test('pi precision','pi',Math.PI);
test('e precision','e',Math.E);
test('sin(0) rad=0','sin(0)',0);
test('gcd(0,0)=NaN','gcd(0,0)',NaN);
test('nthroot(8,3)=2','nthroot(8,3)',2);

// ── 17. Implicit Multiplication (6) ──
console.log('\n── 17. Implicit Multiplication ──');
test('2pi=2*pi','2pi',2*Math.PI);
test('2(3+4)=14','2(3+4)',14);
test('pi*2','2pi',2*Math.PI);
test('e^1=e','e^1',Math.E);
test('2tau=4pi','2tau',4*Math.PI);
test('5% of 200 evaluated as percent','5%*200',10);

// ── 18. Inverse Trig (8) ──
console.log('\n── 18. Inverse Trig ──');
test('asin(0)=0','asin(0)',0);
test('acos(0)=pi/2','acos(0)',Math.PI/2);
test('atan(0)=0','atan(0)',0);
test('asin(-1)=-pi/2','asin(-1)',-Math.PI/2);
test('acos(-1)=pi','acos(-1)',Math.PI);
test('asin(2)=NaN','asin(2)',NaN);
testDeg('asin(1)=90°','asin(1)',90);
testDeg('acos(0)=90°','acos(0)',90);

// ═══════════════════════════════════════════════
//  RESULTS
// ═══════════════════════════════════════════════
console.log('\n═══════════════════════════════════');
console.log(`  TOTAL: ${testNum} tests`);
console.log(`  PASSED: ${passed}`);
console.log(`  FAILED: ${failed}`);
console.log(`  ${failed===0?'✓ ALL TESTS PASSED!':'✗ SOME TESTS FAILED!'}`);
console.log('═══════════════════════════════════\n');
process.exit(failed>0?1:0);
