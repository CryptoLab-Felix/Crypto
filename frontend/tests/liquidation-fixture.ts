import type { LiquidationSnapshot } from "../src/liquidations";

export const liquidationFixture = (): LiquidationSnapshot => ({
  source: "CoinBoss", status: "ready", message: null,
  fetched_at: Date.now(), server_time: Date.now(), next_check_at: Date.now() + 15_000,
  model_interval_seconds: 300,
  data: {
    symbol: "ETH", range: "1d", updated_at: Date.now(), reference_price: 2000, bin_width: 2,
    bins: [
      { price: 1980, side: "long", total: 600_000 },
      { price: 1990, side: "long", total: 400_000 },
      { price: 2005, side: "short", total: 0 },
      { price: 2010, side: "short", total: 300_000 },
      { price: 2020, side: "short", total: 500_000 },
    ],
  },
});
