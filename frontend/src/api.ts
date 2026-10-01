export type Market = "spot" | "futures";

export interface RestCooldown {
  http_status: 418 | 429;
  retry_at: number;
  message: string;
}

export class MarketRequestError extends Error {
  constructor(message: string, public restCooldown: RestCooldown | null = null) {
    super(message);
  }
}

export interface Statistics {
  symbol: string;
  last_price: string;
  price_change: string;
  price_change_percent: string;
  high_price: string;
  low_price: string;
  volume: string;
  quote_volume: string;
  open_time: number;
  close_time: number;
  count: number;
}

export interface Quote {
  symbol: string;
  asset: string;
  name: string;
  price: string | null;
  statistics: Statistics | null;
  errors: Record<string, string>;
}

export interface MarketSnapshot {
  market: Market;
  source: string;
  fetched_at: string;
  partial: boolean;
  quotes: Quote[];
  rest_cooldown?: RestCooldown | null;
}

export async function loadMarket(
  market: Market,
  signal: AbortSignal,
): Promise<MarketSnapshot> {
  const response = await fetch(`/api/markets/${market}`, {
    signal,
    cache: "no-store",
  });
  if (!response.ok) {
    let message = "行情暂时无法加载，请稍后重试。";
    let cooldown: RestCooldown | null = null;
    try {
      const body = await response.json();
      if (typeof body.detail?.message === "string")
        message = body.detail.message;
      cooldown = body.detail?.rest_cooldown ?? null;
    } catch {
      /* A gateway may return a non-JSON error. */
    }
    throw new MarketRequestError(message, cooldown);
  }
  return response.json() as Promise<MarketSnapshot>;
}
