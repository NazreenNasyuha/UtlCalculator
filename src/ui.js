// ═══════════════════════════════════════════════════════════════════════════════
// ui.js — BUTTONS, KEYPAD & DISPLAY BEHAVIOR (the "hands" of the calculator)
// ═══════════════════════════════════════════════════════════════════════════════
//
// WHAT LIVES HERE
//   • DOM references  — shortcuts to the HTML elements (display, buttons, tabs...)
//   • showResult() / updateDisplay() — draw the expression + live result
//   • addHistory()    — record past calculations in the small history strip
//   • handleAction()  — THE central "what to do when a key is pressed" function.
//                       It reads the button's data-action and:
//                         clear/backspace/left/right  → edit the expression
//                         equals                       → evaluate + animate
//                         insertMap[action]            → insert text at the cursor
//                         angle / inv / shift          → toggle modes
//   • spawnRipple()   — the little circle that expands on every key press
//   • playKeySound()/playChime() — Web-Audio clicks (no audio files needed)
//   • animateOdometer()/spawnConfetti() — fun effects for "=" and special answers
//   • setTheme()      — dark ↔ light (saved in localStorage)
//   • switchMode()    — 4-Function / Scientific / Graphing tab switching
//
// FILE LOAD ORDER  engine.js → mathml-renderer.js → ui.js → graph.js → main.js
// ═══════════════════════════════════════════════════════════════════════════════

    // ─── IMPORTS (ES module) — what this file needs from other files ───
    import { state, evaluate, formatResult } from './engine.js';
    import { esc, renderExpression } from './mathml-renderer.js';

    // ─── DOM References: connect JS to HTML elements ───
    const calc = document.getElementById('calc');
    const displayEditor = document.getElementById('displayEditor');
    const displayValue = document.getElementById('displayValue');
    const displayResult = document.getElementById('displayResult');
    const displayHistory = document.getElementById('displayHistory');
    const display = document.getElementById('display');
    const angleModeBtn = document.getElementById('angleModeBtn');
    const themeBtn = document.getElementById('themeToggle');
    const precisionBtn = document.getElementById('precisionBtn');
    const precisionLabel = document.getElementById('precisionLabel');
    const precisionDropdown = document.getElementById('precisionDropdown');
    const modeLabel = document.getElementById('modeLabel');
    // UI UPDATE FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    // Update the display with the current expression and result
    function showResult(text) {
      displayResult.style.display = 'flex';
      displayValue.textContent = text;
      displayValue.className = 'display-value';
      // Shrink font for long numbers
      if (text.length > 10) displayValue.className = 'display-value small';
      if (text.length > 15) displayValue.className = 'display-value xsmall';
    }

    function updateDisplay() {
      renderExpression();
      if (state.displayValue !== '') {
        showResult(state.displayValue);
      } else if ((state.calcMode === 'fourfunction' || state.calcMode === 'scientific') && state.expression.trim()) {
        // FreeCalc-style live preview: show the result as you type
        const r = evaluate(state.expression);
        if (!isNaN(r) && isFinite(r)) {
          showResult(formatResult(r));
        } else {
          displayResult.style.display = 'none';
          displayValue.textContent = '';   // clear stale result text (mode resets)
        }
      } else {
        displayResult.style.display = 'none';
        displayValue.textContent = '';     // clear stale result text (mode resets)
      }
    }

    // Add an entry to the calculation history
    function addHistory(expr, result) {
      const h = document.createElement('div');
      h.className = 'history-row';
      h.innerHTML = `<span class="h-expr">${esc(expr)}</span><span class="h-result">= ${esc(result)}</span>`;
      displayHistory.appendChild(h);
      displayHistory.scrollTop = displayHistory.scrollHeight;  // Auto-scroll to newest
      state.history.push({ expr, result });
      // Keep only last 10 history items
      while (displayHistory.children.length > 10) displayHistory.removeChild(displayHistory.firstChild);
    }

    // ═══════════════════════════════════════════════════════════════
    // ACTION HANDLER — processes button clicks and keyboard input
    // ═══════════════════════════════════════════════════════════════

    function handleAction(action) {
      playKeySound(action === 'equals');           // Key click sound
      // Clear function buffer timer
      if (state.fnTimeout) { clearTimeout(state.fnTimeout); state.fnTimeout = null; }

      // In 2nd mode, trig/hyperbolic keys insert their inverse functions
      if (state.secondMode) {
        const invMap = { sin:'asin', cos:'acos', tan:'atan', sinh:'asinh', cosh:'acosh', tanh:'atanh' };
        if (invMap[action]) action = invMap[action];
      }

      if (action === 'clear') {                              // AC — Clear everything
        state.expression = '';
        state.displayValue = '';
        state.justGotResult = false;
        display.classList.remove('err');
        updateDisplay();
        return;
      }

      if (action === 'backspace') {                           // ⌫ — Delete at the cursor
        if (state.justGotResult) { state.expression = ''; state.justGotResult = false; state.cursorPos = 0; }
        else if (state.cursorPos > 0) {
          // Delete the character BEFORE the cursor (FreeCalc behavior)
          state.expression = state.expression.slice(0, state.cursorPos - 1) + state.expression.slice(state.cursorPos);
          state.cursorPos--;
        }
        state.displayValue = '';
        display.classList.remove('err');
        updateDisplay();
        return;
      }

      // Cursor movement (FreeCalc ← → arrows)
      if (action === 'left') {
        state.cursorPos = Math.max(0, state.cursorPos - 1);
        updateDisplay();
        return;
      }
      if (action === 'right') {
        state.cursorPos = Math.min(state.expression.length, state.cursorPos + 1);
        updateDisplay();
        return;
      }

      // Shift toggle on the ABC keyboard (uppercase letters)
      if (action === 'shift') {
        state.shiftOn = !state.shiftOn;
        document.querySelectorAll('.keypad-sci .abc-row .key-btn.alpha').forEach(b => {
          b.classList.toggle('shift-on', state.shiftOn);
        });
        return;
      }

      if (action === 'equals') {                              // = — Evaluate!
        if (!state.expression) return;
        const result = evaluate(state.expression);
        const formatted = formatResult(result);
        if (isNaN(result) || !isFinite(result)) {
          display.classList.add('err');
          state.displayValue = isNaN(result) ? 'Error' : formatted;
        } else {
          display.classList.remove('err');
          state.displayValue = formatted;
          addHistory(state.expression, formatted);
          state.lastResult = result;
          state.justGotResult = true;
        }
        updateDisplay();
        // ── Animate the display when = is pressed ──
        if (isNaN(result) || !isFinite(result)) {
          display.classList.remove('shake');      // Shake on error
          void display.offsetWidth;               // restart the animation
          display.classList.add('shake');
        } else {
          display.classList.remove('flash');            // Display glows briefly
          void display.offsetWidth;
          display.classList.add('flash');
          animateOdometer(formatted);                   // Rolling odometer digits
          if (result === 67 || result === 69) {         // Special answers: confetti!
            spawnConfetti();
            playChime();
          }
        }
        return;
      }

      // After pressing =, start a NEW expression if user types a number or ans
      if (state.justGotResult && (/[0-9.]/.test(action) || action === 'ans')) {
        state.expression = '';
        state.justGotResult = false;
        state.cursorPos = 0;
      }

      // Insert the action character(s) into the expression at the cursor
      const insertMap = {
        '0':'0','1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9',
        'decimal':'.','zerodec':'0.',
        'add':'+','subtract':'-','multiply':'*','divide':'/','power':'^','lparen':'(','rparen':')',
        'percent':'%','negate':'-','comma':',',
        'square':'^2','sqrt':'sqrt(','cbrt':'cbrt(','invx':'^(-1)','fact':'!','nthroot':'nthroot(',
        'sin':'sin(','cos':'cos(','tan':'tan(','sinh':'sinh(','cosh':'cosh(','tanh':'tanh(',
        'asin':'asin(','acos':'acos(','atan':'atan(','asinh':'asinh(','acosh':'acosh(','atanh':'atanh(',
        'log':'log(','ln':'ln(','exp':'exp(','tenx':'10^','abs':'abs(','ceil':'ceil(','floor':'floor(','round':'round(',
        'mean':'mean(','stdev':'stdev(','stdevp':'stdevp(','ncr':'nCr(','npr':'nPr(',
        'lbracket':'[','rbracket':']','apostrophe':"'",
        'constant_pi':'π','constant_tau':'τ','constant_e':'e','ans':'ans',
        'fraction':'/',
        // Graphing-specific
        'x':'x',
      };

      if (insertMap[action] !== undefined) {
        state.justGotResult = false;
        state.expression = state.expression.slice(0, state.cursorPos) + insertMap[action] + state.expression.slice(state.cursorPos);
        state.cursorPos += insertMap[action].length;
        state.displayValue = '';
        display.classList.remove('err');
        updateDisplay();
      }

      // Angle mode toggle
      if (action === 'angle') {
        state.angleMode = state.angleMode === 'RAD' ? 'DEG' : 'RAD';
        angleModeBtn.textContent = state.angleMode;
        localStorage.setItem('calc-angle', state.angleMode);
      }

      // Second function toggle: swaps sin/cos/tan/sinh/cosh/tanh to their inverses
      if (action === 'inv') {
        state.secondMode = !state.secondMode;
        const labels = { sin:['sin','sin⁻¹'], cos:['cos','cos⁻¹'], tan:['tan','tan⁻¹'],
                         sinh:['sinh','sinh⁻¹'], cosh:['cosh','cosh⁻¹'], tanh:['tanh','tanh⁻¹'] };
        document.querySelectorAll('.keypad-sci .key-btn[data-action]').forEach(b => {
          const a = b.dataset.action;
          if (labels[a]) {
            b.textContent = state.secondMode ? labels[a][1] : labels[a][0];
            b.classList.toggle('second-active', state.secondMode);
          }
        });
        const invBtn = document.querySelector('.keypad-sci .second-toggle');
        if (invBtn) invBtn.classList.toggle('second-active', state.secondMode);
        return;
      }

      // Letters a-z (for ABC panel and graphing variables)
      if (/^[a-zA-Z]$/.test(action) && action.length === 1) {
        const ch = state.shiftOn ? action.toUpperCase() : action;
        state.expression = state.expression.slice(0, state.cursorPos) + ch + state.expression.slice(state.cursorPos);
        state.cursorPos += 1;
        state.justGotResult = false;
        state.displayValue = '';
        display.classList.remove('err');
        updateDisplay();
      }
    }

    // ── Ripple effect on key presses (like modern web calculators) ──
    function spawnRipple(e, btn) {
      const old = btn.querySelector('.ripple');   // avoid stacking ripples on fast clicks
      if (old) old.remove();
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 2.2;
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;
      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = x + 'px';
      ripple.style.top = y + 'px';
      btn.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove());
      setTimeout(() => ripple.remove(), 600);  // Fallback cleanup (e.g. reduced-motion, no animationend)
    }

    // ── Key press sounds (Web Audio API — no audio files needed) ──
    let soundOn = localStorage.getItem('calc-sound') !== 'off';
    const soundBtn = document.getElementById('soundToggle');
    let audioCtx = null;

    function playKeySound(isEquals) {
      if (!soundOn) return;
      try {
        audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(isEquals ? 988 : 440, now);   // B5 for =, A4 for keys
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.09);
      } catch (err) { /* audio unavailable — ignore */ }
    }

    // Little rising chime for special results (67 / 69 confetti moment)
    function playChime() {
      if (!soundOn) return;
      try {
        audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        const now = audioCtx.currentTime;
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {   // C5 → E5 → G5 → C6
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.value = f;
          const t = now + i * 0.09;
          gain.gain.setValueAtTime(0.001, t);
          gain.gain.exponentialRampToValueAtTime(0.09, t + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
          osc.connect(gain).connect(audioCtx.destination);
          osc.start(t);
          osc.stop(t + 0.4);
        });
      } catch (err) { /* audio unavailable — ignore */ }
    }

    // ── Odometer-style rolling result digits when = is pressed ──
    function animateOdometer(text) {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const chars = String(text).split('');
      displayValue.textContent = '';
      chars.forEach((ch, i) => {
        const span = document.createElement('span');
        span.className = 'odometer-digit';
        span.style.animationDelay = (i * 0.025) + 's';
        span.textContent = ch;
        displayValue.appendChild(span);
      });
    }

    // ── Confetti burst inside the display for special answers (67 / 69) ──
    function spawnConfetti() {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const colors = ['#58a6ff', '#d29922', '#56d364', '#f85149', '#bc8cff', '#ff7b72', '#f0f6fc'];
      for (let i = 0; i < 36; i++) {
        const c = document.createElement('span');
        c.className = 'confetti-piece';
        c.style.left = (Math.random() * 100) + '%';
        c.style.top = (-4 - Math.random() * 16) + 'px';
        c.style.width = (5 + Math.random() * 4) + 'px';
        c.style.height = (8 + Math.random() * 6) + 'px';
        c.style.background = colors[Math.floor(Math.random() * colors.length)];
        c.style.borderRadius = Math.random() < 0.3 ? '50%' : '2px';
        c.style.animationDelay = (Math.random() * 0.35) + 's';
        c.style.animationDuration = (0.8 + Math.random() * 0.6) + 's';
        display.appendChild(c);
        c.addEventListener('animationend', () => c.remove());
        setTimeout(() => c.remove(), 2400);   // fallback cleanup (e.g. reduced-motion)
      }
    }

    // Toggle sound on/off and sync every 🔊 button (header toggle + graph
    // keypad Audio key). Exported so graph.js can wire the keypad key.
    function toggleSound() {
      soundOn = !soundOn;
      localStorage.setItem('calc-sound', soundOn ? 'on' : 'off');
      document.querySelectorAll('[data-action="audio"]').forEach(b => {
        b.textContent = soundOn ? '🔊' : '🔇';
        b.classList.toggle('muted', !soundOn);
      });
      if (soundBtn) soundBtn.textContent = soundOn ? '🔊' : '🔇';
      if (soundOn) playKeySound(false);   // confirmation blip
      return soundOn;
    }

    if (soundBtn) {
      soundBtn.textContent = soundOn ? '🔊' : '🔇';
      soundBtn.addEventListener('click', toggleSound);
    }
    // Keep the graph keypad Audio key's icon in sync on load
    document.querySelectorAll('[data-action="audio"]').forEach(b => {
      b.textContent = soundOn ? '🔊' : '🔇';
      b.classList.toggle('muted', !soundOn);
    });

    // ═══════════════════════════════════════════════════════════════
    // THEME TOGGLE (Dark ↔ Light)
    // Persists choice in localStorage so it remembers your preference
    // ═══════════════════════════════════════════════════════════════
    function setTheme(theme) {
      if (theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        themeBtn.textContent = '☀️';
      } else {
        document.documentElement.removeAttribute('data-theme');
        themeBtn.textContent = '🌙';
      }
      localStorage.setItem('calc-theme', theme);
    }
    // ═══════════════════════════════════════════════════════════════
    // EXPORTS (ES module) — what other files may import from ui.js
    // ═══════════════════════════════════════════════════════════════
    // NOTE: switchMode() lives in main.js (not here) so that it can call
    // initGraph() from graph.js without creating a circular import.
    export { calc, display, displayEditor, displayValue, displayResult,
             precisionBtn, precisionLabel, precisionDropdown, angleModeBtn,
             themeBtn, modeLabel, updateDisplay, handleAction, spawnRipple,
             playKeySound, playChime, animateOdometer, spawnConfetti,
             setTheme, toggleSound };

    // ═══════════════════════════════════════════════════════════════
