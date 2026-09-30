# 币安现货 REST API 完整清单

核验日期：2026-10-01。本文完整列出官方 **Spot REST API** 当前目录中的 **48 个端点**，另外列出独立 Algo Trading 产品中的 **5 个现货算法交易端点**，共 **53 项**。只需要 BTC、ETH 行情时，主要阅读“基础信息”和“行情与成交”。

## 范围与计数

| 部分 | 数量 | 范围 |
|---|---:|---|
| 基础信息 | 4 | 交易规则、连通性、服务器时间 |
| 行情与成交 | 15 | 价格、成交、盘口、K 线、参考价格 |
| 账户查询 | 14 | 余额、订单、个人成交、费率等 |
| 交易操作 | 15 | 下单、撤单、改单、订单测试 |
| 附录：现货算法交易 | 5 | 官方另列产品中的现货 TWAP 及查询 |
| 合计 | 53 | 核心目录 48 + 扩展 5 |

“完整”针对上表所列官方产品目录及核验日期。保证金杠杆交易、钱包充提、兑换、理财、Alpha、大宗撮合、机构及子账户是官网独立产品，不属于本文的 Spot REST API 核心目录；期权和合约也不混入此文件。官网全部产品的边界可查看[官方 API 总目录](https://developers.binance.com/en/docs/catalog)。

## 域名与权限

- 核心 REST 主域名：`https://api.binance.com`。完整地址由“主域名 + 表内路径”组成。[官方通用说明](https://developers.binance.com/en/docs/products/spot/rest-api)
- 公开行情专用域名：`https://data-api.binance.vision`，仅承诺支持官方白名单中的端点，不能把本文所有路径都换成这个域名。[官方白名单](https://developers.binance.com/en/docs/products/spot/faqs/market_data_only)
- 附录的 `/sapi/` 算法交易同样使用 `https://api.binance.com`，属于另一个产品接口集合。

| 安全类型 | 含义 |
|---|---|
| NONE¹ | 现货通用文档明确：端点标题未指定安全类型时默认 NONE，即公开接口 |
| USER_DATA | 个人账户数据；需要 API Key 和签名 |
| TRADE | 交易操作；需要 API Key、签名及相应权限 |
| MARKET_DATA | 本目录大宗成交端点使用此标签，其详细页明确要求 API Key；签名要求见下方差异说明 |

¹ `NONE` 来自现货[请求安全规则](https://developers.binance.com/en/docs/products/spot/rest-api#request-security)，不是通过“GET 就公开”推断。

**官方文档差异：**现货通用安全说明泛称非 NONE 请求需签名，但历史大宗成交的详细页只列出 API Key 要求，未列签名授权段落。本文保留 `MARKET_DATA` 原标签，不把它擅自归成无需认证或确定无需签名。接入该项时应进一步核对官方详细定义。[历史大宗成交所在页](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/market)

## 目录

- 基础信息：4 项。
- 行情与成交：15 项。
- 账户查询：14 项。
- 交易操作：15 项。
- 附录：现货算法交易：5 项。
- BTC、ETH 获取方式与指标边界。
- 核验方法与边界。

## 基础信息（4 项）

| 编号 | HTTP | 路径 | 中文用途 | 官方安全类型 | 官方依据 |
|---|---|---|---|---|---|
| SG-01 | `GET` | `/api/v3/exchangeInfo` | 交易对信息、交易规则及限额 | NONE¹ | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/general) |
| SG-02 | `GET` | `/api/v3/executionRules` | 查询交易对执行规则 | NONE¹ | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/general) |
| SG-03 | `GET` | `/api/v3/ping` | 连通性测试 | NONE¹ | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/general) |
| SG-04 | `GET` | `/api/v3/time` | 服务器时间 | NONE¹ | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/general) |

## 行情与成交（15 项）

| 编号 | HTTP | 路径 | 中文用途 | 官方安全类型 | 官方依据 |
|---|---|---|---|---|---|
| SM-01 | `GET` | `/api/v3/aggTrades` | 聚合成交记录 | NONE¹ | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/market) |
| SM-02 | `GET` | `/api/v3/avgPrice` | 当前均价及统计窗口 | NONE¹ | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/market) |
| SM-03 | `GET` | `/api/v3/depth` | 买卖盘口深度 | NONE¹ | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/market) |
| SM-04 | `GET` | `/api/v3/trades` | 最近逐笔成交 | NONE¹ | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/market) |
| SM-05 | `GET` | `/api/v3/historicalTrades` | 较早的逐笔成交 | NONE¹ | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/market) |
| SM-06 | `GET` | `/api/v3/historicalBlockTrades` | 历史大宗成交 | MARKET_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/market) |
| SM-07 | `GET` | `/api/v3/klines` | 交易价格 K 线及成交统计 | NONE¹ | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/market) |
| SM-08 | `GET` | `/api/v3/ticker` | 可选滚动窗口行情统计 | NONE¹ | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/market) |
| SM-09 | `GET` | `/api/v3/ticker/24hr` | 滚动 24 小时行情统计 | NONE¹ | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/market) |
| SM-10 | `GET` | `/api/v3/ticker/bookTicker` | 最优买卖报价及数量 | NONE¹ | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/market) |
| SM-11 | `GET` | `/api/v3/ticker/price` | 最新成交价 | NONE¹ | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/market) |
| SM-12 | `GET` | `/api/v3/ticker/tradingDay` | 按交易日统计的行情 | NONE¹ | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/market) |
| SM-13 | `GET` | `/api/v3/uiKlines` | 供图表展示的调整后 K 线 | NONE¹ | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/market) |
| SM-14 | `GET` | `/api/v3/referencePrice` | 查询执行规则所用参考价格 | NONE¹ | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/market) |
| SM-15 | `GET` | `/api/v3/referencePrice/calculation` | 查询参考价格计算方式 | NONE¹ | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/market) |

`ticker/24hr` 是滚动 24 小时窗口，`ticker/tradingDay` 是交易日统计；`ticker` 支持选择滚动窗口。`uiKlines` 是为图表展示调整的数据，指标分析可优先采用原始 `klines`。`referencePrice` 属于交易执行规则的参考价，不能直接当作最新成交价。

## 账户查询（14 项）

| 编号 | HTTP | 路径 | 中文用途 | 官方安全类型 | 官方依据 |
|---|---|---|---|---|---|
| SA-01 | `GET` | `/api/v3/account/commission` | 查询账户手续费率 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/account) |
| SA-02 | `GET` | `/api/v3/allOrderList` | 查询全部订单列表 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/account) |
| SA-03 | `GET` | `/api/v3/allOrders` | 全部个人订单 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/account) |
| SA-04 | `GET` | `/api/v3/account` | 账户信息 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/account) |
| SA-05 | `GET` | `/api/v3/openOrders` | 当前个人挂单 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/account) |
| SA-06 | `GET` | `/api/v3/order` | 查询单个订单 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/account) |
| SA-07 | `GET` | `/api/v3/orderList` | 查询单个订单列表 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/account) |
| SA-08 | `GET` | `/api/v3/myAllocations` | 查询 SOR 成交分配 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/account) |
| SA-09 | `GET` | `/api/v3/myFilters` | 查询当前账户适用的交易过滤规则 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/account) |
| SA-10 | `GET` | `/api/v3/myPreventedMatches` | 查询自成交预防导致的阻止撮合记录 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/account) |
| SA-11 | `GET` | `/api/v3/myTrades` | 账户个人成交记录 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/account) |
| SA-12 | `GET` | `/api/v3/openOrderList` | 查询当前未完成订单列表 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/account) |
| SA-13 | `GET` | `/api/v3/order/amendments` | 查询订单修改记录 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/account) |
| SA-14 | `GET` | `/api/v3/rateLimit/order` | 查询未完成订单计数 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/account) |

## 交易操作（15 项）

| 编号 | HTTP | 路径 | 中文用途 | 官方安全类型 | 官方依据 |
|---|---|---|---|---|---|
| ST-01 | `DELETE` | `/api/v3/openOrders` | 撤销指定交易对的全部挂单 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/trade) |
| ST-02 | `POST` | `/api/v3/order` | 创建订单 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/trade) |
| ST-03 | `DELETE` | `/api/v3/order` | 撤销单个订单 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/trade) |
| ST-04 | `DELETE` | `/api/v3/orderList` | 撤销订单列表 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/trade) |
| ST-05 | `PUT` | `/api/v3/order/amend/keepPriority` | 保留队列优先级的订单修改 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/trade) |
| ST-06 | `POST` | `/api/v3/order/cancelReplace` | 撤销旧订单并提交新订单 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/trade) |
| ST-07 | `POST` | `/api/v3/orderList/oco` | 创建 OCO 订单列表 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/trade) |
| ST-08 | `POST` | `/api/v3/orderList/opo` | 创建 OPO 订单列表 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/trade) |
| ST-09 | `POST` | `/api/v3/orderList/opoco` | 创建 OPOCO 订单列表 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/trade) |
| ST-10 | `POST` | `/api/v3/orderList/oto` | 创建 OTO 订单列表 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/trade) |
| ST-11 | `POST` | `/api/v3/orderList/otoco` | 创建 OTOCO 订单列表 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/trade) |
| ST-12 | `POST` | `/api/v3/order/oco` | 旧版 OCO 下单【官方标注已弃用】 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/trade) |
| ST-13 | `POST` | `/api/v3/order/test` | 现货订单测试 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/trade) |
| ST-14 | `POST` | `/api/v3/sor/order` | 通过智能路由 SOR 下单 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/trade) |
| ST-15 | `POST` | `/api/v3/sor/order/test` | SOR 订单测试 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/trade) |

以上交易操作列出是为了使接口目录完整。它们不是“获取市场行情”的必要步骤。旧 `POST /api/v3/order/oco` 在官方标题中标为弃用，新接口为 `POST /api/v3/orderList/oco`；本文件保留两者以便核对旧代码。

## 附录：现货算法交易（5 项）

| 编号 | HTTP | 路径 | 中文用途 | 官方安全类型 | 官方依据 |
|---|---|---|---|---|---|
| SX-01 | `DELETE` | `/sapi/v1/algo/spot/order` | 撤销现货算法订单 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/advanced-trading-algo-trading/api/rest-api/spot-algo) |
| SX-02 | `GET` | `/sapi/v1/algo/spot/openOrders` | 查询当前未完成现货算法订单 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/advanced-trading-algo-trading/api/rest-api/spot-algo) |
| SX-03 | `GET` | `/sapi/v1/algo/spot/historicalOrders` | 查询历史现货算法订单 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/advanced-trading-algo-trading/api/rest-api/spot-algo) |
| SX-04 | `GET` | `/sapi/v1/algo/spot/subOrders` | 查询现货算法订单的子订单 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/advanced-trading-algo-trading/api/rest-api/spot-algo) |
| SX-05 | `POST` | `/sapi/v1/algo/spot/newOrderTwap` | 创建现货 TWAP 算法订单 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/advanced-trading-algo-trading/api/rest-api/spot-algo) |

这些是独立 Algo Trading 产品的现货分支，因此单独计数；不是计算 MACD、RSI 的接口。其正式定义和主域名见[现货算法交易文档](https://developers.binance.com/en/docs/catalog/advanced-trading-algo-trading/api/rest-api/spot-algo)。

## BTC、ETH 获取方式与指标边界

交易对可使用 `BTCUSDT`、`ETHUSDT` 等；可交易币对、状态、价格步长和数量步长应查询 `exchangeInfo`，不把 BTC 或 ETH 单个资产名直接当作交易对参数。[交易对定义](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/general)

下面是 Windows PowerShell 中的公开 GET 示例：

```powershell
# BTC 最新价
curl.exe -sS "https://data-api.binance.vision/api/v3/ticker/price?symbol=BTCUSDT"

# ETH 滚动 24 小时行情
curl.exe -sS "https://data-api.binance.vision/api/v3/ticker/24hr?symbol=ETHUSDT"

# BTC 最近 500 根小时 K 线
curl.exe -sS "https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=500"
```

在现货 `klines` 的 12 个位置中，索引 0/6 是开盘与收盘时间，1–4 是开高低收，5 是基础资产成交量，7 是计价资产成交额，8 是成交笔数，9/10 是主动买入数量与金额，11 为忽略字段。以 BTCUSDT 为例，基础资产是 BTC，计价资产是 USDT。单次 `limit` 最大为 1000。[K 线定义](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/market)

在本次完整核对的官方现货 REST 目录中，没有发现直接输出 MACD、RSI 的端点；这是对上述目录的检索结论，不是对币安所有内部服务的断言。可用收盘价序列调用 TA-Lib 的 `MACD`、`RSI` 函数，计算时固定周期、参数及是否包含未收盘 K 线。[TA-Lib 函数定义](https://ta-lib.github.io/ta-lib-python/func_groups/momentum_indicators.html)

## 核验方法与边界

- 核验日期：2026-10-01（Asia/Shanghai）。
- 逐项提取官方 [llms.txt](https://developers.binance.com/en/docs/llms.txt) 与 [llms-full.txt](https://developers.binance.com/en/docs/llms-full.txt) 中对应 REST 产品章节，对比 `HTTP 方法 + 路径` 集合，检查遗漏、重复及大小写；主目录两份来源的集合完全一致。
- 这两份机器可读文件属于同一官方站点的不同导出格式，对比用于检查清单完整性，不把它们宣称为两家独立机构的验证。
- 每行“官方依据”链接到包含该端点的官方分类页；打开后搜索完整路径，即可查看参数、响应、权重、限制。表内用途为中文摘要，HTTP 方法和路径来自官方原文。
- 这是接口级清单，不是全部请求参数或全部 JSON 字段的复制。未对所有接口做实盘调用，不能将“官方文档收录”理解为“所有地区、账户和币种都保证可调用”。
- 同一路径的不同 HTTP 方法分别计数；合约还按产品域名分别计数。已弃用接口保留并注明，不通过版本号自行推断其他接口是否已停用。
- 用于此次比对的官方索引 SHA-256（UTF-8／LF 规范化文本）：`0118119ca307557c9edc44d7a7a56e9b4ed6ba4a12e44e7b2d042463fbd3ea04`。
- 完整官方导出 SHA-256（UTF-8／LF 规范化文本）：`9630afb88aa729d57ceb5513ccc08c09620a9bc9c525012a7f5ef059874cf7e2`。
