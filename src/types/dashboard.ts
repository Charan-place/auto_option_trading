import type { StrategySignal } from "@/lib/strategies/types";

export interface DashboardPayload {
  trading: "live" | "paper";
  underlying: string;
  spot: number;
  ivRank: number;
  signals: StrategySignal[];
  paper: {
    capital: number;
    cash: number;
    realizedPnl: number;
    unrealizedPnl: number;
    equity: number;
    positions: {
      id: string;
      underlying: string;
      strategyId: string;
      notionalPremium: number;
      stopLossPct: number;
      takeProfitPct: number;
      openedAt: string;
    }[];
    recentClosed: {
      id: string;
      pnl: number;
      closedAt: string;
      strategyId: string;
      underlying?: string;
    }[];
  };
  live: { growwConfigured: boolean; note: string };
  lastAction: string | null;
  risk: {
    killSwitch: boolean;
    dailyHalted: boolean;
    haltMessage: string | null;
    dailyPnlPct: number | null;
    maxDailyLossPct: number;
    maxOpenPositions: number;
  };
  learning: {
    entryThreshold: number;
    hint: string;
  };
}
