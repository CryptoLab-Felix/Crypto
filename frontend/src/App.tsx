import { useCallback, useEffect, useRef, useState } from "react";
import { loadMarket, MarketRequestError } from "./api";
import type { Market, MarketSnapshot, Quote, RestCooldown } from "./api";
import EthOrderBook from "./EthOrderBook";
import RestCooldownNotice from "./RestCooldownNotice";

type Asset = "BTC" | "ETH";
type IconName =
  "spot" | "futures" | "refresh" | "arrow" | "activity" | "clock" | "external";
function Icon({
  name,
  className = "",
}: {
  name: IconName;
  className?: string;
}) {
  const paths: Record<IconName, string> = {
    spot: "M12 3 3 8l9 5 9-5-9-5ZM3 12l9 5 9-5M3 16l9 5 9-5",
    futures: "M4 17V7m5 13V4m6 13V7m5 13V4M2 9h4m1 7h4m2-6h4m1 5h4",
    refresh: "M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 13 2M5 16a8 8 0 0 0 13 2",
    arrow: "M6 16 17 5M6 5h11v11",
    activity: "M3 12h4l3-8 4 16 3-8h4",
    clock: "M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
    external: "M14 4h6v6M20 4 10 14M10 4H4v16h16v-6",
  };
  return (
    <svg
      className={`icon ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}

function AssetIcon({ asset }: { asset: string }) {
  return (
    <span className={`asset-icon ${asset.toLowerCase()}`} aria-hidden="true">
      {asset === "BTC" ? (
        "₿"
      ) : (
        <svg viewBox="0 0 24 32">
          <path
            fill="currentColor"
            d="m12 0 11 17-11 6L1 17Zm0 25 11-6-11 13L1 19Z"
          />
        </svg>
      )}
    </span>
  );
}

const decimal = (value: string | number | null | undefined, digits = 2) =>
  value == null
    ? "—"
    : Number(value).toLocaleString("en-US", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
const compact = (value: string | null | undefined) => {
  if (value == null) return "—";
  const number = Number(value);
  if (number >= 100_000_000) return `${decimal(number / 100_000_000)} 亿`;
  if (number >= 10_000) return `${decimal(number / 10_000)} 万`;
  return decimal(number);
};
const signed = (value: string | undefined) =>
  value == null ? "—" : `${Number(value) > 0 ? "+" : ""}${decimal(value)}`;
const clockTime = (time: string) =>
  new Date(time).toLocaleTimeString("zh-CN", { hour12: false });

function AssetCard({
  quote,
  loading,
  stale,
}: {
  quote: Quote;
  loading: boolean;
  stale: boolean;
}) {
  const stats = quote.statistics;
  const rising = stats ? Number(stats.price_change_percent) >= 0 : true;
  const range = stats ? Number(stats.high_price) - Number(stats.low_price) : 0;
  const position =
    stats && quote.price && range > 0
      ? Math.max(
          0,
          Math.min(
            100,
            ((Number(quote.price) - Number(stats.low_price)) / range) * 100,
          ),
        )
      : null;
  const errors = [...new Set(Object.values(quote.errors))];
  return (
    <article
      className={`asset-card ${loading ? "is-loading" : ""}`}
      aria-label={`${quote.asset} 行情`}
      aria-busy={loading}
    >
      <div className="asset-heading">
        <div className="asset-identity">
          <AssetIcon asset={quote.asset} />
          <div>
            <h2>
              {quote.name}
              <span>{quote.asset}</span>
            </h2>
            <p>{quote.asset} / USDT</p>
          </div>
        </div>
        <span className="pair-label">{quote.symbol}</span>
      </div>
      <div className="price-label">
        最新成交价 {stale && <span className="stale-label">上次数据</span>}
      </div>
      <div className="price-line">
        <strong className={loading ? "skeleton price-skeleton" : ""}>
          {loading ? "\u00a0" : decimal(quote.price)}
        </strong>
        <span>USDT</span>
      </div>
      <div className="change-line">
        <span
          className={`change-pill ${stats ? (rising ? "positive" : "negative") : "neutral"}`}
        >
          <Icon name="arrow" className={rising ? "" : "down-arrow"} />
          {stats ? `${signed(stats.price_change_percent)}%` : "—"}
        </span>
        <span>{stats ? `${signed(stats.price_change)} USDT` : "等待行情"}</span>
        <span className="period-label">24h</span>
      </div>
      <div className="daily-range">
        <div className="range-labels">
          <span>
            24h 最低 <b>{decimal(stats?.low_price)}</b>
          </span>
          <span>
            24h 最高 <b>{decimal(stats?.high_price)}</b>
          </span>
        </div>
        <div className={`range-track ${quote.asset.toLowerCase()}`}>
          <span className="range-fill" />
          {position !== null && (
            <i
              style={{ left: `${position}%` }}
              aria-label="最新价在24小时区间的位置"
            />
          )}
        </div>
      </div>
      <div className="card-statistics">
        <div>
          <span>24h 成交量</span>
          <strong>
            {compact(stats?.volume)} <small>{quote.asset}</small>
          </strong>
        </div>
        <div>
          <span>24h 成交额</span>
          <strong>
            {compact(stats?.quote_volume)} <small>USDT</small>
          </strong>
        </div>
      </div>
      {errors.length > 0 && (
        <div className="partial-error" role="status">
          部分数据不可用：{errors.join(" ")}
        </div>
      )}
    </article>
  );
}

const emptyQuotes: Quote[] = [
  {
    symbol: "BTCUSDT",
    asset: "BTC",
    name: "Bitcoin",
    price: null,
    statistics: null,
    errors: {},
  },
  {
    symbol: "ETHUSDT",
    asset: "ETH",
    name: "Ethereum",
    price: null,
    statistics: null,
    errors: {},
  },
];

export default function App() {
  const [market, setMarket] = useState<Market>("spot");
  const [selectedAssets, setSelectedAssets] = useState<Record<Market, Asset>>({
    spot: "BTC",
    futures: "BTC",
  });
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [tick, setTick] = useState(Date.now());
  const controller = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const [futuresCooldown, setFuturesCooldown] = useState<RestCooldown | null>(null);
  const cooldownRef = useRef<RestCooldown | null>(null);
  const updateCooldown = useCallback((cooldown: RestCooldown | null | undefined) => {
    const previous = cooldownRef.current;
    if (cooldown && (cooldown.retry_at > (previous?.retry_at ?? 0) ||
      (cooldown.retry_at === previous?.retry_at && cooldown.http_status === 418 && previous.http_status !== 418))) {
      cooldownRef.current = cooldown;
      setFuturesCooldown(cooldown);
      setTick(Date.now());
    }
  }, []);

  const refresh = useCallback(async () => {
    controller.current?.abort();
    if (market === "futures" && (cooldownRef.current?.retry_at ?? 0) > Date.now()) {
      ++sequence.current;
      setLoading(false);
      return;
    }
    const request = new AbortController();
    controller.current = request;
    const requestNumber = ++sequence.current;
    setLoading(true);
    const timeout = window.setTimeout(() => request.abort("timeout"), 18_000);
    try {
      const next = await loadMarket(market, request.signal);
      if (requestNumber === sequence.current && !request.signal.aborted) {
        if (market === "futures") updateCooldown(next.rest_cooldown);
        setSnapshot(next);
        setError(null);
        setTick(Date.now());
      }
    } catch (cause) {
      if (
        requestNumber === sequence.current &&
        (!request.signal.aborted || request.signal.reason === "timeout")
      ) {
        if (market === "futures" && cause instanceof MarketRequestError) updateCooldown(cause.restCooldown);
        setError(
          request.signal.reason === "timeout"
            ? "行情加载超时，请点击刷新重试。"
            : cause instanceof Error
              ? cause.message
              : "行情加载失败，请重试。",
        );
      }
    } finally {
      window.clearTimeout(timeout);
      if (requestNumber === sequence.current) setLoading(false);
    }
  }, [market, updateCooldown]);

  useEffect(() => {
    setSnapshot(null);
    setError(null);
    void refresh();
    return () => {
      ++sequence.current;
      controller.current?.abort();
    };
  }, [refresh]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [autoRefresh, refresh]);

  useEffect(() => {
    const interval = window.setInterval(() => setTick(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, []);

  const activeSnapshot = snapshot?.market === market ? snapshot : null;
  const age = activeSnapshot
    ? Math.max(
        0,
        Math.floor(
          (tick - new Date(activeSnapshot.fetched_at).getTime()) / 1000,
        ),
      )
    : 0;
  const restPaused = market === "futures" && (futuresCooldown?.retry_at ?? 0) > tick;
  const stale = Boolean(activeSnapshot && (error || age > 60 || restPaused));
  const selectedAsset = selectedAssets[market];
  const selectedQuote =
    activeSnapshot?.quotes.find((quote) => quote.asset === selectedAsset) ??
    emptyQuotes[selectedAsset === "BTC" ? 0 : 1];
  const selectedHasErrors = Object.keys(selectedQuote.errors).length > 0;
  const selectedHasData =
    selectedQuote.price !== null || selectedQuote.statistics !== null;
  const isSpot = market === "spot";
  const showEthBook = !isSpot && selectedAsset === "ETH";
  const healthy = Boolean(
    activeSnapshot && selectedHasData && !error && !selectedHasErrors && !stale,
  );
  const status = restPaused ? "查询已暂停" : error
    ? "更新失败"
    : selectedHasErrors
      ? selectedHasData
        ? "部分数据可用"
        : "行情暂不可用"
      : stale
        ? "数据待刷新"
        : activeSnapshot
          ? "行情已连接"
          : loading
            ? "连接行情中"
            : "等待连接";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Crypto 首页">
          <span className="brand-mark">
            <Icon name="activity" />
          </span>
          <div>
            crypto<span>市场观察</span>
          </div>
        </a>
        <div className="navigation-label">
          工作空间 <span>01</span>
        </div>
        <nav aria-label="市场模块">
          <button
            className={`nav-item ${isSpot ? "active" : ""}`}
            aria-pressed={isSpot}
            onClick={() => setMarket("spot")}
          >
            <Icon name="spot" />
            <span>
              现货市场<small>Spot market</small>
            </span>
            {isSpot && <i />}
          </button>
          <button
            className={`nav-item ${!isSpot ? "active" : ""}`}
            aria-pressed={!isSpot}
            onClick={() => setMarket("futures")}
          >
            <Icon name="futures" />
            <span>
              合约市场<small>Futures market</small>
            </span>
            {!isSpot && <i />}
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="exchange-mark">
            <span>◆</span> BINANCE
          </div>
          <p>公开市场数据</p>
          <div className="sidebar-divider" />
          <span className="version-label">
            MARKET PREVIEW <b>v0.1</b>
          </span>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            工作空间 <span>/</span>{" "}
            <strong>{isSpot ? "现货市场" : "合约市场"}</strong>
          </div>
          <span className="public-badge">
            <span className="tiny-square" /> 公开行情
          </span>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                MARKET OVERVIEW <span>/ {isSpot ? "SPOT" : "FUTURES"}</span>
              </div>
              <h1>
                {isSpot ? "现货市场" : "合约市场"}
                <span>{isSpot ? "SPOT" : "USDⓈ-M"}</span>
              </h1>
              <p>
                {isSpot
                  ? `从价格到成交，掌握 ${selectedAsset} 的现货市场动态。`
                  : `追踪 ${selectedAsset} 的 U 本位永续合约行情。`}
              </p>
            </div>
            <div className="market-symbol" aria-hidden="true">
              <Icon name={isSpot ? "spot" : "futures"} />
            </div>
          </div>

          <div className="asset-selector" role="group" aria-label="币种选择">
            {(["BTC", "ETH"] as const).map((asset) => (
              <button
                key={asset}
                type="button"
                className={`asset-option ${selectedAsset === asset ? "selected" : ""}`}
                aria-label={asset}
                aria-pressed={selectedAsset === asset}
                onClick={() =>
                  setSelectedAssets((current) => ({
                    ...current,
                    [market]: asset,
                  }))
                }
              >
                <AssetIcon asset={asset} />
                <span>
                  {asset}
                  <small>{asset === "BTC" ? "Bitcoin" : "Ethereum"}</small>
                </span>
                <span className="selection-dot" aria-hidden="true" />
              </button>
            ))}
          </div>

          <section className="toolbar" aria-label="行情更新控制">
            <div className="connection" role="status">
              <i
                className={
                  healthy
                    ? "connected"
                    : error || stale || selectedHasErrors
                      ? "warning"
                      : ""
                }
              />
              <span>{showEthBook ? `24h 统计 · ${status}` : status}</span>
              <span className="toolbar-separator" />
              <small>
                {activeSnapshot
                  ? `更新于 ${clockTime(activeSnapshot.fetched_at)}`
                  : restPaused ? "等待恢复查询" : "正在获取最新数据"}
              </small>
            </div>
            <div className="refresh-controls">
              <label className="auto-refresh">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(event) => setAutoRefresh(event.target.checked)}
                />
                <span className="toggle" />{showEthBook ? "24h 统计每 30 秒刷新" : "每 30 秒刷新"}
              </label>
              <button
                className="refresh-button"
                onClick={() => void refresh()}
                disabled={loading || restPaused}
              >
                <Icon name="refresh" className={loading ? "spin" : ""} />
                {loading ? "更新中" : "刷新行情"}
              </button>
            </div>
          </section>

          {restPaused && futuresCooldown && <RestCooldownNotice cooldown={futuresCooldown} now={tick} />}

          {error && !restPaused && (
            <div className="error-banner" role="alert">
              <div>
                <strong>{showEthBook ? "暂时无法更新 24h 统计" : "暂时无法更新行情"}</strong>
                <p>
                  {error}
                  {activeSnapshot ? (showEthBook ? " 统计表保留上次获取的数据。" : " 下方保留上次获取的数据。") : ""}
                </p>
              </div>
              <button onClick={() => void refresh()} disabled={loading}>
                重新加载 <span>↗</span>
              </button>
            </div>
          )}
          {stale && !error && !restPaused && (
            <div className="stale-banner" role="status">
                {showEthBook ? `当前 24h 统计为 ${age} 秒前的数据，点击“刷新行情”更新统计。` : `当前显示的是 ${age} 秒前的数据，点击“刷新行情”获取最新价格。`}
            </div>
          )}

          {showEthBook ? <EthOrderBook onCooldown={updateCooldown} /> : <section
            className="asset-grid"
            aria-label={`${selectedAsset} 行情概览`}
          >
            <AssetCard
              key={selectedAsset}
              quote={selectedQuote}
              loading={loading && !activeSnapshot}
              stale={stale}
            />
          </section>}

          <section className="details-panel" aria-labelledby="details-title">
            <div className="panel-heading">
              <div>
                <span className="section-marker" />
                <h2 id="details-title">{selectedAsset} · 24 小时市场数据</h2>
              </div>
              <span>
                滚动统计 <Icon name="clock" />
              </span>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">交易对</th>
                    <th scope="col">24h 涨跌幅</th>
                    <th scope="col">
                      24h 最高价 <small>USDT</small>
                    </th>
                    <th scope="col">
                      24h 最低价 <small>USDT</small>
                    </th>
                    <th scope="col">成交笔数</th>
                    {showEthBook && <th scope="col">24h 成交量 <small>ETH</small></th>}
                    {showEthBook && <th scope="col">24h 成交额 <small>USDT</small></th>}
                  </tr>
                </thead>
                <tbody>
                  <tr key={selectedQuote.symbol}>
                    <th scope="row">
                      <div className="table-asset">
                        <AssetIcon asset={selectedQuote.asset} />
                        <span>
                          {selectedQuote.asset}
                          <small>/ USDT</small>
                        </span>
                        <span className="market-type">
                          {isSpot ? "现货" : "永续"}
                        </span>
                      </div>
                    </th>
                    <td
                      className={
                        selectedQuote.statistics
                          ? Number(
                              selectedQuote.statistics.price_change_percent,
                            ) >= 0
                            ? "positive-text"
                            : "negative-text"
                          : ""
                      }
                    >
                      {selectedQuote.statistics
                        ? `${signed(selectedQuote.statistics.price_change_percent)}%`
                        : "—"}
                    </td>
                    <td>{decimal(selectedQuote.statistics?.high_price)}</td>
                    <td>{decimal(selectedQuote.statistics?.low_price)}</td>
                    <td>{decimal(selectedQuote.statistics?.count, 0)}</td>
                    {showEthBook && <td>{compact(selectedQuote.statistics?.volume)}</td>}
                    {showEthBook && <td>{compact(selectedQuote.statistics?.quote_volume)}</td>}
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="table-footnote">
              <span className="info-icon">i</span>
              <p>
                24 小时为滚动统计，成交额以 USDT 计。
                {!isSpot && "合约最新价为成交价格。"}
              </p>
            </div>
          </section>

          <footer className="page-footer">
            <span>
              数据来源{" "}
              <b>{isSpot ? "Binance Spot" : "Binance USDⓈ-M Futures"}</b>
            </span>
            <a
              href={
                isSpot
                  ? `https://www.binance.com/en/trade/${selectedAsset}_USDT`
                  : `https://www.binance.com/en/futures/${selectedAsset}USDT`
              }
              target="_blank"
              rel="noreferrer"
            >
              在币安查看 <Icon name="external" />
            </a>
          </footer>
        </main>
      </div>
    </div>
  );
}
