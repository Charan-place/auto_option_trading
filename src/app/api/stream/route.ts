import { NextRequest } from "next/server";
import { getPaperCapital } from "@/lib/config";
import { buildDashboardPayload } from "@/lib/dashboard-tick";
import type { Underlying } from "@/lib/config";

export const dynamic = "force-dynamic";

function parseUnderlying(v: string | null): Underlying {
  const u = (v ?? "NIFTY").toUpperCase();
  if (u === "BANKNIFTY" || u === "SENSEX") return u;
  return "NIFTY";
}

/**
 * Server-Sent Events: repeated dashboard snapshots (Groww-compatible live UI without a browser WebSocket to Groww).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawCap = searchParams.get("paperCapital");
  const parsedCap = rawCap != null ? Number(rawCap) : NaN;
  const envPaper = getPaperCapital();
  const paperCapital =
    Number.isFinite(parsedCap) && parsedCap > 0 ? parsedCap : envPaper;

  const tickInput = {
    underlying: parseUnderlying(searchParams.get("underlying")),
    sessionId: searchParams.get("sessionId") ?? "default",
    auto: searchParams.get("auto") === "1",
    paperCapital,
    reset: false,
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const push = async () => {
        try {
          const payload = await buildDashboardPayload(tickInput);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : "tick failed";
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${JSON.stringify({ msg })}\n\n`)
          );
        }
      };
      await push();
      const iv = setInterval(push, 1500);
      req.signal.addEventListener("abort", () => {
        clearInterval(iv);
        try {
          controller.close();
        } catch {
          /* closed */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
