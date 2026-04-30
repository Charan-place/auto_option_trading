import type { Underlying } from "./config";

export type Side = "BUY" | "SELL";

export interface RiskBracket {
  takeProfitPct: number;
  stopLossPct: number;
  maxPremiumOutlay: number;
}

/** Conservative defaults: tight SL vs TP ratio for long premium. */
export function defaultBracket(
  underlying: Underlying,
  spotApprox: number
): RiskBracket {
  const base = underlying === "BANKNIFTY" ? 0.35 : underlying === "SENSEX" ? 0.28 : 0.32;
  return {
    takeProfitPct: Math.min(45, base * 1.8 + 12),
    stopLossPct: Math.min(22, base + 8),
    maxPremiumOutlay: Math.round(spotApprox * 0.004),
  };
}

export function sizeLotsByRisk(
  capital: number,
  riskPct: number,
  premiumPerLot: number,
  lotSize: number
): number {
  if (premiumPerLot <= 0 || lotSize <= 0) return 0;
  const riskBudget = (capital * riskPct) / 100;
  const maxLots = Math.floor(riskBudget / (premiumPerLot * lotSize));
  return Math.max(0, Math.min(maxLots, 5));
}
