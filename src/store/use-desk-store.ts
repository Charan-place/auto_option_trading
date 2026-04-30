"use client";

import { create } from "zustand";
import type { DashboardPayload } from "@/types/dashboard";

interface DeskState {
  underlying: string;
  autoPaper: boolean;
  useStream: boolean;
  sessionId: string;
  payload: DashboardPayload | null;
  error: string | null;
  pollMs: number;
  setUnderlying: (u: string) => void;
  setAutoPaper: (v: boolean) => void;
  setUseStream: (v: boolean) => void;
  setPaperCapitalInput: (n: number) => void;
  paperCapitalInput: number;
  fetchDashboard: () => Promise<void>;
  resetSession: () => void;
  resetPaperBook: () => Promise<void>;
}

function paperQs(get: () => DeskState): URLSearchParams {
  const { underlying, sessionId, autoPaper, paperCapitalInput } = get();
  return new URLSearchParams({
    underlying,
    sessionId,
    auto: autoPaper ? "1" : "0",
    paperCapital: String(
      Number.isFinite(paperCapitalInput) && paperCapitalInput > 0
        ? Math.round(paperCapitalInput)
        : 100000
    ),
  });
}

export const useDeskStore = create<DeskState>((set, get) => ({
  underlying: "NIFTY",
  autoPaper: false,
  useStream: true,
  sessionId:
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `sess-${Date.now()}`,
  payload: null,
  error: null,
  pollMs: 2500,
  paperCapitalInput: 100000,
  setUnderlying: (u) => set({ underlying: u }),
  setAutoPaper: (v) => set({ autoPaper: v }),
  setUseStream: (v) => set({ useStream: v }),
  setPaperCapitalInput: (n) => set({ paperCapitalInput: n }),
  fetchDashboard: async () => {
    try {
      const q = paperQs(get);
      const res = await fetch(`/api/dashboard?${q}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = (await res.json()) as DashboardPayload;
      set({ payload, error: null });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Fetch failed" });
    }
  },
  resetSession: () => {
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `sess-${Date.now()}`;
    set({ sessionId: id });
    void get().fetchDashboard();
  },
  resetPaperBook: async () => {
    const q = paperQs(get);
    q.set("reset", "1");
    const res = await fetch(`/api/dashboard?${q}`, { cache: "no-store" });
    if (res.ok) {
      const payload = (await res.json()) as DashboardPayload;
      set({ payload, error: null });
    }
  },
}));
