import type { Underlying } from "./config";

const BASE_SPOT: Record<Underlying, number> = {
  NIFTY: 24500,
  BANKNIFTY: 52000,
  SENSEX: 79500,
};

const storeKey = "__synthSpot";

function bucket(sessionId: string, u: Underlying) {
  return `${sessionId}:${u}`;
}

export function nextSynthSnapshot(
  sessionId: string,
  underlying: Underlying,
  historyLen = 80
): { spot: number; closes: number[]; highs: number[]; lows: number[] } {
  const g = globalThis as unknown as Record<string, Record<string, number>>;
  if (!g[storeKey]) g[storeKey] = {};
  const b = bucket(sessionId, underlying);
  const prev = g[storeKey][b] ?? BASE_SPOT[underlying];
  const drift = (Math.random() - 0.48) * (underlying === "BANKNIFTY" ? 42 : 28);
  const spot = Math.max(1000, Math.round(prev + drift));
  g[storeKey][b] = spot;

  const closes: number[] = [];
  const highs: number[] = [];
  const lows: number[] = [];
  let walk = spot - drift * (historyLen / 2);
  for (let i = 0; i < historyLen; i++) {
    walk += (Math.random() - 0.5) * (underlying === "SENSEX" ? 55 : 35);
    const h = walk + Math.random() * 20;
    const l = walk - Math.random() * 20;
    closes.push(Math.round(walk));
    highs.push(Math.round(h));
    lows.push(Math.round(l));
  }
  closes[closes.length - 1] = spot;
  highs[highs.length - 1] = Math.max(highs[highs.length - 1], spot);
  lows[lows.length - 1] = Math.min(lows[lows.length - 1], spot);
  return { spot, closes, highs, lows };
}
