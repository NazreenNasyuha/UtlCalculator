// ═══════════════════════════════════════════════════════════════════════════════
// graph.js — THE GRAPHING ENGINE (professional graphing-calculator style)
// ═══════════════════════════════════════════════════════════════════════════════
//
// WHAT LIVES HERE
//   • graphState      — viewport (xMin..xMax, yMin..yMax), expression list, hover x
//   • mathToScreen() / screenToMath() — convert between math coords and pixels
//   • niceScale()     — picks "nice" grid steps (1, 2, 5, 10, 20, 50...)
//   • parseGraphExpression() — decides the curve type of a row:
//        cartesian  "y = x^2"                 (or just "x^2")
//        parametric "x = cos(t), y = sin(t)"  (or "(cos(t), sin(t))")
//        polar      "r = 2cos(θ)"             (theta may be typed "θ" or "theta")
//        implicit   "x^2 + y^2 = 25"          (any equation with a top-level '=',
//                     rendered by marching squares — also makes "x = 3" a
//                     vertical line)
//        derivative "y' = x^2"  "f'(x) = x^2"  "d/dx x^2" — the NUMERIC
//                     derivative dy/dx (central difference), plotted like any
//                     other curve — no symbolic calculus engine needed!
//                     Higher orders too: "y'' = x^3", "f''(x) = x^3",
//                     "d2/dx2 x^3", "d3/dx3(x^3)" ...
//        integral   "integral(x^2, 0, 2)" (or "∫(x^2, 0, 2)") — shades the
//                     area under f(x) between the bounds (Simpson's rule) and
//                     labels the value. Bounds may be slider letters:
//                     "integral(x^2, 0, a)"
//        tangent    "tangent(x^2, 2)" — the TANGENT LINE to a curve at a
//                     point. The point can be a literal number or a slider
//                     letter: "tangent(x^2, a)" and drag a to animate it.
//   • t/θ range controls — type new min/max values to resample parametric (t)
//     and polar (θ) curves live
//   • legend overlay + ? help — color→curve legend on the canvas and a
//     keyboard-shortcuts cheat sheet
//   • getVariableNames() / syncSliders() — find single-letter variables (a, b, k…)
//     that aren't the axis variable and give each one a draggable SLIDER
//   • renderGraph()  — draws grid, axes, labels and every curve
//   • exportGraph()  — redraws the scene on an offscreen canvas at 2x and downloads a PNG
//   • addGraphExpression() / remove / toggle / cycleColor — manage the list
//   • renderGraphExprList() — builds the editable rows (+ sliders)
//   • validateExpression()  — shows a friendly error for bad syntax
//   • initGraph()     — wires pan (mouse/touch), wheel zoom, buttons, list editing
//   • handleGraphKeypad() — routes keypad clicks into the focused expression row
//
// HOW CURVES ARE DRAWN (the important part!)
//   For every pixel column we pick a sample value (x, t or θ), call the engine's
//   evaluate() with that variable bound (plus any slider values), and draw a line
//   to the previous point. Non-finite results (division by zero, log of a negative
//   number, sqrt of a negative...) BREAK the line — that is how asymptotes are
//   drawn. Because we reuse the SAME parser as the calculator, implicit
//   multiplication works too: 2x, x(x+1), 2sin(x) and xsin(x) are all valid.
//
// CURVE TYPES
//   • Cartesian : y = f(x)   — x is sampled across the viewport.
//   • Parametric: x = f(t), y = g(t) — t is sampled (default -10..10); the
//     computed (x, y) pair is plotted directly in math space.
//   • Polar     : r = f(θ)   — θ is sampled (default 0..2π); the point is
//     (r·cosθ, r·sinθ), so r = 2cos(θ) draws a circle of radius 1 at (1, 0).
//   • Implicit  : lhs = rhs   — e.g. x^2 + y^2 = 25. No "y =" form to sample,
//     so the zero-set of f(x,y) = lhs − rhs is traced with MARCHING SQUARES.
//     "x = 3" also lands here (vertical line). Both t and θ ranges are
//     adjustable via the sidebar controls.
//   • Derivative: y' = f(x)   — type "y' = x^3", "f'(x) = x^3", "d/dx x^3" or
//     "d/dx(x^3)" to plot dy/dx. Computed NUMERICALLY with a central
//     difference (no symbolic differentiation), so it works on any expression
//     the engine can evaluate — including implicit ones via a slider-free
//     sample of the original formula. Higher orders use the classic
//     central-difference stencils: "y'' = x^3", "d2/dx2 x^3", "d3/dx3(x^3)"...
//   • Integral  : integral(f, a, b) — "integral(x^2, 0, 2)" (∫ symbol works
//     too) shades the area between y = f(x) and the x-axis from a to b,
//     computes the definite integral with SIMPSON'S RULE and labels the
//     value. The bounds can be numbers or slider letters
//     ("integral(x^2, 0, a)" → the a slider moves the upper bound).
//   • Trace     : the ◎ button turns on TRACE mode — moving the mouse over
//     the canvas marks the curve under the cursor, draws its TANGENT LINE
//     and shows a live readout of x, f(x) and f'(x).
//   • Tangent   : tangent(f(x), a) — e.g. "tangent(x^2, 2)" draws the line
//     y = f(a) + f'(a)·(x − a) and a dot at the touch point. The point can
//     also be a single letter ("tangent(x^2, a)") which becomes a SLIDER —
//     drag it to slide the tangent line along the curve.
//   • Any other single letter (a, b, k, m…) becomes a SLIDER (default -10..10,
//     step 0.1, value 1) — drag it to animate the curve live.
//
// FILE LOAD ORDER  engine.js → mathml-renderer.js → ui.js → graph.js → main.js
// ═══════════════════════════════════════════════════════════════════════════════

    // ─── IMPORTS (ES module) ───
    import { state, evaluate, graphEvaluate, isFn, tokenize, toRPN, evaluateRPN } from './engine.js';
    import { playKeySound } from './ui.js';

    // Line-color palette for plotted functions (defined in the state object in
    // engine.js; engine.js always loads before this file).
    const GRAPH_COLORS = state.graphColors;

    // ─── Graph DOM references ───
    const graphCanvas = document.getElementById('graphCanvas');
    const graphExprList = document.getElementById('graphExprList');
    const graphAddBtn = document.getElementById('graphAddBtn');
    const graphCoordLabel = document.getElementById('graphCoordLabel');
    const graphZoomIn = document.getElementById('graphZoomIn');
    const graphZoomOut = document.getElementById('graphZoomOut');
    const graphHome = document.getElementById('graphHome');
    const graphExport = document.getElementById('graphExport');
    const graphLegend = document.getElementById('graphLegend');
    const graphHelpBtn = document.getElementById('graphHelpBtn');
    const graphHelp = document.getElementById('graphHelp');
    const tMinInput = document.getElementById('tMinInput');
    const tMaxInput = document.getElementById('tMaxInput');
    const thMinInput = document.getElementById('thMinInput');
    const thMaxInput = document.getElementById('thMaxInput');
    const xMinInput = document.getElementById('xMinInput');
    const xMaxInput = document.getElementById('xMaxInput');
    const yMinInput = document.getElementById('yMinInput');
    const yMaxInput = document.getElementById('yMaxInput');
    const graphAspectBtn = document.getElementById('graphAspect');
    const graphTraceBtn = document.getElementById('graphTraceBtn');
    // View sliders (zoom + aspect ratio) in the sidebar range panel
    const viewZoomSlider = document.getElementById('viewZoomSlider');
    const viewZoomVal = document.getElementById('viewZoomVal');
    const viewAspectSlider = document.getElementById('viewAspectSlider');
    const viewAspectVal = document.getElementById('viewAspectVal');
    // Table of values and share controls
    const graphTableBtn = document.getElementById('graphTableBtn');
    const graphShareBtn = document.getElementById('graphShareBtn');
    const graphTableModal = document.getElementById('graphTableModal');
    const tableModalClose = document.getElementById('tableModalClose');
    const tableXStart = document.getElementById('tableXStart');
    const tableXEnd = document.getElementById('tableXEnd');
    const tableXStep = document.getElementById('tableXStep');
    const tableCopyBtn = document.getElementById('tableCopyBtn');
    const tableCsvBtn = document.getElementById('tableCsvBtn');
    const tableContent = document.getElementById('tableContent');
    const graphToast = document.getElementById('graphToast');

    // GRAPHING ENGINE
    // ═══════════════════════════════════════════════════════════════

    // Graph state: viewport, scale, expressions list
    const graphState = {
      expressions: [],            // Array of { text, visible, color, sliders }
      xMin: -10, xMax: 10,
      yMin: -10, yMax: 10,
      tMin: -10, tMax: 10,        // Parametric curves: t sampling range
      thMin: 0, thMax: 2 * Math.PI,  // Polar curves: θ sampling range
      aspectLock: false,          // Lock x/y scale to 1:1 (square grid)
      activeIndex: -1,            // Which expression row is being edited (-1 = none)
      hoverX: null,               // Math-space x under the mouse (for value preview)
      traceOn: false,             // Trace mode: mark curve + tangent under the mouse
      initialized: false,         // True once graph listeners are bound
    };

    // localStorage key where the whole graph session is persisted
    const GRAPH_STORAGE_KEY = 'freecalc-graph-state';

    // Coordinate conversion: math space ↔ screen space.
    // `width`/`height` are passed in so this also works when drawing to an
    // offscreen canvas for PNG export.
    function mathToScreen(x, y, width, height) {
      const sx = ((x - graphState.xMin) / (graphState.xMax - graphState.xMin)) * width;
      const sy = height - ((y - graphState.yMin) / (graphState.yMax - graphState.yMin)) * height;
      return { x: sx, y: sy };
    }
    function screenToMath(sx, sy) {
      const rect = graphCanvas.getBoundingClientRect();
      const width = rect.width, height = rect.height;
      const mx = (sx / width) * (graphState.xMax - graphState.xMin) + graphState.xMin;
      const my = ((height - sy) / height) * (graphState.yMax - graphState.yMin) + graphState.yMin;
      return { x: mx, y: my };
    }

    // Find "nice" numbers for grid lines (1, 2, 5, 10, 20, 50...)
    function niceScale(range, ticks) {
      const rough = range / ticks;
      const mag = Math.pow(10, Math.floor(Math.log10(rough)));
      const norm = rough / mag;
      let nice;
      if (norm < 1.5) nice = 1;
      else if (norm < 3.5) nice = 2;
      else if (norm < 7.5) nice = 5;
      else nice = 10;
      return nice * mag;
    }

    // Read a CSS variable with a fallback (used for theme-aware colors)
    function cssVar(name, fallback) {
      return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
    }

    // Strip a "y = ..." or "f(x) = ..." prefix so we only evaluate the right side
    function stripPrefix(text) {
      return text.replace(/^(y|f)\s*\(\s*x\s*\)\s*=\s*/i, '').replace(/^y\s*=\s*/i, '').trim();
    }

    // ── EXPRESSION TYPE DETECTION ─────────────────────────────────────
    // Returns { kind, xExpr, yExpr, rExpr, lhsExpr, rhsExpr } so the renderer
    // knows how to plot. Detection order matters (specific → general):
    //   "y = x^2"                    → cartesian, yExpr = "x^2"
    //   "x = cos(t), y = sin(t)"     → parametric
    //   "(cos(t), sin(t))"           → parametric
    //   "r = 2cos(θ)"                → polar
    //   "x^2 + y^2 = 25"             → IMPLICIT (lhsExpr/rhsExpr) — an equation
    //                                   relating x and y, rendered with a
    //                                   marching-squares contour finder. "x = 3"
    //                                   falls here too → a vertical line.
    function parseGraphExpression(text) {
      const t = String(text).trim();
      // Parametric: "x = ..., y = ..."
      let m = t.match(/^x\s*=\s*(.*?),?\s*y\s*=\s*(.*)$/i);
      if (m) return { kind: 'parametric', xExpr: m[1].trim(), yExpr: m[2].trim() };
      // Parametric: "(f(t), g(t))"
      m = t.match(/^\(\s*(.+?),\s*(.+?)\s*\)$/);
      if (m && /[tθ]/.test(m[1] + m[2])) return { kind: 'parametric', xExpr: m[1].trim(), yExpr: m[2].trim() };
      // Polar: "r = ..."
      m = t.match(/^r\s*=\s*(.*)$/i);
      if (m) return { kind: 'polar', rExpr: m[1].trim() };
      // Derivative forms (must be checked BEFORE the implicit '=' branch —
      // "y' = x^2" contains an '=' that would otherwise be read as an
      // equation!). Higher orders are supported via extra primes or the
      // dⁿ/dxⁿ notation: "y'' = x^3", "f'''(x) = x^4", "d2/dx2 x^3"...
      //   "f'(x) = x^2" / "f''(x) = x^3" → derivative (order = # of primes)
      m = t.match(/^f('+)\s*\(\s*x\s*\)\s*=\s*(.+)$/i);
      if (m) return { kind: 'derivative', yExpr: m[2].trim(), order: m[1].length };
      //   "y' = x^2" / "y'' = x^3" → derivative (order = # of primes)
      m = t.match(/^y('+)\s*=\s*(.+)$/i);
      if (m) return { kind: 'derivative', yExpr: m[2].trim(), order: m[1].length };
      //   "d/dx x^2" / "d/dx(x^2)" → 1st derivative
      //   "d2/dx2 x^3" / "d2/dx2(x^3)" → 2nd derivative (the digit repeats
      //   via the \1 backreference, so d2/dx2 only matches d2/dx2)
      m = t.match(/^d(\d*)\/dx\1\s*\((.+)\)\s*$/i) || t.match(/^d(\d*)\/dx\1\s+(.+)$/i);
      if (m) return { kind: 'derivative', yExpr: m[2].trim(), order: m[1] ? parseInt(m[1], 10) : 1 };
      // A bare "d/dx" / "d2/dx2" is an empty derivative scaffold (auto-removed)
      if (/^d(\d*)\/dx\1\s*$/i.test(t)) return { kind: 'derivative', yExpr: '', order: 1 };
      // Definite integral: "integral(x^2, 0, 2)" or "∫(x^2, 0, 2)". The bounds
      // may be numbers, expressions like "pi", or slider letters
      // ("integral(x^2, 0, a)" → the a slider moves the upper bound).
      if (/^(?:integral|∫)\s*\(/i.test(t)) {
        const inner = t.replace(/^(?:integral|∫)\s*\(/i, '').replace(/\)\s*$/, '').trim();
        const args = splitTopLevelArgs(inner);
        if (args.length >= 3) {
          return { kind: 'integral', yExpr: args[0], aExpr: args[1], bExpr: args[2] };
        }
      }
      // Tangent line: "tangent(expr, point)" — point is a number or a letter
      m = t.match(/^tangent\s*\((.+?),\s*([^)]+)\)\s*$/i);
      if (m) return { kind: 'tangent', yExpr: m[1].trim(), point: m[2].trim() };

      // Inequality forms: y <= x^2, y < 2x+1, x <= 3, x^2 + y^2 <= 25, etc.
      const findTopLevelIneq = (str) => {
        let depth = 0;
        for (let i = 0; i < str.length; i++) {
          const ch = str[i];
          if (ch === '(') depth++;
          else if (ch === ')') depth--;
          if (depth === 0) {
            if (str.slice(i, i + 4) === '\\leq') return { index: i, length: 4, op: '<=' };
            if (str.slice(i, i + 4) === '\\geq') return { index: i, length: 4, op: '>=' };
            if (str.slice(i, i + 3) === '\\le') return { index: i, length: 3, op: '<=' };
            if (str.slice(i, i + 3) === '\\ge') return { index: i, length: 3, op: '>=' };
            if (str.slice(i, i + 2) === '<=') return { index: i, length: 2, op: '<=' };
            if (str.slice(i, i + 2) === '>=') return { index: i, length: 2, op: '>=' };
            if (ch === '≤') return { index: i, length: 1, op: '<=' };
            if (ch === '≥') return { index: i, length: 1, op: '>=' };
            if (ch === '<') return { index: i, length: 1, op: '<' };
            if (ch === '>') return { index: i, length: 1, op: '>' };
          }
        }
        return null;
      };

      const ineq = findTopLevelIneq(t);
      if (ineq) {
        const lhsRaw = t.slice(0, ineq.index).trim();
        const rhsRaw = t.slice(ineq.index + ineq.length).trim();
        const op = ineq.op;
        const strict = (op === '<' || op === '>');

        // Derivative forms: y' <= x^2, f'(x) < x^2
        const lhsDeriv = lhsRaw.match(/^(?:f('+)\s*\(\s*x\s*\)|y('+))$/i);
        if (lhsDeriv) {
          const order = (lhsDeriv[1] || lhsDeriv[2]).length;
          return { kind: 'inequality', subtype: 'derivative', order, op, strict, yExpr: rhsRaw };
        }

        // Standard y or f(x) on LHS: y <= x^2, f(x) > 2x + 1
        const isLhsY = /^(y|f\s*\(\s*x\s*\))$/i.test(lhsRaw);
        const isRhsY = /^(y|f\s*\(\s*x\s*\))$/i.test(rhsRaw);
        if (isLhsY) {
          return { kind: 'inequality', subtype: 'y', op, strict, yExpr: rhsRaw };
        }
        if (isRhsY) {
          const flip = { '<=': '>=', '>=': '<=', '<': '>', '>': '<' };
          return { kind: 'inequality', subtype: 'y', op: flip[op], strict, yExpr: lhsRaw };
        }

        // Vertical inequality: x <= 3, -2 < x
        const isLhsX = /^x$/i.test(lhsRaw);
        const isRhsX = /^x$/i.test(rhsRaw);
        if (isLhsX && !/[y]/i.test(rhsRaw)) {
          return { kind: 'inequality', subtype: 'x', op, strict, xVal: rhsRaw };
        }
        if (isRhsX && !/[y]/i.test(lhsRaw)) {
          const flip = { '<=': '>=', '>=': '<=', '<': '>', '>': '<' };
          return { kind: 'inequality', subtype: 'x', op: flip[op], strict, xVal: lhsRaw };
        }

        // General implicit inequality: x^2 + y^2 <= 25
        return { kind: 'inequality', subtype: 'implicit', op, strict, lhsExpr: lhsRaw, rhsExpr: rhsRaw };
      }
      // Cartesian with a "y =" or "f(x) =" prefix. "y = d/dx x^2" also
      // becomes a derivative row after the prefix is stripped.
      const stripped = stripPrefix(t);
      if (stripped !== t) {
        const dm = stripped.match(/^d(\d*)\/dx\1\s*\((.+)\)\s*$/i) || stripped.match(/^d(\d*)\/dx\1\s+(.+)$/i);
        if (dm) return { kind: 'derivative', yExpr: dm[2].trim(), order: dm[1] ? parseInt(dm[1], 10) : 1 };
        return { kind: 'cartesian', yExpr: stripped };
      }
      // Implicit: an equation with a TOP-LEVEL '=' that isn't a y=/r=/f(x)= form.
      // e.g. "x^2 + y^2 = 25", "x = 3", "sin(x) = cos(y)".
      const eq = findTopLevelEquals(t);
      if (eq > 0) {
        return { kind: 'implicit', lhsExpr: t.slice(0, eq).trim(), rhsExpr: t.slice(eq + 1).trim() };
      }
      // Default: plain cartesian (no '=' at all)
      return { kind: 'cartesian', yExpr: t };
    }

    // Split "a, b, c" on TOP-LEVEL commas only — commas inside parentheses
    // don't split. Used by the integral parser so "integral(nCr(5,2), 0, 2)"
    // keeps nCr(5,2) whole as the first argument.
    function splitTopLevelArgs(text) {
      const parts = [];
      let depth = 0, cur = '';
      for (const ch of text) {
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
        if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; }
        else cur += ch;
      }
      parts.push(cur.trim());
      return parts;
    }

    // Find the index of the first '=' that is NOT inside parentheses.
    // "x^2 + (y = 3)" — the inner '=' is skipped, only top-level ones count.
    function findTopLevelEquals(text) {
      let depth = 0;
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
        else if (ch === '=' && depth === 0) return i;
      }
      return -1;
    }

    // ── NUMERIC DERIVATIVE (central difference) ──────────────────────────
    // f'(x) ≈ ( f(x+h) − f(x−h) ) / 2h. The step h is scaled to |x| so the
    // formula stays accurate for huge and tiny arguments alike. Any
    // non-finite sample (division by zero, log of a negative...) yields NaN,
    // which the plotter treats as a line break — exactly like an asymptote.
    //
    // HIGHER ORDERS (numericDerivative(expr, x, vals, order)) are computed by
    // RECURSIVELY composing central differences:
    //   f''(x) ≈ ( f'(x+h) − f'(x−h) ) / 2h
    // The outer step h grows with the order so round-off error stays small:
    // order 2 → h ~ 1e-4·|x|, order 3 → h ~ 1e-3·|x| (each recursion halves
    // the error term while the larger step keeps the difference big enough).
    function numericDerivative(expr, x, vals, order) {
      order = order || 1;
      if (order <= 1) {
        const h = 1e-6 * Math.max(1, Math.abs(x));
        const fp = evaluate(expr, { x: x + h, ...(vals || {}) });
        const fm = evaluate(expr, { x: x - h, ...(vals || {}) });
        if (!isFinite(fp) || !isFinite(fm)) return NaN;
        return (fp - fm) / (2 * h);
      }
      // Scale the step so each recursion stays numerically stable
      const h = Math.pow(1e-7, 1 / (order + 2)) * Math.max(1, Math.abs(x));
      const fp = numericDerivative(expr, x + h, vals, order - 1);
      const fm = numericDerivative(expr, x - h, vals, order - 1);
      if (!isFinite(fp) || !isFinite(fm)) return NaN;
      return (fp - fm) / (2 * h);
    }

    // ── NUMERIC INTEGRAL (Simpson's rule) ────────────────────────────────
    // ∫ₐᵇ f(x) dx ≈ (h/3)·[ f(a) + f(b) + 4·Σ(odd samples) + 2·Σ(even) ]
    // with N (even) sub-intervals — accurate to O(h⁴), plenty for the area
    // plot and its value label. Handles a > b (returns the negative) and
    // returns NaN if the curve is undefined anywhere inside (asymptote → the
    // area is not well defined, same convention as the line plotter).
    function numericIntegral(expr, a, b, vals) {
      if (!isFinite(a) || !isFinite(b)) return NaN;
      if (a === b) return 0;
      const N = 2000;                                   // even, fixed & accurate
      const h = (b - a) / N;
      let sum = evaluate(expr, { x: a, ...(vals || {}) })
              + evaluate(expr, { x: b, ...(vals || {}) });
      if (!isFinite(sum)) return NaN;
      for (let i = 1; i < N; i++) {
        const y = evaluate(expr, { x: a + i * h, ...(vals || {}) });
        if (!isFinite(y)) return NaN;                   // asymptote inside the range
        sum += (i % 2 === 0 ? 2 : 4) * y;
      }
      return (h / 3) * sum;
    }

    // Resolve an integral bound: a literal number, a single-letter slider
    // variable, or a small expression like "pi" or "2pi".
    function resolveBound(expr, vals) {
      if (/^-?\d*\.?\d+$/.test(expr)) return parseFloat(expr);
      if (/^[a-zA-Z]$/.test(expr)) return (vals && expr in vals) ? vals[expr] : NaN;
      return evaluate(expr, vals || {});
    }

    // Turn "#rrggbb" into "rgba(r,g,b,a)" so area fills can be translucent
    function hexWithAlpha(hex, alpha) {
      if (!/^#([0-9a-f]{6})$/i.test(hex)) return hex;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    }

    // Which single-letter variable names appear in an expression string?
    // Constants like e/π/τ/ans tokenize as numbers, so only true variables show up.
    function getVariableNames(exprStr) {
      const names = new Set();
      for (const tok of tokenize(exprStr)) {
        if (tok.type === 'variable' && /^[a-zA-Zαπτθ]$/.test(tok.value)) names.add(tok.value);
      }
      return [...names].sort();
    }

    // Make sure every non-axis variable in a row has a slider entry.
    // Existing slider values are kept when the user edits the expression.
    function syncSliders(expr) {
      const parsed = parseGraphExpression(expr.text);
      // The "axis" variable(s) are the ones being plotted: x for cartesian,
      // t for parametric, θ for polar, and BOTH x & y for implicit equations.
      const axis = parsed.kind === 'parametric' ? 't'
        : parsed.kind === 'polar' ? 'θ'
        : parsed.kind === 'implicit' ? 'xy'
        : (parsed.kind === 'inequality' && parsed.subtype === 'implicit') ? 'xy' : 'x';
      const src = parsed.kind === 'parametric'
        ? parsed.xExpr + ',' + parsed.yExpr
        : parsed.kind === 'polar' ? parsed.rExpr
        : parsed.kind === 'implicit' ? parsed.lhsExpr + ',' + parsed.rhsExpr
        // Tangent rows include the point letter, so "tangent(x^2, a)" gives
        // the "a" slider that slides the touch point along the curve.
        : parsed.kind === 'tangent' ? parsed.yExpr + ',' + parsed.point
        // Integral rows include the bound letters, so "integral(x^2, 0, a)"
        // gets an "a" slider that moves the upper bound of the area.
        : parsed.kind === 'integral' ? parsed.yExpr + ',' + parsed.aExpr + ',' + parsed.bExpr
        : parsed.kind === 'inequality'
          ? (parsed.subtype === 'implicit' ? parsed.lhsExpr + ',' + parsed.rhsExpr
            : parsed.subtype === 'x' ? parsed.xVal
            : parsed.yExpr)
        : parsed.yExpr;
      const vars = getVariableNames(src).filter(v => !axis.includes(v));
      expr.sliders = expr.sliders || {};
      // Prune sliders whose variable is no longer in the expression
      for (const k of Object.keys(expr.sliders)) {
        if (!vars.includes(k)) delete expr.sliders[k];
      }
      for (const v of vars) {
        if (!expr.sliders[v]) expr.sliders[v] = { min: -10, max: 10, step: 0.1, value: 1 };
      }
    }

    // Is a row effectively empty (nothing worth graphing)? Used to decide when
    // to auto-remove a row on blur — without forgetting polar (r = ...) rows,
    // which have no yExpr property.
    function isEmptyExpression(text) {
      const p = parseGraphExpression(text);
      const body = p.kind === 'parametric' ? p.xExpr + p.yExpr
        : p.kind === 'polar' ? p.rExpr
        : p.kind === 'implicit' ? p.lhsExpr + p.rhsExpr
        : p.kind === 'tangent' ? p.yExpr + p.point
        : p.kind === 'integral' ? p.yExpr + p.aExpr + p.bExpr
        : p.kind === 'inequality'
          ? (p.subtype === 'implicit' ? p.lhsExpr + p.rhsExpr
            : p.subtype === 'x' ? p.xVal
            : p.yExpr)
        : p.yExpr;
      return !String(text).trim() || !body
        || (p.kind === 'parametric' && (!p.xExpr || !p.yExpr))
        || (p.kind === 'implicit' && (!p.lhsExpr || !p.rhsExpr))
        || (p.kind === 'tangent' && (!p.yExpr || !p.point))
        || (p.kind === 'integral' && (!p.yExpr || !p.aExpr || !p.bExpr))
        || (p.kind === 'inequality' && p.subtype === 'implicit' && (!p.lhsExpr || !p.rhsExpr))
        || (p.kind === 'inequality' && p.subtype === 'x' && !p.xVal)
        || (p.kind === 'inequality' && (p.subtype === 'y' || p.subtype === 'derivative') && !p.yExpr);
    }

    // Collect the current slider values as a plain { name: value } map
    function sliderValues(expr) {
      const out = {};
      for (const k in (expr.sliders || {})) out[k] = expr.sliders[k].value;
      return out;
    }

    function formatSlider(v) {
      return (+v.toFixed(4)).toString();
    }

    // Validate an expression and return an error message ('' = OK)
    function validateExpression(text) {
      const parsed = parseGraphExpression(text);
      const t = parsed.kind === 'parametric'
        ? parsed.xExpr + ',' + parsed.yExpr
        : parsed.kind === 'polar' ? parsed.rExpr
        : parsed.kind === 'implicit' ? parsed.lhsExpr + ',' + parsed.rhsExpr
        : parsed.kind === 'tangent' ? parsed.yExpr + ',' + parsed.point
        : parsed.kind === 'integral' ? parsed.yExpr + ',' + parsed.aExpr + ',' + parsed.bExpr
        : parsed.kind === 'inequality'
          ? (parsed.subtype === 'implicit' ? parsed.lhsExpr + ',' + parsed.rhsExpr
            : parsed.subtype === 'x' ? parsed.xVal
            : parsed.yExpr)
        : parsed.yExpr;
      if (!t) return '';
      // The tangent point must be a number (tangent(x^2, 2)) or a single
      // letter slider (tangent(x^2, a)) — anything else is a typo.
      if (parsed.kind === 'tangent' && !/^-?\d*\.?\d+$/.test(parsed.point) && !/^[a-zA-Z]$/.test(parsed.point)) {
        return 'Tangent point must be a number or letter';
      }
      // Balanced parentheses (checked on the whole raw text)
      let depth = 0;
      for (const ch of String(text)) {
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
        if (depth < 0) return 'Unbalanced ")"';
      }
      if (depth !== 0) return 'Missing ")"';
      // Unknown multi-letter names are errors; single letters are sliders/params.
      const tokens = tokenize(t);
      for (const tok of tokens) {
        if (tok.type === 'variable' && tok.value.length > 1) {
          return `Unknown "${tok.value}"`;
        }
        if (tok.type === 'operator' && !'+-*/^'.includes(tok.value)) {
          return `Invalid "${tok.value}"`;
        }
      }
      return '';
    }

    // The main graph renderer: draws the whole scene (grid + axes + curves).
    // `ctx` may be the live canvas context (devicePixelRatio-scaled) or an
    // offscreen context for PNG export (scale = export resolution multiplier).
    function drawScene(ctx, width, height) {
      const { xMin, xMax, yMin, yMax } = graphState;

      // Clear canvas
      ctx.fillStyle = cssVar('--canvas-bg', '#0d0e12');
      ctx.fillRect(0, 0, width, height);

      // Calculate grid step sizes
      const xStep = niceScale(xMax - xMin, 8);
      const yStep = niceScale(yMax - yMin, 6);

      // ── Minor gridlines (1/5 of a major step) for a ruler look ──
      const xMinor = xStep / 5, yMinor = yStep / 5;
      ctx.strokeStyle = cssVar('--canvas-grid', 'rgba(255,255,255,0.06)');
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.45;
      for (let x = Math.ceil(xMin / xMinor) * xMinor; x <= xMax; x += xMinor) {
        const sx = mathToScreen(x, 0, width, height).x;
        ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, height); ctx.stroke();
      }
      for (let y = Math.ceil(yMin / yMinor) * yMinor; y <= yMax; y += yMinor) {
        const sy = mathToScreen(0, y, width, height).y;
        ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(width, sy); ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // ── Major gridlines ──
      for (let x = Math.ceil(xMin / xStep) * xStep; x <= xMax; x += xStep) {
        const sx = mathToScreen(x, 0, width, height).x;
        ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, height); ctx.stroke();
      }
      for (let y = Math.ceil(yMin / yStep) * yStep; y <= yMax; y += yStep) {
        const sy = mathToScreen(0, y, width, height).y;
        ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(width, sy); ctx.stroke();
      }

      // ── Axes (drawn on top of the grid) ──
      ctx.strokeStyle = cssVar('--canvas-axis', 'rgba(255,255,255,0.2)');
      ctx.lineWidth = 1.5;
      const origin = mathToScreen(0, 0, width, height);
      ctx.beginPath(); ctx.moveTo(0, origin.y); ctx.lineTo(width, origin.y); ctx.stroke();  // X-axis
      ctx.beginPath(); ctx.moveTo(origin.x, 0); ctx.lineTo(origin.x, height); ctx.stroke();  // Y-axis

      // ── Axis labels ──
      ctx.fillStyle = cssVar('--text-dim', '#3d4050');
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      for (let x = Math.ceil(xMin / xStep) * xStep; x <= xMax; x += xStep) {
        if (Math.abs(x) < xStep * 0.01) continue;
        const sx = mathToScreen(x, 0, width, height).x;
        ctx.fillText(x.toFixed(xStep < 1 ? 1 : 0), sx, origin.y + 14);
      }
      ctx.textAlign = 'right';
      for (let y = Math.ceil(yMin / yStep) * yStep; y <= yMax; y += yStep) {
        if (Math.abs(y) < yStep * 0.01) continue;
        const sy = mathToScreen(0, y, width, height).y;
        ctx.fillText(y.toFixed(yStep < 1 ? 1 : 0), origin.x - 4, sy + 3);
      }

      // ── Plot each expression ──
      const samples = Math.max(2, Math.round(width * 2));  // 2 samples per pixel
      for (const expr of graphState.expressions) {
        if (!expr.visible) continue;
        if (isEmptyExpression(expr.text)) continue;          // blank scaffold rows (r =, x = , y =)
        if (validateExpression(expr.text)) continue;        // skip invalid
        const parsed = parseGraphExpression(expr.text);
        const vals = sliderValues(expr);
        ctx.strokeStyle = expr.color || '#58a6ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        let first = true;
        let prevSX = null, prevSY = null;

        // Plot a single math-space point (breaking the line on asymptotes).
        const plot = (mx, my) => {
          if (isFinite(mx) && isFinite(my) && Math.abs(mx) < 1e12 && Math.abs(my) < 1e12) {
            const { x: sx, y: sy } = mathToScreen(mx, my, width, height);
            // Huge screen-space jump = vertical asymptote → start a new segment
            if (prevSX !== null && (Math.abs(sx - prevSX) > width * 2 || Math.abs(sy - prevSY) > height * 2)) {
              first = true;
            }
            if (first) { ctx.moveTo(sx, sy); first = false; }
            else ctx.lineTo(sx, sy);
            prevSX = sx; prevSY = sy;
          } else {
            prevSX = null; prevSY = null; first = true;   // break line at discontinuities
          }
        };

        let tangentDots = [];   // touch points of tangent lines (drawn on top)
        if (parsed.kind === 'parametric') {
          const tMin = graphState.tMin, tMax = graphState.tMax;
          for (let i = 0; i <= samples; i++) {
            const tv = tMin + (i / samples) * (tMax - tMin);
            plot(evaluate(parsed.xExpr, { t: tv, ...vals }),
                 evaluate(parsed.yExpr, { t: tv, ...vals }));
          }
        } else if (parsed.kind === 'polar') {
          const thMin = graphState.thMin, thMax = graphState.thMax;
          for (let i = 0; i <= samples; i++) {
            const tv = thMin + (i / samples) * (thMax - thMin);
            const r = evaluate(parsed.rExpr, { θ: tv, ...vals });
            plot(r * Math.cos(tv), r * Math.sin(tv));
          }
        } else if (parsed.kind === 'implicit') {
          drawImplicitContour(ctx, parsed, vals, width, height);
        } else if (parsed.kind === 'derivative') {
          // y = dⁿ/dxⁿ f(x) — numeric central difference at every sample
          // (order 1 = y', order 2 = y'', order 3 = y'''...)
          for (let i = 0; i <= samples; i++) {
            const px = (i / samples) * (xMax - xMin) + xMin;
            plot(px, numericDerivative(parsed.yExpr, px, vals, parsed.order));
          }
        } else if (parsed.kind === 'integral') {
          // ∫ₐᵇ f(x) dx — area under the curve, shaded, with the value labeled.
          // The bounds can be numbers, small expressions ("pi") or slider
          // letters ("integral(x^2, 0, a)" → drag a to watch the area grow).
          const a = resolveBound(parsed.aExpr, vals);
          const b = resolveBound(parsed.bExpr, vals);
          if (isFinite(a) && isFinite(b) && a !== b) {
            const lo = Math.min(a, b), hi = Math.max(a, b);
            const n = Math.max(2, Math.round(width * 1.5));
            const pts = [];                 // curve samples over [lo, hi]
            let maxY = -Infinity;
            for (let i = 0; i <= n; i++) {
              const px = lo + (i / n) * (hi - lo);
              const py = evaluate(parsed.yExpr, { x: px, ...vals });
              if (!isFinite(py)) { pts.length = 0; break; }  // asymptote → no fill
              pts.push({ x: px, y: py });
              if (py > maxY) maxY = py;
            }
            if (pts.length === n + 1) {
              const axisY = mathToScreen(0, 0, width, height).y;
              // Shaded polygon: curve → down to the x-axis → back
              const s0 = mathToScreen(pts[0].x, pts[0].y, width, height);
              ctx.beginPath();
              ctx.moveTo(s0.x, s0.y);
              for (let i = 1; i < pts.length; i++) {
                const s = mathToScreen(pts[i].x, pts[i].y, width, height);
                ctx.lineTo(s.x, s.y);
              }
              ctx.lineTo(mathToScreen(hi, 0, width, height).x, axisY);
              ctx.lineTo(mathToScreen(lo, 0, width, height).x, axisY);
              ctx.closePath();
              ctx.fillStyle = hexWithAlpha(expr.color || '#58a6ff', 0.22);
              ctx.fill();
              // Outline the curve itself so the boundary is crisp
              ctx.beginPath();
              ctx.strokeStyle = expr.color || '#58a6ff';
              ctx.lineWidth = 2;
              ctx.moveTo(s0.x, s0.y);
              for (let i = 1; i < pts.length; i++) {
                const s = mathToScreen(pts[i].x, pts[i].y, width, height);
                ctx.lineTo(s.x, s.y);
              }
              ctx.stroke();
              // Value label above the shaded area
              const value = numericIntegral(parsed.yExpr, a, b, vals);
              if (isFinite(value)) {
                const topS = mathToScreen((lo + hi) / 2, Math.max(maxY, 0), width, height);
                const txt = '∫ ≈ ' + (Math.abs(value) >= 10000 || (value !== 0 && Math.abs(value) < 0.0001)
                  ? value.toExponential(3) : (+value.toFixed(4)).toString());
                const pad = 6, fh = 14;
                ctx.font = '12px Consolas, monospace';
                const tw = ctx.measureText(txt).width + pad * 2;
                const chipH = fh + 8;
                let cx = topS.x - tw / 2, cy = topS.y - chipH - 6;
                cx = Math.max(4, Math.min(width - tw - 4, cx));
                if (cy < 0) cy = topS.y + 10;
                ctx.beginPath();
                ctx.roundRect ? ctx.roundRect(cx, cy, tw, chipH, 4) : ctx.rect(cx, cy, tw, chipH);
                ctx.fillStyle = 'rgba(10,11,15,0.92)';
                ctx.fill();
                ctx.strokeStyle = expr.color || '#58a6ff';
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.textAlign = 'left';   // axis labels left it 'right' — reset
                ctx.fillStyle = expr.color || '#58a6ff';
                ctx.fillText(txt, cx + pad, cy + fh);
              }
            }
          }
        } else if (parsed.kind === 'tangent') {
          // y = f(a) + f'(a)·(x − a) — the line touching f at x = a.
          // `a` may be a literal number or a slider letter.
          // Drawn with DIRECT moveTo/lineTo (not the plot() helper): plot()
          // breaks segments with screen jumps > 2× the viewport to render
          // asymptotes, which would erase any tangent with |slope| > 2 — the
          // canvas clips offscreen geometry on its own, so a straight line is
          // always safe to draw end-to-end.
          const a = /^[a-zA-Z]$/.test(parsed.point) ? (vals[parsed.point] ?? NaN) : parseFloat(parsed.point);
          const fa = evaluate(parsed.yExpr, { x: a, ...vals });
          const ma = numericDerivative(parsed.yExpr, a, vals);
          if (isFinite(a) && isFinite(fa) && isFinite(ma)) {
            const p1 = mathToScreen(xMin, fa + ma * (xMin - a), width, height);
            const p2 = mathToScreen(xMax, fa + ma * (xMax - a), width, height);
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            tangentDots.push({ x: a, y: fa, color: expr.color });
          }
        } else if (parsed.kind === 'inequality') {
          if (parsed.subtype === 'x') {
            const cVal = resolveBound(parsed.xVal, vals);
            if (isFinite(cVal)) {
              const sx = mathToScreen(cVal, 0, width, height).x;
              ctx.fillStyle = hexWithAlpha(expr.color || '#58a6ff', 0.18);
              if (parsed.op === '<=' || parsed.op === '<') {
                const wFill = Math.max(0, Math.min(width, sx));
                ctx.fillRect(0, 0, wFill, height);
              } else {
                const startX = Math.max(0, Math.min(width, sx));
                ctx.fillRect(startX, 0, width - startX, height);
              }
              ctx.beginPath();
              ctx.strokeStyle = expr.color || '#58a6ff';
              ctx.lineWidth = 2;
              if (parsed.strict) ctx.setLineDash([8, 6]);
              else ctx.setLineDash([]);
              ctx.moveTo(sx, 0);
              ctx.lineTo(sx, height);
              ctx.stroke();
              ctx.setLineDash([]);
            }
          } else if (parsed.subtype === 'implicit') {
            drawImplicitInequalityShading(ctx, parsed, vals, width, height, expr.color);
            ctx.beginPath();
            ctx.strokeStyle = expr.color || '#58a6ff';
            ctx.lineWidth = 2;
            if (parsed.strict) ctx.setLineDash([8, 6]);
            else ctx.setLineDash([]);
            drawImplicitContour(ctx, { lhsExpr: parsed.lhsExpr, rhsExpr: parsed.rhsExpr }, vals, width, height);
            ctx.stroke();
            ctx.setLineDash([]);
          } else {
            drawCartesianInequalityShading(ctx, parsed, vals, width, height, expr.color);
            ctx.beginPath();
            ctx.strokeStyle = expr.color || '#58a6ff';
            ctx.lineWidth = 2;
            if (parsed.strict) ctx.setLineDash([8, 6]);
            else ctx.setLineDash([]);
            for (let i = 0; i <= samples; i++) {
              const px = (i / samples) * (xMax - xMin) + xMin;
              const py = parsed.subtype === 'derivative'
                ? numericDerivative(parsed.yExpr, px, vals, parsed.order)
                : evaluate(parsed.yExpr, { x: px, ...vals });
              plot(px, py);
            }
            ctx.stroke();
            ctx.setLineDash([]);
          }
        } else {
          for (let i = 0; i <= samples; i++) {
            const px = (i / samples) * (xMax - xMin) + xMin;
            plot(px, evaluate(parsed.yExpr, { x: px, ...vals }));
          }
        }
        ctx.stroke();
        // Tangent touch-point dots (drawn after the line so they sit on top)
        for (const d of tangentDots) {
          const s = mathToScreen(d.x, d.y, width, height);
          ctx.beginPath();
          ctx.arc(s.x, s.y, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = d.color;
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = cssVar('--canvas-bg', '#0d0e12');
          ctx.stroke();
        }
      }

      // ── CURVE TRACING overlay ──
      // In trace mode (traceOn), hovering the canvas snaps to the nearest
      // visible cartesian curve: a marker dot sits ON the curve, the tangent
      // line at that point is drawn, and a small readout shows
      // (x, f(x), f'(x)). This is the "walk along the curve" experience —
      // the marker never leaves the curve, no matter where the mouse is.
      if (graphState.traceOn && graphState.hoverX !== null) {
        const hx = graphState.hoverX;
        // Find the first visible cartesian expression to trace
        let traceRow = null;
        for (const e of graphState.expressions) {
          if (!e.visible) continue;
          const p = parseGraphExpression(e.text);
          if (p && (p.kind === 'cartesian' || p.kind === 'derivative' || (p.kind === 'inequality' && (p.subtype === 'y' || p.subtype === 'derivative')))) {
            traceRow = { e, p }; break;
          }
        }
        if (traceRow) {
          const { e, p } = traceRow;
          const vals = sliderValues(e);
          const isDeriv = p.kind === 'derivative' || (p.kind === 'inequality' && p.subtype === 'derivative');
          const fy = isDeriv
            ? numericDerivative(p.yExpr, hx, vals, p.order)
            : evaluate(p.yExpr, { x: hx, ...vals });
          if (isFinite(fy)) {
            const s = mathToScreen(hx, fy, width, height);
            // Tangent line at the trace point (for cartesian, derivative, and inequality rows)
            const m = isDeriv
              ? numericDerivative(p.yExpr, hx, vals, (p.order || 1) + 1)
              : numericDerivative(p.yExpr, hx, vals);
            if (isFinite(m)) {
              const p1 = mathToScreen(xMin, fy + m * (xMin - hx), width, height);
              const p2 = mathToScreen(xMax, fy + m * (xMax - hx), width, height);
              ctx.beginPath();
              ctx.strokeStyle = e.color;
              ctx.lineWidth = 1;
              ctx.setLineDash([6, 5]);
              ctx.globalAlpha = 0.75;
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.stroke();
              ctx.setLineDash([]);
              ctx.globalAlpha = 1;
            }
            // Marker dot ON the curve
            ctx.beginPath();
            ctx.arc(s.x, s.y, 5.5, 0, Math.PI * 2);
            ctx.fillStyle = e.color;
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = cssVar('--canvas-bg', '#0d0e12');
            ctx.stroke();
            // Readout chip (x, f(x), f'(x)) pinned near the marker
            const m2 = m;
            const txt = `(${hx.toFixed(2)}, ${fy.toFixed(2)})${isFinite(m2) ? '  m=' + m2.toFixed(2) : ''}`;
            const pad = 6, fh = 14;
            ctx.font = '12px Consolas, monospace';
            const tw = ctx.measureText(txt).width + pad * 2;
            let cx = s.x + 12, cy = s.y - 16;
            if (cx + tw > width) cx = s.x - tw - 12;
            if (cy < 0) cy = s.y + 18;
            ctx.beginPath();
            ctx.roundRect ? ctx.roundRect(cx, cy, tw, fh + 8, 4) : ctx.rect(cx, cy, tw, fh + 8);
            ctx.fillStyle = 'rgba(10,11,15,0.92)';
            ctx.fill();
            ctx.strokeStyle = e.color;
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.textAlign = 'left';   // axis labels left it 'right' — reset
            ctx.fillStyle = e.color;
            ctx.fillText(txt, cx + pad, cy + fh);
          }
        }
      }

      // Draw the scale label (x-axis step size, bottom-right)
      const stepLabel = document.getElementById('stepScaleLabel');
      if (stepLabel) stepLabel.textContent = xStep.toFixed(xStep < 1 ? 2 : 1);
    }

    // ── IMPLICIT CURVES (adaptive marching squares) ─────────────────────
    // An implicit equation like "x^2 + y^2 = 25" relates x and y, so there is
    // no "y = f(x)" to sample. Instead we find the zero-set of
    //   f(x,y) = evaluate(lhs) − evaluate(rhs)
    // with MARCHING SQUARES: sample f on a grid over the viewport, then in every
    // grid cell check whether the function changes sign across an edge. Where it
    // does, linear-interpolate the crossing point and connect the crossings with
    // line segments — this traces the full curve (circles, hyperbolas, "x = 3"
    // vertical lines...) through the grid.
    //
    // SHARPENING: a plain fixed grid makes tight curves (e.g. x^2 − y^2 = 0 near
    // the origin, or small circles when zoomed in) look like a polygon. So cells
    // that actually contain the contour are RECURSIVELY SUBDIVIDED up to a few
    // extra levels — the crossing points are interpolated on the fine sub-grid,
    // producing a much smoother curve with very little extra cost (only cells
    // near the curve are refined, not the whole viewport).

    // Pure helper (also reused by the test suite): compile lhs/rhs to RPN once,
    // then evaluate f(x, y, sliderVals) = lhs − rhs at any point. Returning NaN
    // on any error keeps the contour finder safe from malformed input.
    function makeImplicitFn(lhsExpr, rhsExpr) {
      const rpnL = toRPN(tokenize(lhsExpr));
      const rpnR = toRPN(tokenize(rhsExpr));
      return (x, y, vals) => {
        try {
          return evaluateRPN(rpnL, { x, y, ...(vals || {}) }) - evaluateRPN(rpnR, { x, y, ...(vals || {}) });
        } catch (e) { return NaN; }
      };
    }

    function drawImplicitContour(ctx, parsed, vals, width, height) {
      const { xMin, xMax, yMin, yMax } = graphState;
      const f = makeImplicitFn(parsed.lhsExpr, parsed.rhsExpr);
      const MAX_DEPTH = 2;                          // subdivide up to 2 extra levels
      const cols = Math.max(20, Math.round(width / 8));   // ~8 px base cells
      const rows = Math.max(16, Math.round(height / 8));

      // Sample f on the base grid once (each point is shared by 4 cells)
      const g = [];
      for (let r = 0; r <= rows; r++) {
        const y = yMin + (r / rows) * (yMax - yMin);
        const row = [];
        for (let c = 0; c <= cols; c++) {
          const x = xMin + (c / cols) * (xMax - xMin);
          row.push(f(x, y, vals));
        }
        g.push(row);
      }

      ctx.beginPath();

      // Crossing helper: if the sign flips across an edge, interpolate.
      // An exact 0 at either end also counts as a crossing (t = 0 or 1 puts
      // the point on the grid corner), so curves like x = 3 that land exactly
      // on a grid line still render.
      const cross = (a, b, ax, ay, bx, by) => {
        if (!isFinite(a) || !isFinite(b)) return null;
        if ((a < 0) === (b < 0) && a !== 0 && b !== 0) return null;  // same side
        const t = a === b ? 0.5 : a / (a - b);
        return mathToScreen(ax + t * (bx - ax), ay + t * (by - ay), width, height);
      };

      // Emit the segment(s) for one cell given its 4 corner values.
      const emitCell = (v00, v10, v01, v11, xs0, ys0, xs1, ys1) => {
        const segs = [
          cross(v00, v10, xs0, ys0, xs1, ys0),   // bottom edge
          cross(v10, v11, xs1, ys0, xs1, ys1),   // right edge
          cross(v11, v01, xs1, ys1, xs0, ys1),   // top edge
          cross(v01, v00, xs0, ys1, xs0, ys0),   // left edge
        ].filter(Boolean);
        // 2 crossings → one segment. 4 crossings → saddle; connect opposing
        // pairs for the classic "X" resolution (both diagonal pairs).
        if (segs.length === 2) {
          ctx.moveTo(segs[0].x, segs[0].y);
          ctx.lineTo(segs[1].x, segs[1].y);
        } else if (segs.length === 4) {
          ctx.moveTo(segs[0].x, segs[0].y); ctx.lineTo(segs[2].x, segs[2].y);
          ctx.moveTo(segs[1].x, segs[1].y); ctx.lineTo(segs[3].x, segs[3].y);
        }
      };

      // Does this cell (4 corner values) possibly contain part of the curve?
      // Same-sign corners with no exact zeros can't cross the contour.
      const maybeContains = (a, b, c, d) =>
        (a === 0 || b === 0 || c === 0 || d === 0)
        || (a < 0) !== (b < 0) || (a < 0) !== (c < 0) || (a < 0) !== (d < 0);

      // Recursively refine a cell: if it holds the contour and we can still
      // subdivide, split into 4 quadrants and recurse; otherwise draw it.
      const refine = (depth, v00, v10, v01, v11, xs0, ys0, xs1, ys1) => {
        if (!maybeContains(v00, v10, v01, v11)) return;   // empty cell — skip
        const pixelW = ((xs1 - xs0) / (xMax - xMin)) * width;
        const pixelH = ((ys1 - ys0) / (yMax - yMin)) * height;
        if (depth >= MAX_DEPTH || pixelW <= 2 || pixelH <= 2) {
          emitCell(v00, v10, v01, v11, xs0, ys0, xs1, ys1);
          return;
        }
        const xm = (xs0 + xs1) / 2, ym = (ys0 + ys1) / 2;
        const vm = f(xm, ym, vals);
        const vbt = f(xm, ys0, vals), vtp = f(xm, ys1, vals);   // midpoints of bottom/top edges
        const vlt = f(xs0, ym, vals), vrt = f(xs1, ym, vals);   // midpoints of left/right edges
        // 4 sub-cells: bottom-left, bottom-right, top-left, top-right
        refine(depth + 1, v00, vbt, vlt, vm, xs0, ys0, xm, ym);
        refine(depth + 1, vbt, v10, vm, vrt, xm, ys0, xs1, ym);
        refine(depth + 1, vlt, vm, v01, vtp, xs0, ym, xm, ys1);
        refine(depth + 1, vm, vrt, vtp, v11, xm, ym, xs1, ys1);
      };

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const xs0 = xMin + (c / cols) * (xMax - xMin), xs1 = xMin + ((c + 1) / cols) * (xMax - xMin);
          const ys0 = yMin + (r / rows) * (yMax - yMin), ys1 = yMin + ((r + 1) / rows) * (yMax - yMin);
          refine(0, g[r][c], g[r][c + 1], g[r + 1][c], g[r + 1][c + 1], xs0, ys0, xs1, ys1);
        }
      }
    }

    // Shading helper for cartesian & derivative inequalities (y <= f(x), y > f(x), etc.)
    function drawCartesianInequalityShading(ctx, parsed, vals, width, height, color) {
      const { xMin, xMax } = graphState;
      const n = Math.max(2, Math.round(width * 1.5));
      const op = parsed.op;
      const isBelow = (op === '<=' || op === '<');
      const targetScreenY = isBelow ? height : 0;
      const fillStyle = hexWithAlpha(color || '#58a6ff', 0.18);

      let currentSegment = [];
      const flushSegment = (seg) => {
        if (seg.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(seg[0].sx, seg[0].sy);
        for (let j = 1; j < seg.length; j++) {
          ctx.lineTo(seg[j].sx, seg[j].sy);
        }
        ctx.lineTo(seg[seg.length - 1].sx, targetScreenY);
        ctx.lineTo(seg[0].sx, targetScreenY);
        ctx.closePath();
        ctx.fillStyle = fillStyle;
        ctx.fill();
      };

      let prevSX = null, prevSY = null;
      for (let i = 0; i <= n; i++) {
        const px = xMin + (i / n) * (xMax - xMin);
        const py = parsed.subtype === 'derivative'
          ? numericDerivative(parsed.yExpr, px, vals, parsed.order)
          : evaluate(parsed.yExpr, { x: px, ...vals });

        if (isFinite(py) && Math.abs(py) < 1e10) {
          const { x: sx, y: sy } = mathToScreen(px, py, width, height);
          if (prevSY !== null && Math.abs(sy - prevSY) > height * 2.5) {
            flushSegment(currentSegment);
            currentSegment = [];
          }
          const clampedSY = Math.max(-height * 2, Math.min(height * 3, sy));
          currentSegment.push({ sx, sy: clampedSY });
          prevSX = sx;
          prevSY = sy;
        } else {
          flushSegment(currentSegment);
          currentSegment = [];
          prevSX = null;
          prevSY = null;
        }
      }
      flushSegment(currentSegment);
    }

    // Shading helper for 2D implicit inequalities (x^2 + y^2 <= 25, etc.)
    function drawImplicitInequalityShading(ctx, parsed, vals, width, height, color) {
      const f = makeImplicitFn(parsed.lhsExpr, parsed.rhsExpr);
      const cols = Math.max(20, Math.round(width / 10));
      const rows = Math.max(16, Math.round(height / 10));
      const cellW = width / cols;
      const cellH = height / rows;
      const op = parsed.op;
      const satisfies = (v) => (op === '<=' || op === '<') ? (v <= 0) : (v >= 0);

      ctx.fillStyle = hexWithAlpha(color || '#58a6ff', 0.16);
      for (let r = 0; r < rows; r++) {
        const ym = graphState.yMin + ((rows - 1 - r + 0.5) / rows) * (graphState.yMax - graphState.yMin);
        const sy = r * cellH;
        for (let c = 0; c < cols; c++) {
          const xm = graphState.xMin + ((c + 0.5) / cols) * (graphState.xMax - graphState.xMin);
          const v = f(xm, ym, vals);
          if (isFinite(v) && satisfies(v)) {
            ctx.fillRect(c * cellW, sy, cellW + 0.5, cellH + 0.5);
          }
        }
      }
    }

    // ── VIEWPORT HELPERS (aspect lock + persistence) ─────────────────────

    // When aspect lock is on, keep 1 math unit on the x-axis equal to 1 unit
    // on the y-axis (a square grid), so circles stay round. We adjust the
    // viewport around its center to match the canvas's physical aspect ratio.
    function applyAspectLock() {
      if (!graphState.aspectLock) return;
      const rect = graphCanvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const canvasRatio = rect.width / rect.height;
      const viewRatio = (graphState.xMax - graphState.xMin) / (graphState.yMax - graphState.yMin);
      if (Math.abs(viewRatio - canvasRatio) < 1e-9) return;   // already square
      const cx = (graphState.xMin + graphState.xMax) / 2;
      const cy = (graphState.yMin + graphState.yMax) / 2;
      if (viewRatio > canvasRatio) {
        // Viewport too wide: expand the y range to match.
        const newRy = (graphState.xMax - graphState.xMin) / canvasRatio / 2;
        graphState.yMin = cy - newRy; graphState.yMax = cy + newRy;
      } else {
        // Viewport too tall: expand the x range to match.
        const newRx = (graphState.yMax - graphState.yMin) * canvasRatio / 2;
        graphState.xMin = cx - newRx; graphState.xMax = cx + newRx;
      }
    }

    // Persist the whole graph session (expressions, viewport, ranges, lock)
    function saveGraphState() {
      try {
        const data = {
          expressions: graphState.expressions.map(e => ({
            text: e.text, visible: e.visible, color: e.color, sliders: e.sliders,
          })),
          xMin: graphState.xMin, xMax: graphState.xMax,
          yMin: graphState.yMin, yMax: graphState.yMax,
          tMin: graphState.tMin, tMax: graphState.tMax,
          thMin: graphState.thMin, thMax: graphState.thMax,
          aspectLock: graphState.aspectLock,
        };
        localStorage.setItem(GRAPH_STORAGE_KEY, JSON.stringify(data));
      } catch (e) { /* storage unavailable — ignore */ }
    }

    // Restore a previously saved session; returns true if something loaded.
    function loadGraphState() {
      try {
        const raw = localStorage.getItem(GRAPH_STORAGE_KEY);
        if (!raw) return false;
        const d = JSON.parse(raw);
        if (!d || !Array.isArray(d.expressions)) return false;
        graphState.expressions = d.expressions.map(e => ({
          text: String(e.text || ''),
          visible: e.visible !== false,
          color: e.color || GRAPH_COLORS[0],
          sliders: e.sliders || {},
        }));
        if (isFinite(d.xMin)) graphState.xMin = d.xMin;
        if (isFinite(d.xMax)) graphState.xMax = d.xMax;
        if (isFinite(d.yMin)) graphState.yMin = d.yMin;
        if (isFinite(d.yMax)) graphState.yMax = d.yMax;
        if (isFinite(d.tMin)) graphState.tMin = d.tMin;
        if (isFinite(d.tMax)) graphState.tMax = d.tMax;
        if (isFinite(d.thMin)) graphState.thMin = d.thMin;
        if (isFinite(d.thMax)) graphState.thMax = d.thMax;
        graphState.aspectLock = !!d.aspectLock;
        return true;
      } catch (e) { return false; }
    }

    // Debounced persistence: renderGraph is called on every pan/zoom/slider
    // move, so we don't write localStorage on every frame — only after the user
    // pauses ~400ms. Covers every mutation (they all end in renderGraph).
    let saveTimer = null;
    function queueSave() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(saveGraphState, 400);
    }

    // Render into the visible canvas (devicePixelRatio aware)
    function renderGraph() {
      const canvas = graphCanvas;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;  // hidden — skip
      applyAspectLock();                                  // keep grid square if locked
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;                    // High-DPI support
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);                 // reset any previous transform
      ctx.scale(dpr, dpr);
      drawScene(ctx, rect.width, rect.height);
      queueSave();
    }

    // Export the current graph as a PNG download (rendered at 2x resolution)
    function exportGraph() {
      const rect = graphCanvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const scale = 2;
      const out = document.createElement('canvas');
      out.width = Math.round(rect.width * scale);
      out.height = Math.round(rect.height * scale);
      const octx = out.getContext('2d');
      octx.scale(scale, scale);
      drawScene(octx, rect.width, rect.height);
      const a = document.createElement('a');
      a.download = 'freecalc-graph.png';
      a.href = out.toDataURL('image/png');
      document.body.appendChild(a);   // appending helps some browsers honor the download
      a.click();
      a.remove();
      playKeySound(false);
    }

    // Update the "y ≈ value" preview inside every expression row for hoverX
    function updateValuePreviews() {
      const rows = graphExprList.children;
      for (let i = 0; i < graphState.expressions.length; i++) {
        const expr = graphState.expressions[i];
        const valueEl = rows[i] && rows[i].querySelector('.expr-value');
        if (!valueEl) continue;
        // Only cartesian + derivative + inequality rows get a "y ≈" preview; parametric/
        // polar/tangent need t/θ/point lookups that don't map to a single x
        const parsed = parseGraphExpression(expr.text);
        const isCartesianLike = parsed.kind === 'cartesian' || parsed.kind === 'derivative' || (parsed.kind === 'inequality' && (parsed.subtype === 'y' || parsed.subtype === 'derivative'));
        if (!isCartesianLike || !expr.visible || graphState.hoverX === null) {
          valueEl.textContent = '';
          continue;
        }
        if (validateExpression(expr.text)) { valueEl.textContent = ''; continue; }
        const isDeriv = parsed.kind === 'derivative' || (parsed.kind === 'inequality' && parsed.subtype === 'derivative');
        const y = isDeriv
          ? numericDerivative(parsed.yExpr, graphState.hoverX, sliderValues(expr), parsed.order)
          : evaluate(parsed.yExpr, { x: graphState.hoverX, ...sliderValues(expr) });
        if (isFinite(y)) {
          // "y ≈ " / "y' ≈ " / "boundary ≈ " — the label matches curve type
          const label = isDeriv
            ? 'y' + "'".repeat(parsed.order || 1) + ' ≈ '
            : (parsed.kind === 'inequality' ? 'boundary ≈ ' : 'y ≈ ');
          valueEl.textContent = label + (Math.abs(y) >= 10000 || (y !== 0 && Math.abs(y) < 0.0001)
            ? y.toExponential(3) : (+y.toFixed(4)).toString());
        } else {
          valueEl.textContent = 'undefined';
        }
      }
    }

    // Render the legend overlay: which color belongs to which visible curve.
    // Kept in sync with the expression list (called after every list change).
    function renderLegend() {
      if (!graphLegend) return;
      graphLegend.innerHTML = '';
      for (let i = 0; i < graphState.expressions.length; i++) {
        const expr = graphState.expressions[i];
        if (!expr.visible || isEmptyExpression(expr.text)) continue;
        const item = document.createElement('div');
        item.className = 'legend-item';
        const dot = document.createElement('span');
        dot.className = 'legend-dot';
        dot.style.background = expr.color;
        const label = document.createElement('span');
        label.textContent = expr.text;
        item.appendChild(dot);
        item.appendChild(label);
        graphLegend.appendChild(item);
      }
    }

    // Add a new expression to the graph list
    function addGraphExpression(text, opts) {
      opts = opts || {};
      graphState.expressions.push({
        text: String(text || ''),
        visible: true,
        color: GRAPH_COLORS[graphState.expressions.length % GRAPH_COLORS.length],
        sliders: {},
      });
      const expr = graphState.expressions[graphState.expressions.length - 1];
      syncSliders(expr);
      renderGraphExprList();
      renderLegend();
      renderGraph();
      if (opts.focus !== false) focusRow(graphState.expressions.length - 1);
    }

    function removeGraphExpression(i) {
      if (i < 0 || i >= graphState.expressions.length) return;
      graphState.expressions.splice(i, 1);
      if (graphState.activeIndex >= graphState.expressions.length) {
        graphState.activeIndex = graphState.expressions.length - 1;
      }
      renderGraphExprList();
      renderLegend();
      renderGraph();
    }

    function toggleGraphExpression(i) {
      const expr = graphState.expressions[i];
      if (!expr) return;
      expr.visible = !expr.visible;
      const dot = graphExprList.children[i] && graphExprList.children[i].querySelector('.color-dot');
      if (dot) dot.classList.toggle('hidden', !expr.visible);
      updateValuePreviews();
      renderLegend();
      renderGraph();
    }

    function cycleGraphColor(i) {
      const expr = graphState.expressions[i];
      if (!expr) return;
      const idx = (GRAPH_COLORS.indexOf(expr.color) + 1) % GRAPH_COLORS.length;
      expr.color = GRAPH_COLORS[idx];
      const dot = graphExprList.children[i] && graphExprList.children[i].querySelector('.color-dot');
      if (dot) dot.style.background = expr.color;
      renderLegend();
      renderGraph();
    }

    // Put keyboard focus into expression row i and select its text
    function focusRow(i) {
      const row = graphExprList.children[i];
      if (!row) return;
      graphState.activeIndex = i;
      const input = row.querySelector('.expr-input');
      if (input) { input.focus(); input.select(); }
    }

    // Render the slider rows for one expression (used on every re-render too)
    function renderSliders(wrap, expr) {
      wrap.innerHTML = '';
      const vars = Object.keys(expr.sliders || {}).sort();
      for (const v of vars) {
        const s = expr.sliders[v];
        const row = document.createElement('div');
        row.className = 'expr-slider-row';
        row.dataset.var = v;                       // so integral animation can target it
        const name = document.createElement('span');
        name.className = 'slider-name';
        name.textContent = v + ' =';
        const range = document.createElement('input');
        range.type = 'range';
        range.min = s.min; range.max = s.max; range.step = s.step; range.value = s.value;
        range.title = 'Drag to change ' + v;
        const val = document.createElement('span');
        val.className = 'slider-val';
        val.textContent = formatSlider(s.value);
        range.addEventListener('input', () => {
          s.value = parseFloat(range.value);
          val.textContent = formatSlider(s.value);
          renderGraph();
          updateValuePreviews();
        });
        row.appendChild(name);
        row.appendChild(range);
        row.appendChild(val);
        wrap.appendChild(row);
      }
    }

    // ── INTEGRAL ANIMATION ──
    // Integral rows get a ▶ button that sweeps the bound slider letter
    // (a or b) from its current value up to its max over ~3s with easing,
    // re-rendering live so the shaded area visibly grows — a classic
    // slider-play animation. Clicking again (⏸) stops it.
    let integralAnim = null;
    // Reset every ▶/⏸ label in the list (used when switching rows or stopping)
    function resetAnimButtons() {
      graphExprList.querySelectorAll('.anim-btn').forEach(b => { b.textContent = '▶'; });
    }
    function toggleIntegralAnim(i, btn) {
      const expr = graphState.expressions[i];
      if (!expr) return;
      const parsed = parseGraphExpression(expr.text);
      const bound = parsed.kind === 'integral'
        ? (/^[a-zA-Z]$/.test(parsed.bExpr) ? parsed.bExpr
           : /^[a-zA-Z]$/.test(parsed.aExpr) ? parsed.aExpr : null)
        : null;
      const s = bound && expr.sliders[bound];
      if (!s) return;
      // Stop an in-flight animation (and reset every label — a different row
      // may have been animating with a stale ⏸ icon). If the same row was
      // animating, this click is a toggle-off; otherwise fall through and
      // start the NEW row's animation (▶ on another row moves the animation
      // there, graphing-calculator style).
      if (integralAnim) {
        const wasSameRow = integralAnim.i === i;
        cancelAnimationFrame(integralAnim.raf);
        integralAnim = null;
        resetAnimButtons();
        if (wasSameRow) return;
      }
      const from = s.value, to = s.max, t0 = performance.now();
      const dur = 3000;
      const step = (now) => {
        const t = Math.min(1, (now - t0) / dur);
        const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        s.value = from + (to - from) * eased;
        // Sync the slider DOM (range input + value label) for this bound
        const row = graphExprList.children[i];
        if (row) {
          const srow = row.querySelector('.expr-slider-row[data-var="' + bound + '"]');
          if (srow) {
            const range = srow.querySelector('input[type=range]');
            const val = srow.querySelector('.slider-val');
            if (range) range.value = s.value;
            if (val) val.textContent = formatSlider(s.value);
          }
        }
        renderGraph();
        updateValuePreviews();
        if (t < 1) integralAnim = { raf: requestAnimationFrame(step), i: i };
        else { integralAnim = null; resetAnimButtons(); }
      };
      integralAnim = { raf: requestAnimationFrame(step), i: i };
      resetAnimButtons();
      if (btn) btn.textContent = '⏸';
    }

    // Render the list of graph expressions — editable rows with sliders
    function renderGraphExprList() {
      graphExprList.innerHTML = '';
      for (let i = 0; i < graphState.expressions.length; i++) {
        const expr = graphState.expressions[i];
        const item = document.createElement('div');
        item.className = 'graph-expr-item';
        item.dataset.i = i;

        // Empty rows get a blinking "type here" guide so it's obvious where
        // to enter the equation. The class is re-evaluated on every keystroke
        // and on blur (an empty row = the place you should type next).
        // (input is always created before syncGuide is ever called — it's only
        // invoked after the row is fully built and on focus/blur/input events)
        const syncGuide = () => item.classList.toggle('guide', isEmptyExpression(input.value));

        // Color dot — click toggles visibility, right-click cycles color
        const dot = document.createElement('span');
        dot.className = 'color-dot' + (expr.visible ? '' : ' hidden');
        dot.style.background = expr.color;
        dot.title = 'Click: show/hide · Right-click: change color';
        dot.addEventListener('click', () => toggleGraphExpression(i));
        dot.addEventListener('contextmenu', (e) => { e.preventDefault(); cycleGraphColor(i); });

        // Editable expression input (live re-graph as you type!)
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'expr-input';
        input.value = expr.text || '';
        input.spellcheck = false;
        input.autocomplete = 'off';
        input.placeholder = 'type an equation — e.g. y = x^2';
        input.addEventListener('input', () => {
          expr.text = input.value;
          const err = validateExpression(input.value);
          item.classList.toggle('err', !!err);
          input.title = err || '';
          syncSliders(expr);
          renderSliders(slidersWrap, expr);
          renderGraph();
          updateValuePreviews();
          renderLegend();               // keep the overlay in sync while typing
          syncGuide();
        });
        input.addEventListener('focus', () => {
          graphState.activeIndex = i;
          item.classList.add('active');
          item.classList.remove('guide');   // you found it — stop blinking
        });
        input.addEventListener('blur', () => {
          item.classList.remove('active');
          // Remove rows left empty (works for cartesian AND polar rows)
          let removed = false;
          if (isEmptyExpression(expr.text) && graphState.expressions.length > 1) {
            removeGraphExpression(i);        // re-renders the list — item is now detached
            removed = true;
          }
          if (!removed) syncGuide();         // empty survivor row blinks again
        });
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (!isEmptyExpression(input.value)) {
              addGraphExpression('', { focus: true });
            } else {
              focusRow(Math.min(i + 1, graphState.expressions.length - 1));
            }
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (i > 0) focusRow(i - 1);
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (i < graphState.expressions.length - 1) focusRow(i + 1);
          } else if (e.key === 'Escape') {
            input.blur();
          }
        });

        // Live value preview ("y ≈ ...") — filled while hovering the canvas
        const value = document.createElement('span');
        value.className = 'expr-value';

        // Slider container — filled by renderSliders()
        const slidersWrap = document.createElement('div');
        slidersWrap.className = 'expr-sliders';

        // Delete button (shown when you hover the row)
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'del-btn';
        del.textContent = '✕';
        del.title = 'Remove expression';
        del.addEventListener('click', () => removeGraphExpression(i));

        item.appendChild(dot);
        item.appendChild(input);
        item.appendChild(value);
        item.appendChild(slidersWrap);
        syncGuide();
        // Integral rows with a letter bound get a ▶ button that animates the
        // shaded area (numeric-bound integrals have nothing to sweep)
        const iParsed = parseGraphExpression(expr.text);
        const iBound = iParsed.kind === 'integral'
          ? (/^[a-zA-Z]$/.test(iParsed.bExpr) ? iParsed.bExpr
             : /^[a-zA-Z]$/.test(iParsed.aExpr) ? iParsed.aExpr : null)
          : null;
        if (iBound && expr.sliders[iBound]) {
          const animBtn = document.createElement('button');
          animBtn.type = 'button';
          animBtn.className = 'anim-btn';
          animBtn.textContent = '▶';
          animBtn.title = 'Animate the integral bound';
          animBtn.addEventListener('click', () => toggleIntegralAnim(i, animBtn));
          item.appendChild(animBtn);
        }
        item.appendChild(del);
        graphExprList.appendChild(item);

        renderSliders(slidersWrap, expr);
      }
    }

    // ── SHAREABLE GRAPH STATE & TOAST ────────────────────────────────────
    function showGraphToast(msg) {
      if (!graphToast) return;
      graphToast.textContent = msg;
      graphToast.style.display = 'block';
      graphToast.style.opacity = '1';
      clearTimeout(showGraphToast._timer);
      showGraphToast._timer = setTimeout(() => {
        graphToast.style.opacity = '0';
        setTimeout(() => { graphToast.style.display = 'none'; }, 200);
      }, 2600);
    }

    function exportGraphStateToUrl() {
      const data = {
        v: 1,
        exprs: graphState.expressions.map(e => ({
          text: e.text,
          visible: e.visible !== false,
          color: e.color,
          sliders: e.sliders ? Object.fromEntries(Object.entries(e.sliders).map(([k, s]) => [k, s.value])) : {}
        })),
        bounds: [
          +graphState.xMin.toFixed(4),
          +graphState.xMax.toFixed(4),
          +graphState.yMin.toFixed(4),
          +graphState.yMax.toFixed(4)
        ]
      };
      const json = JSON.stringify(data);
      const encoded = encodeURIComponent(json);
      const base = window.location.href.split('#')[0];
      return { url: base + '#graph=' + encoded, hash: '#graph=' + encoded };
    }

    function importGraphStateFromUrl(hash) {
      if (!hash || !hash.includes('#graph=')) return false;
      try {
        const raw = hash.slice(hash.indexOf('#graph=') + 7);
        const json = decodeURIComponent(raw);
        const data = JSON.parse(json);
        if (!data || !Array.isArray(data.exprs)) return false;

        graphState.expressions = data.exprs.map(e => {
          const expr = {
            text: e.text || '',
            visible: e.visible !== false,
            color: e.color || '#58a6ff',
            sliders: {}
          };
          if (e.sliders && typeof e.sliders === 'object') {
            for (const [k, v] of Object.entries(e.sliders)) {
              expr.sliders[k] = { min: -10, max: 10, step: 0.1, value: Number(v) || 0 };
            }
          }
          return expr;
        });

        if (Array.isArray(data.bounds) && data.bounds.length === 4) {
          const [xmin, xmax, ymin, ymax] = data.bounds.map(Number);
          if (isFinite(xmin) && isFinite(xmax) && isFinite(ymin) && isFinite(ymax) && xmax > xmin && ymax > ymin) {
            graphState.xMin = xmin;
            graphState.xMax = xmax;
            graphState.yMin = ymin;
            graphState.yMax = ymax;
          }
        }

        renderGraphExprList();
        renderLegend();
        renderGraph();
        showGraphToast('Graph loaded from link');
        return true;
      } catch (err) {
        console.warn('Could not parse graph link:', err);
        return false;
      }
    }

    // ── TABLE OF VALUES MODAL ───────────────────────────────────────────
    function getTablePlottableFunctions() {
      const fns = [];
      for (let idx = 0; idx < graphState.expressions.length; idx++) {
        const expr = graphState.expressions[idx];
        if (!expr.visible || !expr.text.trim()) continue;
        if (validateExpression(expr.text)) continue;
        const p = parseGraphExpression(expr.text);
        const vals = sliderValues(expr);
        if (p.kind === 'cartesian') {
          fns.push({
            label: expr.text.startsWith('y=') || expr.text.startsWith('f(x)=') ? expr.text : `y = ${expr.text}`,
            color: expr.color || '#58a6ff',
            fn: (x) => evaluate(p.yExpr, { x, ...vals })
          });
        } else if (p.kind === 'derivative') {
          fns.push({
            label: expr.text,
            color: expr.color || '#58a6ff',
            fn: (x) => numericDerivative(p.yExpr, x, vals, p.order)
          });
        } else if (p.kind === 'inequality' && (p.subtype === 'y' || p.subtype === 'derivative')) {
          fns.push({
            label: expr.text,
            color: expr.color || '#58a6ff',
            fn: (x) => p.subtype === 'derivative'
              ? numericDerivative(p.yExpr, x, vals, p.order)
              : evaluate(p.yExpr, { x, ...vals })
          });
        }
      }
      return fns;
    }

    function renderTableContent() {
      if (!tableContent) return;
      const fns = getTablePlottableFunctions();
      if (fns.length === 0) {
        tableContent.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding: 24px 8px;">No visible functions to display.<br>Add an expression like <i>y = x²</i> to generate a table.</div>';
        return;
      }

      let xStart = parseFloat(tableXStart ? tableXStart.value : -5);
      let xEnd = parseFloat(tableXEnd ? tableXEnd.value : 5);
      let xStep = parseFloat(tableXStep ? tableXStep.value : 1);

      if (isNaN(xStart)) xStart = -5;
      if (isNaN(xEnd)) xEnd = 5;
      if (isNaN(xStep) || xStep <= 0) xStep = 1;
      if (xEnd < xStart) { const tmp = xStart; xStart = xEnd; xEnd = tmp; }

      const count = Math.min(1000, Math.floor((xEnd - xStart) / xStep) + 1);

      let html = '<table class="graph-table"><thead><tr><th>x</th>';
      for (const f of fns) {
        const safeLabel = String(f.label).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        html += `<th><span class="table-dot" style="background:${f.color}"></span>${safeLabel}</th>`;
      }
      html += '</tr></thead><tbody>';

      const formatVal = (v) => {
        if (!isFinite(v)) return '<span style="color:var(--text-muted)">undefined</span>';
        if (Math.abs(v) < 1e-12) return '0';
        if (Math.abs(v) >= 1e6 || Math.abs(v) <= 1e-4) return v.toExponential(4);
        return (+v.toFixed(6)).toString();
      };

      for (let i = 0; i < count; i++) {
        const x = xStart + i * xStep;
        const xFormatted = (+x.toFixed(6)).toString();
        html += `<tr><td>${xFormatted}</td>`;
        for (const f of fns) {
          const y = f.fn(x);
          html += `<td>${formatVal(y)}</td>`;
        }
        html += '</tr>';
      }
      html += '</tbody></table>';
      tableContent.innerHTML = html;
    }

    function openTableModal() {
      if (!graphTableModal) return;
      graphTableModal.style.display = 'flex';
      renderTableContent();
    }

    function closeTableModal() {
      if (graphTableModal) graphTableModal.style.display = 'none';
    }

    function exportTableCsv() {
      const fns = getTablePlottableFunctions();
      if (fns.length === 0) { showGraphToast('No functions to export'); return; }

      let xStart = parseFloat(tableXStart ? tableXStart.value : -5);
      let xEnd = parseFloat(tableXEnd ? tableXEnd.value : 5);
      let xStep = parseFloat(tableXStep ? tableXStep.value : 1);
      if (isNaN(xStart)) xStart = -5;
      if (isNaN(xEnd)) xEnd = 5;
      if (isNaN(xStep) || xStep <= 0) xStep = 1;
      if (xEnd < xStart) { const tmp = xStart; xStart = xEnd; xEnd = tmp; }
      const count = Math.min(2000, Math.floor((xEnd - xStart) / xStep) + 1);

      let csv = 'x,' + fns.map(f => '"' + f.label.replace(/"/g, '""') + '"').join(',') + '\n';
      for (let i = 0; i < count; i++) {
        const x = xStart + i * xStep;
        const row = [(+x.toFixed(6)).toString()];
        for (const f of fns) {
          const y = f.fn(x);
          row.push(isFinite(y) ? (+y.toFixed(6)).toString() : '');
        }
        csv += row.join(',') + '\n';
      }

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'graph_table.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showGraphToast('CSV exported!');
    }

    function copyTableToClipboard() {
      const fns = getTablePlottableFunctions();
      if (fns.length === 0) { showGraphToast('No functions to copy'); return; }

      let xStart = parseFloat(tableXStart ? tableXStart.value : -5);
      let xEnd = parseFloat(tableXEnd ? tableXEnd.value : 5);
      let xStep = parseFloat(tableXStep ? tableXStep.value : 1);
      if (isNaN(xStart)) xStart = -5;
      if (isNaN(xEnd)) xEnd = 5;
      if (isNaN(xStep) || xStep <= 0) xStep = 1;
      if (xEnd < xStart) { const tmp = xStart; xStart = xEnd; xEnd = tmp; }
      const count = Math.min(1000, Math.floor((xEnd - xStart) / xStep) + 1);

      let tsv = 'x\t' + fns.map(f => f.label).join('\t') + '\n';
      for (let i = 0; i < count; i++) {
        const x = xStart + i * xStep;
        const row = [(+x.toFixed(6)).toString()];
        for (const f of fns) {
          const y = f.fn(x);
          row.push(isFinite(y) ? (+y.toFixed(6)).toString() : 'undefined');
        }
        tsv += row.join('\t') + '\n';
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(tsv).then(() => {
          showGraphToast('Table copied to clipboard!');
        }).catch(() => {
          showGraphToast('Could not access clipboard');
        });
      }
    }

    // Initialize the graph canvas and event handlers
    function initGraph() {
      // Restore a previously saved session (expressions, viewport, ranges) so
      // the graph survives page reloads. First check for shareable URL hash.
      if (graphState.expressions.length === 0) {
        let restored = false;
        if (typeof location !== 'undefined' && location.hash && location.hash.startsWith('#graph=')) {
          restored = importGraphStateFromUrl(location.hash);
        }
        if (!restored) {
          restored = loadGraphState();
        }
        if (restored) {
          renderGraphExprList();
          renderLegend();
        } else {
          // Start with a curve that has a letter parameter (a), so the row
          // immediately shows a draggable KNOB — new users instantly see the
          // "slide the equation" affordance the app is built around.
          addGraphExpression('y = a sin(x)', { focus: false });
          // One-time attention pulse on the first row — a friendly "look here"
          // so new users instantly spot where the equation is edited.
          const firstRow = graphExprList.children[0];
          if (firstRow) firstRow.classList.add('attention');
        }
      }
      renderGraph();

      // Bind all graph event listeners only once — switching modes back
      // and forth would otherwise stack duplicate listeners
      if (graphState.initialized) return;
      graphState.initialized = true;

      // ── "+" button: add a new (empty) expression row and focus it ──
      graphAddBtn.addEventListener('click', () => addGraphExpression(''));

      // ── Export button: download the current graph as a PNG ──
      if (graphExport) graphExport.addEventListener('click', exportGraph);

      // ── Help (?) button: toggle the keyboard-shortcuts cheat sheet ──
      if (graphHelpBtn && graphHelp) {
        graphHelpBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          graphHelp.classList.toggle('open');
        });
        // Clicking anywhere else closes the cheat sheet
        document.addEventListener('click', () => graphHelp.classList.remove('open'));
      }

      // ── Table of Values modal controls ──
      if (graphTableBtn) graphTableBtn.addEventListener('click', openTableModal);
      if (tableModalClose) tableModalClose.addEventListener('click', closeTableModal);
      if (graphTableModal) {
        graphTableModal.addEventListener('click', (e) => {
          if (e.target === graphTableModal) closeTableModal();
        });
      }
      [tableXStart, tableXEnd, tableXStep].forEach(inp => {
        if (inp) {
          inp.addEventListener('input', renderTableContent);
          inp.addEventListener('change', renderTableContent);
        }
      });
      if (tableCopyBtn) tableCopyBtn.addEventListener('click', copyTableToClipboard);
      if (tableCsvBtn) tableCsvBtn.addEventListener('click', exportTableCsv);

      // ── Share button: copy shareable link ──
      if (graphShareBtn) {
        graphShareBtn.addEventListener('click', () => {
          const { url, hash } = exportGraphStateToUrl();
          try {
            if (window.history && window.history.replaceState) {
              window.history.replaceState(null, '', hash);
            } else {
              window.location.hash = hash;
            }
          } catch (_) {}

          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(() => {
              showGraphToast('Link copied to clipboard!');
            }).catch(() => {
              prompt('Copy this link to share your graph:', url);
            });
          } else {
            prompt('Copy this link to share your graph:', url);
          }
        });
      }

      // Close modal on Escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && graphTableModal && graphTableModal.style.display !== 'none') {
          closeTableModal();
        }
      });

      // Listen for hash change to update graph state if user navigates back/forward
      window.addEventListener('hashchange', () => {
        if (location.hash && location.hash.startsWith('#graph=')) {
          importGraphStateFromUrl(location.hash);
        }
      });

      // ── Viewport + sampling range controls ──
      // x/y rows set the visible viewport bounds; t/θ rows set the sampling
      // window for parametric and polar curves. All re-render live.
      const applyRange = () => {
        const xa = parseFloat(xMinInput.value), xb = parseFloat(xMaxInput.value);
        const ya = parseFloat(yMinInput.value), yb = parseFloat(yMaxInput.value);
        if (!isNaN(xa) && !isNaN(xb) && xb > xa) { graphState.xMin = xa; graphState.xMax = xb; }
        if (!isNaN(ya) && !isNaN(yb) && yb > ya) { graphState.yMin = ya; graphState.yMax = yb; }
        const tv = parseFloat(tMinInput.value), tw = parseFloat(tMaxInput.value);
        const av = parseFloat(thMinInput.value), aw = parseFloat(thMaxInput.value);
        if (!isNaN(tv) && !isNaN(tw) && tw > tv) { graphState.tMin = tv; graphState.tMax = tw; }
        if (!isNaN(av) && !isNaN(aw) && aw > av) { graphState.thMin = av; graphState.thMax = aw; }
        renderGraph();
        // Reflect the REAL viewport back into the boxes (aspect lock may have
        // expanded one dimension to keep the grid square), but never clobber
        // the box the user is currently typing in.
        syncRangeInputs(document.activeElement ? document.activeElement.id : null);
      };
      [xMinInput, xMaxInput, yMinInput, yMaxInput, tMinInput, tMaxInput, thMinInput, thMaxInput].forEach(inp => {
        inp.addEventListener('input', applyRange);
        inp.addEventListener('change', applyRange);
      });
      // Keep the range boxes in sync with the actual state values (so the
      // displayed θ max matches the true 2π instead of a rounded copy).
      // `skipId` — an input id to leave untouched (the one being edited).
      const syncRangeInputs = (skipId) => {
        const set = (id, v) => { if (id !== skipId) document.getElementById(id).value = v; };
        set('xMinInput', +graphState.xMin.toFixed(4));
        set('xMaxInput', +graphState.xMax.toFixed(4));
        set('yMinInput', +graphState.yMin.toFixed(4));
        set('yMaxInput', +graphState.yMax.toFixed(4));
        set('tMinInput', graphState.tMin);
        set('tMaxInput', graphState.tMax);
        set('thMinInput', graphState.thMin);
        set('thMaxInput', graphState.thMax.toFixed(4));
        syncViewSliders();
      };
      syncRangeInputs();

    // ── Aspect-lock button: keep the grid 1:1 (square) ──
    if (graphAspectBtn) {
      graphAspectBtn.classList.toggle('active', graphState.aspectLock);
      graphAspectBtn.addEventListener('click', () => {
        graphState.aspectLock = !graphState.aspectLock;
        graphAspectBtn.classList.toggle('active', graphState.aspectLock);
        viewAspectSlider.disabled = graphState.aspectLock;
        renderGraph();
        syncRangeInputs();
      });
    }

    // ── Trace button: curve tracing mode ──
    // When active, hovering the canvas marks the nearest curve and shows a
    // tangent line + (x, f(x), f'(x)) readout at that point. The ← → arrow
    // keys step the trace point along the curve (keyboard tracing).
    if (graphTraceBtn) {
      graphTraceBtn.classList.toggle('active', graphState.traceOn);
      graphTraceBtn.addEventListener('click', () => {
        graphState.traceOn = !graphState.traceOn;
        graphTraceBtn.classList.toggle('active', graphState.traceOn);
        graphCanvas.style.cursor = graphState.traceOn ? 'crosshair' : 'grab';
        if (!graphState.traceOn) graphState.hoverX = null;
        renderGraph();
      });
    }

    // ── Keyboard tracing: ← → step the trace point along the curve ──
    // Works while trace mode is on (and the user isn't typing in a row).
    // Each press moves hoverX by 1/60th of the visible x-range, re-rendering
    // the marker + tangent + readout so you can walk the curve with keys.
    document.addEventListener('keydown', (e) => {
      if (!graphState.traceOn) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;   // don't hijack typing
      e.preventDefault();
      if (graphState.hoverX === null) graphState.hoverX = 0;
      const step = (graphState.xMax - graphState.xMin) / 60;
      graphState.hoverX += (e.key === 'ArrowRight' ? step : -step);
      graphState.hoverX = Math.min(graphState.xMax, Math.max(graphState.xMin, graphState.hoverX));
      updateValuePreviews();
      renderGraph();
    });

    // ── View sliders: zoom (viewport span) + aspect ratio ──
    // Zoom slider re-scales the viewport around its center, preserving the
    // current aspect ratio; the aspect slider stretches x relative to y (it
    // is disabled while the square-grid lock is on, since the lock fixes the
    // ratio to the canvas shape). Declared as a function so syncRangeInputs
    // (defined above, and called immediately) can safely call it — function
    // declarations are hoisted, unlike const arrow functions.
    function syncViewSliders(skipZoom, skipAspect) {
      if (!viewZoomSlider || !viewAspectSlider) return;
      const xSpan = graphState.xMax - graphState.xMin;
      const ySpan = graphState.yMax - graphState.yMin;
      if (!skipZoom) {
        const v = Math.min(60, Math.max(0.5, xSpan));
        viewZoomSlider.value = +v.toFixed(2);
        viewZoomVal.textContent = v.toFixed(1);
      }
      if (!skipAspect) {
        const r = Math.min(4, Math.max(0.25, xSpan / ySpan));
        viewAspectSlider.value = +r.toFixed(2);
        viewAspectVal.textContent = r.toFixed(2);
      }
      viewAspectSlider.disabled = graphState.aspectLock;
    };
    if (viewZoomSlider && viewAspectSlider) {
      viewZoomSlider.addEventListener('input', () => {
        const target = parseFloat(viewZoomSlider.value);
        const cx = (graphState.xMin + graphState.xMax) / 2;
        const cy = (graphState.yMin + graphState.yMax) / 2;
        const ratio = (graphState.xMax - graphState.xMin) / (graphState.yMax - graphState.yMin);
        const newX = target, newY = target / ratio;
        graphState.xMin = cx - newX / 2; graphState.xMax = cx + newX / 2;
        graphState.yMin = cy - newY / 2; graphState.yMax = cy + newY / 2;
        renderGraph();
        syncRangeInputs();
        syncViewSliders(true, false);
      });
      viewAspectSlider.addEventListener('input', () => {
        if (graphState.aspectLock) return;   // locked → ratio is fixed
        const ratio = parseFloat(viewAspectSlider.value);
        const cx = (graphState.xMin + graphState.xMax) / 2;
        const cy = (graphState.yMin + graphState.yMax) / 2;
        const ySpan = graphState.yMax - graphState.yMin;   // y range is preserved
        const newX = ySpan * ratio;                        // only x stretches
        graphState.xMin = cx - newX / 2; graphState.xMax = cx + newX / 2;
        graphState.yMin = cy - ySpan / 2; graphState.yMax = cy + ySpan / 2;
        renderGraph();
        syncRangeInputs();
        syncViewSliders(false, true);
      });
    }
    syncViewSliders();

      // Keep the sidebar range boxes in step with pan/zoom (which also move
      // the viewport). Panning/mousemove fires constantly, so we sync on a
      // debounce rather than every frame.
      let syncTimer = null;
      const syncTimerFn = () => {
        clearTimeout(syncTimer);
        syncTimer = setTimeout(syncRangeInputs, 300);
      };
      graphCanvas.addEventListener('mousemove', syncTimerFn);
      graphCanvas.addEventListener('wheel', syncTimerFn);

      // ── Canvas mouse handlers for panning + coordinate readout ──
      let isDown = false, lx = 0, ly = 0;
      graphCanvas.addEventListener('mousedown', (e) => {
        isDown = true;
        const rect = graphCanvas.getBoundingClientRect();
        lx = e.clientX - rect.left;
        ly = e.clientY - rect.top;
        graphCanvas.style.cursor = 'grabbing';
      });
      graphCanvas.addEventListener('mousemove', (e) => {
        const rect = graphCanvas.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        // Update coordinate display + "y ≈" previews
        const math = screenToMath(mx, my);
        graphCoordLabel.textContent = `(${math.x.toFixed(2)}, ${math.y.toFixed(2)})`;
        graphState.hoverX = math.x;
        updateValuePreviews();
        // In trace mode the overlay marker follows the mouse — re-render
        if (graphState.traceOn && !isDown) renderGraph();

        if (isDown) {
          const dx = (lx - mx) / rect.width * (graphState.xMax - graphState.xMin);
          const dy = (ly - my) / rect.height * (graphState.yMax - graphState.yMin);
          graphState.xMin += dx; graphState.xMax += dx;
          graphState.yMin += dy; graphState.yMax += dy;
          lx = mx; ly = my;
          renderGraph();
        }
      });
      const idleCursor = () => graphState.traceOn ? 'crosshair' : 'grab';
      graphCanvas.addEventListener('mouseup', () => { isDown = false; graphCanvas.style.cursor = idleCursor(); });
      graphCanvas.addEventListener('mouseleave', () => { isDown = false; graphCanvas.style.cursor = idleCursor(); graphState.hoverX = null; updateValuePreviews(); });

      // ── Mouse wheel zoom, centered on the cursor ──
      graphCanvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = graphCanvas.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        const math = screenToMath(mx, my);            // point under the cursor
        const factor = e.deltaY < 0 ? 0.8 : 1.25;     // wheel up = zoom in
        const cx = (graphState.xMin + graphState.xMax) / 2;
        const cy = (graphState.yMin + graphState.yMax) / 2;
        // Keep the cursor's math point fixed on screen while zooming
        graphState.xMin = math.x - (math.x - graphState.xMin) * factor;
        graphState.xMax = math.x + (graphState.xMax - math.x) * factor;
        graphState.yMin = math.y - (math.y - graphState.yMin) * factor;
        graphState.yMax = math.y + (graphState.yMax - math.y) * factor;
        renderGraph();
      }, { passive: false });

      // Touch support for mobile panning
      graphCanvas.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        const rect = graphCanvas.getBoundingClientRect();
        lx = touch.clientX - rect.left;
        ly = touch.clientY - rect.top;
        isDown = true;
      }, { passive: true });
      graphCanvas.addEventListener('touchmove', (e) => {
        if (!isDown) return;
        const touch = e.touches[0];
        const rect = graphCanvas.getBoundingClientRect();
        const mx = touch.clientX - rect.left, my = touch.clientY - rect.top;
        const dx = (lx - mx) / rect.width * (graphState.xMax - graphState.xMin);
        const dy = (ly - my) / rect.height * (graphState.yMax - graphState.yMin);
        graphState.xMin += dx; graphState.xMax += dx;
        graphState.yMin += dy; graphState.yMax += dy;
        lx = mx; ly = my;
        renderGraph();
      }, { passive: true });
      graphCanvas.addEventListener('touchend', () => { isDown = false; }, { passive: true });

      // ── Zoom buttons ──
      graphZoomIn.addEventListener('click', () => {
        const cx = (graphState.xMin + graphState.xMax) / 2;
        const cy = (graphState.yMin + graphState.yMax) / 2;
        const rx = (graphState.xMax - graphState.xMin) * 0.2;
        const ry = (graphState.yMax - graphState.yMin) * 0.2;
        graphState.xMin = cx - rx; graphState.xMax = cx + rx;
        graphState.yMin = cy - ry; graphState.yMax = cy + ry;
        renderGraph();
      });
      graphZoomOut.addEventListener('click', () => {
        const cx = (graphState.xMin + graphState.xMax) / 2;
        const cy = (graphState.yMin + graphState.yMax) / 2;
        const rx = (graphState.xMax - graphState.xMin) * 0.5;
        const ry = (graphState.yMax - graphState.yMin) * 0.5;
        graphState.xMin = cx - rx; graphState.xMax = cx + rx;
        graphState.yMin = cy - ry; graphState.yMax = cy + ry;
        renderGraph();
      });
      // Reset to default view
      graphHome.addEventListener('click', () => {
        graphState.xMin = -10; graphState.xMax = 10;
        graphState.yMin = -10; graphState.yMax = 10;
        renderGraph();
      });

      // Step zoom (scale control at bottom-right)
      document.getElementById('stepZoomIn').addEventListener('click', () => {
        graphState.xMin *= 0.8; graphState.xMax *= 0.8;
        graphState.yMin *= 0.8; graphState.yMax *= 0.8;
        renderGraph();
      });
      document.getElementById('stepZoomOut').addEventListener('click', () => {
        graphState.xMin *= 1.25; graphState.xMax *= 1.25;
        graphState.yMin *= 1.25; graphState.yMax *= 1.25;
        renderGraph();
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // ── Graph keypad handler for graphing mode ──
    // Keypad clicks (and the physical keyboard in graphing mode) are routed
    // here from main.js. We insert characters into the ACTIVE expression row,
    // or create a new row if none is focused — like typing into a graph row.
    function handleGraphKeypad(action) {
      playKeySound(action === 'equals' || action === 'graph-add' || action === 'enter');

      // ── Panel toggles (no expression row needed) ──
      // The Functions popover and ABC letters strip live above the keypad;
      // clicking their keys toggles them open/closed.
      if (action === 'functions') {
        const pop = document.getElementById('gkpFunctions');
        const letters = document.getElementById('gkpLetters');
        if (pop) pop.classList.toggle('open');
        if (letters && pop && pop.classList.contains('open')) letters.classList.remove('open');
        return;
      }
      if (action === 'abc') {
        const letters = document.getElementById('gkpLetters');
        const pop = document.getElementById('gkpFunctions');
        if (letters) letters.classList.toggle('open');
        if (pop && letters && letters.classList.contains('open')) pop.classList.remove('open');
        return;
      }

      // What each key inserts into the expression row
      const insertMap = {
        '0':'0','1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9',
        'decimal':'.','add':'+','subtract':'-','multiply':'*','divide':'/','power':'^',
        'lparen':'(','rparen':')','negate':'-','x':'x','y':'y','t':'t','r':'r',
        'sin':'sin(','cos':'cos(','tan':'tan(',
        'asin':'asin(','acos':'acos(','atan':'atan(',
        'sinh':'sinh(','cosh':'cosh(','tanh':'tanh(',
        'log':'log(','ln':'ln(','exp':'exp(','abs':'abs(',
        'cbrt':'cbrt(','nthroot':'nthroot(','ncr':'nCr(','npr':'nPr(','fact':'!',
        'sqrt':'sqrt(','square':'^2','comma':',',
        'less':'<','greater':'>','leq':'<=','geq':'>=',
        'constant_pi':'π','constant_e':'e','theta':'θ',
        'equals':'=',      // the keypad '=' INSERTS '=' so you can type
                           // y = x^2 row-by-row; only ⏎/enter commits.
      };

      // Find the focused row input, or fall back to the active/last row
      let input = null;
      const focused = document.activeElement;
      if (focused && focused.classList && focused.classList.contains('expr-input')) input = focused;
      if (!input) {
        const idx = graphState.activeIndex >= 0 ? graphState.activeIndex : graphState.expressions.length - 1;
        const row = graphExprList.children[idx];
        if (row) input = row.querySelector('.expr-input');
        // Graphing-calculator behavior: when nothing is actively selected and
        // the last row already holds a completed expression, start a FRESH row
        // below it instead of appending onto the finished one. Only for
        // text-insertion actions — edit/navigation keys (⌫ ← → clear, enter)
        // still target the
        // last row so they don't spawn spurious empty rows.
        const isInsert = insertMap[action] !== undefined || /^[a-zA-Z]$/.test(action);
        if (isInsert && input && graphState.activeIndex === -1 && !isEmptyExpression(input.value)) {
          addGraphExpression('');
          const last = graphExprList.children[graphExprList.children.length - 1];
          input = last ? last.querySelector('.expr-input') : null;
        }
      }
      // No row yet? Create one
      if (!input) { addGraphExpression(''); return; }
      if (!input.classList.contains('expr-input')) return;

      const insert = (s) => {
        const start = input.selectionStart != null ? input.selectionStart : input.value.length;
        const end = input.selectionEnd != null ? input.selectionEnd : input.value.length;
        input.setRangeText(s, start, end, 'end');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
      };
      const removeChar = () => {
        const start = input.selectionStart != null ? input.selectionStart : input.value.length;
        if (start > 0) {
          input.setRangeText('', start - 1, start, 'end');
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        input.focus();
      };
      // Cursor movement inside the expression row (← → keys)
      const moveCursor = (dir) => {
        const pos = input.selectionStart != null ? input.selectionStart : input.value.length;
        input.setSelectionRange(Math.max(0, Math.min(input.value.length, pos + dir)),
                                Math.max(0, Math.min(input.value.length, pos + dir)));
        input.focus();
      };

      if (action === 'clear') { input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true })); return; }
      if (action === 'backspace') { removeChar(); return; }
      if (action === 'left') { moveCursor(-1); return; }
      if (action === 'right') { moveCursor(1); return; }
      if (action === 'graph-add' || action === 'enter') {
        // Commit the current row (graphing is live already) and add a new one.
        // Note: 'equals' is NOT here — on the graph keypad it inserts '=' (see
        // insertMap) so equations like y = x^2 can be typed in one row.
        if (!isEmptyExpression(input.value)) addGraphExpression('');
        return;
      }
      if (insertMap[action] !== undefined) { insert(insertMap[action]); return; }
      // Any other single letter (slider variables like a, b, k) inserts itself
      if (/^[a-zA-Z]$/.test(action)) insert(action);
    }

    // ═══════════════════════════════════════════════════════════════
    // EXPORTS (ES module) — what main.js may import from graph.js
    // ═══════════════════════════════════════════════════════════════
    export { initGraph, renderGraph, handleGraphKeypad, addGraphExpression,
             renderGraphExprList, graphState, removeGraphExpression,
             toggleGraphExpression, validateExpression, parseGraphExpression,
             exportGraph, loadGraphState, numericDerivative,
             openTableModal, exportGraphStateToUrl, importGraphStateFromUrl };

    // ═══════════════════════════════════════════════════════════════
