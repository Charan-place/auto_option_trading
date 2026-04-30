import { NextRequest, NextResponse } from "next/server";
import { getPaperCapital } from "@/lib/config";
import { buildDashboardPayload } from "@/lib/dashboard-tick";
import type { Underlying } from "@/lib/config";

export const dynamic = "force-dynamic";

function parseUnderlying(v: string | null): Underlying {
  const u = (v ?? "NIFTY").toUpperCase();
  if (u === "BANKNIFTY" || u === "SENSEX") return u;
  return "NIFTY";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawCap = searchParams.get("paperCapital");
  const parsedCap = rawCap != null ? Number(rawCap) : NaN;
  const envPaper = getPaperCapital();
  const paperCapital =
    Number.isFinite(parsedCap) && parsedCap > 0 ? parsedCap : envPaper;

  const payload = await buildDashboardPayload({
    underlying: parseUnderlying(searchParams.get("underlying")),
    sessionId: searchParams.get("sessionId") ?? "default",
    auto: searchParams.get("auto") === "1",
    paperCapital,
    reset: searchParams.get("reset") === "1",
  });
  return NextResponse.json(payload);
}
