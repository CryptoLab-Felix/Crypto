import { useEffect, useMemo, useState } from "react";
import type { RestCooldown } from "./api";
import "./orderbook.css";

type Level = [string, string];
type StreamStatus = "connecting" | "live" | "reconnecting";
export interface OrderBookSnapshot {
  symbol: "ETHUSDT";
  bids: Level[];
  asks: Level[];
  price: string | null;
  book_status: StreamStatus;
  price_status: StreamStatus;
  book_time: number | null;
  price_time: number | null;
  book_received_at: number | null;
  price_received_at: number | null;
  book_message?: string | null;
  price_message?: string | null;
  server_time: number;
  rest_cooldown?: RestCooldown | null;
}

const format = (value: number | string | null | undefined, digits = 2) =>
  value == null ? "—" : Number(value).toLocaleString("en-US", {
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  });
const time = (value: number | null | undefined) => value == null ? "—" :
  new Date(value).toLocaleTimeString("zh-CN", { hour12: false });

interface DepthRow {
  key: number;
  label: string;
  quantity: number;
  notional: number;
  cumulative: number;
}

export function groupLevels(levels: Level[], step: number, side: "asks" | "bids", count: number) {
  const groups = new Map<number, DepthRow>();
  for (const [priceText, quantityText] of levels) {
    const price = Number(priceText), quantity = Number(quantityText);
    // Integer cents prevent decimal prices falling into an adjacent bucket.
    const cents = Math.round(price * 100);
    const bucket = step ? Math.floor(cents / Math.round(step * 100)) * Math.round(step * 100) : cents;
    const row = groups.get(bucket) ?? {
      key: bucket,
      label: step ? `${format(bucket / 100)}–${format(bucket / 100 + step)}` : format(price),
      quantity: 0, notional: 0, cumulative: 0,
    };
    row.quantity += quantity;
    row.notional += price * quantity;
    groups.set(bucket, row);
  }
  const rows = [...groups.values()].sort((a, b) => side === "asks" ? a.key - b.key : b.key - a.key).slice(0, count);
  let cumulative = 0;
  for (const row of rows) row.cumulative = cumulative += row.quantity;
  return side === "asks" ? rows.reverse() : rows;
}

function useEthStream(attempt: number) {
  const [snapshot, setSnapshot] = useState<OrderBookSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const [receivedAt, setReceivedAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | null = null;
    let retry: number | undefined;
    let frame: number | undefined;
    let pending: OrderBookSnapshot | null = null;
    let delay = 500;
    let lastReceived = Date.now();
    const stop = () => {
      window.clearTimeout(retry);
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = undefined;
      pending = null;
      if (socket) {
        socket.onclose = socket.onerror = socket.onmessage = socket.onopen = null;
        socket.close();
        socket = null;
      }
      if (!disposed) setConnected(false);
    };
    const reconnect = () => {
      stop();
      if (disposed || document.hidden) return;
      retry = window.setTimeout(start, delay);
      delay = Math.min(delay * 2, 10_000);
    };
    const start = () => {
      if (disposed || document.hidden) return;
      setConnected(false);
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      const current = new WebSocket(`${protocol}//${location.host}/api/markets/futures/eth/orderbook`);
      socket = current;
      lastReceived = Date.now();
      current.onmessage = (event) => {
        if (socket !== current || disposed) return;
        try {
          const data: OrderBookSnapshot = JSON.parse(event.data);
          if (data.symbol !== "ETHUSDT" || !Array.isArray(data.asks) || !Array.isArray(data.bids)) throw new Error("Invalid stream");
          pending = data;
          lastReceived = Date.now();
          delay = 500;
          if (frame === undefined) frame = requestAnimationFrame(() => {
            frame = undefined;
            setSnapshot(pending);
            setReceivedAt(lastReceived);
            setConnected(true);
          });
        } catch {
          reconnect();
        }
      };
      current.onerror = () => {
        if (socket === current && !disposed) reconnect();
      };
      current.onclose = () => {
        if (socket !== current || disposed) return;
        reconnect();
      };
    };
    const visibility = () => {
      setHidden(document.hidden);
      stop();
      if (!document.hidden) start();
    };
    const timer = window.setInterval(() => {
      setNow(Date.now());
      if (socket && Date.now() - lastReceived > 5_000) reconnect();
    }, 500);
    document.addEventListener("visibilitychange", visibility);
    start();
    return () => {
      disposed = true;
      stop();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [attempt]);
  const elapsed = Math.max(0, now - receivedAt);
  const bookAge = snapshot?.book_received_at == null ? Infinity :
    snapshot.server_time - snapshot.book_received_at + elapsed;
  return {
    snapshot, hidden, now,
    bookLive: connected && elapsed < 5_000 && snapshot?.book_status === "live" && bookAge < 5_000,
    priceLive: connected && elapsed < 5_000 && snapshot?.price_status === "live",
  };
}

function DepthRows({ rows, side }: { rows: DepthRow[]; side: "asks" | "bids" }) {
  const max = Math.max(1, ...rows.map((row) => row.cumulative));
  return <div className={`depth-rows ${side}`} role="rowgroup">
    {rows.map((row) => <div className="depth-row" role="row" key={row.key}>
      <span className="depth-fill" style={{ width: `${row.cumulative / max * 100}%` }} aria-hidden="true" />
      <span role="cell" className="depth-level-price">{row.label}</span>
      <span role="cell">{format(row.quantity, 3)}</span>
      <span role="cell">{format(row.cumulative, 3)}</span>
      <span role="cell" className="depth-notional">{format(row.notional)}</span>
    </div>)}
    {!rows.length && <div className="depth-empty">等待盘口数据…</div>}
  </div>;
}

export default function EthOrderBook({ onCooldown }: { onCooldown: (cooldown: RestCooldown | null | undefined) => void }) {
  const [step, setStep] = useState(1);
  const [count, setCount] = useState(10);
  const [attempt, setAttempt] = useState(0);
  const { snapshot, hidden, now, bookLive, priceLive } = useEthStream(attempt);
  const restPaused = (snapshot?.rest_cooldown?.retry_at ?? 0) > now;
  useEffect(() => { onCooldown(snapshot?.rest_cooldown); }, [snapshot?.rest_cooldown, onCooldown]);
  const asks = useMemo(() => groupLevels(snapshot?.asks ?? [], step, "asks", count), [snapshot?.asks, step, count]);
  const bids = useMemo(() => groupLevels(snapshot?.bids ?? [], step, "bids", count), [snapshot?.bids, step, count]);
  const spread = snapshot?.asks.length && snapshot.bids.length ? Number(snapshot.asks[0][0]) - Number(snapshot.bids[0][0]) : null;
  const status = hidden ? "后台已暂停" : bookLive ? "盘口实时连接" : restPaused ? "盘口同步等待解除限制" : snapshot?.asks.length ? "盘口重连中 · 上次数据" : snapshot?.book_status === "reconnecting" ? "盘口连接重试中" : "正在同步盘口";

  return <article className="eth-orderbook" aria-label="ETH 行情">
    <div className="depth-heading">
      <div><span className="depth-eyebrow">ETHUSDT · 永续合约</span><h2>实时买卖挂单</h2></div>
      <div className={`depth-status ${bookLive ? "live" : "waiting"}`} role="status"><i />{status}</div>
    </div>
    <div className="depth-controls">
      <span className="depth-speed">100 ms 盘口推送</span>
      <label>价格分组 <select aria-label="价格分组" value={step} onChange={(event) => setStep(Number(event.target.value))}>
        <option value={0}>原始价位</option>
        {[0.1, 1, 5, 10].map((value) => <option value={value} key={value}>{value} USDT</option>)}
      </select></label>
      <label>每侧显示 <select aria-label="每侧显示" value={count} onChange={(event) => setCount(Number(event.target.value))}>
        {[10, 20, 50].map((value) => <option key={value} value={value}>{value} 档</option>)}
      </select></label>
      <button className="depth-reconnect" disabled={restPaused} onClick={() => setAttempt((value) => value + 1)}>重新连接</button>
    </div>
    <div className={`depth-ladder ${!bookLive ? "depth-stale" : ""}`}>
      <div className="depth-side-label asks"><b>卖盘 · 卖出挂单</b><span>可能开空 / 平多</span></div>
      <div role="table" aria-label="ETH 卖盘">
        <div className="depth-columns" role="row"><span role="columnheader">{step ? "价格区间" : "价格"} (USDT)</span><span role="columnheader">挂单量 (ETH)</span><span role="columnheader">累计量 (ETH)</span><span role="columnheader" className="depth-notional">名义金额 (USDT)</span></div>
        <DepthRows rows={asks} side="asks" />
      </div>
      <div className="depth-current">
        <div>
          <div className="price-label">最新成交价 {snapshot?.price && !priceLive && <span className="stale-label">上次数据</span>}</div>
          <div className="price-line"><strong data-testid="eth-live-price">{format(snapshot?.price)}</strong><span>USDT</span></div>
          <span className="depth-price-time">{priceLive ? "成交价实时连接" : "成交价连接中"} · 最近成交 {time(snapshot?.price_time)}</span>
        </div>
        <div className="depth-spread"><span>买卖价差</span><b>{format(spread)} <small>USDT</small></b><span>盘口更新 {time(snapshot?.book_time)}</span></div>
      </div>
      <div className="depth-side-label bids"><b>买盘 · 买入挂单</b><span>可能开多 / 平空</span></div>
      <div role="table" aria-label="ETH 买盘">
        <div className="depth-columns" role="row"><span role="columnheader">{step ? "价格区间" : "价格"} (USDT)</span><span role="columnheader">挂单量 (ETH)</span><span role="columnheader">累计量 (ETH)</span><span role="columnheader" className="depth-notional">名义金额 (USDT)</span></div>
        <DepthRows rows={bids} side="bids" />
      </div>
    </div>
    <div className="depth-notes">
      {!bookLive && <p className="depth-warning" role="status">{snapshot?.book_message ?? "正在连接币安并同步盘口；网络不可用时会自动重试。"}{Boolean(snapshot?.asks.length) && "连接恢复前保留上次盘口，当前数据可能过时。"}</p>}
      {!priceLive && snapshot?.price_message && <p className="depth-warning" role="status">{snapshot.price_message}</p>}
      <p>已载入买盘 {snapshot?.bids.length ?? 0} 档 / 卖盘 {snapshot?.asks.length ?? 0} 档 · 当前覆盖 {format(snapshot?.bids.at(-1)?.[0])}–{format(snapshot?.asks.at(-1)?.[0])} USDT</p>
      <p>累计量从最优买卖价向外累加；名义金额为各价位价格 × 数量之和。{step > 0 && "分组区间含下限、不含上限，边缘区间仅统计已载入价位。"}</p>
      <p>币安公开挂单按价格汇总，买卖方向无法区分开仓、平仓。每侧最多载入 1000 档，不含 RPI 及未触发的条件单；盘口和最新成交价为独立更新。</p>
    </div>
  </article>;
}
