import { useEffect, useState } from "react";

export interface LiquidationBin {
  price: number;
  side: "long" | "short";
  total: number;
}

export interface LiquidationMap {
  symbol: "ETH";
  range: "1d";
  updated_at: number;
  reference_price: number;
  bin_width: number;
  bins: LiquidationBin[];
}

export interface LiquidationSnapshot {
  source: "CoinBoss";
  status: "ready" | "stale" | "unavailable";
  data: LiquidationMap | null;
  message: string | null;
  fetched_at: number | null;
  server_time: number;
  next_check_at: number;
  model_interval_seconds: number;
}

export interface LiquidationRow extends LiquidationBin {
  upper: number | null;
  cumulative: number;
}

export function liquidationRows(bins: LiquidationBin[], anchor: number, side: "long" | "short", nonzero: boolean, count: number, step: number) {
  const groups = new Map<number, LiquidationRow>();
  const stepCents = Math.round(step * 100);
  for (const bin of bins) {
    if (bin.side !== side || (side === "short" ? bin.price <= anchor : bin.price >= anchor)) continue;
    // Group whole source bins by representative price. Their internal distribution
    // is unknown, so never split notional across display intervals.
    const cents = Math.round(bin.price * 100);
    const key = stepCents ? Math.floor(cents / stepCents) * stepCents : cents;
    const row = groups.get(key) ?? {
      price: key / 100, upper: stepCents ? (key + stepCents) / 100 : null,
      side, total: 0, cumulative: 0,
    };
    row.total += bin.total;
    groups.set(key, row);
  }
  const levels = [...groups.values()].sort((a, b) => side === "short" ? a.price - b.price : b.price - a.price);
  let cumulative = 0;
  const rows: LiquidationRow[] = [];
  for (const bin of levels) {
    cumulative += bin.total;
    if (!nonzero || bin.total > 0) rows.push({ ...bin, cumulative });
  }
  const visible = rows.slice(0, count);
  return { rows: side === "short" ? visible.reverse() : visible, total: cumulative, available: rows.length };
}

export function useLiquidations() {
  const [snapshot, setSnapshot] = useState<LiquidationSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const [nextCheck, setNextCheck] = useState(0);
  const [receivedAt, setReceivedAt] = useState(0);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let disposed = false;
    let request: AbortController | null = null;
    let timer: number | undefined;
    let timeout: number | undefined;
    let failures = 0;
    const stop = () => {
      clearTimeout(timer);
      clearTimeout(timeout);
      request?.abort();
      request = null;
    };
    const load = async () => {
      if (disposed || document.hidden || request) return;
      const current = new AbortController();
      request = current;
      setLoading(true);
      timeout = window.setTimeout(() => current.abort("timeout"), 18_000);
      let delay = 15_000;
      try {
        const response = await fetch("/api/markets/futures/eth/liquidations", { signal: current.signal, cache: "no-store" });
        if (!response.ok) throw new Error("强平估算暂时无法加载，将自动重试。");
        const data: LiquidationSnapshot = await response.json();
        if (data.source !== "CoinBoss" || !["ready", "stale", "unavailable"].includes(data.status) ||
          !Number.isFinite(data.server_time) || !Number.isFinite(data.next_check_at) ||
          (data.data !== null && (data.data.symbol !== "ETH" || !Array.isArray(data.data.bins)))) {
          throw new Error("强平估算数据格式异常，将自动重试。");
        }
        if (disposed || request !== current || current.signal.aborted) return;
        // Backend errors with an empty cache must not erase a previously loaded map.
        setSnapshot((previous) => data.data || !previous?.data ? data : {
          ...data, status: "stale", data: previous.data, fetched_at: previous.fetched_at,
        });
        setError(null);
        setReceivedAt(Date.now());
        delay = Math.max(delay, data.next_check_at - data.server_time);
        failures = 0;
      } catch (cause) {
        if (disposed || request !== current) return;
        setError(current.signal.reason === "timeout" ? "强平估算加载超时，将自动重试。" :
          cause instanceof Error ? cause.message : "强平估算加载失败，将自动重试。");
        delay = Math.min(300_000, 15_000 * 2 ** Math.min(failures++, 5));
      } finally {
        if (!disposed && request === current) {
          clearTimeout(timeout);
          request = null;
          setLoading(false);
          setNextCheck(Date.now() + delay);
          if (!document.hidden) timer = window.setTimeout(() => void load(), delay);
        }
      }
    };
    const visibility = () => {
      setHidden(document.hidden);
      stop();
      setLoading(false);
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", visibility);
    void load();
    return () => {
      disposed = true;
      stop();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [attempt]);

  return { snapshot, error, loading, hidden, nextCheck, receivedAt, refresh: () => setAttempt((value) => value + 1) };
}
