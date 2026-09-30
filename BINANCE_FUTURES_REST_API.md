# 币安合约 REST API 完整清单

核验日期：2026-10-01。本文完整列出官方 **USDⓈ-M Futures REST API 的 95 个端点**及 **COIN-M Futures REST API 的 64 个端点**。另列官方迁移公告补充的 **3 项**币本位条件单接口，以及合约算法交易 **6 项**、合约带单查询 **2 项**，共 **170 项**。

## 范围与计数

| 产品及分类 | 数量 |
|---|---:|
| U 本位：行情、交易规则与基础信息 | 34 |
| U 本位：账户 | 21 |
| U 本位：交易及订单（含 GET 查询） | 32 |
| U 本位：兑换 | 4 |
| U 本位：经典统一账户入口 | 1 |
| U 本位：用户数据流 REST 管理 | 3 |
| U 本位核心小计 | 95 |
| 币本位：行情、交易规则与基础信息 | 26 |
| 币本位：账户 | 13 |
| 币本位：交易及订单（含 GET 查询） | 22 |
| 币本位：用户数据流 REST 管理 | 3 |
| 币本位核心小计 | 64 |
| 官方迁移公告补充（不在上述主目录内） | 3 |
| 独立合约算法交易产品 | 6 |
| 独立合约带单产品 | 2 |
| 合计 | 170 |

“完整”针对上述官方产品目录及核验日期。期权、保证金杠杆交易、独立 Portfolio Margin／Portfolio Margin Pro 全套接口、钱包和机构产品不混入普通合约目录。普通 U 本位目录本身列出的 `pmAccountInfo` 则保留。其他产品边界见[官方 API 总目录](https://developers.binance.com/en/docs/catalog)。

## 域名与交易对

| 产品 | 主域名 | 交易对示例 |
|---|---|---|
| U 本位 USDⓈ-M | `https://fapi.binance.com` | `BTCUSDT`、`ETHUSDT` |
| 币本位 COIN-M | `https://dapi.binance.com` | `BTCUSD_PERP`、`ETHUSD_PERP`；pair 示例为 `BTCUSD`、`ETHUSD` |
| 附录中的 `/sapi/` 算法交易、带单 | `https://api.binance.com` | 依具体接口定义 |

交易对示例不是实时在售合约清单；应通过相应 `exchangeInfo` 获取当前合约及状态。U 本位与币本位可能使用完全相同的 `/futures/data/...` 路径，但主域名、`symbol`／`pair` 参数、数量单位及合约范围不同，必须分别处理。[U 本位说明](https://developers.binance.com/en/docs/products/derivatives-trading-usds-futures/general-info)、[币本位说明](https://developers.binance.com/en/docs/products/derivatives-trading-coin-futures/general-info)

## 权限与使用说明

| 官方安全类型 | 通用含义 |
|---|---|
| USER_DATA | API Key + 签名；个人账户相关 |
| TRADE | API Key + 签名；所需权限以接口为准 |
| MARKET_DATA | API Key；行情类别并不自动等于无需认证 |
| USER_STREAM | API Key；用户数据流管理 |
| 未标注² | 官方端点标题未给出安全类型，本文保留这一事实；详细页若要求认证，以详细页为准 |

² 不仅凭 GET 方法推断权限。`GET positionMargin/history` 在官方目录中标为 TRADE，带单状态 GET 也标为 TRADE；本文没有擅自改成 USER_DATA。反之，`POST convert/acceptQuote` 虽标为 USER_DATA，仍然会执行兑换。**权限标签不是“是否修改账户”的判定标准。**[合约权限规则](https://developers.binance.com/en/docs/products/derivatives-trading-usds-futures/general-info#endpoint-security-type)

以下交易分类按 GET 查询与非 GET 操作拆开显示，端点的来源仍链接到原官方分类页。下载任务的 GET 可能申请服务器任务，不应把所有 GET 理解为完全无副作用。

## U 本位合约（USDⓈ-M）

### 行情、交易规则与基础信息（34 项）

| 编号 | HTTP | 路径 | 中文用途 | 官方安全类型 | 官方依据 |
|---|---|---|---|---|---|
| UM-01 | `GET` | `/fapi/v1/symbolAdlRisk` | 交易对级别 ADL 风险评级 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data) |
| UM-02 | `GET` | `/futures/data/basis` | 合约基差及基差率 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data) |
| UM-03 | `GET` | `/fapi/v1/time` | 服务器时间 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data) |
| UM-04 | `GET` | `/fapi/v1/indexInfo` | 综合指数成分信息 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data) |
| UM-05 | `GET` | `/fapi/v1/aggTrades` | 聚合成交记录 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data) |
| UM-06 | `GET` | `/fapi/v1/continuousKlines` | 连续合约 K 线 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data) |
| UM-07 | `GET` | `/fapi/v1/exchangeInfo` | 交易对信息、交易规则及限额 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data) |
| UM-08 | `GET` | `/fapi/v1/fundingRate` | 历史资金费率 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data) |
| UM-09 | `GET` | `/fapi/v1/fundingInfo` | 资金费率上限、下限及结算间隔调整信息 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data) |
| UM-10 | `GET` | `/fapi/v1/indexPriceKlines` | 指数价格 K 线 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data) |
| UM-11 | `GET` | `/fapi/v1/klines` | 交易价格 K 线及成交统计 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data) |
| UM-12 | `GET` | `/futures/data/globalLongShortAccountRatio` | 多空账户比例 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data) |
| UM-13 | `GET` | `/fapi/v1/premiumIndex` | 标记价格、指数价格及资金费率信息 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data) |
| UM-14 | `GET` | `/fapi/v1/markPriceKlines` | 标记价格 K 线 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data) |
| UM-15 | `GET` | `/fapi/v1/assetIndex` | 资产价格指数；迁移公告已扩展至币本位结算资产 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data) |
| UM-16 | `GET` | `/fapi/v1/historicalTrades` | 较早的逐笔成交 | MARKET_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data) |
| UM-17 | `GET` | `/fapi/v1/openInterest` | 当前未平仓合约量 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data) |
| UM-18 | `GET` | `/futures/data/openInterestHist` | 历史未平仓量及价值统计 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data) |
| UM-19 | `GET` | `/fapi/v1/depth` | 买卖盘口深度 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data) |
| UM-20 | `GET` | `/fapi/v1/premiumIndexKlines` | 溢价指数 K 线 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data) |
| UM-21 | `GET` | `/futures/data/delivery-price` | 季度交割合约结算价 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data) |
| UM-22 | `GET` | `/fapi/v1/constituents` | 查询价格指数成分 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data) |
| UM-23 | `GET` | `/fapi/v1/insuranceBalance` | 保险基金余额快照 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data) |
| UM-24 | `GET` | `/fapi/v1/trades` | 最近逐笔成交 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data) |
| UM-25 | `GET` | `/fapi/v1/rpiDepth` | 包含 RPI 订单的盘口深度 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data) |
| UM-26 | `GET` | `/fapi/v1/ticker/bookTicker` | 最优买卖报价及数量 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data) |
| UM-27 | `GET` | `/fapi/v1/ticker/price` | 最新成交价【已弃用；参见 V2】 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data) |
| UM-28 | `GET` | `/fapi/v2/ticker/price` | 最新成交价 V2 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data) |
| UM-29 | `GET` | `/futures/data/takerlongshortRatio` | 主动买入、卖出成交统计 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data) |
| UM-30 | `GET` | `/fapi/v1/ping` | 连通性测试 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data) |
| UM-31 | `GET` | `/fapi/v1/ticker/24hr` | 滚动 24 小时行情统计 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data) |
| UM-32 | `GET` | `/futures/data/topLongShortAccountRatio` | 大户多空账户比例 | MARKET_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data) |
| UM-33 | `GET` | `/futures/data/topLongShortPositionRatio` | 大户多空持仓比例 | MARKET_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data) |
| UM-34 | `GET` | `/fapi/v1/tradingSchedule` | TradFi 标的交易时段；不属于 BTC/ETH 行情 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data) |

注意：`GET /fapi/v1/ticker/price` 在当前详细页标为 deprecated，应查看 V2；`tradingSchedule` 面向 TradFi 标的交易时段，不是 BTC／ETH 专属行情。`symbolAdlRisk` 是市场交易对级别的风险评级，与下面个人持仓的 `adlQuantile` 不同。[官方行情页](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data)

### 账户查询（21 项）

| 编号 | HTTP | 路径 | 中文用途 | 官方安全类型 | 官方依据 |
|---|---|---|---|---|---|
| UA-01 | `GET` | `/fapi/v2/account` | 账户信息 V2 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/account) |
| UA-02 | `GET` | `/fapi/v3/account` | 账户信息 V3 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/account) |
| UA-03 | `GET` | `/fapi/v2/balance` | 合约账户余额 V2 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/account) |
| UA-04 | `GET` | `/fapi/v3/balance` | 合约账户余额 V3 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/account) |
| UA-05 | `GET` | `/fapi/v1/accountConfig` | 合约账户配置 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/account) |
| UA-06 | `GET` | `/fapi/v1/apiTradingStatus` | 账户量化交易规则指标 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/account) |
| UA-07 | `GET` | `/fapi/v1/feeBurn` | 查询 BNB 手续费抵扣状态 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/account) |
| UA-08 | `POST` | `/fapi/v1/feeBurn` | 修改合约 BNB 手续费抵扣设置 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/account) |
| UA-09 | `GET` | `/fapi/v1/multiAssetsMargin` | 查询联合保证金模式 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/account) |
| UA-10 | `GET` | `/fapi/v1/positionSide/dual` | 查询持仓模式 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/account) |
| UA-11 | `GET` | `/fapi/v1/order/asyn` | 申请历史订单下载任务 ID | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/account) |
| UA-12 | `GET` | `/fapi/v1/trade/asyn` | 申请历史成交下载任务 ID | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/account) |
| UA-13 | `GET` | `/fapi/v1/income/asyn` | 申请历史资金流水下载任务 ID | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/account) |
| UA-14 | `GET` | `/fapi/v1/order/asyn/id` | 凭任务 ID 获取历史订单下载链接 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/account) |
| UA-15 | `GET` | `/fapi/v1/trade/asyn/id` | 凭任务 ID 获取历史成交下载链接 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/account) |
| UA-16 | `GET` | `/fapi/v1/income/asyn/id` | 凭任务 ID 获取资金流水下载链接 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/account) |
| UA-17 | `GET` | `/fapi/v1/income` | 账户收益及资金流水 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/account) |
| UA-18 | `GET` | `/fapi/v1/leverageBracket` | 名义价值与杠杆分档 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/account) |
| UA-19 | `GET` | `/fapi/v1/rateLimit/order` | 查询账户订单速率限制 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/account) |
| UA-20 | `GET` | `/fapi/v1/symbolConfig` | 交易对级别的账户配置 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/account) |
| UA-21 | `GET` | `/fapi/v1/commissionRate` | 查询账户交易手续费率 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/account) |

### 订单、成交及持仓查询（14 项）

| 编号 | HTTP | 路径 | 中文用途 | 官方安全类型 | 官方依据 |
|---|---|---|---|---|---|
| UQ-01 | `GET` | `/fapi/v1/userTrades` | 账户个人成交记录 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/trade) |
| UQ-02 | `GET` | `/fapi/v1/allOrders` | 全部个人订单 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/trade) |
| UQ-03 | `GET` | `/fapi/v1/algoOrder` | 查询单个条件策略订单 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/trade) |
| UQ-04 | `GET` | `/fapi/v1/order` | 查询单个订单 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/trade) |
| UQ-05 | `GET` | `/fapi/v1/openAlgoOrders` | 当前未完成条件策略订单 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/trade) |
| UQ-06 | `GET` | `/fapi/v1/openOrders` | 当前全部个人挂单 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/trade) |
| UQ-07 | `GET` | `/fapi/v1/orderAmendment` | 订单修改历史 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/trade) |
| UQ-08 | `GET` | `/fapi/v1/positionMargin/history` | 持仓保证金调整历史 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/trade) |
| UQ-09 | `GET` | `/fapi/v1/adlQuantile` | 个人持仓 ADL 队列分位估计 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/trade) |
| UQ-10 | `GET` | `/fapi/v2/positionRisk` | 个人持仓及风险信息 V2 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/trade) |
| UQ-11 | `GET` | `/fapi/v3/positionRisk` | 个人持仓及风险信息 V3 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/trade) |
| UQ-12 | `GET` | `/fapi/v1/allAlgoOrders` | 查询全部条件策略订单 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/trade) |
| UQ-13 | `GET` | `/fapi/v1/openOrder` | 查询单个当前挂单 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/trade) |
| UQ-14 | `GET` | `/fapi/v1/forceOrders` | 个人强制订单记录；不是全市场爆仓记录 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/trade) |

### 下单、撤单、改单及配置操作（18 项）

| 编号 | HTTP | 路径 | 中文用途 | 官方安全类型 | 官方依据 |
|---|---|---|---|---|---|
| UT-01 | `POST` | `/fapi/v1/multiAssetsMargin` | 切换联合保证金模式 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/trade) |
| UT-02 | `POST` | `/fapi/v1/positionSide/dual` | 切换单向或双向持仓模式 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/trade) |
| UT-03 | `POST` | `/fapi/v1/countdownCancelAll` | 设置倒计时自动撤销挂单 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/trade) |
| UT-04 | `POST` | `/fapi/v1/algoOrder` | 创建条件策略订单 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/trade) |
| UT-05 | `DELETE` | `/fapi/v1/algoOrder` | 撤销条件策略订单 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/trade) |
| UT-06 | `DELETE` | `/fapi/v1/algoOpenOrders` | 撤销全部未完成条件策略订单 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/trade) |
| UT-07 | `DELETE` | `/fapi/v1/allOpenOrders` | 撤销全部挂单 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/trade) |
| UT-08 | `PUT` | `/fapi/v1/batchOrders` | 批量修改订单 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/trade) |
| UT-09 | `POST` | `/fapi/v1/batchOrders` | 批量下单 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/trade) |
| UT-10 | `DELETE` | `/fapi/v1/batchOrders` | 批量撤单 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/trade) |
| UT-11 | `PUT` | `/fapi/v1/order` | 修改单个订单 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/trade) |
| UT-12 | `POST` | `/fapi/v1/order` | 创建订单 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/trade) |
| UT-13 | `DELETE` | `/fapi/v1/order` | 撤销单个订单 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/trade) |
| UT-14 | `POST` | `/fapi/v1/leverage` | 修改初始杠杆倍数 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/trade) |
| UT-15 | `POST` | `/fapi/v1/marginType` | 切换逐仓或全仓模式 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/trade) |
| UT-16 | `POST` | `/fapi/v1/stock/contract` | 签署 TradFi 永续合约协议；不属于 BTC/ETH 行情 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/trade) |
| UT-17 | `POST` | `/fapi/v1/positionMargin` | 调整逐仓持仓保证金 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/trade) |
| UT-18 | `POST` | `/fapi/v1/order/test` | 合约订单测试 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/trade) |

### 合约兑换（4 项）

| 编号 | HTTP | 路径 | 中文用途 | 官方安全类型 | 官方依据 |
|---|---|---|---|---|---|
| UC-01 | `POST` | `/fapi/v1/convert/acceptQuote` | 接受兑换报价并执行兑换 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/convert) |
| UC-02 | `GET` | `/fapi/v1/convert/exchangeInfo` | 支持兑换的币对 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/convert) |
| UC-03 | `GET` | `/fapi/v1/convert/orderStatus` | 查询兑换订单状态 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/convert) |
| UC-04 | `POST` | `/fapi/v1/convert/getQuote` | 申请兑换报价 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/convert) |

### 核心目录中的经典统一账户入口（1 项）

| 编号 | HTTP | 路径 | 中文用途 | 官方安全类型 | 官方依据 |
|---|---|---|---|---|---|
| UP-01 | `GET` | `/fapi/v1/pmAccountInfo` | 经典统一账户保证金信息 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/portfolio-margin-endpoints) |

### 用户数据流的 REST 管理（3 项）

| 编号 | HTTP | 路径 | 中文用途 | 官方安全类型 | 官方依据 |
|---|---|---|---|---|---|
| US-01 | `PUT` | `/fapi/v1/listenKey` | 延长用户数据流 listenKey 有效期 | USER_STREAM | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/user-data-streams) |
| US-02 | `POST` | `/fapi/v1/listenKey` | 创建用户数据流 listenKey | USER_STREAM | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/user-data-streams) |
| US-03 | `DELETE` | `/fapi/v1/listenKey` | 关闭用户数据流 listenKey | USER_STREAM | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/user-data-streams) |

以上 listenKey 管理是 REST 调用；实际账户事件推送通过 WebSocket，不能将推送流本身计为 REST 数据接口。

## 币本位合约（COIN-M）

### 行情、交易规则与基础信息（26 项）

| 编号 | HTTP | 路径 | 中文用途 | 官方安全类型 | 官方依据 |
|---|---|---|---|---|---|
| CM-01 | `GET` | `/futures/data/basis` | 合约基差及基差率 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/market-data) |
| CM-02 | `GET` | `/dapi/v1/time` | 服务器时间 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/market-data) |
| CM-03 | `GET` | `/dapi/v1/aggTrades` | 聚合成交记录 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/market-data) |
| CM-04 | `GET` | `/dapi/v1/continuousKlines` | 连续合约 K 线 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/market-data) |
| CM-05 | `GET` | `/dapi/v1/exchangeInfo` | 交易对信息、交易规则及限额 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/market-data) |
| CM-06 | `GET` | `/dapi/v1/fundingRate` | 永续合约历史资金费率 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/market-data) |
| CM-07 | `GET` | `/dapi/v1/fundingInfo` | 资金费率上限、下限及结算间隔调整信息 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/market-data) |
| CM-08 | `GET` | `/dapi/v1/premiumIndex` | 指数价格、标记价格及相关资金费率信息 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/market-data) |
| CM-09 | `GET` | `/dapi/v1/indexPriceKlines` | 指数价格 K 线 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/market-data) |
| CM-10 | `GET` | `/dapi/v1/klines` | 交易价格 K 线及成交统计 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/market-data) |
| CM-11 | `GET` | `/futures/data/globalLongShortAccountRatio` | 多空账户比例 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/market-data) |
| CM-12 | `GET` | `/dapi/v1/markPriceKlines` | 标记价格 K 线 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/market-data) |
| CM-13 | `GET` | `/dapi/v1/historicalTrades` | 较早的逐笔成交 | MARKET_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/market-data) |
| CM-14 | `GET` | `/dapi/v1/openInterest` | 当前未平仓合约量 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/market-data) |
| CM-15 | `GET` | `/futures/data/openInterestHist` | 历史未平仓量及价值统计 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/market-data) |
| CM-16 | `GET` | `/dapi/v1/depth` | 买卖盘口深度 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/market-data) |
| CM-17 | `GET` | `/dapi/v1/premiumIndexKlines` | 溢价指数 K 线 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/market-data) |
| CM-18 | `GET` | `/dapi/v1/constituents` | 查询价格指数成分 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/market-data) |
| CM-19 | `GET` | `/dapi/v1/trades` | 最近逐笔成交 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/market-data) |
| CM-20 | `GET` | `/dapi/v1/ticker/bookTicker` | 最优买卖报价及数量 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/market-data) |
| CM-21 | `GET` | `/dapi/v1/ticker/price` | 最新成交价 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/market-data) |
| CM-22 | `GET` | `/futures/data/takerBuySellVol` | 主动买入、卖出成交统计 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/market-data) |
| CM-23 | `GET` | `/dapi/v1/ping` | 连通性测试 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/market-data) |
| CM-24 | `GET` | `/dapi/v1/ticker/24hr` | 滚动 24 小时行情统计 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/market-data) |
| CM-25 | `GET` | `/futures/data/topLongShortAccountRatio` | 大户多空账户比例 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/market-data) |
| CM-26 | `GET` | `/futures/data/topLongShortPositionRatio` | 大户多空持仓比例 | 未标注² | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/market-data) |

### 账户查询（13 项）

| 编号 | HTTP | 路径 | 中文用途 | 官方安全类型 | 官方依据 |
|---|---|---|---|---|---|
| CA-01 | `GET` | `/dapi/v1/account` | 账户信息 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/account) |
| CA-02 | `GET` | `/dapi/v1/balance` | 合约账户余额 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/account) |
| CA-03 | `GET` | `/dapi/v1/positionSide/dual` | 查询持仓模式 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/account) |
| CA-04 | `GET` | `/dapi/v1/order/asyn` | 申请历史订单下载任务 ID | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/account) |
| CA-05 | `GET` | `/dapi/v1/trade/asyn` | 申请历史成交下载任务 ID | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/account) |
| CA-06 | `GET` | `/dapi/v1/income/asyn` | 申请历史资金流水下载任务 ID | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/account) |
| CA-07 | `GET` | `/dapi/v1/order/asyn/id` | 凭任务 ID 获取历史订单下载链接 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/account) |
| CA-08 | `GET` | `/dapi/v1/trade/asyn/id` | 凭任务 ID 获取历史成交下载链接 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/account) |
| CA-09 | `GET` | `/dapi/v1/income/asyn/id` | 凭任务 ID 获取资金流水下载链接 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/account) |
| CA-10 | `GET` | `/dapi/v1/income` | 账户收益及资金流水 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/account) |
| CA-11 | `GET` | `/dapi/v1/leverageBracket` | 按 pair 查询名义价值分档 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/account) |
| CA-12 | `GET` | `/dapi/v2/leverageBracket` | 按 symbol 查询名义价值分档 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/account) |
| CA-13 | `GET` | `/dapi/v1/commissionRate` | 查询账户交易手续费率 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/account) |

### 订单、成交及持仓查询（10 项）

| 编号 | HTTP | 路径 | 中文用途 | 官方安全类型 | 官方依据 |
|---|---|---|---|---|---|
| CQ-01 | `GET` | `/dapi/v1/userTrades` | 账户个人成交记录 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/trade) |
| CQ-02 | `GET` | `/dapi/v1/allOrders` | 全部个人订单 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/trade) |
| CQ-03 | `GET` | `/dapi/v1/order` | 查询单个订单 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/trade) |
| CQ-04 | `GET` | `/dapi/v1/openOrders` | 当前全部个人挂单 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/trade) |
| CQ-05 | `GET` | `/dapi/v1/orderAmendment` | 订单修改历史 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/trade) |
| CQ-06 | `GET` | `/dapi/v1/positionMargin/history` | 持仓保证金调整历史 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/trade) |
| CQ-07 | `GET` | `/dapi/v1/adlQuantile` | 个人持仓 ADL 队列分位估计 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/trade) |
| CQ-08 | `GET` | `/dapi/v1/positionRisk` | 个人持仓及风险信息 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/trade) |
| CQ-09 | `GET` | `/dapi/v1/openOrder` | 查询单个当前挂单 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/trade) |
| CQ-10 | `GET` | `/dapi/v1/forceOrders` | 个人强制订单记录；不是全市场爆仓记录 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/trade) |

### 下单、撤单、改单及配置操作（12 项）

| 编号 | HTTP | 路径 | 中文用途 | 官方安全类型 | 官方依据 |
|---|---|---|---|---|---|
| CT-01 | `POST` | `/dapi/v1/positionSide/dual` | 切换单向或双向持仓模式 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/trade) |
| CT-02 | `POST` | `/dapi/v1/countdownCancelAll` | 设置倒计时自动撤销挂单 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/trade) |
| CT-03 | `DELETE` | `/dapi/v1/allOpenOrders` | 撤销全部挂单 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/trade) |
| CT-04 | `PUT` | `/dapi/v1/batchOrders` | 批量修改订单 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/trade) |
| CT-05 | `POST` | `/dapi/v1/batchOrders` | 批量下单 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/trade) |
| CT-06 | `DELETE` | `/dapi/v1/batchOrders` | 批量撤单 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/trade) |
| CT-07 | `PUT` | `/dapi/v1/order` | 修改单个订单 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/trade) |
| CT-08 | `POST` | `/dapi/v1/order` | 创建订单 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/trade) |
| CT-09 | `DELETE` | `/dapi/v1/order` | 撤销单个订单 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/trade) |
| CT-10 | `POST` | `/dapi/v1/leverage` | 修改初始杠杆倍数 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/trade) |
| CT-11 | `POST` | `/dapi/v1/marginType` | 切换逐仓或全仓模式 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/trade) |
| CT-12 | `POST` | `/dapi/v1/positionMargin` | 调整逐仓持仓保证金 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/trade) |

### 用户数据流的 REST 管理（3 项）

| 编号 | HTTP | 路径 | 中文用途 | 官方安全类型 | 官方依据 |
|---|---|---|---|---|---|
| CS-01 | `PUT` | `/dapi/v1/listenKey` | 延长用户数据流 listenKey 有效期 | USER_STREAM | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/user-data-streams) |
| CS-02 | `POST` | `/dapi/v1/listenKey` | 创建用户数据流 listenKey | USER_STREAM | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/user-data-streams) |
| CS-03 | `DELETE` | `/dapi/v1/listenKey` | 关闭用户数据流 listenKey | USER_STREAM | [文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/user-data-streams) |

## 官方迁移公告补充：币本位条件单（3 项）

官方架构整合公告 C.5 明确列出下列三个方法和路径，但本次获取的 COIN-M 主目录及其机器可读导出未收录。因此单独列为“公告证实存在、详细定义未在本次主目录中找到”，不借用 U 本位接口猜测全部参数或权限要求。[公告依据](https://developers.binance.com/en/docs/products/derivatives-trading-coin-futures/Important-CM-UM-Integration-Notice)

| 编号 | HTTP | 路径 | 中文用途 | 核验状态 | 官方依据 |
|---|---|---|---|---|---|
| CN-01 | `POST` | `/dapi/v1/algoOrder` | 创建币本位条件策略订单 | 仅确认公告中的定义；完整参数、认证需继续核对 | [公告 C.5](https://developers.binance.com/en/docs/products/derivatives-trading-coin-futures/Important-CM-UM-Integration-Notice) |
| CN-02 | `GET` | `/dapi/v1/openAlgoOrders` | 查询未完成币本位条件策略订单 | 仅确认公告中的定义；完整参数、认证需继续核对 | [公告 C.5](https://developers.binance.com/en/docs/products/derivatives-trading-coin-futures/Important-CM-UM-Integration-Notice) |
| CN-03 | `DELETE` | `/dapi/v1/algoOrder` | 撤销币本位条件策略订单 | 仅确认公告中的定义；完整参数、认证需继续核对 | [公告 C.5](https://developers.binance.com/en/docs/products/derivatives-trading-coin-futures/Important-CM-UM-Integration-Notice) |

同一公告还说明部分 K 线端点可接受 UM、CM 两类标识，UM／CM 共用部分账户设置与限额池，`assetIndex` 扩展了币本位结算资产。不要机械地把某个 fapi 路径替换为 dapi 来“创造”接口，也不要把某一类接口的兼容性推广到所有端点。[架构整合公告](https://developers.binance.com/en/docs/products/derivatives-trading-coin-futures/Important-CM-UM-Integration-Notice)

## 附录：合约算法交易（6 项）

| 编号 | HTTP | 路径 | 中文用途 | 官方安全类型 | 官方依据 |
|---|---|---|---|---|---|
| FX-01 | `DELETE` | `/sapi/v1/algo/futures/order` | 撤销合约算法订单 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/advanced-trading-algo-trading/api/rest-api/future-algo) |
| FX-02 | `GET` | `/sapi/v1/algo/futures/openOrders` | 查询当前未完成合约算法订单 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/advanced-trading-algo-trading/api/rest-api/future-algo) |
| FX-03 | `GET` | `/sapi/v1/algo/futures/historicalOrders` | 查询历史合约算法订单 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/advanced-trading-algo-trading/api/rest-api/future-algo) |
| FX-04 | `GET` | `/sapi/v1/algo/futures/subOrders` | 查询合约算法订单的子订单 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/advanced-trading-algo-trading/api/rest-api/future-algo) |
| FX-05 | `POST` | `/sapi/v1/algo/futures/newOrderTwap` | 创建合约 TWAP 算法订单 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/advanced-trading-algo-trading/api/rest-api/future-algo) |
| FX-06 | `POST` | `/sapi/v1/algo/futures/newOrderVp` | 创建合约 VP 成交量参与算法订单 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/advanced-trading-algo-trading/api/rest-api/future-algo) |

## 附录：合约带单查询（2 项）

| 编号 | HTTP | 路径 | 中文用途 | 官方安全类型 | 官方依据 |
|---|---|---|---|---|---|
| FL-01 | `GET` | `/sapi/v1/copyTrading/futures/userStatus` | 查询合约带单员状态 | TRADE | [文档](https://developers.binance.com/en/docs/catalog/advanced-trading-copy-trading/api/rest-api/future-copy-trading) |
| FL-02 | `GET` | `/sapi/v1/copyTrading/futures/leadSymbol` | 查询合约带单交易对允许列表 | USER_DATA | [文档](https://developers.binance.com/en/docs/catalog/advanced-trading-copy-trading/api/rest-api/future-copy-trading) |

以上两类 `/sapi/` 扩展接口使用 `https://api.binance.com`，分别来自[算法交易](https://developers.binance.com/en/docs/catalog/advanced-trading-algo-trading/api/rest-api/future-algo)和[带单](https://developers.binance.com/en/docs/catalog/advanced-trading-copy-trading/api/rest-api/future-copy-trading)独立产品，未重复计入 U 本位／币本位核心数量。

## BTC、ETH 数据使用要点

- 最新成交价、标记价格、指数价格是不同概念；先确定要使用哪一种价格序列，再计算指标。
- 资金费率和结算间隔分别核对 `fundingRate`、`fundingInfo` 等接口，不假定所有合约固定每 8 小时结算。
- 市场统计中的多空账户比、持仓比、主动买卖量各有不同口径；个人 `forceOrders` 查询的是自己的强制订单，不能当成全市场爆仓数据。
- K 线是时间序列；未收盘 K 线的数值仍可能变化。指标应明确使用交易价、标记价或指数价，并固定周期与参数。
- U 本位、币本位成交量单位应按各接口字段说明解读；不要把币本位的合约张数直接当作 BTC／ETH 数量。以相应 `exchangeInfo` 的合约定义和该 K 线页的响应字段为准。

以上定义及字段分别见[U 本位行情页](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data)、[币本位行情页](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-coin-m-futures/api/rest-api/market-data)及[个人订单查询页](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/trade)。

公开 GET 的 Windows PowerShell 示例：

```powershell
# BTC U 本位最新成交价（V2）
curl.exe -sS "https://fapi.binance.com/fapi/v2/ticker/price?symbol=BTCUSDT"

# ETH U 本位标记价格、指数价格及资金费率信息
curl.exe -sS "https://fapi.binance.com/fapi/v1/premiumIndex?symbol=ETHUSDT"

# BTC U 本位最近 500 根小时交易价格 K 线
curl.exe -sS "https://fapi.binance.com/fapi/v1/klines?symbol=BTCUSDT&interval=1h&limit=500"

# BTC 币本位永续的最新成交价
curl.exe -sS "https://dapi.binance.com/dapi/v1/ticker/price?symbol=BTCUSD_PERP"
```

本次核对的 U 本位、币本位 REST 目录未发现直接输出 MACD、RSI 的端点。可用所选价格序列调用 TA-Lib 对应函数；这属于本地计算，不属于币安新增 REST 接口。[TA-Lib 指标定义](https://ta-lib.github.io/ta-lib-python/func_groups/momentum_indicators.html)

## 已确认的限制与易混淆项

- 本清单保留 V2、V3 等官网仍收录的版本；“存在更新版本”不自动等于旧版已停用。仅对已核到弃用标记的旧 ticker 作明确标注。
- 合约统计接口的历史窗口与 K 线不同。例如 U 本位主动买卖统计页注明只能查最近 30 天；不能用它推导其他接口也只有 30 天。[主动买卖统计所在页](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data)
- 官方 2026-08-26 更新说明将 U 本位及币本位个人成交查询窗口说明调整为最近 3 个月，不能照抄旧教程中的 6 个月。[官方变更记录](https://developers.binance.com/en/docs/products/derivatives-trading-usds-futures/change-log)
- U 本位两项大户多空比例端点在当前目录带 `MARKET_DATA` 标签；币本位对应项标题未标注相同标签。两者按各自文档保留，不因名称相同而统一改写认证要求。

## 核验方法与边界

- 核验日期：2026-10-01（Asia/Shanghai）。
- 逐项提取官方 [llms.txt](https://developers.binance.com/en/docs/llms.txt) 与 [llms-full.txt](https://developers.binance.com/en/docs/llms-full.txt) 中对应 REST 产品章节，对比 `HTTP 方法 + 路径` 集合，检查遗漏、重复及大小写；主目录两份来源的集合完全一致。
- 这两份机器可读文件属于同一官方站点的不同导出格式，对比用于检查清单完整性，不把它们宣称为两家独立机构的验证。
- 每行“官方依据”链接到包含该端点的官方分类页；打开后搜索完整路径，即可查看参数、响应、权重、限制。表内用途为中文摘要，HTTP 方法和路径来自官方原文。
- 这是接口级清单，不是全部请求参数或全部 JSON 字段的复制。未对所有接口做实盘调用，不能将“官方文档收录”理解为“所有地区、账户和币种都保证可调用”。
- 同一路径的不同 HTTP 方法分别计数；合约还按产品域名分别计数。已弃用接口保留并注明，不通过版本号自行推断其他接口是否已停用。
- 用于此次比对的官方索引 SHA-256（UTF-8／LF 规范化文本）：`0118119ca307557c9edc44d7a7a56e9b4ed6ba4a12e44e7b2d042463fbd3ea04`。
- 完整官方导出 SHA-256（UTF-8／LF 规范化文本）：`9630afb88aa729d57ceb5513ccc08c09620a9bc9c525012a7f5ef059874cf7e2`。
