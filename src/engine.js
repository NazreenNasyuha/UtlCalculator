// ═══════════════════════════════════════════════════════════════════════════════
// engine.js — THE CALCULATION ENGINE (the "brain" of the calculator)
// ═══════════════════════════════════════════════════════════════════════════════
//
// WHAT LIVES HERE
//   • state           — the central object holding ALL calculator data
//                       (expression text, last result, angle mode, precision...)
//   • isFn()          — checks whether a name is one of the supported math functions
//   • applyFn()       — applies a math function to its argument(s): sin, log, nCr...
//   • applyVariadic() — statistics helpers that take many arguments (mean/stdev)
//   • fact() gcd() lcm() nCr() nPr() — small math helpers used by applyFn
//   • tokenize()      — Step 1: splits "3+4*2" into tokens [3, +, 4, *, 2]
//   • toRPN()         — Step 2: Shunting-Yard algorithm → Reverse Polish Notation
//   • evaluateRPN()   — Step 3: walks the RPN stack and computes the final number
//   • evaluate()      — the one entry point: evaluate("3+4*2") === 14
//   • graphEvaluate() — evaluate(expr, { x }) so the graphing engine can plot curves
//   • formatResult()  — turns a raw number into a display string (Auto/Fix/Sci/Eng)
//
// WHY THIS FILE IS "PURE"
//   The engine never touches the page (no DOM access, no event listeners) — it only
//   reads and writes the state object. That is exactly why the test files can copy
//   these functions out and run 1000+ equations against them in plain Node.
//
// ═══ DEEP DIVE — HOW EVERY CALCULATOR EVALUATES MATH ═══════════════════════
//
//   A math expression like "2+3*4" is written in INFIX notation: the operator
//   sits BETWEEN its two operands. Humans read infix naturally, but a computer
//   needs rules for operator precedence (× before +) and parentheses. The
//   classic solution is a 3-step pipeline:
//
//   STEP 1 — TOKENIZE:  "2+3*4"  →  [num 2] [op +] [num 3] [op *] [num 4]
//     The tokenizer is a tiny state machine. It walks the string character by
//     character and classifies each chunk as a NUMBER, FUNCTION/VARIABLE name,
//     OPERATOR (+ - * / ^), PAREN, COMMA, % or !. Numbers also support
//     scientific notation (2e3 = 2000). After the main loop it inserts
//     IMPLICIT multiplication between adjacent values: "2(3+4)" → "2*(3+4)",
//     "2pi" → "2*pi", "2sin(x)" → "2*sin(x)" — just like a real calculator.
//
//   STEP 2 — SHUNTING-YARD (toRPN):  [2][+][3][*][4]  →  [2][3][4][*][+]
//     Named after Edsger Dijkstra's classic algorithm, this converts infix to
//     REVERSE POLISH NOTATION (RPN): every operator is written AFTER its two
//     operands, so parentheses become unnecessary! It uses two structures:
//       • an OUTPUT queue (the result) and an OPERATOR STACK (temporary hold).
//     Rules that make it work:
//       1. Numbers/functions go straight to the output.
//       2. An operator pops off the stack any operator with >= precedence
//          (so * beats +, and + * get correctly ordered), then pushes itself.
//       3. '(' is pushed blindly; ')' pops everything up to the matching '('.
//       4. '^' is RIGHT-associative: 2^3^2 = 2^(3^2) = 512, not (2^3)^2.
//     Precedence table (low → high):  + -  <  * /  <  ^  <  unary minus _
//     Unary minus ('-' that negates, e.g. -5 or 2^-3) is marked with '_' so it
//     binds like '^': -5^2 = -(5^2) = -25, matching standard math.
//
//   STEP 3 — EVALUATE THE RPN STACK (evaluateRPN):  [2][3][4][*][+]  →  14
//     Walking left to right: push every number; when you hit an OPERATOR, pop
//     its operands, compute, and push the result back.
//       2     → push 2            stack: [2]
//       3     → push 3            stack: [2, 3]
//       4     → push 4            stack: [2, 3, 4]
//       *     → pop 4, pop 3, 3*4=12, push 12   stack: [2, 12]
//       +     → pop 12, pop 2, 2+12=14, push 14 stack: [14]  ✔ answer = 14
//
//   GRAPHING SUPPORT
//     evaluate(expr, vars) accepts an optional variable map. The graphing
//     engine calls evaluate("x^2+1", { x: 3 }) for each sampled x, so the SAME
//     parser that powers the calculator also plots curves. This also means
//     "2x+1", "sin(2x)" and "x(x+1)" all work in the graph — the tokenizer's
//     implicit-multiplication rules apply identically.
//
// FILE LOAD ORDER  engine.js → mathml-renderer.js → ui.js → graph.js → main.js
// ═══════════════════════════════════════════════════════════════════════════════
    const state = {
      expression: '',           // The raw math expression as a string (e.g. "sin(45)+2")
      displayValue: '',         // What to show on the display
      lastResult: null,         // The most recent calculation result (for "ans" feature)
      justGotResult: false,     // Flag: did we just press = ? (affects typing behavior)
      angleMode: 'RAD',         // 'RAD' or 'DEG' — affects sin/cos/tan calculations
      secondMode: false,        // '2nd' toggle for inverse functions
      history: [],              // Array of { expression, result } for history display
      isEditing: false,         // Is user typing directly in the textarea?
      cursorPos: 0,             // Cursor position in the expression
      precision: 'auto',        // Display precision: 'auto', 'fix0'-'fix8', 'sci', 'eng'
      fnBuffer: '',             // Buffer for function name when typing (e.g. "sin")
      fnTimeout: null,          // Timeout to clear fnBuffer
      shiftOn: false,           // ABC keyboard shift toggle (uppercase letters)
      calcMode: 'scientific',   // Current calculator mode
      graphColors: ['#58a6ff','#d29922','#56d364','#f85149','#bc8cff','#ff7b72'], // Colors for graph lines
    };

    // EVALUATOR — The math engine!
    // Handles functions, operators, precedence, and angle modes
    // ═══════════════════════════════════════════════════════════════
    function isFn(fn) {
      return ['sin','cos','tan','asin','acos','atan','sinh','cosh','tanh','asinh','acosh','atanh',
              'csc','sec','cot','sqrt','cbrt','log','ln','abs','exp','fact',
              'ceil','floor','round','gcd','lcm','mod','nCr','nPr','nthroot',
              'mean','stdev','stdevp'].includes(fn);
    }

    // Variadic statistics helpers (FreeCalc-style: mean(2,4,6), stdev(1,2,3))
    // stdev  = sample standard deviation (n-1 denominator)
    // stdevp = population standard deviation (n denominator)
    function applyVariadic(fn, args) {
      const n = args.length;
      if (n === 0) return NaN;
      const sum = args.reduce((a, b) => a + b, 0);
      if (fn === 'mean') return sum / n;
      const m = sum / n;
      const ss = args.reduce((a, b) => a + (b - m) * (b - m), 0);
      if (fn === 'stdev') return n < 2 ? NaN : Math.sqrt(ss / (n - 1));  // sample
      return Math.sqrt(ss / n);                                          // population
    }

    // Apply a math function to one or two values
    function applyFn(fn, val, val2) {
      const d=state.angleMode==='DEG';  // Degree mode: convert to radians first
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
        case'csc':return d?1/R.sin(val*PI/180):1/R.sin(val);      // Cosecant
        case'sec':return d?1/R.cos(val*PI/180):1/R.cos(val);      // Secant
        case'cot':return d?1/R.tan(val*PI/180):1/R.tan(val);      // Cotangent
        case'sqrt':return val<0?NaN:R.sqrt(val);
        case'cbrt':return R.cbrt(val);
        case'log':return val<=0?NaN:R.log10(val);                 // Base-10 logarithm
        case'ln':return val<=0?NaN:R.log(val);                    // Natural log
        case'abs':return R.abs(val);
        case'exp':return R.exp(val);
        case'fact':return fact(val);
        case'ceil':return R.ceil(val);
        case'floor':return R.floor(val);
        case'round':return R.round(val);
        case'gcd':return gcd(val,val2);   // Greatest Common Divisor
        case'lcm':return lcm(val,val2);   // Least Common Multiple
        case'mod':return val2===0?NaN:((val%val2)+val2)%val2;     // Modulo
        case'nCr':return nCr(val,val2);    // Combinations
        case'nPr':return nPr(val,val2);    // Permutations
        case'nthroot': {                                          // Nth root (odd roots of negatives are real, like FreeCalc)
          if (val2 === 0) return NaN;
          if (val < 0) return (val2 % 2 === 1) ? -R.pow(-val, 1 / val2) : NaN;
          return R.pow(val, 1 / val2);
        }
        default:return NaN;
      }
    }

    // Factorial: n! = n * (n-1) * (n-2) * ... * 1
    function fact(n){if(n<0||!Number.isInteger(n)||n>170)return NaN;if(n<=1)return 1;let r=1;for(let i=2;i<=n;i++)r*=i;return r;}
    // Greatest Common Divisor (Euclidean algorithm)
    function gcd(a,b){if(!Number.isInteger(a)||!Number.isInteger(b))return NaN;a=Math.abs(a);b=Math.abs(b);if(a===0&&b===0)return NaN;while(b)[a,b]=[b,a%b];return a;}
    // Least Common Multiple
    function lcm(a,b){if(!Number.isInteger(a)||!Number.isInteger(b))return NaN;if(a===0||b===0)return 0;return Math.abs(a*b)/gcd(a,b);}
    // Combinations: nCr = n! / (r! * (n-r)!)
    function nCr(n,r){if(!Number.isInteger(n)||!Number.isInteger(r)||n<0||r<0||r>n)return NaN;if(r===0||r===n)return 1;if(r>n-r)r=n-r;let res=1;for(let i=1;i<=r;i++){res=res*(n-i+1)/i;}return Math.round(res);}
    // Permutations: nPr = n! / (n-r)!
    function nPr(n,r){if(!Number.isInteger(n)||!Number.isInteger(r)||n<0||r<0||r>n)return NaN;if(r===0)return 1;let res=1;for(let i=n;i>n-r;i--)res*=i;return res;}

    const PREC={'+':1,'-':1,'*':2,'/':2,'^':3,'_':3};  // Operator precedence ('_' = unary minus; binds like ^ so -5^2 = -(5^2))
    const RIGHT_ASSOC={'^':true,'_':true};              // Right-associative operators (^ and unary minus)

    // ═══════════════════════════════════════════════════════════════
    // SHUNTING-YARD ALGORITHM
    // Converts infix notation (e.g. "3 + 4 * 2") to Reverse Polish Notation (RPN)
    // then evaluates the RPN stack.
    // This is how calculators properly handle operator precedence!
    // ═══════════════════════════════════════════════════════════════

    // Step 1: Tokenize the expression string into tokens
    function tokenize(expr) {
      const tokens = []; let i = 0;
      while (i < expr.length) {
        if (/\s/.test(expr[i])) { i++; continue; }                          // Skip spaces
        if (/[0-9.]/.test(expr[i])) {                                       // Number
          let n = '';
          while (i < expr.length && /[0-9.]/.test(expr[i])) { n += expr[i]; i++; }
          // Scientific notation (FreeCalc-style): 2e3 → 2000, 1.5e-3 → 0.0015, 2E+4 → 20000.
          // Only when 'e' is immediately followed by a digit (or sign+digit), so "2e" stays 2·e.
          if ((expr[i] === 'e' || expr[i] === 'E') && i + 1 < expr.length &&
              (/[0-9]/.test(expr[i+1]) || ((expr[i+1] === '+' || expr[i+1] === '-') && i + 2 < expr.length && /[0-9]/.test(expr[i+2])))) {
            n += expr[i]; i++;
            if (expr[i] === '+' || expr[i] === '-') { n += expr[i]; i++; }
            while (i < expr.length && /[0-9]/.test(expr[i])) { n += expr[i]; i++; }
          }
          tokens.push({ type: 'number', value: parseFloat(n) });
        } else if (/[a-zA-Zαπτθ]/.test(expr[i])) {                          // Function or variable name (θ = theta, for polar curves)
          let n = '';
          while (i < expr.length && /[a-zA-Zαπτθ]/.test(expr[i])) { n += expr[i]; i++; }
          // Check if it's a known function or a variable like π, τ, e
          if (n === 'π' || n === 'pi') tokens.push({ type: 'number', value: Math.PI });
          else if (n === 'τ' || n === 'tau') tokens.push({ type: 'number', value: Math.PI * 2 });
          else if (n === 'e') tokens.push({ type: 'number', value: Math.E });
          else if (n === 'ans') tokens.push({ type: 'number', value: state.lastResult !== null ? state.lastResult : 0 });  // ans = last result (0 if none yet)
          else if (n === 'theta' || n === 'θ') tokens.push({ type: 'variable', value: 'θ' });  // theta spelled out or as θ
          else if (isFn(n)) tokens.push({ type: 'function', value: n });
          else {
            // GRAPHING-CALCULATOR-STYLE VARIABLE×FUNCTION/CONSTANT SPLITTING
            // "xsin(x)" should mean x·sin(x), "2xexp(-x^2)" = 2·x·exp(-x²) and
            // "xpi" = x·π. The letter-greedy loop above read "xsin" as ONE name;
            // try to split it into a single-letter variable prefix + a known
            // function or constant suffix. The implicit-multiplication pass
            // below then inserts the missing "×".
            const varTok = (pre) =>
              pre === 'e' ? { type: 'number', value: Math.E }
              : pre === 'π' ? { type: 'number', value: Math.PI }
              : pre === 'τ' ? { type: 'number', value: Math.PI * 2 }
              : pre === 'θ' ? { type: 'variable', value: 'θ' }
              : { type: 'variable', value: pre };
            let split = false;
            for (let k = 1; k < n.length && !split; k++) {
              const pre = n.slice(0, k), suf = n.slice(k);
              if (!/^[a-zA-Zαπτθ]$/.test(pre)) continue;
              if (isFn(suf)) {
                tokens.push(varTok(pre), { type: 'function', value: suf });
                split = true;
              } else if (suf === 'pi' || suf === 'π') {
                tokens.push(varTok(pre), { type: 'number', value: Math.PI });
                split = true;
              } else if (suf === 'tau' || suf === 'τ') {
                tokens.push(varTok(pre), { type: 'number', value: Math.PI * 2 });
                split = true;
              } else if (/^[a-zA-Zαπτθ]$/.test(suf)) {
                // variable × variable: "ax" → a·x, "xy" → x·y (so y = ax^2
                // with an "a" slider works without typing the "*")
                tokens.push(varTok(pre), varTok(suf));
                split = true;
              }
            }
            if (!split) tokens.push({ type: 'variable', value: n });          // Plain variable (for graphing)
          }
        } else if (expr[i] === ',') { tokens.push({ type: 'comma', value: ',' }); i++; }
        else if (expr[i] === '%') {                                          // Percent → postfix ÷100 (binds tighter than ×/÷, like FreeCalc: 100/50% = 200)
          tokens.push({ type: 'percent', value: '%' });
          i++;
        } else {
          // Operators, parens, factorial
          if (expr[i] === '!') tokens.push({ type: 'postfix', value: '!' });
          else tokens.push({ type: 'operator', value: expr[i] });
          i++;
        }
      }

      // Implicit multiplication (FreeCalc-style): 2(3+4) → 2*(3+4), (1+2)(3+4) → (1+2)*(3+4), 2pi → 2*pi
      for (let j = 1; j < tokens.length; j++) {
        const prev = tokens[j - 1], cur = tokens[j];
        const prevEndsValue = prev.type === 'number' || prev.type === 'variable' ||
                              (prev.type === 'operator' && prev.value === ')') || prev.type === 'postfix' ||
                              prev.type === 'percent';
        const curStartsValue = cur.type === 'number' || cur.type === 'variable' ||
                               (cur.type === 'operator' && cur.value === '(') || cur.type === 'function';
        if (prevEndsValue && curStartsValue) { tokens.splice(j, 0, { type: 'operator', value: '*' }); j++; }
      }
      return tokens;
    }

    // Step 2: Convert tokens to RPN using the Shunting-Yard algorithm
    function toRPN(tokens) {
      const output = [], stack = [];
      const argCounts = [];   // Parallel to stack: number of comma-separated args at each '(' level
      let expectUnary = true;
      for (const tok of tokens) {
        if (tok.type === 'number') { output.push(tok); expectUnary = false; }
        else if (tok.type === 'variable') { output.push(tok); expectUnary = false; }
        else if (tok.type === 'function') { stack.push(tok); expectUnary = true; }
        else if (tok.type === 'postfix' || tok.type === 'percent') { output.push(tok); }
        else if (tok.type === 'comma') {
          while (stack.length && stack[stack.length-1].value !== '(') output.push(stack.pop());
          if (argCounts.length) argCounts[argCounts.length - 1]++;   // One more arg at this level
          expectUnary = true;   // A '-' after a comma is negation: mean(-4,-21,27,11)
        } else if (tok.value === '(') { stack.push(tok); argCounts.push(0); expectUnary = true; }
        else if (tok.value === ')') {
          while (stack.length && stack[stack.length-1].value !== '(') output.push(stack.pop());
          stack.pop(); // Remove '('
          const argc = argCounts.length ? argCounts.pop() + 1 : 1;
          if (stack.length && stack[stack.length-1].type === 'function') {
            const fn = stack.pop();
            fn.argc = argc;   // Record how many args this call had (variadic: mean/stdev/stdevp)
            output.push(fn);
          }
          expectUnary = false;
        } else { // Operator
          if (tok.value === '-' && expectUnary) { tok.value = '_'; }  // Unary minus (negation)
          while (stack.length && stack[stack.length-1].type === 'operator' &&
                 stack[stack.length-1].value !== '(' &&
                 ((PREC[stack[stack.length-1].value] > PREC[tok.value]) ||
                  (PREC[stack[stack.length-1].value] === PREC[tok.value] && !RIGHT_ASSOC[tok.value]))) {
            output.push(stack.pop());
          }
          stack.push(tok);
          expectUnary = true;
        }
      }
      while (stack.length) output.push(stack.pop());
      return output;
    }

    // Step 3: Evaluate the RPN expression
    function evaluateRPN(rpn, vars) {
      const stack = [];
      for (const tok of rpn) {
        if (tok.type === 'number') { stack.push(tok.value); }
        else if (tok.type === 'variable') {
          // If the caller supplied a value for this variable (e.g. the graphing
          // engine binds `x`), push the number; otherwise keep the name as-is.
          stack.push((vars && tok.value in vars) ? vars[tok.value] : tok.value);
        }
        else if (tok.type === 'postfix') {
          const a = stack.pop();
          if (tok.value === '!') stack.push(applyFn('fact', a));
        } else if (tok.type === 'percent') {
          const a = stack.pop();
          stack.push(a === undefined ? NaN : a / 100);
        } else if (tok.type === 'function') {
          const args = [];
          // Variadic statistics functions: mean/stdev/stdevp take any number of args
          if (tok.value === 'mean' || tok.value === 'stdev' || tok.value === 'stdevp') {
            const argc = tok.argc || 1;
            for (let i = 0; i < argc; i++) args.push(stack.pop());
            args.reverse();
            stack.push(applyVariadic(tok.value, args));
          }
          // Fixed-arity multi-arg functions (e.g. nCr(5,2), gcd(6,9), nthroot(8,3))
          else if (tok.value === 'gcd' || tok.value === 'lcm' || tok.value === 'mod' ||
                   tok.value === 'nCr' || tok.value === 'nPr' || tok.value === 'nthroot') {
            args.push(stack.pop(), stack.pop());  // Pop two args (order matters!)
            stack.push(applyFn(tok.value, args[1], args[0]));  // Apply with arguments reversed
          } else {
            stack.push(applyFn(tok.value, stack.pop()));  // Single arg function
          }
        } else if (tok.type === 'operator') {
          if (tok.value === '_') {               // Unary minus pops exactly ONE operand
            const v = stack.pop();
            stack.push(-v);
          } else {
            const b = stack.pop(), a = stack.pop();
            switch (tok.value) {
              case '+': stack.push(a + b); break;
              case '-': stack.push(a - b); break;
              case '*': stack.push(a * b); break;
              case '/': stack.push(b === 0 ? NaN : a / b); break;
            case '^': {
              let res = Math.pow(a, b);
              // REAL NTH ROOTS, GRAPHING-CALCULATOR-STYLE: (-8)^(1/3) = -2, not NaN.
              // Math.pow only yields a real number for INTEGER exponents on a
              // negative base; for fractional exponents it returns NaN. Detect
              // the common 1/(odd integer) case and return the negative real
              // root instead (x^(1/2) stays NaN — no real square root exists).
              if (Number.isNaN(res) && a < 0 && !Number.isInteger(b)) {
                // Use a tolerance: 1/(1/3) can round to 3.0000000000000004 in
                // floating point, so a plain Number.isInteger() would miss it.
                const n = Math.round(1 / b);
                if (Math.abs(1 / b - n) < 1e-9 && Math.abs(n) % 2 === 1) res = -Math.pow(-a, b);
              }
              stack.push(res);
              break;
            }
            }
          }
        }
      }
      return stack[0];  // Final result
    }

    // Master evaluate function: tokenize → RPN → evaluate
    // `vars` (optional) binds variable names to numbers — used by the graphing
    // engine to plot curves: evaluate("x^2+1", { x: 3 }) === 10
    function evaluate(expr, vars) {
      try {
        if (!String(expr).trim()) return NaN;   // empty input → NaN, not undefined
        const tokens = tokenize(expr);
        const rpn = toRPN(tokens);
        return evaluateRPN(rpn, vars);
      } catch (e) {
        return NaN;
      }
    }

    // Evaluate an expression with the graphing variable `x` bound to a value.
    // This is what the graphing engine calls for every sampled pixel along the
    // x-axis: graphEvaluate("sin(x)", 0.5) === Math.sin(0.5)
    function graphEvaluate(expr, x) {
      return evaluate(String(expr), { x: x });
    }

    // ═══════════════════════════════════════════════════════════════
    // FORMATTING HELPERS
    // ═══════════════════════════════════════════════════════════════

    // Format a number according to the selected precision mode
    function formatResult(num) {
      if (!isFinite(num)) return num > 0 ? '∞' : num < 0 ? '-∞' : 'Error';
      const prec = state.precision;
      if (prec === 'auto') {
        // Auto: show up to 10 significant digits, trim trailing zeros
        const s = parseFloat(num.toPrecision(10)).toString();
        return s.length > 14 ? num.toExponential(6) : s;
      }
      if (prec === 'sci') return num.toExponential(4);          // Scientific notation
      if (prec === 'eng') {                                      // Engineering notation
        const e = Math.floor(Math.log10(Math.abs(num)) / 3) * 3;
        const m = num / Math.pow(10, e);
        return m.toFixed(3) + 'e' + e;
      }
      // Fixed decimal places (fix0 through fix8)
      const digits = parseInt(prec.replace('fix', ''));
      return num.toFixed(digits);
    }

    // ═══════════════════════════════════════════════════════════════
    // EXPORTS (ES module) — what other files may import from engine.js
    // ═══════════════════════════════════════════════════════════════
    export { state, evaluate, graphEvaluate, formatResult, tokenize, toRPN, evaluateRPN, isFn };

    // ═══════════════════════════════════════════════════════════════
