"use client";

import { useEffect, useMemo, useState } from "react";
import { useDeskStore } from "@/store/use-desk-store";
import type { DashboardPayload } from "@/types/dashboard";

const underlyings = [
  { id: "NIFTY", label: "Nifty 50" },
  { id: "BANKNIFTY", label: "Bank Nifty" },
  { id: "SENSEX", label: "Sensex" },
] as const;

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
}

export default function Home() {
  const {
    underlying,
    setUnderlying,
    autoPaper,
    setAutoPaper,
    sessionId,
    payload,
    error,
    pollMs,
    fetchDashboard,
    paperCapitalInput,
    setPaperCapitalInput,
    resetSession,
    resetPaperBook,
    useStream,
    setUseStream,
  } = useDeskStore();

  const [orderSecret, setOrderSecret] = useState("");
  const [orderSymbol, setOrderSymbol] = useState("NIFTY25JAN24500CE");
  const [orderMsg, setOrderMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let es: EventSource | null = null;
    if (useStream) {
      const q = new URLSearchParams({
        underlying,
        sessionId,
        auto: autoPaper ? "1" : "0",
        paperCapital: String(
          Number.isFinite(paperCapitalInput) && paperCapitalInput > 0
            ? Math.round(paperCapitalInput)
            : 100000
        ),
      });
      es = new EventSource(`/api/stream?${q}`);
      es.onmessage = (ev) => {
        if (cancelled) return;
        try {
          const p = JSON.parse(ev.data) as DashboardPayload;
          useDeskStore.setState({ payload: p, error: null });
        } catch {
          useDeskStore.setState({ error: "Bad stream payload" });
        }
      };
      es.onerror = () => {
        if (!cancelled) useDeskStore.setState({ error: "Live stream disconnected" });
      };
      return () => {
        cancelled = true;
        es?.close();
      };
    }
    void fetchDashboard();
    const t = setInterval(() => void fetchDashboard(), pollMs);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [
    useStream,
    fetchDashboard,
    pollMs,
    underlying,
    autoPaper,
    sessionId,
    paperCapitalInput,
  ]);

  const pnlColor = useMemo(() => {
    if (!payload) return "var(--muted)";
    const u = payload.paper.unrealizedPnl + payload.paper.realizedPnl;
    if (u > 0) return "var(--profit)";
    if (u < 0) return "var(--loss)";
    return "var(--muted)";
  }, [payload]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <p className="text-sm text-[var(--warn)]">
          Not investment advice. Options can lose 100% of premium. Past or simulated
          performance does not predict future results. Live orders require Groww Trade
          API subscription and compliance with exchange and broker rules.
        </p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight md:text-3xl">
          Index options desk
        </h1>
        <p className="mt-2 max-w-3xl text-[var(--muted)]">
          Five defined-risk style strategies (spreads, condor, calendar, momentum debit)
          with cautious stop-loss and take-profit brackets. The desk logs paper outcomes and
          applies small, bounded confidence tweaks — this is not a guarantee of becoming
          profitable. Set{" "}
          <code className="rounded bg-[var(--surface2)] px-1.5 py-0.5 text-[var(--accent)]">
            TRADING=paper
          </code>{" "}
          or{" "}
          <code className="rounded bg-[var(--surface2)] px-1.5 py-0.5 text-[var(--accent)]">
            TRADING=live
          </code>{" "}
          in <code className="text-[var(--accent)]">.env.local</code> (server only).
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Mode</p>
          <p className="mt-1 text-xl font-semibold capitalize">
            {payload?.trading ?? "…"}
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {payload?.live.note}
          </p>
          {payload?.trading === "live" && !payload.live.growwConfigured && (
            <p className="mt-2 text-sm text-[var(--loss)]">
              Set GROWW_ACCESS_TOKEN on the server for live quotes/orders.
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Spot (sim / feed)</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {payload ? fmt(payload.spot) : "—"}
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            IV rank (synthetic): {payload?.ivRank ?? "—"}%
          </p>
        </div>
        <div
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-colors duration-300"
          style={{ borderColor: pnlColor === "var(--loss)" ? "#3f2024" : undefined }}
        >
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
            Live P&amp;L (paper book)
          </p>
          <p
            className="mt-1 text-2xl font-semibold tabular-nums"
            style={{ color: pnlColor }}
          >
            {payload
              ? fmt(payload.paper.unrealizedPnl + payload.paper.realizedPnl)
              : "—"}
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Equity: {payload ? fmt(payload.paper.equity) : "—"} · Cash:{" "}
            {payload ? fmt(payload.paper.cash) : "—"}
          </p>
        </div>
      </div>

      <section className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="text-lg font-semibold">Controls</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {underlyings.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => setUnderlying(u.id)}
              className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                underlying === u.id
                  ? "border-[var(--accent)] bg-[var(--surface2)] text-[var(--accent)]"
                  : "border-[var(--border)] bg-transparent text-[var(--text)] hover:border-[var(--muted)]"
              }`}
            >
              {u.label}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="text-xs uppercase tracking-wide text-[var(--muted)]">
              Paper starting capital (₹)
            </label>
            <input
              type="number"
              min={10000}
              step={5000}
              value={paperCapitalInput}
              onChange={(e) => setPaperCapitalInput(Number(e.target.value))}
              className="mt-1 block w-44 rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-sm text-[var(--text)]"
            />
            <p className="mt-1 text-xs text-[var(--muted)]">
              Sent on each poll; first request opens the book at this size.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void resetPaperBook()}
            className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm hover:border-[var(--accent)]"
          >
            Reset paper book
          </button>
          <button
            type="button"
            onClick={resetSession}
            className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm hover:border-[var(--accent)]"
          >
            New session ID
          </button>
        </div>
        <label className="mt-4 flex cursor-pointer items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={useStream}
            onChange={(e) => setUseStream(e.target.checked)}
            className="h-4 w-4 rounded border-[var(--border)]"
          />
          <span>
            <strong>Live stream</strong> (server push ~1.5s). Turn off to use slower
            polling only.
          </span>
        </label>
        <label className="mt-2 flex cursor-pointer items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={autoPaper}
            onChange={(e) => setAutoPaper(e.target.checked)}
            className="h-4 w-4 rounded border-[var(--border)]"
          />
          <span>
            Auto-evaluate signals in <strong>paper</strong> mode (simulated fills, max
            open positions from env, risk-capped sizing).
          </span>
        </label>
        {payload?.risk && (
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {payload.risk.killSwitch && (
              <span className="rounded-full bg-red-950 px-3 py-1 text-red-200">
                Kill switch ON — no new entries
              </span>
            )}
            {payload.risk.dailyHalted && (
              <span className="rounded-full bg-amber-950 px-3 py-1 text-amber-200">
                Daily loss guard — paper entries paused today
              </span>
            )}
            <span className="rounded-full bg-[var(--surface2)] px-3 py-1 text-[var(--muted)]">
              Day P&amp;L vs open:{" "}
              {payload.risk.dailyPnlPct != null
                ? `${payload.risk.dailyPnlPct.toFixed(2)}%`
                : "—"}{" "}
              (limit −{payload.risk.maxDailyLossPct}%)
            </span>
          </div>
        )}
        {payload?.learning && (
          <p className="mt-3 text-sm text-[var(--muted)]">
            Learned auto-entry bar:{" "}
            <strong className="text-[var(--accent)]">
              {(payload.learning.entryThreshold * 100).toFixed(1)}%
            </strong>{" "}
            confidence (moves slowly from closed paper trades). {payload.learning.hint}
          </p>
        )}
        {error && (
          <p className="mt-3 text-sm text-[var(--loss)]">{error}</p>
        )}
      </section>

      {payload?.trading === "live" && (
        <section className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-lg font-semibold">Live order probe (Groww)</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Sends <code className="text-[var(--accent)]">POST /api/order</code> with{" "}
            <code className="text-[var(--accent)]">X-Order-Secret</code>. Default{" "}
            <code className="text-[var(--accent)]">ORDER_DRY_RUN=1</code> validates only.
            Never expose secrets in production frontends.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="block text-xs uppercase text-[var(--muted)]">
              ORDER_API_SECRET (dev)
              <input
                type="password"
                value={orderSecret}
                onChange={(e) => setOrderSecret(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-sm"
                autoComplete="off"
              />
            </label>
            <label className="block text-xs uppercase text-[var(--muted)]">
              trading_symbol
              <input
                value={orderSymbol}
                onChange={(e) => setOrderSymbol(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-sm"
              />
            </label>
          </div>
          <button
            type="button"
            className="mt-4 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-slate-950"
            onClick={async () => {
              setOrderMsg(null);
              try {
                const res = await fetch("/api/order", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "X-Order-Secret": orderSecret,
                  },
                  body: JSON.stringify({
                    dry_run: true,
                    trading_symbol: orderSymbol,
                    quantity: 1,
                    price: 0,
                    exchange: "NSE",
                    segment: "FNO",
                    product: "NRML",
                    order_type: "MARKET",
                    transaction_type: "BUY",
                  }),
                });
                const j = await res.json();
                setOrderMsg(JSON.stringify(j, null, 2));
              } catch (e) {
                setOrderMsg(e instanceof Error ? e.message : "failed");
              }
            }}
          >
            Dry-run validate order body
          </button>
          {orderMsg && (
            <pre className="mt-3 max-h-48 overflow-auto rounded-xl bg-black/40 p-3 text-xs">
              {orderMsg}
            </pre>
          )}
        </section>
      )}

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-lg font-semibold">Strategy signals</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            RSI, MACD, Bollinger, ATR-based rules. Parallel evaluation on each tick.
          </p>
          <ul className="mt-4 space-y-3">
            {(payload?.signals ?? []).map((s) => (
              <li
                key={s.strategyId}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{s.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${
                      s.bias === "bullish"
                        ? "bg-emerald-950 text-emerald-400"
                        : s.bias === "bearish"
                          ? "bg-red-950 text-red-300"
                          : s.bias === "neutral"
                            ? "bg-slate-800 text-slate-300"
                            : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {s.bias}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">{s.rationale}</p>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  Confidence: {(s.confidence * 100).toFixed(0)}%
                  {s.baseConfidence != null &&
                    Math.abs(s.confidence - s.baseConfidence) > 0.001 && (
                      <span>
                        {" "}
                        (base {(s.baseConfidence * 100).toFixed(0)}%)
                      </span>
                    )}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-lg font-semibold">Open positions (paper)</h2>
          {payload?.lastAction && (
            <p className="mt-2 text-sm text-[var(--accent)]">
              Last simulated entry: {payload.lastAction}
            </p>
          )}
          <ul className="mt-4 space-y-3">
            {(payload?.paper.positions.length ? payload.paper.positions : []).map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-4 text-sm"
              >
                <div className="flex justify-between font-medium">
                  <span>{p.strategyId.replace(/_/g, " ")}</span>
                  <span className="tabular-nums">₹{fmt(p.notionalPremium)}</span>
                </div>
                <p className="mt-1 text-[var(--muted)]">
                  SL {p.stopLossPct.toFixed(1)}% · TP {p.takeProfitPct.toFixed(1)}%
                </p>
              </li>
            ))}
            {payload && payload.paper.positions.length === 0 && (
              <li className="text-sm text-[var(--muted)]">No open paper positions.</li>
            )}
          </ul>
          <h3 className="mt-6 text-sm font-semibold text-[var(--muted)]">Recent closes</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {(payload?.paper.recentClosed ?? []).map((c) => (
              <li key={c.id} className="flex justify-between gap-2 text-[var(--muted)]">
                <span>
                  {(c.underlying ?? "?")} · {c.strategyId}
                </span>
                <span style={{ color: c.pnl >= 0 ? "var(--profit)" : "var(--loss)" }}>
                  {c.pnl >= 0 ? "+" : ""}
                  {fmt(c.pnl)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="mt-10 text-center text-xs text-[var(--muted)]">
        Session: {sessionId.slice(0, 8)}… ·{" "}
        {useStream ? "SSE ~1.5s" : `Poll every ${pollMs / 1000}s`}
      </footer>
    </main>
  );
}
