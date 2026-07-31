# 🧮 UltCalc — Scientific Calculator + Graphing Calculator

A feature-packed scientific calculator with a textbook-quality **MathML expression
display** and a **full graphing calculator** — all in a single-page web app
with zero dependencies. No build step, no frameworks: plain HTML + CSS + vanilla
JavaScript ES modules.

![Stack](https://img.shields.io/badge/stack-HTML%20%2B%20CSS%20%2B%20Vanilla%20JS%20(ES%20Modules)-informational)

---

## 🚀 Try it right now — three ways

There are **three** ways to run FreeCalc, from "zero effort" to "full dev setup":

| # | Way | What the person does | You need to do |
|---|-----|----------------------|----------------|
| 1 | **Live link (GitHub Pages)** | Opens a URL in any browser — no download, works on phones | Deploy once (see below) |
| 2 | **Single-file download** | Downloads ONE `.html` file and double-clicks it — works offline, no installs | Rebuild after code changes |
| 3 | **Run from source** | Downloads the ZIP and serves the folder (needs Python or Node) | Nothing extra |

**Live link** — the repo is set up to auto-deploy to GitHub Pages on every push:
`https://<your-username>.github.io/UtlCalculator/`
(one-time setup: repo **Settings → Pages → Source: GitHub Actions**).

**Single-file download** — grab `FreeCalc-single-file.html` from the repo root (or the
latest release) and double-click it. It has every script + the stylesheet inlined,
so it runs from `file://` with no server. To regenerate it after editing `src/`:

```bash
node build-single-file.js     # → regenerates FreeCalc-single-file.html
```

**Run from source** — clone/download the repo and serve `src/` over HTTP (ES
modules won't load over `file://`):

```bash
cd src
python -m http.server 8000    # then open http://localhost:8000/calculator.html
# or double-click serve.bat (Windows, one click)
```

---

## ✨ Features

### Calculator
- **4-function + scientific modes**: `sin cos tan asin acos atan sinh cosh tanh`,
  `csc sec cot`, `log ln exp`, `sqrt cbrt nthroot`, `! % ^`, `π τ e`, `ans`,
  `gcd lcm mod nCr nPr`, and statistics (`mean stdev stdevp`)
- **Shunting-yard expression engine** — correct operator precedence and
  right-associative `^` (`2^3^2 = 512`, not `64`)
- **MathML rendering** — expressions render like a textbook, not a flat string
- **Implicit multiplication** (`2pi`, `2(3+4)`, `2sin(x)`)
- Angle modes (RAD/DEG), precision modes (Auto/Fix/Sci/Eng), history, sounds,
  dark theme, and full keyboard support

### Graphing
- **Expression list on the left** — add rows with `+`, edit live (curve redraws
  as you type), toggle visibility with the color dot, right-click to cycle
  colors, delete with ✕
- **Four curve types** — Cartesian `y = x^2`, **parametric**
  `x = cos(t), y = sin(t)` (or `(cos t, sin t)`), **polar** `r = 2cos(θ)`
  (type `theta` if you don't have θ handy), and **implicit** equations
  `x^2 + y^2 = 25`
- **Implicit curves** — any equation with a top-level `=` (e.g. `x^2 + y^2 = 25`,
  `sin(x) = cos(y)`, or `x = 3` for a vertical line) is traced with an
  **adaptive marching-squares** contour finder: cells that contain the curve
  are recursively subdivided so tight shapes (hyperbolas near the origin, small
  circles while zoomed in) render smooth instead of blocky
- **Derivatives** — plot `dy/dx` numerically (central difference, so no
  symbolic engine is needed) with any of `y' = x^3`, `f'(x) = x^3`,
  `d/dx x^3` or `d/dx(x^3)`; the derivative curve breaks exactly at
  asymptotes and gets its own `y' ≈` hover preview
- **Higher derivatives** — `y'' = x^3`, `f''(x) = x^3`, `d2/dx2 x^3` (or any
  order: `y'''`, `f'''(x)`, `d3/dx3(x^3)`…) plot the n-th derivative via
  recursively composed central differences. The hover preview label matches
  the order (`y'' ≈`)
- **Integral area plots** — `integral(x^2, 0, 2)` (or `∫(x^2, 0, 2)`) shades
  the area under the curve between the bounds and labels the value, computed
  with **Simpson's rule**. Bounds can be numbers, `pi`, or slider letters
  (`integral(x^2, 0, a)` → drag `a` to watch the area grow)
- **Curve tracing** — the `◎` button turns on trace mode: hovering the canvas
  snaps a marker dot onto the nearest curve, draws its tangent line and shows
  a live `(x, f(x)) m=slope` readout — walk along the curve with the mouse
- **Tangent lines** — `tangent(x^2, 2)` draws the line touching the curve at
  `x = 2` (with a dot at the touch point). The point can be a slider variable:
  `tangent(x^2, a)` and drag `a` to slide the tangent line along the curve
- **Viewport + t/θ range controls** — the sidebar has number boxes to set the
  visible **x/y bounds** and the **sampling ranges** for parametric (`t`) and
  polar (`θ`) curves; curves re-render live as you type, and the boxes stay in
  step with pan/zoom
- **Zoom & aspect sliders** — the View section of the sidebar adds a **zoom
  slider** (re-scales the viewport around its center, keeping the x:y ratio)
  and an **aspect-ratio slider** (stretches x vs y; disabled while the
  square-grid lock is on). Both stay in sync with pan/zoom
- **Square grid (aspect lock)** — the `▭` button keeps 1 unit on the x-axis
  equal to 1 unit on the y-axis, so circles stay round instead of stretched
- **Variable sliders** — any single-letter variable that isn't a curve axis
  (e.g. `a` in `y = a·sin(x)`, or `a` in `x^2 + y^2 = a^2`) automatically gets
  a draggable slider (default −10…10); drag it to animate the curve live
- **Legend overlay** — the canvas shows a color→curve legend (top-left) that
  stays in sync as you add, edit, hide or re-color expressions
- **Session persistence** — expressions, slider values, viewport, t/θ ranges
  and the aspect lock are saved to `localStorage` (debounced) and restored on
  reload, so your graph is exactly where you left it
- **Three-group graphing keypad** — the graphing keypad is laid out like a
  professional graphing calculator's (4 rows × 3 groups): `x y a² a^b`
  `7 8 9 ÷` `fx` ; `( ) < >` `4 5 6 ×` `← →` ;
  `|a| , ≤ ≥` `1 2 3 −` `⌫` ; `ABC 🔊 √ π` `0 . = +` `⏎`. The `fx` key opens a
  **Functions popover** (sin, cos, tan, asin, acos, atan, sinh, cosh, tanh,
  log, ln, exp, cbrt, nthroot, nCr, nPr, !, t, θ, AC), the `ABC` key opens a
  **letters strip** (a–z slider variables), and 🔊 toggles key sounds. With no
  row selected, typing starts a fresh row instead of appending to a completed
  one. The keypad `=` key **inserts** an equals sign so you
  can type `y = x^2` in one row — only `⏎`/Enter commits and opens the next row.
  Note: the `< > ≤ ≥` keys are part of the layout but the engine doesn't
  support inequalities yet — they show a friendly "not supported" hint instead
  of a bare error
- **Keyboard tracing** — with trace mode on, the **← → arrow keys** step the
  trace point along the curve (1/60 of the visible x-range per press) so you
  can explore the curve from the keyboard
- **Integral animation** — integral rows with a letter bound get a ▶ button
  that sweeps the bound slider from 0 to its max over 3 seconds (ease-in-out)
  so you can watch the shaded area grow; ▶ on another row switches the
  animation there
- **Display reset on mode switch** — switching between 4‑Function, Scientific
  and Graphing clears the previous mode's expression and answer (the display
  never leaks results across modes)
- **Keyboard help** — the `?` button on the canvas opens a shortcuts cheat
  sheet (pan, zoom, new row, row navigation, variable keys, color cycling)
- **PNG export** — the ⬇ button redraws the scene at 2× resolution and
  downloads it as `freecalc-graph.png`
- **Same engine for everything** — `2x`, `x(x+1)`, `xsin(x)` (x·sin(x)) and
  `xpi` (x·π) all parse identically to the calculator via implicit multiplication
- **Real nth roots** — `x^(1/3)` for negative x returns the real cube root,
  like a graphing calculator (`Math.pow` would give `NaN`)
- **Pan** (drag) and **cursor-centered wheel zoom**, zoom buttons, home reset,
  and a coordinate readout + `y ≈ value` previews while hovering
- **Asymptote-aware plotting** — division by zero / `log(negative)` break the
  line instead of drawing a fake vertical line
- Touch gestures for mobile panning

---

## 🚀 How to run

The app uses **ES modules** (`type="module"`), which browsers refuse to load
over the `file://` protocol due to CORS. You must serve the folder over HTTP:

**Option A — one-click (Windows):** double-click `src/serve.bat`
(opens http://localhost:8000 automatically).

**Option B — Python:**
```bash
cd "Calculator Project/src"
python -m http.server 8000
# then open http://localhost:8000/calculator.html
```

**Option C — Node (if you don't have Python):**
```bash
cd "Calculator Project/src"
npx serve . -l 8000
# then open http://localhost:8000/calculator.html
```

> **Tip:** Open `src/calculator.html` via a local server — never directly from
> the file system — or the modules won't load.

---

## 🗂 Project structure

```
Calculator Project/
├── src/                       # the app itself
│   ├── calculator.html        # THE CORE — markup only (display, keypad, graph layout)
│   ├── styles.css             # All styling: themes, layout, buttons, graph canvas
│   ├── engine.js              # THE BRAIN — tokenizer → shunting-yard → RPN evaluator
│   │                          #   (state, evaluate, graphEvaluate, formatResult…)
│   ├── mathml-renderer.js     # Recursive-descent parser → textbook MathML output
│   ├── ui.js                  # Keypad behavior, sounds, theme, display updates
│   ├── graph.js               # Graphing engine: expression list, sliders, implicit
│   │                          #   contours, t/θ ranges, legend, pan/zoom, tracing
│   ├── main.js                # Boot file — wires all modules together
│   └── serve.bat              # Windows local-server launcher
├── tests/                     # dependency-free Node test suites
│   ├── test_calculator_suite.js     # 200+ core regression cases
│   ├── test_fourfunction_1000.js    # 1,000 4-function samples
│   ├── test_scientific_suite.js     # 3,125 scientific cases
│   ├── test_scientific_2000.js      # 2,000 scientific equations
│   ├── test_graph_2000.js           # 2,000 equations × 10 curve samples vs reference
│   ├── test_engine_fixes.js         # engine fixes: splitting, real roots, θ vars
│   ├── test_derivatives.js          # derivative & tangent detection + calculus math
│   ├── test_calculus.js             # higher derivatives, integrals & trace checks
│   ├── test_implicit.js             # implicit-curve detection + equation math
│   ├── test_ui_structure.js         # HTML markup structure check
│   ├── test_single_file.js          # executes the bundled single-file in Node
│   └── verify_mathml_render.js      # MathML render verification
├── build-single-file.js      # bundles the app into ONE standalone HTML file
├── FreeCalc-single-file.html # 📦 the build output — download & double-click
├── .github/workflows/pages.yml  # auto-deploys to GitHub Pages on push
├── README.md
└── .gitignore
```

**Module load order** (each file only imports from earlier ones — no cycles):

```
engine.js → mathml-renderer.js → ui.js → graph.js → main.js
```

---

## 🧪 Running the tests

All test files are dependency-free Node scripts (they extract the real engine
code from `engine.js` and run thousands of equations against it):

```bash
cd "Calculator Project/tests"
node test_calculator_suite.js      # 200+ core cases
node test_fourfunction_1000.js     # 1,000 samples
node test_scientific_suite.js      # 3,125 cases
node test_scientific_2000.js       # 2,000 equations
node test_graph_2000.js            # 2,000 curves × 10 samples vs reference math
node test_engine_fixes.js          # identifier splitting, real roots, θ vars
node test_derivatives.js           # derivative & tangent detection + calculus math
node test_calculus.js              # higher derivatives, integrals, trace checks
node test_implicit.js              # implicit detection + equation math + curve sampling
node test_ui_structure.js          # markup sanity check
node verify_mathml_render.js       # MathML rendering check
```

Or run everything at once (Windows cmd / bash):

```bash
cd "Calculator Project/tests"
for f in test_*.js verify_mathml_render.js; do node "$f" || exit 1; done
```

**Current status:** all suites pass — 200+ core, 1,000 four-function,
3,125 scientific, 2,000 scientific, 2,000 graph curves, 102 engine-fix checks,
implicit-curve checks, **50 derivative & tangent checks**, **6,076 calculus
checks** (higher derivatives through order 8 + 6,000 randomized integrals vs
analytic values + trace), UI structure, and MathML render.

---

## 🧠 How the math engine works (deep dive)

The expression pipeline is a classic 3-step design (fully commented in
`engine.js`):

1. **`tokenize()`** — splits `"2+3*4"` into tokens `[2][+][3][*][4]`, handles
   scientific notation (`2e3`), implicit multiplication (`2pi`, `2(3+4)`), and
   graphing-calculator-style identifier splitting (`xsin` → `x` `sin`).
2. **`toRPN()`** — the **shunting-yard algorithm** (Dijkstra) converts infix to
   Reverse Polish Notation so parentheses become unnecessary and precedence is
   handled by a table: `+ -` < `* /` < `^` < unary minus.
3. **`evaluateRPN()`** — walks the RPN stack, applying each operator/function as
   it goes. `[2][3][4][*][+]` → `14`.

`graphEvaluate(expr, x)` reuses the same pipeline with `x` bound as a variable —
so the curve plotted is *exactly* what the calculator would compute.

---

## 🐛 Testing the graph against reference math

`test_graph_2000.js` verifies the graphing engine against **2,000 equations**,
sampled at 10 x-positions each and compared to an independent reference written
with plain `Math.*`:

- **A.** Curated classic curves (`x²`, `sin(x)`, `1/x`, `e^x`, `ln(x)`…)
- **B.** 250 randomized polynomials
- **C.** 250 randomized trig curves
- **D.** 200 exponential / logarithmic curves
- **E.** 200 rational curves (asymptote breaking)
- **F.** 100+ implicit-multiplication curves (`2x`, `3sin(x)`, `xsin(x)`, `xpi`…)
- **G.** 250 nested composite curves
- **H.** Hyperbolic & inverse trig
- **I.** Mixed forms (`%`, `!`, powers)
- **J.** Random composite fuzz to reach exactly 2000

Points where the curve is undefined (asymptotes, `sqrt(negative)`, `log(≤0)`)
are skipped on *both* sides — matching how the canvas breaks the line.

`test_implicit.js` separately verifies that implicit equations are detected
correctly (`x^2 + y^2 = 25` → implicit, `y = x^2` → cartesian, `x = 3` →
implicit vertical line), that the engine evaluates both sides so the contour
finder's `f(x,y) = lhs − rhs` is truly zero on the curve, and — new — that
**sample points on classic implicit curves** (circle, vertical line, ellipse,
hyperbola, slider-parametrized circle, trig) all satisfy `f(x,y) ≈ 0` while
off-curve points are correctly non-zero.

`test_derivatives.js` verifies the calculus features: that `y' =`, `f'(x) =`,
`d/dx` and `tangent(...)` are classified correctly (and that `y' = x^2` is
**not** mistaken for an implicit equation despite its `=`), that the numeric
central-difference derivative matches the **analytic** derivative for classic
functions (`x²`, `x³`, `sin`, `cos`, `e^x`, `ln`, `1/x`, square roots,
slider-parametrized forms) to within `1e-3`, that non-finite points produce
`NaN` (asymptote line-breaks), that tangent lines pass through the curve at
the touch point with the correct slope (including slider points), and that a
sampled `d/dx sin(x)` curve tracks `cos(x)` across the viewport.

`test_calculus.js` verifies the newest calculus layer: **higher derivatives**
(`y''`, `f''(x)`, `d2/dx2`, `d3/dx3(x^3)` are classified with the right order,
and `d²/dx² x³ = 6x`, `d³/dx³ sin = −cos`, `d⁴/dx⁴ x⁴ = 24` etc. match the
analytic values — including slider-parametrized forms and `NaN` on undefined
points), **integrals** (`integral(f, a, b)` and `∫(f, a, b)` detection with
slider/`pi` bounds, Simpson-rule values vs analytic: `∫₀² x² = 8/3`, `∫₀^π sin = 2`,
`∫₀¹ eˣ = e−1`, reversed bounds → negative, asymptote inside → `NaN`),
**trace mode** (the overlay picks the first visible cartesian/derivative row
and its `(x, f(x)) m=slope` readout matches the analytic values), and a
**stress-test layer**: derivatives of order 5–8 (`y'''''`…, `d8/dx8`) match
analytic values, and **6,000 randomized integrals** (`xⁿ`, `sin`, `cos`, `eˣ`,
`1/x`, `a·x²` over random bounds) match their closed forms to within `1e-4`.

---

## 🧭 Reading guide — where to start (for learners)

The codebase is written to be read like a textbook. The files form a **dependency
chain**, so read them in this order and each one will make sense:

```
engine.js → mathml-renderer.js → ui.js → graph.js → main.js
  (math)        (display)         (buttons)   (canvas)    (boot)
```

### 1. `src/engine.js` — the brain (start here)

A classic 3-step expression pipeline, fully commented:

1. **`tokenize()`** — splits `"2+3*4"` into tokens `[2][+][3][*][4]` (handles
   scientific notation, implicit multiplication `2pi`, identifier splitting `xsin`).
2. **`toRPN()`** — the **shunting-yard algorithm** converts infix to Reverse
   Polish Notation; precedence comes from a table, not hard-coded cases.
3. **`evaluateRPN()`** — walks the RPN stack applying operators as it goes.

Read this first because **every other file calls `evaluate()`** — understand it
and you understand the whole app.

### 2. `src/mathml-renderer.js` — textbook display (small, quick win)

Turns `"2+3*4"` into real MathML so the display looks like a textbook, not a
flat string. Great first file to read fully — it's only ~100 lines.

### 3. `src/ui.js` — buttons, sounds, themes

Ties keypad buttons to engine calls. Look for `handleAction()` — the single
function every button click funnels through.

### 4. `src/graph.js` — the graphing engine (biggest file)

`parseGraphExpression()` decides what kind of curve a row is (cartesian,
parametric, polar, implicit, derivative, integral, tangent). `drawScene()` does
the actual canvas drawing. The **numeric derivative** and **Simpson's rule
integral** are pure functions — easy to read, easy to test.

### 5. `src/main.js` — wiring it all together

Boots the app and connects events. `switchMode()` lives here (not ui.js) so it
can call `initGraph()` without a circular import.

### The `tests/` folder is your friend

Every test file has a header comment explaining **what** it verifies and **why**.
They extract the real engine code and run thousands of equations against it —
read one test file and you'll see exactly how the engine is *supposed* to behave.

### Suggested exercises

1. Add a new function (e.g. `cube`) — find where `sin` is handled in the engine
   and in the keypad, add both, run the tests.
2. Change the graph's default color palette in `state.graphColors` and watch
   every new curve pick it up.
3. Trace how `2pi` becomes a number: `tokenize` → `toRPN` → `evaluateRPN`.
4. Write a test file like `tests/test_engine_fixes.js` for a function you add.

---

## 🛠 GitHub-ready

- **One-command Pages deploy** — `.github/workflows/pages.yml` rebuilds the
  single-file bundle and deploys it to GitHub Pages on every push to `main`.
- **Single-file build** — `build-single-file.js` inlines all modules + CSS into
  `FreeCalc-single-file.html` (works from `file://`). Validated by
  `tests/test_single_file.js`, which executes the bundle in Node.
- `.gitignore` excludes junk (`.DS_Store`, `Thumbs.db`, scratch files, `_site/`).
- No `node_modules`, no external dependencies — **running from source needs no
  build** (clone & serve). The standalone `FreeCalc-single-file.html` is a
  pre-generated bonus, refreshed by the build script and verified fresh in CI.

---

## 📄 License

Free to use, modify, and share. Made for learning — the code is heavily
commented so you can read it like a textbook.
