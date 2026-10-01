# 币安历史成交数据

数据来自 [Binance Public Data](https://github.com/binance/binance-public-data)，使用官方 `trades` 逐笔成交文件。价格是成交价格；挂单、标记价格和聚合成交属于其他数据类型。

## 目录约定

按「处理阶段 / 数据源 / 市场 / 数据类型 / 交易对 / 时区（整理后的数据）/ 年 / 月 / 日」归类：

```text
data/
  raw/binance/futures/um/trades/ETHUSDT/2026/09/29/
    ETHUSDT-trades-2026-09-29.zip
    ETHUSDT-trades-2026-09-29.zip.CHECKSUM
    metadata.json
  raw/binance/futures/um/trades/ETHUSDT/2026/09/30/
    ETHUSDT-trades-2026-09-30.zip
    ETHUSDT-trades-2026-09-30.zip.CHECKSUM
    metadata.json
  processed/binance/futures/um/trades/ETHUSDT/Asia_Shanghai/2026/09/30/
    ETHUSDT-trades-2026-09-30.csv
    metadata.json
```

`futures/um` 表示 U 本位合约；`ETHUSDT` 表示 ETHUSDT 永续合约。其他交易对放在同级目录，其他市场或数据类型使用独立目录。原始文件和整理后的 CSV 已通过本目录的 `.gitignore` 排除，避免大文件进入 Git；说明与下载脚本可正常提交。

## 日期与时区

官方日包按 UTC 日期划分。本次「昨日」按用户的北京时间解释为 **2026-09-30 00:00:00（含）至 2026-10-01 00:00:00（不含），Asia/Shanghai**。

对应 UTC 区间是 **2026-09-29 16:00:00（含）至 2026-09-30 16:00:00（不含）**，因此需要两个官方日包。整理后的 CSV 保留此区间内每一笔成交，包括价格相同的连续成交，不进行采样、聚合或补造记录。CSV 的 `time` 仍为 Unix 毫秒时间戳，时区只影响日期筛选。

## 本次下载结果

- 北京时间 2026-09-30 的 ETHUSDT 永续合约：**4,703,449 笔**，CSV **250,958,231 字节**（约 251 MB）。
- 首笔：北京时间 `2026-09-30 00:00:00.024`，编号 `8801042307`；末笔：`2026-09-30 23:59:59.691`，编号 `8805759723`。
- 两份原始 ZIP 的官方 SHA-256 及 ZIP CRC 均通过；选中记录无重复编号，时间顺序检查通过。
- 成交编号有 **13,624 处不连续**，首尾编号范围内有 **13,968 个未出现的编号**。已抽查前三处在原始官方 ZIP 中同样存在，并非此次 CSV 筛选产生；目前没有确认这些编号缺口的具体原因，不将缺口直接等同于丢失交易。
- 官方档案来自 `/fapi/v1/trades`；[接口文档](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data) 说明该接口仅返回订单簿市场成交，不包含保险基金交易和 ADL 交易。因此这里的范围是交易所公开的市场成交记录。

完整的文件来源、SHA-256、大小、时间区间与校验结果见对应目录的 `metadata.json`。

## 继续下载

在项目根目录运行，需要 Python 3.11+，仅使用标准库，无需安装额外依赖或提供 API Key：

```powershell
# 北京时间一天；默认时区为 Asia/Shanghai
.\.venv\Scripts\python.exe scripts/download_binance_trades.py --symbol ETHUSDT --date 2026-09-30

# 改币种、日期即可追加下载
.\.venv\Scripts\python.exe scripts/download_binance_trades.py --symbol BTCUSDT --date 2026-09-30

# 如需官方 UTC 整天的数据，显式选择 UTC
.\.venv\Scripts\python.exe scripts/download_binance_trades.py --symbol ETHUSDT --date 2026-09-30 --timezone UTC
```

当前脚本支持 U 本位合约的日级 `trades` 文件，日期必须明确指定，避免依赖电脑本地日期。已通过官方校验的原始 ZIP 会复用；重跑会重新生成对应的 CSV 与元数据。官方尚未发布文件时会报错，不会替换成其他日期或其他数据类型。官方可能修订历史文件，脚本每次获取最新 CHECKSUM；原始 ZIP 内容变化时会重新下载。

## 字段与校验

CSV 使用官方 U 本位合约字段：

| 字段 | 含义 |
|---|---|
| `id` | 此交易对的成交编号 |
| `price` | 成交价格，保留原始十进制文本 |
| `qty` | 成交数量 |
| `quote_qty` | 计价资产成交额（ETHUSDT 为 USDT） |
| `time` | 成交时间，Unix 毫秒时间戳 |
| `is_buyer_maker` | 买方是否为挂单方 |

下载时核对官方 SHA-256，并完整读取 ZIP 内的 CSV 以验证 CRC。整理时检查源文件 UTC 日期范围、字段、成交编号递增、选中记录时间顺序、价格和数量；元数据记录笔数、首尾成交、编号缺口、文件大小、校验值、来源地址与校验时间。

`metadata.json` 中的 `validation` 是检查结果；编号无缺口与校验通过说明本地数据符合这些检查，不构成对交易所原始数据绝对无遗漏的保证。发现缺口时保留真实记录并在元数据中报告，不自动填充。
