import { randomUUID } from "crypto";
import type { StrategyId } from "./strategies/types";

export interface PaperPosition {
  id: string;
  underlying: string;
  strategyId: StrategyId;
  legs: { symbol: string; side: "BUY" | "SELL"; qty: number; price: number }[];
  openedAt: string;
  stopLossPct: number;
  takeProfitPct: number;
  notionalPremium: number;
}

export interface PaperState {
  capital: number;
  cash: number;
  realizedPnl: number;
  positions: PaperPosition[];
  closedTrades: {
    id: string;
    pnl: number;
    closedAt: string;
    strategyId: StrategyId;
    underlying: string;
  }[];
  /** Asia/Kolkata calendar day YYYY-MM-DD for daily loss tracking */
  riskDay: string | null;
  riskDayOpenEquity: number;
  tradingHalted: boolean;
  haltMessage: string | null;
}

const globalKey = "__paperLedger";

function getStore(): Map<string, PaperState> {
  const g = globalThis as unknown as Record<string, Map<string, PaperState>>;
  if (!g[globalKey]) g[globalKey] = new Map();
  return g[globalKey];
}

export function getPaperState(sessionId: string, initialCapital: number): PaperState {
  const store = getStore();
  if (!store.has(sessionId)) {
    store.set(sessionId, {
      capital: initialCapital,
      cash: initialCapital,
      realizedPnl: 0,
      positions: [],
      closedTrades: [],
      riskDay: null,
      riskDayOpenEquity: initialCapital,
      tradingHalted: false,
      haltMessage: null,
    });
  }
  return store.get(sessionId)!;
}

export function resetPaperState(sessionId: string, initialCapital: number): PaperState {
  const store = getStore();
  const fresh: PaperState = {
    capital: initialCapital,
    cash: initialCapital,
    realizedPnl: 0,
    positions: [],
    closedTrades: [],
    riskDay: null,
    riskDayOpenEquity: initialCapital,
    tradingHalted: false,
    haltMessage: null,
  };
  store.set(sessionId, fresh);
  return fresh;
}

export function openPaperPosition(
  sessionId: string,
  initialCapital: number,
  pos: Omit<PaperPosition, "id" | "openedAt">
): PaperPosition {
  const st = getPaperState(sessionId, initialCapital);
  const id = randomUUID();
  const full: PaperPosition = {
    ...pos,
    id,
    openedAt: new Date().toISOString(),
  };
  const cost = pos.notionalPremium;
  st.cash -= cost;
  st.positions.push(full);
  return full;
}

export function markPaperPositions(
  sessionId: string,
  initialCapital: number,
  multipliers: Record<string, number>
): { closed: PaperState["closedTrades"]; unrealized: number } {
  const st = getPaperState(sessionId, initialCapital);
  let unrealized = 0;
  const closed: PaperState["closedTrades"] = [];
  const kept: PaperPosition[] = [];
  for (const p of st.positions) {
    const m = multipliers[p.id] ?? 1;
    const pnlApprox = p.notionalPremium * (m - 1);
    const upnlPct = (pnlApprox / p.notionalPremium) * 100;
    if (upnlPct >= p.takeProfitPct || upnlPct <= -p.stopLossPct) {
      st.cash += p.notionalPremium + pnlApprox;
      st.realizedPnl += pnlApprox;
      closed.push({
        id: p.id,
        pnl: pnlApprox,
        closedAt: new Date().toISOString(),
        strategyId: p.strategyId,
        underlying: p.underlying,
      });
    } else {
      unrealized += pnlApprox;
      kept.push(p);
    }
  }
  st.positions = kept;
  st.closedTrades.push(...closed);
  return { closed, unrealized };
}

export function calendarDayIST(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Roll daily baseline (IST) and enforce max daily drawdown vs day open equity.
 */
export function touchPaperRisk(
  st: PaperState,
  equityNow: number,
  maxDailyLossPct: number
): void {
  const day = calendarDayIST();
  if (st.riskDay !== day) {
    st.riskDay = day;
    st.riskDayOpenEquity = equityNow;
    if (st.haltMessage === "daily_loss") {
      st.tradingHalted = false;
      st.haltMessage = null;
    }
  }
  const base = st.riskDayOpenEquity;
  if (base <= 0 || !Number.isFinite(maxDailyLossPct) || maxDailyLossPct <= 0) return;
  const ddPct = ((equityNow - base) / base) * 100;
  if (!st.tradingHalted && ddPct <= -maxDailyLossPct) {
    st.tradingHalted = true;
    st.haltMessage = "daily_loss";
  }
}

export function paperAllowsNewTrades(st: PaperState): boolean {
  return !st.tradingHalted;
}
