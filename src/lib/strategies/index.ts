import { bollinger, macd, rsi } from "../indicators";
import type {
  LearnAdjustments,
  MarketContext,
  StrategySignal,
} from "./types";
import type { StrategyId } from "./types";

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function applyLearn(
  s: StrategySignal,
  learning?: LearnAdjustments
): StrategySignal {
  const base = s.confidence;
  if (!learning) return { ...s, baseConfidence: base };
  const d = learning.strategyConfidenceDelta[s.strategyId] ?? 0;
  const adj = clamp01(base + d);
  const note =
    Math.abs(d) >= 0.005
      ? ` (book-learned ${d >= 0 ? "+" : ""}${(d * 100).toFixed(1)}% conf.)`
      : "";
  return {
    ...s,
    baseConfidence: base,
    confidence: adj,
    rationale: s.rationale + note,
  };
}

function bullCallSpread(ctx: MarketContext): StrategySignal {
  const r = rsi(ctx.closes);
  const m = macd(ctx.closes);
  let bias: StrategySignal["bias"] = "skip";
  let conf = 0.4;
  let rationale = "RSI/MACD not decisive; skip new bull spread.";
  if (r != null && m != null && r > 48 && r < 68 && m.hist > 0) {
    bias = "bullish";
    conf = 0.62;
    rationale =
      "Trend-friendly: RSI not overbought, MACD histogram positive — defined-risk bull call.";
  }
  return {
    strategyId: "bull_call_spread",
    name: "Bull call spread",
    bias,
    rationale,
    confidence: conf,
  };
}

function bearPutSpread(ctx: MarketContext): StrategySignal {
  const r = rsi(ctx.closes);
  const m = macd(ctx.closes);
  let bias: StrategySignal["bias"] = "skip";
  let conf = 0.4;
  let rationale = "No clean bearish momentum; skip bear put.";
  if (r != null && m != null && r < 52 && r > 32 && m.hist < 0) {
    bias = "bearish";
    conf = 0.6;
    rationale =
      "Weakness: RSI rolling down, MACD hist negative — bear put spread for capped risk.";
  }
  return {
    strategyId: "bear_put_spread",
    name: "Bear put spread",
    bias,
    rationale,
    confidence: conf,
  };
}

function ironCondor(ctx: MarketContext): StrategySignal {
  const b = bollinger(ctx.closes, 20, 2);
  const r = rsi(ctx.closes);
  let bias: StrategySignal["bias"] = "neutral";
  let conf = 0.45;
  let rationale = "Range thesis: sell wings when price hugs middle band.";
  if (!b || r == null) {
    return {
      strategyId: "iron_condor",
      name: "Iron condor",
      bias: "skip",
      rationale: "Insufficient candles for Bollinger/RSI.",
      confidence: 0.2,
    };
  }
  const last = ctx.closes[ctx.closes.length - 1];
  const midDist = Math.abs(last - b.mid) / b.mid;
  if (midDist < 0.004 && r > 42 && r < 58) {
    conf = 0.58;
    rationale =
      "Compression near mid-BB with neutral RSI — short volatility iron condor (defined risk beyond wings).";
  } else {
    bias = "skip";
    rationale = "Trend or extension too strong for neutral iron condor entry.";
    conf = 0.35;
  }
  return {
    strategyId: "iron_condor",
    name: "Iron condor",
    bias,
    rationale,
    confidence: conf,
  };
}

function calendarSpread(ctx: MarketContext): StrategySignal {
  const r = rsi(ctx.closes);
  let bias: StrategySignal["bias"] = "neutral";
  let conf = 0.5;
  let rationale =
    "Calendar: benefit from theta + vol crush on front leg; use when IV elevated vs recent.";
  if (ctx.ivRank != null && ctx.ivRank > 55 && r != null && r > 45 && r < 60) {
    conf = 0.63;
    rationale =
      "IV rank elevated with flat RSI — calendar favors vol normalization.";
  } else if (ctx.ivRank != null && ctx.ivRank < 35) {
    bias = "skip";
    conf = 0.3;
    rationale = "IV rank low; calendar edge weaker — skip.";
  }
  return {
    strategyId: "calendar_spread",
    name: "Calendar spread",
    bias,
    rationale,
    confidence: conf,
  };
}

function momentumDebit(ctx: MarketContext): StrategySignal {
  const m = macd(ctx.closes);
  const r = rsi(ctx.closes);
  let bias: StrategySignal["bias"] = "skip";
  let conf = 0.42;
  let rationale = "Wait for MACD cross + RSI band for directional debit.";
  if (m != null && r != null) {
    if (m.hist > 0 && r > 55 && r < 72) {
      bias = "bullish";
      conf = 0.55;
      rationale =
        "Momentum: long-call / call debit with strict SL (premium can go to zero).";
    } else if (m.hist < 0 && r < 45 && r > 28) {
      bias = "bearish";
      conf = 0.53;
      rationale =
        "Downside momentum: put debit; keep notional small vs capital.";
    }
  }
  return {
    strategyId: "momentum_debit",
    name: "Momentum debit (call/put)",
    bias,
    rationale,
    confidence: conf,
  };
}

const runners: Record<
  StrategyId,
  (ctx: MarketContext) => StrategySignal
> = {
  bull_call_spread: bullCallSpread,
  bear_put_spread: bearPutSpread,
  iron_condor: ironCondor,
  calendar_spread: calendarSpread,
  momentum_debit: momentumDebit,
};

export function runAllStrategies(ctx: MarketContext): StrategySignal[] {
  const { learning, ...core } = ctx;
  return (Object.keys(runners) as StrategyId[]).map((id) =>
    applyLearn(runners[id](core as MarketContext), learning)
  );
}

export { type StrategyId };
