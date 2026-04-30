import { mkdir, readFile, writeFile, appendFile } from "fs/promises";
import path from "path";
import type { LearnAdjustments, StrategyId } from "./strategies/types";

const DATA_DIR = path.join(process.cwd(), "data");
const STATE_PATH = path.join(DATA_DIR, "learn-state.json");
const LOG_PATH = path.join(DATA_DIR, "learn-trades.jsonl");

export interface ClosedTradeForLearn {
  id: string;
  strategyId: StrategyId;
  pnl: number;
  underlying: string;
  closedAt: string;
}

interface StrategyStats {
  n: number;
  sumPnl: number;
  wins: number;
}

interface LearnStateFile {
  version: 1;
  updatedAt: string;
  byStrategy: Partial<Record<StrategyId, StrategyStats>>;
}

const EMPTY: LearnStateFile = {
  version: 1,
  updatedAt: new Date(0).toISOString(),
  byStrategy: {},
};

async function ensureDataDir(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
}

async function readState(): Promise<LearnStateFile> {
  try {
    const raw = await readFile(STATE_PATH, "utf8");
    const p = JSON.parse(raw) as LearnStateFile;
    if (p?.version === 1 && p.byStrategy) return p;
  } catch {
    /* missing */
  }
  return { ...EMPTY, byStrategy: { ...EMPTY.byStrategy } };
}

function winRate(stats: StrategyStats): number {
  return stats.n > 0 ? stats.wins / stats.n : 0.5;
}

function avgPnl(stats: StrategyStats): number {
  return stats.n > 0 ? stats.sumPnl / stats.n : 0;
}

/**
 * Map recent performance to small bounded deltas (does not guarantee edge).
 */
export function adjustmentsFromState(state: LearnStateFile): LearnAdjustments {
  const strategyConfidenceDelta: Partial<Record<StrategyId, number>> = {};
  let entryThresholdDelta = 0;

  const ids = Object.keys(state.byStrategy) as StrategyId[];
  if (ids.length === 0) {
    return { strategyConfidenceDelta: {}, entryThresholdDelta: 0 };
  }

  let poor = 0;
  let strong = 0;
  for (const id of ids) {
    const st = state.byStrategy[id];
    if (!st || st.n < 3) continue;
    const wr = winRate(st);
    const ap = avgPnl(st);
    let d = 0;
    if (wr >= 0.55 && ap >= 0) d = Math.min(0.08, 0.02 + (wr - 0.5) * 0.25);
    else if (wr <= 0.45 || ap < 0) d = Math.max(-0.1, -0.03 + (0.45 - wr) * 0.2);
    d = Math.max(-0.1, Math.min(0.1, d));
    strategyConfidenceDelta[id] = d;
    if (d < -0.02) poor++;
    if (d > 0.02) strong++;
  }

  if (poor >= 2) entryThresholdDelta += 0.03;
  if (strong >= 2) entryThresholdDelta -= 0.02;
  entryThresholdDelta = Math.max(-0.04, Math.min(0.06, entryThresholdDelta));

  return { strategyConfidenceDelta, entryThresholdDelta };
}

export async function loadLearnAdjustments(): Promise<LearnAdjustments> {
  const st = await readState();
  return adjustmentsFromState(st);
}

function mergeClosed(
  prev: Partial<Record<StrategyId, StrategyStats>>,
  trades: ClosedTradeForLearn[]
): Partial<Record<StrategyId, StrategyStats>> {
  const next = { ...prev };
  for (const t of trades) {
    const cur = next[t.strategyId] ?? { n: 0, sumPnl: 0, wins: 0 };
    cur.n += 1;
    cur.sumPnl += t.pnl;
    if (t.pnl > 0) cur.wins += 1;
    next[t.strategyId] = cur;
  }
  return next;
}

/**
 * Persist outcomes and refresh aggregates in parallel (I/O bound).
 */
export async function recordClosedTradesParallel(
  trades: ClosedTradeForLearn[]
): Promise<void> {
  if (trades.length === 0) return;
  await ensureDataDir();
  const lines = trades.map((t) => JSON.stringify(t)).join("\n") + "\n";
  const writeState = async () => {
    const prev = await readState();
    const merged: LearnStateFile = {
      version: 1,
      updatedAt: new Date().toISOString(),
      byStrategy: mergeClosed(prev.byStrategy, trades),
    };
    await writeFile(STATE_PATH, JSON.stringify(merged, null, 2), "utf8");
  };
  await Promise.all([appendFile(LOG_PATH, lines, "utf8"), writeState()]);
}
