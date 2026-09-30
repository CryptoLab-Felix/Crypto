export type Market = "spot" | "futures";

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
    try {
      const body = await response.json();
      if (typeof body.detail?.message === "string")
        message = body.detail.message;
    } catch {
      /* A gateway may return a non-JSON error. */
    }
    throw new Error(message);
  }
  return response.json() as Promise<MarketSnapshot>;
}
