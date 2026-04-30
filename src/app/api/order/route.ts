import { NextRequest, NextResponse } from "next/server";
import {
  getOrderApiSecret,
  getTradingMode,
  isKillSwitchOn,
  isOrderDryRun,
} from "@/lib/config";
import { growwCreateOrder, type GrowwOrderBody } from "@/lib/groww";

export const dynamic = "force-dynamic";

const REQUIRED: (keyof GrowwOrderBody)[] = [
  "trading_symbol",
  "quantity",
  "exchange",
  "segment",
  "product",
  "order_type",
  "transaction_type",
];

/**
 * Guarded live order proxy. Requires TRADING=live, GROWW_ACCESS_TOKEN,
 * matching X-Order-Secret with ORDER_API_SECRET (min 8 chars).
 * Default ORDER_DRY_RUN=1 logs intent without calling Groww.
 */
export async function POST(req: NextRequest) {
  if (getTradingMode() !== "live") {
    return NextResponse.json(
      { error: "TRADING must be live to place broker orders." },
      { status: 403 }
    );
  }
  const token = process.env.GROWW_ACCESS_TOKEN?.trim();
  if (!token) {
    return NextResponse.json(
      { error: "Missing GROWW_ACCESS_TOKEN on server." },
      { status: 401 }
    );
  }
  const secret = getOrderApiSecret();
  const hdr = req.headers.get("x-order-secret")?.trim();
  if (!secret || hdr !== secret) {
    return NextResponse.json(
      {
        error:
          "Set ORDER_API_SECRET in .env.local and send the same value as header X-Order-Secret.",
      },
      { status: 401 }
    );
  }
  if (isKillSwitchOn()) {
    return NextResponse.json(
      { error: "KILL_SWITCH=1 — new orders blocked." },
      { status: 423 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  for (const k of REQUIRED) {
    const v = body[k];
    if (v === undefined || v === null || v === "") {
      return NextResponse.json({ error: `Missing field: ${k}` }, { status: 400 });
    }
  }

  const dryRequested = body.dry_run === true;
  const dry = dryRequested || isOrderDryRun();

  const order_reference_id =
    typeof body.order_reference_id === "string" && body.order_reference_id.length > 0
      ? body.order_reference_id
      : `desk-${Date.now()}`;

  const payload: GrowwOrderBody = {
    trading_symbol: String(body.trading_symbol),
    quantity: Number(body.quantity),
    price: Number(body.price ?? 0),
    validity: String(body.validity ?? "DAY"),
    exchange: String(body.exchange),
    segment: String(body.segment),
    product: String(body.product),
    order_type: String(body.order_type),
    transaction_type: String(body.transaction_type),
    order_reference_id,
    trigger_price:
      body.trigger_price !== undefined && body.trigger_price !== null
        ? Number(body.trigger_price)
        : undefined,
  };

  if (dry) {
    return NextResponse.json({
      ok: true,
      dry_run: true,
      would_send: payload,
      hint: "Set ORDER_DRY_RUN=0 after paper verification to hit Groww.",
    });
  }

  try {
    const groww = await growwCreateOrder({ accessToken: token }, payload);
    return NextResponse.json({ ok: true, dry_run: false, groww });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Groww order failed" },
      { status: 502 }
    );
  }
}
