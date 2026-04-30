/** Close-only indicator helpers for signal generation. */

export function ema(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0];
  out.push(prev);
  for (let i = 1; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

export function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1];
    if (ch >= 0) gains += ch;
    else losses -= ch;
  }
  const avgG = gains / period;
  const avgL = losses / period;
  if (avgL === 0) return 100;
  const rs = avgG / avgL;
  return 100 - 100 / (1 + rs);
}

export function macd(
  closes: number[],
  fast = 12,
  slow = 26,
  signal = 9
): { line: number; signal: number; hist: number } | null {
  if (closes.length < slow + signal) return null;
  const ef = ema(closes, fast);
  const es = ema(closes, slow);
  const line = ef[ef.length - 1] - es[es.length - 1];
  const histSeries: number[] = [];
  for (let i = slow; i < closes.length; i++) {
    const l = ef[i] - es[i];
    histSeries.push(l);
  }
  const sigArr = ema(histSeries, signal);
  const sig = sigArr[sigArr.length - 1];
  return { line, signal: sig, hist: line - sig };
}

export function bollinger(
  closes: number[],
  period = 20,
  mult = 2
): { mid: number; upper: number; lower: number } | null {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  const mid = slice.reduce((a, b) => a + b, 0) / period;
  const variance =
    slice.reduce((a, x) => a + (x - mid) ** 2, 0) / period;
  const sd = Math.sqrt(variance);
  return { mid, upper: mid + mult * sd, lower: mid - mult * sd };
}

export function atr(highs: number[], lows: number[], closes: number[], period = 14): number | null {
  if (highs.length !== lows.length || highs.length !== closes.length) return null;
  if (highs.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < highs.length; i++) {
    const h = highs[i];
    const l = lows[i];
    const pc = closes[i - 1];
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  const slice = trs.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}
