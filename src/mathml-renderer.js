// ═══════════════════════════════════════════════════════════════════════════════
// mathml-renderer.js — DISPLAY RENDERER (expressions as textbook-style math)
// ═══════════════════════════════════════════════════════════════════════════════
//
// WHAT LIVES HERE
//   • esc()            — escapes & < > " so text is safe to insert into markup
//   • tokD()           — a SECOND, display-oriented tokenizer (keeps raw text)
//   • parseMML()       — entry point: "5/2" → <mfrac>5 over 2</mfrac> markup
//   • parseAdd/Mul/Pow/Un — recursive-descent parser with math precedence:
//                           + -  (lowest)  <  × /  <  ^  <  unary minus
//   • renderExpression()— puts the parsed markup + blinking caret into the display
//
// MathML is a W3C standard that lets a browser draw real math notation
// (fractions, exponents, Greek letters) instead of flat text like "5/2".
// While you type, this file converts your expression into that notation.
//
// FILE LOAD ORDER  engine.js → mathml-renderer.js → ui.js → graph.js → main.js
// ═══════════════════════════════════════════════════════════════════════════════

    // ─── IMPORTS (ES module) — shares the calculator state with engine.js ───
    import { state } from './engine.js';

    // The display element this renderer draws into (defined in the markup).
    // NOTE: module scripts are deferred, so the DOM is fully parsed by the time
    // this line runs.
    const displayMath = document.getElementById('displayMath');

    // MATHML RENDERER
    // Takes a math expression string and converts it to MathML markup
    // for beautiful textbook-style display (fractions, exponents, etc.)
    // ═══════════════════════════════════════════════════════════════
    function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\\"/g,'&quot;'); }

    let phOk = true;  // When false, the "?" placeholder is omitted (cursor is mid-expression)
    // Tokenizer: breaks an expression into tokens (numbers, names, operators, parens)
    function tokD(expr) {
      const t=[]; let i=0;
      while(i<expr.length){
        if(/\s/.test(expr[i])){i++;continue;}                           // Skip whitespace
        if(/[0-9.]/.test(expr[i])){let n='';while(i<expr.length&&/[0-9.]/.test(expr[i])){n+=expr[i];i++;}if((expr[i]==='e'||expr[i]==='E')&&i+1<expr.length&&(/[0-9]/.test(expr[i+1])||((expr[i+1]==='+'||expr[i+1]==='-')&&i+2<expr.length&&/[0-9]/.test(expr[i+2])))){n+=expr[i];i++;if(expr[i]==='+'||expr[i]==='-'){n+=expr[i];i++;}while(i<expr.length&&/[0-9]/.test(expr[i])){n+=expr[i];i++;}}t.push({type:'num',value:n});}
        else if(/[a-zA-Zπτ]/.test(expr[i])){let n='';while(i<expr.length&&/[a-zA-Zπτ]/.test(expr[i])){n+=expr[i];i++;}t.push({type:'name',value:n});}
        else if('+-*/^'.includes(expr[i])){t.push({type:'op',value:expr[i]});i++;}
        else if(expr[i]==='('){t.push({type:'lparen',value:'('});i++;}
        else if(expr[i]===')'){t.push({type:'rparen',value:')'});i++;}
        else if(expr[i]===','){t.push({type:'comma',value:','});i++;}
        else if(expr[i]==='%'){t.push({type:'percent',value:'%'});i++;}
        else if(expr[i]==='!'){t.push({type:'postfix',value:'!'});i++;}
        else{t.push({type:'unknown',value:expr[i]});i++;}
      }
      return t;
    }

    // Recursive descent parser: expression → MathML
    // parseAdd → parseMul → parsePow → parseUn (precedence: +- < */ < ^ < unary)
    function parseMML(expr) {
      if(!expr||!expr.trim())return'';
      try{const r=parseAdd(tokD(expr),0);return(r&&r.m)?r.m:`<mn>${esc(expr)}</mn>`;}catch(e){return'<mrow><mi>expr</mi></mrow>';}
    }
    function parseAdd(t,p){let l=parseMul(t,p);if(!l)return null;let{m,pos:n}=l;while(n<t.length&&(t[n].value==='+'||t[n].value==='-')){const o=t[n].value;n++;const r=parseMul(t,n);if(!r){m=phOk?`<mrow>${m}${o==='+'?'<mo>+</mo>':'<mo>−</mo>'}<mtext class=\"placeholder\">&#x25FB;</mtext></mrow>`:`<mrow>${m}${o==='+'?'<mo>+</mo>':'<mo>−</mo>'}</mrow>`;break;}m=`<mrow>${m}${o==='+'?'<mo>+</mo>':'<mo>−</mo>'}${r.m}</mrow>`;n=r.pos;}return{m,pos:n};}
    function parseMul(t,p){let l=parsePow(t,p);if(!l)return null;let{m,pos:n}=l;while(n<t.length){const tk=t[n];if(tk.value==='*'||tk.value==='/'){const o=tk.value;n++;const r=parsePow(t,n);if(!r){m=phOk?(o==='/'?`<mfrac>${m}<mtext class=\"placeholder\">&#x25FB;</mtext></mfrac>`:`<mrow>${m}<mo>×</mo><mtext class=\"placeholder\">&#x25FB;</mtext></mrow>`):(o==='/'?`<mrow>${m}<mo>/</mo></mrow>`:`<mrow>${m}<mo>×</mo></mrow>`);break;}m=o==='/'?`<mfrac>${m}${r.m}</mfrac>`:`<mrow>${m}<mo>×</mo>${r.m}</mrow>`;n=r.pos;}else if(tk.type==='name'||tk.type==='num'||tk.value==='('){/* implicit multiplication: keep in sync with the engine tokenizer's curStartsValue (number/variable/'('/function) */const r=parsePow(t,n);if(!r)break;m=`<mrow>${m}<mo>×</mo>${r.m}</mrow>`;n=r.pos;}else break;}return{m,pos:n};}
    function parsePow(t,p){let l=parseUn(t,p);if(!l)return null;let{m,pos:n}=l;while(n<t.length&&(t[n].type==='percent'||t[n].type==='postfix')){m=t[n].type==='percent'?`<mrow>${m}<mo>%</mo></mrow>`:`<mrow>${m}<mo>!</mo></mrow>`;n++;}if(n<t.length&&t[n].value==='^'){n++;const r=parsePow(t,n);if(r){m=`<msup>${m}${r.m}</msup>`;n=r.pos;}else{m=phOk?`<msup>${m}<mtext class=\"placeholder\">&#x25FB;</mtext></msup>`:`<mrow>${m}<mo>^</mo></mrow>`;}}return{m,pos:n};}
    function parseUn(t,p){
      if(p>=t.length)return null;
      const F={'sin':'sin','cos':'cos','tan':'tan','asin':'sin⁻¹','acos':'cos⁻¹','atan':'tan⁻¹',
               'sinh':'sinh','cosh':'cosh','tanh':'tanh','asinh':'sinh⁻¹','acosh':'cosh⁻¹','atanh':'tanh⁻¹',
               'csc':'csc','sec':'sec','cot':'cot','log':'log','ln':'ln','sqrt':'√','cbrt':'∛',
               'abs':'abs','exp':'exp','fact':'fact','ceil':'ceil','floor':'floor','round':'round',
               'gcd':'gcd','lcm':'lcm','mod':'mod','ncr':'nCr','npr':'nPr','nthroot':'nthroot',
               'mean':'mean','stdev':'stdev','stdevp':'stdevp'};
      const fnKey = t[p].type==='name' ? t[p].value.toLowerCase() : null;
      if(fnKey && F[fnKey]){
        const d=F[fnKey]; p++;
        if(p<t.length&&t[p].value==='('){
          p++;
          const args = [];
          while(p<t.length&&t[p].value!==')'){
            const arg = parseAdd(t, p);
            if(!arg){
              if(phOk) args.push('<mtext class="placeholder">&#x25FB;</mtext>');
              break;
            }
            args.push(arg.m);
            p = arg.pos;
            if(p<t.length&&t[p].value===','){
              p++;
            } else {
              break;
            }
          }
          if(args.length===0&&phOk) args.push('<mtext class="placeholder">&#x25FB;</mtext>');
          if(p<t.length&&t[p].value===')'){
            p++;
            return {m:`<mrow><mi>${d}</mi><mo>(</mo>${args.join('<mo>,</mo>')}<mo>)</mo></mrow>`,pos:p};
          }
          return {m:`<mrow><mi>${d}</mi><mo>(</mo>${args.join('<mo>,</mo>')}</mrow>`,pos:p};
        }
        return {m:`<mi>${d}</mi>`,pos:p};
      }
      if(t[p].type==='name'){const v=t[p].value;if(v==='π')return{m:'<mi>π</mi>',pos:p+1};if(v==='τ')return{m:'<mi>τ</mi>',pos:p+1};if(v==='e')return{m:'<mi>e</mi>',pos:p+1};return{m:v==='ans'?'<mi>ans</mi>':`<mi>${esc(v)}</mi>`,pos:p+1};}
      if(t[p].type==='num')return{m:`<mn>${esc(t[p].value)}</mn>`,pos:p+1};
      if(t[p].value==='('){
        p++;
        const args = [];
        while(p<t.length&&t[p].value!==')'){
          const arg = parseAdd(t, p);
          if(!arg){
            if(phOk) args.push('<mtext class="placeholder">&#x25FB;</mtext>');
            break;
          }
          args.push(arg.m);
          p = arg.pos;
          if(p<t.length&&t[p].value===','){
            p++;
          } else {
            break;
          }
        }
        if(args.length===0&&phOk) args.push('<mtext class="placeholder">&#x25FB;</mtext>');
        if(p<t.length&&t[p].value===')'){
          p++;
          return {m:`<mrow><mo>(</mo>${args.join('<mo>,</mo>')}<mo>)</mo></mrow>`,pos:p};
        }
        return {m:`<mrow><mo>(</mo>${args.join('<mo>,</mo>')}</mrow>`,pos:p};
      }
      if(t[p].value==='-'){p++;const inner=parseUn(t,p);if(inner)return{m:`<mrow><mo>−</mo>${inner.m}</mrow>`,pos:inner.pos};return{m:'<mo>−</mo>',pos:p};}
      return null;
    }

    // Updates the MathML display with the current expression.
    // Shows a blinking caret at state.cursorPos (FreeCalc-style ← → editing).
    function renderExpression() {
      const e=state.expression||'';
      if(!e){displayMath.innerHTML='<span class="empty-placeholder">Type an expression...</span>';return;}
      const pos=Math.max(0,Math.min(state.cursorPos===undefined?e.length:state.cursorPos,e.length));
      const before=e.slice(0,pos), after=e.slice(pos);
      const caret='<span class="math-caret"></span>';
      try{
        // When the cursor sits mid-expression, suppress the "?" placeholder so
        // the pre-caret slice doesn't show a phantom hint (e.g. "5+2" -> "5+|2" not "5+?|2").
        phOk = !after;
        const m=(before?parseMML(before):'')+caret+(after?parseMML(after):'');
        displayMath.innerHTML=`<math xmlns="http://www.w3.org/1998/Math/MathML">${m}</math>`;
      }
      catch(er){displayMath.innerHTML=`<math xmlns="http://www.w3.org/1998/Math/MathML"><mn>${esc(e)}</mn></math>`;}
      phOk = true;  // Always reset the placeholder flag (even on errors)
      displayMath.scrollLeft=displayMath.scrollWidth;   // Scroll to show the latest part
    }

    // ═══════════════════════════════════════════════════════════════
    // EXPORTS (ES module) — what other files may import from this file
    // ═══════════════════════════════════════════════════════════════
    export { esc, renderExpression };

    // ═══════════════════════════════════════════════════════════════
