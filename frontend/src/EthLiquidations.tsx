import { useMemo, useState } from "react";
import { liquidationRows, useLiquidations } from "./liquidations";
import type { LiquidationRow } from "./liquidations";
import "./liquidations.css";

const number = (value: number | null | undefined, digits = 0) => value == null ? "—" :
  value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const timestamp = (value: number | null | undefined) => value == null ? "—" :
  new Date(value).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
const ageText = (seconds: number) => seconds < 60 ? `${seconds} 秒前` : `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒前`;
const GROUP_STEPS = [1, 5, 10, 25, 50, 100];

function Rows({ rows, side, max, empty }: { rows: LiquidationRow[]; side: "buy" | "sell"; max: number; empty: string }) {
  return <div className={`liq-rows liq-${side}`} role="rowgroup">
    {rows.map((row) => <div className="liq-row" role="row" key={row.price}>
      <span className="liq-fill" style={{ width: `${row.total / max * 100}%` }} aria-hidden="true" />
      <span role="cell" className="liq-price">{number(row.price, 2)}{row.upper !== null && `–${number(row.upper, 2)}`}</span>
      <span role="cell">{number(row.total)}</span>
      <span role="cell">{number(row.cumulative)}</span>
    </div>)}
    {!rows.length && <div className="depth-empty">{empty}</div>}
  </div>;
}

function Columns({ grouped }: { grouped: boolean }) {
  return <div className="liq-columns" role="row">
    <span role="columnheader">{grouped ? "价格区间" : "价格档"} (USD)</span>
    <span role="columnheader">预估金额 (USD)</span>
    <span role="columnheader">累计金额 (USD)</span>
  </div>;
}

export default function EthLiquidations({ price, priceLive, now }: { price: string | null; priceLive: boolean; now: number }) {
  const { snapshot, error, loading, hidden, nextCheck, receivedAt, refresh } = useLiquidations();
  const [count, setCount] = useState(10);
  const [requestedStep, setRequestedStep] = useState(5);
  const [nonzero, setNonzero] = useState(true);
  const data = snapshot?.data;
  const sourceWidth = data?.bin_width ?? 0;
  const minStep = GROUP_STEPS.find((value) => value >= sourceWidth) ?? Math.ceil(sourceWidth);
  const groupSteps = GROUP_STEPS.includes(minStep) ? GROUP_STEPS : [...GROUP_STEPS, minStep];
  // If the source widens on a refresh, promote the display step automatically.
  const step = requestedStep === 0 ? 0 : Math.max(requestedStep, minStep);
  const anchor = price == null ? data?.reference_price ?? 0 : Number(price);
  const buy = useMemo(() => liquidationRows(data?.bins ?? [], anchor, "short", nonzero, count, step), [data, anchor, nonzero, count, step]);
  const sell = useMemo(() => liquidationRows(data?.bins ?? [], anchor, "long", nonzero, count, step), [data, anchor, nonzero, count, step]);
  const max = Math.max(1, ...buy.rows.map((row) => row.total), ...sell.rows.map((row) => row.total));
  const age = data && snapshot ? Math.max(0, Math.floor((snapshot.server_time - data.updated_at + Math.max(0, now - receivedAt)) / 1000)) : 0;
  const stale = Boolean(error || snapshot?.status === "stale" || (data && age > 600));
  const message = error ?? snapshot?.message ?? (stale ? "模型超过 10 分钟未更新，以下为上次估算。" : null);
  const status = hidden ? "估算检查已暂停" : stale ? "上次估算 · 待更新" : data ? "估算已加载" : loading ? "正在加载估算" : "估算暂不可用";
  const excluded = data?.bins.filter((bin) => bin.total > 0 && (bin.side === "short" ? bin.price <= anchor : bin.price >= anchor)).length ?? 0;
  const empty = data ? nonzero ? "该侧当前没有非零估算价档" : "当前价格该侧无覆盖价档" : loading ? "正在获取 CoinBoss 估算…" : "暂无估算数据，等待自动重试";
  const retryIn = Math.max(0, Math.ceil((nextCheck - now) / 1000));
  const prices = data?.bins.map((bin) => bin.price) ?? [];

  return <article className="eth-liquidations" aria-label="ETH 强平估算">
    <div className="depth-heading">
      <div><span className="depth-eyebrow">COINBOSS · ETH · 1D 模型</span><h2>潜在强平买卖盘 <span className="liq-model-badge">估算</span></h2></div>
      <div className={`depth-status ${data && !stale && !hidden ? "live" : "waiting"}`} role="status"><i />{status}</div>
    </div>
    <p className="liq-intro">价格上方为空头潜在强平买入，下方为多头潜在强平卖出。金额为仓位名义规模。</p>
    <div className="depth-controls">
      <span className="depth-speed">模型约 5 分钟更新 · 每 15 秒检查</span>
      <label>价格分组 <select aria-label="强平价格分组" value={step} onChange={(event) => setRequestedStep(Number(event.target.value))}>
        <option value={0}>原始价位</option>
        {groupSteps.map((value) => <option key={value} value={value} disabled={value < sourceWidth}
          title={value < sourceWidth ? "低于原始档宽，无法细分" : undefined}>{value} USD</option>)}
      </select></label>
      <label>每侧显示 <select aria-label="强平每侧显示" value={count} onChange={(event) => setCount(Number(event.target.value))}>
        {[10, 20, 50, 5000].map((value) => <option key={value} value={value}>{value === 5000 ? "全部价档" : `${value} 档`}</option>)}
      </select></label>
      <label className="liq-zero-toggle"><input type="checkbox" checked={nonzero} onChange={(event) => setNonzero(event.target.checked)} />仅显示非零</label>
      <button className="depth-reconnect" onClick={refresh} disabled={loading || hidden || (Boolean(error || snapshot?.status !== "ready") && retryIn > 0)}>检查估算更新</button>
    </div>
    <div className="liq-summary">
      <div className="liq-buy"><span>上方潜在买入</span><strong>{number(data ? buy.total : null)} <small>USD</small></strong></div>
      <div className="liq-sell"><span>下方潜在卖出</span><strong>{number(data ? sell.total : null)} <small>USD</small></strong></div>
    </div>
    {message && <p className="liq-warning" role="status">{message}{data && " 保留上次有效快照。"}</p>}
    <div className={stale || hidden ? "liq-stale" : ""}>
      <div className="depth-side-label liq-buy"><b>空头强平 → 潜在买入</b><span>{buy.rows.length} / {buy.available} 档</span></div>
      <div role="table" aria-label="ETH 强平买盘"><Columns grouped={step > 0} /><Rows rows={buy.rows} side="buy" max={max} empty={empty} /></div>
      <div className="depth-current liq-current">
        <div>
          <div className="price-label">{price == null ? "CoinBoss 模型参考价" : "币安最新成交价"} {price != null && !priceLive && <span className="stale-label">上次价格</span>}</div>
          <div className="price-line"><strong data-testid="liq-current-price">{number(price == null ? data?.reference_price : Number(price), 2)}</strong><span>{price == null ? "USD" : "USDT"}</span></div>
          <span className="depth-price-time">{price == null ? "实时价格连接中 · 暂按模型参考价定位" : priceLive ? "与实时盘口共用价格行情" : "实时价格重连中"}</span>
        </div>
        <div className="depth-spread"><span>模型参考价</span><b>{number(data?.reference_price, 2)} <small>USD</small></b><span>{data ? `模型生成于 ${ageText(age)}` : "等待模型"}</span></div>
      </div>
      <div className="depth-side-label liq-sell"><b>多头强平 → 潜在卖出</b><span>{sell.rows.length} / {sell.available} 档</span></div>
      <div role="table" aria-label="ETH 强平卖盘"><Columns grouped={step > 0} /><Rows rows={sell.rows} side="sell" max={max} empty={empty} /></div>
    </div>
    <div className="depth-notes">
      <p>模型更新 {timestamp(data?.updated_at)}{data && ` · ${ageText(age)}`} · {hidden ? "返回页面后继续检查" : loading ? "检查中…" : `${retryIn} 秒后检查更新`}</p>
      <p>原始档宽约 {number(data?.bin_width, 4)} USD · 原始代表价覆盖 {number(prices.length ? Math.min(...prices) : null, 2)}–{number(prices.length ? Math.max(...prices) : null, 2)} USD · 共 {data?.bins.length ?? 0} 档。小于原始档宽的分组选项不可用。</p>
      {step > 0 && <p>按 {step} USD 分组，区间含下限、不含上限。原始档按代表价整体归入区间并合计金额，不拆分；区间为展示分组，不代表精确的强平边界，边缘分组可能不完整。</p>}
      {excluded > 0 && <p className="depth-warning">有 {excluded} 个非零价档位于当前价另一侧，暂不计入列表，等待模型更新；不表示已确认发生强平。</p>}
      <p>累计金额从当前价向外累加；汇总统计全部可用价档，显示档数只影响列表长度。数据已是仓位名义金额，无需再乘杠杆。</p>
      <p>来源 <a href="https://www.coinboss.com/pro/futures/LiquidationMap" target="_blank" rel="noreferrer">CoinBoss 强平模型 ↗</a>，非真实挂单，交易所范围未明确披露，不能视为币安专属统计。价档与金额为 USD，币安价格为 USDT，仅作近似定位；触发位置不等于最终成交价格，预估金额不保证全部成交。</p>
    </div>
  </article>;
}
