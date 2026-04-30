/**
 * Server-only Groww Trade API helpers.
 * Docs: https://groww.in/trade-api/docs/curl
 * Never expose GROWW_ACCESS_TOKEN or API keys to the client.
 */

const BASE = "https://api.groww.in/v1";

export interface GrowwConfig {
  accessToken: string;
}

function headers(token: string): HeadersInit {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-API-VERSION": "1.0",
    Authorization: `Bearer ${token}`,
  };
}

export async function growwGetQuote(
  cfg: GrowwConfig,
  params: { exchange: string; segment: string; tradingSymbol: string }
): Promise<unknown> {
  const q = new URLSearchParams({
    exchange: params.exchange,
    segment: params.segment,
    trading_symbol: params.tradingSymbol,
  });
  const res = await fetch(`${BASE}/live-data/quote?${q}`, {
    headers: headers(cfg.accessToken),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Groww quote ${res.status}`);
  return res.json();
}

export async function growwOptionChain(
  cfg: GrowwConfig,
  exchange: string,
  underlying: string,
  expiryDate: string
): Promise<unknown> {
  const url = `${BASE}/option-chain/exchange/${exchange}/underlying/${underlying}?expiry_date=${expiryDate}`;
  const res = await fetch(url, { headers: headers(cfg.accessToken), cache: "no-store" });
  if (!res.ok) throw new Error(`Groww option chain ${res.status}`);
  return res.json();
}

export interface GrowwOrderBody {
  trading_symbol: string;
  quantity: number;
  price: number;
  validity: string;
  exchange: string;
  segment: string;
  product: string;
  order_type: string;
  transaction_type: string;
  order_reference_id: string;
  trigger_price?: number;
}

export async function growwCreateOrder(
  cfg: GrowwConfig,
  body: GrowwOrderBody
): Promise<unknown> {
  const res = await fetch(`${BASE}/order/create`, {
    method: "POST",
    headers: headers(cfg.accessToken),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Groww order ${res.status}: ${t}`);
  }
  return res.json();
}
