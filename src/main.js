// ═══════════════════════════════════════════════════════════════════════════════
// main.js — EVENT WIRING & STARTUP (boots the whole calculator)
// ═══════════════════════════════════════════════════════════════════════════════
//
// WHAT LIVES HERE (no logic — just "when X happens, call the right function")
//   • Button clicks    → every .key-btn / .keypad-tab / .mode-tab routes by
//                        data-action / data-mode / data-panel into handleAction()
//   • Physical keyboard → Enter = equals, Backspace = backspace, s→sin, c→cos...
//   • Precision dropdown, angle toggle, theme toggle wiring + saved preferences
//   • Startup          → switchMode('scientific') + initGraph when graphing
//   • switchMode()     — 4-Function / Scientific / Graphing tab switching.
//                        It lives HERE (not ui.js) so it can call initGraph()
//                        from graph.js without creating a circular import.
//
// FILE LOAD ORDER  engine.js → mathml-renderer.js → ui.js → graph.js → main.js
// ═══════════════════════════════════════════════════════════════════════════════

    // ─── IMPORTS (ES module) — what this file needs from the other files ───
    import { state, evaluate, formatResult } from './engine.js';
    import { calc, display, displayEditor, displayValue, displayResult,
             precisionBtn, precisionLabel, precisionDropdown, angleModeBtn,
             themeBtn, modeLabel, updateDisplay, handleAction, spawnRipple,
             setTheme } from './ui.js';
    import { initGraph, renderGraph, handleGraphKeypad } from './graph.js';

    // Read a localStorage value without ever throwing — on file:// some
    // browsers deny storage access outright, so every read must be optional.
    // (Used below at boot for the saved theme + angle mode.)
    function safeGet(key) {
      try { return localStorage.getItem(key); }
      catch (e) { return null; }
    }

    // ─── MODE SWITCHING (4-Function / Scientific / Graphing) ───
    function switchMode(mode) {
      state.calcMode = mode;
      // Reset the calculator display on EVERY mode switch — the previous
      // mode's expression and answer must not leak into the next mode.
      state.expression = '';
      state.displayValue = '';
      state.cursorPos = 0;
      state.justGotResult = false;
      state.fnBuffer = '';
      if (state.fnTimeout) { clearTimeout(state.fnTimeout); state.fnTimeout = null; }
      display.classList.remove('err');
      updateDisplay();
      // Update the calc class to show/hide relevant sections
      calc.className = 'calc mode-' + mode;
      // Update active tab styling
      document.querySelectorAll('.mode-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
      // Update mode label
      const labels = { fourfunction: '4‑Function', scientific: 'Scientific', graphing: 'Graphing' };
      modeLabel.textContent = labels[mode] || mode;

      // Animate the visible panels sliding in on mode switch
      [display, document.querySelector('.keypad-area'), document.querySelector('.graph-view')].forEach(panel => {
        if (!panel) return;
        panel.classList.remove('mode-switch');
        void panel.offsetWidth;                // restart the animation
        panel.classList.add('mode-switch');
      });

      // Initialize the graph canvas when switching to graphing mode
      // (initGraph is idempotent — it only binds listeners once)
      if (mode === 'graphing') initGraph();
    }

    // EVENT WIRING — connect buttons, keyboard, and UI controls
    // ═══════════════════════════════════════════════════════════════

    // All buttons: click triggers handleAction with data-action value
    document.querySelectorAll('.key-btn, .keypad-tab, .mode-tab').forEach(btn => {
      btn.addEventListener('click', (e) => {
        // Resolve the action from data-action (keys), data-mode (mode tabs),
        // or data-panel (keypad panel tabs: Main/ABC/Funct)
        const action = btn.dataset.action || btn.dataset.mode || btn.dataset.panel;
        if (!action) return;

        // Mode tabs: switch calculator mode
        if (['fourfunction','scientific','graphing'].includes(action)) {
          switchMode(action);
          return;
        }

        // Keypad panel tabs (Main, ABC, Funct)
        if (['main','abc','funct'].includes(action)) {
          document.querySelectorAll('.keypad-tab').forEach(t => t.classList.remove('active'));
          const tab = document.querySelector('.keypad-tab[data-panel="' + action + '"]');
          if (tab) tab.classList.add('active');
          document.querySelectorAll('.keypad-panel').forEach(p => p.classList.remove('active'));
          document.getElementById('panel-' + action).classList.add('active');
          return;
        }

        // In graphing mode, route keypad clicks to the graph expression row
        if (state.calcMode === 'graphing') {
          handleGraphKeypad(action);
          btn.classList.add('key-press');
          setTimeout(() => btn.classList.remove('key-press'), 150);
          spawnRipple(e, btn);
          return;
        }

        handleAction(action);
        // Add press animation + ripple
        btn.classList.add('key-press');
        setTimeout(() => btn.classList.remove('key-press'), 150);
        spawnRipple(e, btn);
      });
    });

    // Keyboard support: map physical keys to calculator actions
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;  // Ignore modifier combos

      // Don't hijack typing inside the graph rows, display editor, etc.
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const key = e.key;
      const map = {
        'Enter': 'equals', '=': 'equals',
        'Backspace': 'backspace', 'Delete': 'clear', 'Escape': 'clear',
        '+': 'add', '-': 'subtract', '*': 'multiply', '/': 'divide', '^': 'power',
        '(': 'lparen', ')': 'rparen', '.': 'decimal', '%': 'percent', '!': 'fact',
        'π': 'constant_pi',
      };

      // In graphing mode, route the physical keyboard to the graph keypad
      if (state.calcMode === 'graphing') {
        if (/^[0-9]$/.test(key)) { handleGraphKeypad(key); e.preventDefault(); return; }
        if (key === 'x' || key === 'X') { handleGraphKeypad('x'); e.preventDefault(); return; }
        if (key === 'θ') { handleGraphKeypad('theta'); e.preventDefault(); return; }
        if (/^[a-z]$/i.test(key)) { handleGraphKeypad(key.toLowerCase()); e.preventDefault(); return; }  // letters = slider vars
        // Enter commits the row (like ⏎); '=' maps to the keypad '=' which
        // INSERTS an equals sign — the shared map keys both to
        // 'equals', so override Enter here to keep commit semantics.
        if (key === 'Enter') { handleGraphKeypad('enter'); e.preventDefault(); return; }
        if (map[key]) { handleGraphKeypad(map[key]); e.preventDefault(); return; }
        return;
      }

      // Handle function keys (s, c, t for sin/cos/tan)
      const fnKeys = { 's': 'sin', 'c': 'cos', 't': 'tan', 'l': 'log', 'n': 'ln' };
      if (/^[0-9]$/.test(key)) { handleAction(key); e.preventDefault(); return; }
      if (fnKeys[key] && !state.fnBuffer) { state.fnBuffer = key; state.fnTimeout = setTimeout(() => { state.fnBuffer = ''; }, 500); e.preventDefault(); return; }
      if (fnKeys[key] && state.fnBuffer) {
        const combo = state.fnBuffer + key;  // e.g. 'si' → sin
        const fnMap = { 'si': 'sin', 'co': 'cos', 'ta': 'tan', 'lo': 'log' };
        if (fnMap[combo]) { handleAction(fnMap[combo]); state.fnBuffer = ''; clearTimeout(state.fnTimeout); }
        e.preventDefault(); return;
      }
      if (key === 'r' && state.fnBuffer === 't') { handleAction('tan'); state.fnBuffer = ''; e.preventDefault(); return; }  // 'tr' in buffer could be tan
      if (state.fnBuffer && /^[a-z]$/.test(key)) {
        state.fnBuffer += key;
        const fnMap2 = { 'sin': 'sin', 'cos': 'cos', 'tan': 'tan', 'log': 'log' };
        if (fnMap2[state.fnBuffer]) { handleAction(fnMap2[state.fnBuffer]); state.fnBuffer = ''; clearTimeout(state.fnTimeout); }
        e.preventDefault(); return;
      }

      if (map[key]) { handleAction(map[key]); e.preventDefault(); }
    });

    // ═══════════════════════════════════════════════════════════════
    // PRECISION DROPDOWN
    // ═══════════════════════════════════════════════════════════════
    precisionBtn.addEventListener('click', () => precisionDropdown.classList.toggle('open'));
    document.querySelectorAll('#precisionDropdown .item').forEach(item => {
      item.addEventListener('click', () => {
        state.precision = item.dataset.prec;
        precisionLabel.textContent = item.textContent.trim();
        document.querySelectorAll('#precisionDropdown .item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        precisionDropdown.classList.remove('open');
        // Re-format the current result if there is one
        if (state.displayValue) {
          const result = evaluate(state.expression);
          if (!isNaN(result)) state.displayValue = formatResult(result);
          updateDisplay();
        }
      });
    });
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#precisionWrap')) precisionDropdown.classList.remove('open');
    });

    // ═══════════════════════════════════════════════════════════════
    // ANGLE MODE TOGGLE (RAD ↔ DEG)
    // ═══════════════════════════════════════════════════════════════
    angleModeBtn.addEventListener('click', () => handleAction('angle'));

    // ═══════════════════════════════════════════════════════════════
    // THEME TOGGLE (Dark ↔ Light) — persists in localStorage
    // ═══════════════════════════════════════════════════════════════
    themeBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      setTheme(current === 'light' ? 'dark' : 'light');
      // Spin the toggle for a playful micro-interaction
      themeBtn.classList.remove('spin');
      void themeBtn.offsetWidth;          // restart the animation
      themeBtn.classList.add('spin');
    });
    // Load saved theme on startup. localStorage is wrapped in a try/catch:
    // some browsers throw a SecurityError when the app is opened over file://
    // (the single-file download!), and the app must still boot if storage is
    // blocked — a saved theme is a nice-to-have, not a requirement.
    const savedTheme = safeGet('calc-theme');
    if (savedTheme) setTheme(savedTheme);
    // Load saved angle mode
    const savedAngle = safeGet('calc-angle');
    if (savedAngle) { state.angleMode = savedAngle; angleModeBtn.textContent = savedAngle; }

    // ═══════════════════════════════════════════════════════════════
    // INITIALIZATION — runs on page load
    // ═══════════════════════════════════════════════════════════════

    // Start in scientific mode
    switchMode('scientific');

    // Deep-link: open calculator.html#graph to boot straight into Graphing mode
    // (also handy for browser-automation tests of the graph UI)
    if (location.hash === '#graph') switchMode('graphing');

    // Window resize: re-render graph if visible
    window.addEventListener('resize', () => {
      if (state.calcMode === 'graphing') renderGraph();
    });

    // ── Editor mode (clicking the display to edit directly) ──
    display.addEventListener('click', () => {
      if (state.calcMode === 'graphing') return;
      state.isEditing = true;
      display.classList.add('editing');
      displayEditor.value = state.expression;
      displayEditor.focus();
      displayEditor.setSelectionRange(displayEditor.value.length, displayEditor.value.length);
    });
    displayEditor.addEventListener('blur', () => {
      state.isEditing = false;
      display.classList.remove('editing');
    });
    displayEditor.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        state.expression = displayEditor.value;
        state.cursorPos = state.expression.length;   // Keep cursor in sync after direct editing
        display.classList.remove('editing');
        handleAction('equals');
      }
    });

    console.log('🧮 Calculator loaded! Try sin(45), 3+4*2, or switch to Graphing mode.');
