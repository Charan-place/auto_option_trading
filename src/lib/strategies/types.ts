import type { Underlying } from "../config";

export type StrategyId =
  | "bull_call_spread"
  | "bear_put_spread"
  | "iron_condor"
  | "calendar_spread"
  | "momentum_debit";

/** Bounded adjustments from offline trade stats; see `learn.ts`. */
export interface LearnAdjustments {
  strategyConfidenceDelta: Partial<Record<StrategyId, number>>;
  /** Added to base entry threshold (higher = harder to enter). */
  entryThresholdDelta: number;
}

export interface MarketContext {
  underlying: Underlying;
  spot: number;
  closes: number[];
  highs: number[];
  lows: number[];
  ivRank?: number;
  /** Bounded boosts from closed-trade statistics (not predictive of live markets). */
  learning?: LearnAdjustments;
}

export type SignalBias = "bullish" | "bearish" | "neutral" | "skip";

export interface StrategySignal {
  strategyId: StrategyId;
  name: string;
  bias: SignalBias;
  rationale: string;
  /** 0–1 after rules + learning delta (clamped). */
  confidence: number;
  /** Raw model confidence before learning adjustment (for UI). */
  baseConfidence?: number;
}
