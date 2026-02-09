/* eslint-disable no-alert */

const $ = (sel) => document.querySelector(sel);

function core() {
  if (!window.CalculatorCore) {
    throw new Error('CalculatorCore 未加载：请确认 core.js 已引入');
  }
  return window.CalculatorCore;
}

function setTab(active) {
  const isCalc = active === 'calc';
  $('#tab-calculator').classList.toggle('is-active', isCalc);
  $('#tab-converter').classList.toggle('is-active', !isCalc);
  $('#tab-calculator').setAttribute('aria-selected', String(isCalc));
  $('#tab-converter').setAttribute('aria-selected', String(!isCalc));
  $('#panel-calculator').classList.toggle('is-active', isCalc);
  $('#panel-converter').classList.toggle('is-active', !isCalc);
}

// ---------------- Calculator ----------------

const calcState = {
  expr: '',
  lastResult: null,
};

function prettyExpr(expr) {
  return expr
    .replaceAll('*', '×')
    .replaceAll('/', '÷')
    .replaceAll('-', '−');
}

function renderCalc() {
  $('#expression').textContent = calcState.expr ? prettyExpr(calcState.expr) : '';
  $('#result').textContent = calcState.lastResult ?? '0';
}

function appendValue(value) {
  calcState.expr += value;
}

function clearAll() {
  calcState.expr = '';
  calcState.lastResult = null;
  renderCalc();
}

function backspace() {
  if (!calcState.expr) return;
  if (calcState.expr.endsWith('sqrt(')) {
    calcState.expr = calcState.expr.slice(0, -5);
  } else {
    calcState.expr = calcState.expr.slice(0, -1);
  }
  renderCalc();
}

function findMatchingParenIndex(str, closeIndex) {
  // str[closeIndex] should be ')'
  let depth = 0;
  for (let i = closeIndex; i >= 0; i--) {
    const ch = str[i];
    if (ch === ')') depth++;
    else if (ch === '(') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function wrapLastTerm(fnName) {
  const s = calcState.expr;
  if (!s) return;

  let end = s.length - 1;

  // If ends with a percent sign, wrap the term before it
  if (s[end] === '%') end -= 1;
  if (end < 0) return;

  let start = end;

  if (s[end] === ')') {
    start = findMatchingParenIndex(s, end);
    if (start === -1) return;
  } else {
    // scan a number
    while (start >= 0) {
      const ch = s[start];
      if (isDigit(ch) || ch === '.') start -= 1;
      else break;
    }
    start += 1;
    if (start > end) return;
  }

  const before = s.slice(0, start);
  const term = s.slice(start, end + 1);
  const after = s.slice(end + 1);
  calcState.expr = `${before}${fnName}(${term})${after}`;
  renderCalc();
}

function applyPercent() {
  // Postfix percent: turns last term into (term%) in expression syntax.
  // Our evaluator treats % as /100.
  const s = calcState.expr;
  if (!s) return;
  const last = s[s.length - 1];
  if (last === '%' || last === '(') return;
  if ('+-*/'.includes(last)) return;
  calcState.expr += '%';
  renderCalc();
}

function equals() {
  if (!calcState.expr) return;
  try {
    const value = core().evaluateExpression(calcState.expr);
    calcState.lastResult = value;
    renderCalc();
  } catch (e) {
    calcState.lastResult = 'Error';
    renderCalc();
  }
}

function onKeypadClick(ev) {
  const btn = ev.target.closest('button');
  if (!btn) return;

  const value = btn.getAttribute('data-value');
  const action = btn.getAttribute('data-action');

  if (value) {
    appendValue(value);
    renderCalc();
    return;
  }

  if (action === 'clear') return clearAll();
  if (action === 'backspace') return backspace();
  if (action === 'equals') return equals();
  if (action === 'percent') return applyPercent();
  if (action === 'sqrt') return wrapLastTerm('sqrt');
}

function onKeydown(ev) {
  const activePanelIsCalc = $('#panel-calculator').classList.contains('is-active');
  if (!activePanelIsCalc) return;

  const { key } = ev;

  if (key === 'Enter') {
    ev.preventDefault();
    equals();
    return;
  }

  if (key === 'Backspace') {
    ev.preventDefault();
    backspace();
    return;
  }

  if (key === 'Escape') {
    ev.preventDefault();
    clearAll();
    return;
  }

  if (key === '%') {
    ev.preventDefault();
    applyPercent();
    return;
  }

  if (key === '(' || key === ')' || key === '.' || '+-*/'.includes(key) || isDigit(key)) {
    ev.preventDefault();
    appendValue(key);
    renderCalc();
  }
}

// ---------------- Base Converter ----------------

function setConvOutputs({ bin, dec, hex }) {
  $('#out-bin').textContent = bin;
  $('#out-dec').textContent = dec;
  $('#out-hex').textContent = hex;
}

function setConvError(message) {
  setConvOutputs({ bin: '—', dec: '—', hex: '—' });
  $('#conv-hint').textContent = message;
}

function setConvHintDefault() {
  $('#conv-hint').innerHTML = '提示：进制转换按“整数”处理；支持负数；支持 <span class="mono">0b</span>/<span class="mono">0x</span> 前缀。';
}

function doConvert() {
  try {
    setConvHintDefault();
    const raw = $('#conv-input').value;
    const baseSel = $('#conv-base').value;

    const out = core().convertInteger(raw, baseSel);
    setConvOutputs(out);
  } catch (e) {
    setConvError(e?.message || '转换失败');
  }
}

function clearConvert() {
  $('#conv-input').value = '';
  setConvHintDefault();
  setConvOutputs({ bin: '—', dec: '—', hex: '—' });
}

// ---------------- init ----------------

function init() {
  $('#tab-calculator').addEventListener('click', () => setTab('calc'));
  $('#tab-converter').addEventListener('click', () => setTab('conv'));

  $('.keypad').addEventListener('click', onKeypadClick);
  document.addEventListener('keydown', onKeydown);

  $('#conv-convert').addEventListener('click', doConvert);
  $('#conv-clear').addEventListener('click', clearConvert);
  $('#conv-input').addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') doConvert();
  });

  renderCalc();
  setConvHintDefault();
}

init();
