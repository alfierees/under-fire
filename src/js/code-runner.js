// ── Code Runner ────────────────────────────────────────────────────────────
// A pseudo-code "terminal" that the user executes (Enter or ▶ Run) to reveal
// a chart animation. Renders the lines with syntax highlighting, then reveals
// them one-by-one with a typing delay, then calls onRun() so the page can
// play its chart reveal.
//
// Usage:
//   mountCodeRunner({
//     mount: '#my-runner',           // selector for the container
//     file:  'build_timeline.js',    // shown in the header
//     lines: [
//       { text: '// Load weekly alert totals', kind: 'cm' },
//       { text: 'data = load("timeline_weekly.json")', kind: 'code' },
//       ...
//     ],
//     onRun: () => { /* trigger the chart animation */ }
//   });
//
// Line kinds:
//   'cm'    — whole line rendered as a comment
//   'code'  — line auto-tokenized via highlight()
//   raw html accepted via { html: '...' }

(function () {
  const KW = /\b(let|const|var|function|return|if|for|await|async|import|from|export|new|true|false|null|draw|load|animate|reveal|filter|on|map|select|append|scale|axis|area|stack)\b/g;
  const STR = /(["'`])(?:(?=(\\?))\2.)*?\1/g;
  const NUM = /\b(\d+(\.\d+)?)\b/g;
  const FN  = /\b([a-zA-Z_][a-zA-Z0-9_]*)(?=\()/g;

  function escapeHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function highlight(src) {
    // Preserve strings first via placeholders
    const strings = [];
    let safe = escapeHtml(src).replace(STR, m => {
      strings.push(m);
      return `__STR${strings.length - 1}__`;
    });
    safe = safe
      .replace(KW, '<span class="kw">$1</span>')
      .replace(NUM, '<span class="num">$1</span>')
      .replace(FN, '<span class="fn">$1</span>');
    safe = safe.replace(/__STR(\d+)__/g, (_, i) => `<span class="str">${strings[+i]}</span>`);
    return safe;
  }

  function renderLine(line) {
    if (line.html) return line.html;
    if (line.kind === 'cm') return `<span class="cm">${escapeHtml(line.text)}</span>`;
    return highlight(line.text);
  }

  window.mountCodeRunner = function (opts) {
    const root = document.querySelector(opts.mount);
    if (!root) return null;

    const lines = opts.lines || [];
    const linesHtml = lines.map(l =>
      `<div class="code-line">${renderLine(l)}</div>`
    ).join('');

    root.classList.add('code-runner');
    root.innerHTML = `
      <div class="code-runner-header">
        <div class="code-runner-title">
          <span class="dot d1"></span><span class="dot d2"></span><span class="dot d3"></span>
          <span class="file">${opts.file || 'chart.js'}</span>
        </div>
        <button class="code-runner-run" type="button">▶ Run</button>
      </div>
      <div class="code-runner-body">
        ${linesHtml}
        <div class="code-runner-prompt">
          <span class="cursor-blink"></span>
          <span>press <kbd>⏎ Enter</kbd> or click <kbd>▶ Run</kbd> to execute</span>
        </div>
      </div>`;

    const runBtn = root.querySelector('.code-runner-run');
    const lineEls = Array.from(root.querySelectorAll('.code-line'));
    let ran = false;

    function run() {
      if (ran) return;
      ran = true;
      root.classList.add('ran');
      runBtn.classList.add('ran');
      runBtn.textContent = '✓ Executed';

      // Reveal lines sequentially
      const perLine = 220;
      lineEls.forEach((el, i) => {
        setTimeout(() => el.classList.add('active'), i * perLine);
      });
      // Trigger chart animation after all lines are revealed
      const totalDelay = lineEls.length * perLine + 250;
      setTimeout(() => { opts.onRun && opts.onRun(); }, totalDelay);
    }

    runBtn.addEventListener('click', run);

    // Enter key triggers run if the runner is on-screen and not yet run
    function onKey(e) {
      if (ran) return;
      if (e.key !== 'Enter') return;
      // Ignore if user is typing in an input or focused on a button elsewhere
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const rect = root.getBoundingClientRect();
      const inView = rect.top < window.innerHeight && rect.bottom > 0;
      if (!inView) return;
      e.preventDefault();
      run();
    }
    window.addEventListener('keydown', onKey);

    return { run, element: root };
  };
})();
