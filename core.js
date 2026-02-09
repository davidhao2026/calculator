(function (global) {
  'use strict';

  function isDigit(ch) {
    return ch >= '0' && ch <= '9';
  }

  function normalizeExpression(expr) {
    // reject invalid chars early
    const ok = /^[0-9+\-*/().%\s]|s|q|r|t$/i;
    for (const ch of expr) {
      if (ok.test(ch)) continue;
      // allow letters in 'sqrt'
      if (/[a-z]/i.test(ch)) continue;
      throw new Error('表达式包含不支持的字符');
    }
    return expr.replaceAll(' ', '');
  }

  function tokenize(expr) {
    const tokens = [];
    let i = 0;

    const push = (t) => tokens.push(t);

    while (i < expr.length) {
      const ch = expr[i];

      if (ch === ' ') {
        i++;
        continue;
      }

      if (isDigit(ch) || ch === '.') {
        let j = i + 1;
        while (j < expr.length && (isDigit(expr[j]) || expr[j] === '.')) j++;
        const raw = expr.slice(i, j);
        if (raw === '.') throw new Error('无效数字');
        const num = Number(raw);
        if (!Number.isFinite(num)) throw new Error('数字超出范围');
        push({ type: 'num', value: num });
        i = j;
        continue;
      }

      if (ch === '(' || ch === ')') {
        push({ type: 'paren', value: ch });
        i++;
        continue;
      }

      if ('+-*/'.includes(ch)) {
        push({ type: 'op', value: ch });
        i++;
        continue;
      }

      if (ch === '%') {
        push({ type: 'op', value: '%' });
        i++;
        continue;
      }

      if (/[a-z]/i.test(ch)) {
        const rest = expr.slice(i).toLowerCase();
        if (rest.startsWith('sqrt')) {
          push({ type: 'func', value: 'sqrt' });
          i += 4;
          continue;
        }
        throw new Error('不支持的函数');
      }

      throw new Error('无法解析表达式');
    }

    return tokens;
  }

  function toRpn(tokens) {
    const output = [];
    const stack = [];

    const prec = (op) => {
      switch (op) {
        case '+':
        case '-':
          return 1;
        case '*':
        case '/':
          return 2;
        case 'u-':
          return 3;
        case '%':
          return 4; // postfix
        default:
          return 0;
      }
    };

    const isRightAssoc = (op) => op === 'u-';
    const isPostfix = (op) => op === '%';

    let prevType = 'start';

    for (let idx = 0; idx < tokens.length; idx++) {
      const t = tokens[idx];

      if (t.type === 'num') {
        output.push(t);
        prevType = 'value';
        continue;
      }

      if (t.type === 'func') {
        stack.push(t);
        prevType = 'func';
        continue;
      }

      if (t.type === 'paren' && t.value === '(') {
        stack.push(t);
        prevType = 'lparen';
        continue;
      }

      if (t.type === 'paren' && t.value === ')') {
        while (stack.length && !(stack[stack.length - 1].type === 'paren' && stack[stack.length - 1].value === '(')) {
          output.push(stack.pop());
        }
        if (!stack.length) throw new Error('括号不匹配');
        stack.pop();

        if (stack.length && stack[stack.length - 1].type === 'func') {
          output.push(stack.pop());
        }

        prevType = 'value';
        continue;
      }

      if (t.type === 'op') {
        let op = t.value;

        if (op === '-' && (prevType === 'start' || prevType === 'op' || prevType === 'lparen' || prevType === 'func')) {
          op = 'u-';
        }

        if (isPostfix(op)) {
          if (prevType !== 'value') throw new Error('百分号位置不合法');
        }

        while (stack.length) {
          const top = stack[stack.length - 1];
          if (top.type === 'func') {
            output.push(stack.pop());
            continue;
          }
          if (top.type !== 'op') break;

          const topOp = top.value;
          const p1 = prec(op);
          const p2 = prec(topOp);

          if ((isRightAssoc(op) && p1 < p2) || (!isRightAssoc(op) && p1 <= p2)) {
            output.push(stack.pop());
          } else {
            break;
          }
        }

        stack.push({ type: 'op', value: op });
        prevType = op === '%' ? 'value' : 'op';
        continue;
      }

      throw new Error('表达式结构不合法');
    }

    while (stack.length) {
      const t2 = stack.pop();
      if (t2.type === 'paren') throw new Error('括号不匹配');
      output.push(t2);
    }

    return output;
  }

  function evalRpn(rpn) {
    const st = [];

    for (const t of rpn) {
      if (t.type === 'num') {
        st.push(t.value);
        continue;
      }

      if (t.type === 'func') {
        if (t.value === 'sqrt') {
          if (st.length < 1) throw new Error('平方根缺少参数');
          const a = st.pop();
          if (a < 0) throw new Error('平方根参数不能为负数');
          st.push(Math.sqrt(a));
          continue;
        }
        throw new Error('不支持的函数');
      }

      if (t.type === 'op') {
        const op = t.value;
        if (op === 'u-') {
          if (st.length < 1) throw new Error('一元负号缺少参数');
          st.push(-st.pop());
          continue;
        }
        if (op === '%') {
          if (st.length < 1) throw new Error('百分号缺少参数');
          st.push(st.pop() / 100);
          continue;
        }

        if (st.length < 2) throw new Error('运算符缺少参数');
        const b = st.pop();
        const a = st.pop();
        switch (op) {
          case '+':
            st.push(a + b);
            break;
          case '-':
            st.push(a - b);
            break;
          case '*':
            st.push(a * b);
            break;
          case '/':
            if (b === 0) throw new Error('除数不能为 0');
            st.push(a / b);
            break;
          default:
            throw new Error('不支持的运算符');
        }
        continue;
      }

      throw new Error('RPN 结构不合法');
    }

    if (st.length !== 1) throw new Error('表达式不完整');
    const res = st[0];
    if (!Number.isFinite(res)) throw new Error('结果无效');
    return res;
  }

  function evaluateExpression(expr) {
    const normalized = normalizeExpression(expr);
    const tokens = tokenize(normalized);
    const rpn = toRpn(tokens);
    const res = evalRpn(rpn);
    const rounded = Math.round((res + Number.EPSILON) * 1e12) / 1e12;
    return String(rounded);
  }

  function parseBigIntAuto(raw) {
    const s = raw.trim();
    if (!s) throw new Error('请输入要转换的整数');

    const m = s.match(/^([+-])?(.*)$/);
    const sign = m[1] || '';
    const body = m[2];

    if (/^0b[01]+$/i.test(body)) return BigInt(sign + body);
    if (/^0x[0-9a-f]+$/i.test(body)) return BigInt(sign + body);
    if (/^[0-9]+$/.test(body)) return BigInt(sign + body);

    throw new Error('无法自动识别：请使用 0b/0x 前缀或选择输入进制');
  }

  function parseBigIntWithBase(raw, base) {
    const s = raw.trim();
    if (!s) throw new Error('请输入要转换的整数');

    const m = s.match(/^([+-])?(.*)$/);
    const sign = m[1] || '';
    let body = m[2];

    if (base === 2) {
      body = body.replace(/^0b/i, '');
      if (!/^[01]+$/.test(body)) throw new Error('二进制只能包含 0 或 1');
      return BigInt(`${sign}0b${body}`);
    }

    if (base === 16) {
      body = body.replace(/^0x/i, '');
      if (!/^[0-9a-f]+$/i.test(body)) throw new Error('十六进制只能包含 0-9 或 a-f');
      return BigInt(`${sign}0x${body}`);
    }

    if (!/^[0-9]+$/.test(body)) throw new Error('十进制只能包含数字');
    return BigInt(`${sign}${body}`);
  }

  function formatSigned(big) {
    return big.toString(10);
  }

  function formatBin(big) {
    const sign = big < 0n ? '-' : '';
    const abs = big < 0n ? -big : big;
    return sign + '0b' + abs.toString(2);
  }

  function formatHex(big) {
    const sign = big < 0n ? '-' : '';
    const abs = big < 0n ? -big : big;
    return sign + '0x' + abs.toString(16).toUpperCase();
  }

  function convertInteger(raw, baseSel) {
    let v;
    if (baseSel === 'auto') v = parseBigIntAuto(raw);
    else v = parseBigIntWithBase(raw, Number(baseSel));

    return {
      bin: formatBin(v),
      dec: formatSigned(v),
      hex: formatHex(v),
    };
  }

  global.CalculatorCore = {
    evaluateExpression,
    convertInteger,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
