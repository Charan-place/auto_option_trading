/**
 * trading: "live" uses Groww Trade API (server-side only).
 * trading: "paper" simulates fills using paperCapital from env or UI.
 */
export type TradingMode = "live" | "paper";

export function getTradingMode(): TradingMode {
  const v = (process.env.TRADING ?? "paper").toLowerCase();
  return v === "live" ? "live" : "paper";
}

export function getPaperCapital(): number {
  const n = Number(process.env.PAPER_CAPITAL ?? "100000");
  return Number.isFinite(n) && n > 0 ? n : 100000;
}

export function getMaxRiskPerTradePct(): number {
  const n = Number(process.env.MAX_RISK_PER_TRADE_PCT ?? "1");
  return Number.isFinite(n) && n > 0 ? Math.min(n, 5) : 1;
}

/** Max loss vs day-start equity (IST) before paper auto-entries stop. Default 3%. */
export function getMaxDailyLossPct(): number {
  const n = Number(process.env.MAX_DAILY_LOSS_PCT ?? "3");
  return Number.isFinite(n) && n > 0 ? Math.min(n, 20) : 3;
}

export function getMaxOpenPositions(): number {
  const n = Number(process.env.MAX_OPEN_POSITIONS ?? "3");
  return Number.isFinite(n) && n >= 0 ? Math.min(Math.floor(n), 20) : 3;
}

export function isKillSwitchOn(): boolean {
  return String(process.env.KILL_SWITCH ?? "").trim() === "1";
}

export function isOrderDryRun(): boolean {
  return String(process.env.ORDER_DRY_RUN ?? "1").trim() === "1";
}

export function getOrderApiSecret(): string | null {
  const s = process.env.ORDER_API_SECRET?.trim();
  return s && s.length >= 8 ? s : null;
}

export const UNDERLYINGS = ["NIFTY", "BANKNIFTY", "SENSEX"] as const;
export type Underlying = (typeof UNDERLYINGS)[number];
