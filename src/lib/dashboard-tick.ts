import {
  getMaxDailyLossPct,
  getMaxOpenPositions,
  getMaxRiskPerTradePct,
  getPaperCapital,
  getTradingMode,
  isKillSwitchOn,
  type Underlying,
} from "@/lib/config";
import { defaultBracket, sizeLotsByRisk } from "@/lib/risk";
import { growwGetQuote } from "@/lib/groww";
import {
  getPaperState,
  markPaperPositions,
  openPaperPosition,
  paperAllowsNewTrades,
  resetPaperState,
  touchPaperRisk,
} from "@/lib/paper-ledger";
import {
  loadLearnAdjustments,
  recordClosedTradesParallel,
  type ClosedTradeForLearn,
} from "@/lib/learn";
import { runAllStrategies } from "@/lib/strategies";
import { nextSynthSnapshot } from "@/lib/synth-market";
import type { StrategyId } from "@/lib/strategies/types";
import type { DashboardPayload } from "@/types/dashboard";

export interface DashboardTickInput {
  underlying: Underlying;
  sessionId: string;
  auto: boolean;
  paperCapital: number;
  reset: boolean;
}

export async function buildDashboardPayload(
  inp: DashboardTickInput
): Promise<DashboardPayload> {
  const trading = getTradingMode();
  const envPaper = getPaperCapital();
  const riskPct = getMaxRiskPerTradePct();
  const maxDailyLossPct = getMaxDailyLossPct();
  const maxOpen = getMaxOpenPositions();
  const killSwitch = isKillSwitchOn();

  const paperCapital =
    Number.isFinite(inp.paperCapital) && inp.paperCapital > 0
      ? inp.paperCapital
      : envPaper;

  if (inp.reset) {
    resetPaperState(inp.sessionId, paperCapital);
  }

  const learnAdj = await loadLearnAdjustments();
  const baseEntry = 0.55 + learnAdj.entryThresholdDelta;
  const entryThreshold = Math.max(0.45, Math.min(0.65, baseEntry));

  const synth = nextSynthSnapshot(inp.sessionId, inp.underlying);
  let spot = synth.spot;
  const closes = [...synth.closes];
  const highs = [...synth.highs];
  const lows = [...synth.lows];
  const token = process.env.GROWW_ACCESS_TOKEN;
  if (trading === "live" && token) {
    try {
      const sym =
        inp.underlying === "BANKNIFTY"
          ? "BANKNIFTY"
          : inp.underlying === "SENSEX"
            ? "SENSEX"
            : "NIFTY";
      const q = (await growwGetQuote(
        { accessToken: token },
        { exchange: "NSE", segment: "CASH", tradingSymbol: sym }
      )) as { ltp?: number; last_price?: number; close?: number };
      const ltp = Number(q.ltp ?? q.last_price ?? q.close);
      if (Number.isFinite(ltp) && ltp > 0) {
        spot = Math.round(ltp);
        const i = closes.length - 1;
        closes[i] = spot;
        highs[i] = Math.max(highs[i], spot);
        lows[i] = Math.min(lows[i], spot);
      }
    } catch {
      /* synth */
    }
  }

  const ivRank = Math.round(30 + Math.random() * 40);

  const signals = await Promise.all(
    runAllStrategies({
      underlying: inp.underlying,
      spot,
      closes,
      highs,
      lows,
      ivRank,
      learning: learnAdj,
    }).map((s) => Promise.resolve(s))
  );

  const multipliers: Record<string, number> = {};
  const stPre = getPaperState(inp.sessionId, paperCapital);
  for (const p of stPre.positions) {
    multipliers[p.id] = 1 + (Math.random() - 0.48) * 0.06;
  }

  const { closed, unrealized } = markPaperPositions(
    inp.sessionId,
    paperCapital,
    multipliers
  );

  if (closed.length > 0) {
    const forLearn: ClosedTradeForLearn[] = closed.map((c) => ({
      id: c.id,
      strategyId: c.strategyId,
      pnl: c.pnl,
      underlying: c.underlying,
      closedAt: c.closedAt,
    }));
    await recordClosedTradesParallel(forLearn);
  }

  const st2 = getPaperState(inp.sessionId, paperCapital);
  const openMults: Record<string, number> = {};
  for (const p of st2.positions) {
    openMults[p.id] = multipliers[p.id] ?? 1;
  }
  const positionsMtm = st2.positions.reduce(
    (a, p) => a + p.notionalPremium * (openMults[p.id] ?? 1),
    0
  );
  const equity = st2.cash + positionsMtm;

  touchPaperRisk(st2, equity, maxDailyLossPct);

  const dailyPnlPct =
    st2.riskDayOpenEquity > 0
      ? ((equity - st2.riskDayOpenEquity) / st2.riskDayOpenEquity) * 100
      : null;

  let opened: string | null = null;
  const canAuto =
    trading === "paper" &&
    inp.auto &&
    !killSwitch &&
    paperAllowsNewTrades(st2) &&
    st2.positions.length < maxOpen;

  if (canAuto) {
    const best = signals
      .filter((s) => s.bias !== "skip" && s.confidence >= entryThreshold)
      .sort((a, b) => b.confidence - a.confidence)[0];
    if (best) {
      const bracket = defaultBracket(inp.underlying, spot);
      const premium = Math.max(
        500,
        bracket.maxPremiumOutlay * (0.8 + Math.random() * 0.4)
      );
      const lots = sizeLotsByRisk(st2.cash, riskPct, premium, 1);
      if (lots >= 1 && st2.cash > premium * 1.05) {
        openPaperPosition(inp.sessionId, paperCapital, {
          underlying: inp.underlying,
          strategyId: best.strategyId as StrategyId,
          legs: [
            {
              symbol: `${inp.underlying}-WEEKLY-CE`,
              side: "BUY",
              qty: 1,
              price: premium,
            },
          ],
          stopLossPct: bracket.stopLossPct,
          takeProfitPct: bracket.takeProfitPct,
          notionalPremium: premium,
        });
        opened = best.strategyId;
      }
    }
  }

  const st3 = getPaperState(inp.sessionId, paperCapital);
  const openMults2: Record<string, number> = {};
  for (const p of st3.positions) {
    openMults2[p.id] = multipliers[p.id] ?? 1;
  }
  const positionsMtm2 = st3.positions.reduce(
    (a, p) => a + p.notionalPremium * (openMults2[p.id] ?? 1),
    0
  );
  const equity2 = st3.cash + positionsMtm2;

  return {
    trading,
    underlying: inp.underlying,
    spot,
    ivRank,
    signals,
    paper: {
      capital: st3.capital,
      cash: st3.cash,
      realizedPnl: st3.realizedPnl,
      unrealizedPnl: unrealized,
      equity: equity2,
      positions: st3.positions,
      recentClosed: st3.closedTrades.slice(-8),
    },
    live: {
      growwConfigured: Boolean(process.env.GROWW_ACCESS_TOKEN),
      note:
        trading === "live"
          ? "Orders must be sent server-side with a valid subscription and F&O-enabled account."
          : "Paper mode uses simulated prices and fills.",
    },
    lastAction: opened,
    risk: {
      killSwitch,
      dailyHalted: st3.tradingHalted,
      haltMessage: st3.haltMessage,
      dailyPnlPct,
      maxDailyLossPct,
      maxOpenPositions: maxOpen,
    },
    learning: {
      entryThreshold,
      hint:
        "Confidence tweaks come from your paper book closes in data/learn-state.json — bounded, not a guarantee of future performance.",
    },
  };
}
