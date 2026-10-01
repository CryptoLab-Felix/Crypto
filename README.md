# Crypto

Python 3 + TypeScript Web 行情原型，展示币安 BTC、ETH 的现货和 U 本位永续合约行情。

## 当前功能

- 现货、合约两个模块，均可点击切换 BTC／ETH，页面只展示选中币种的行情。两个模块默认选择 BTC，并在当前页面内分别记住所选币种。
- 最新成交价、24 小时涨跌、最高／最低价、成交量、成交额和成交笔数。
- 手动刷新、每 30 秒自动刷新、数据更新时间及失败／部分成功提示；后台标签页暂停轮询。
- ETH U 本位永续增加实时盘口：卖盘、最新成交价、买盘依次排列，支持原始价位或 0.1／1／5／10 USDT 分组，每侧显示 10／20／50 档，展示挂单量、累计量及名义金额。
- 桌面与手机布局；没有演示行情回退，页面数值来自真实公开 API。

前端使用 React + TypeScript + Vite，后端使用 Python 3 + FastAPI + httpx。无需币安 API Key。当前仅展示行情，MACD、RSI 和交易操作尚未实现。

## 接入的币安 API

| 模块 | 数据 | 上游接口 |
|---|---|---|
| 现货 | 最新价格 | `https://data-api.binance.vision/api/v3/ticker/price` |
| 现货 | 24 小时行情 | `https://data-api.binance.vision/api/v3/ticker/24hr` |
| U 本位合约 | 最新价格 | `https://fapi.binance.com/fapi/v2/ticker/price` |
| U 本位合约 | 24 小时行情 | `https://fapi.binance.com/fapi/v1/ticker/24hr` |

每个模块使用两类 API，每次刷新为两个交易对分别请求，共四次上游 GET。后端并发请求，并通过 `/api/markets/spot`、`/api/markets/futures` 向前端提供统一结构。价格保留字符串精度，前端展示时格式化。最新价格与 24 小时统计是独立快照，可能存在轻微时间差；合约最新价不是标记价格。

### ETH 合约实时盘口

进入“合约市场 → ETH”即可查看，使用公开行情，无需账户或 API Key。

| 数据 | 币安接口 | 更新方式 |
|---|---|---|
| 初始盘口 | `GET https://fapi.binance.com/fapi/v1/depth?symbol=ETHUSDT&limit=1000` | 连接及重新同步时载入每侧最多 1000 档 |
| 盘口变化 | `wss://fstream.binance.com/public/ws/ethusdt@depth@100ms` | 100 毫秒增量推送 |
| 最新成交价 | `wss://fstream.binance.com/market/ws/ethusdt@aggTrade` | 随聚合成交事件更新 |

后端通过同源 WebSocket `/api/markets/futures/eth/orderbook` 转发行情。同一个后端进程的多个页面共享上游连接；先缓冲增量、再获取快照，按 `U/u/pu` 检查连续性，挂单数量按绝对值替换，零数量删除。失联或序号断档时标记旧数据并退避重连；遇到 REST 限流尊重 `Retry-After`。只维护快照内已知的价格范围，避免把远端未知价位当成零挂单，页面明确显示实际覆盖范围。快速成交合并为最多每秒 40 帧，并只向慢客户端保留最新帧；浏览器按绘制帧更新。100 毫秒是盘口源的推送周期，端到端延迟还取决于网络。

离开 ETH 合约或隐藏标签页会关闭该页面的订阅，最后一个订阅退出后释放上游连接；回来时重新同步。当前价格和盘口独立于原有 30 秒刷新，ETH 页面上的该开关只控制 24 小时统计。

合约 REST 请求共用限流冷却：盘口快照、BTC／ETH 最新价和 24 小时统计任一请求收到 418／429 后，该后端停止向币安发起新的合约 REST 请求。截止时间取 `Retry-After`（秒或 HTTP 日期）与错误消息内封禁期限中较晚者；缺失时 429 等待 60 秒、418 等待 120 秒。已经发出的请求可能完成，但成功响应不会提前清除其他请求触发的冷却。到期先放行一次探测，成功后恢复正常查询。

冷却状态保存在已忽略的 `.local/futures-rest-cooldown.json`，切页、隐藏、手动重连和本地后端重启均不能提前解除。页面区分“频率受限”和“出口暂时封禁”，显示北京时间重试期限及倒计时，并暂停定时、手动查询。正常连接的价格和盘口 WebSocket 持续接收更新。日志记录触发限制的接口、状态码、请求用量及重试时间；该保护适用于当前单进程后端，不能控制同一公网 IP 上其他应用的请求。

挂单按买卖方向汇总：卖单可能开空或平多，买单可能开多或平空，无法识别参与者、人数或开平仓比例。数据仅覆盖币安 ETHUSDT 的已载入价位，不包含 RPI、未触发的条件单或其他交易所；分组区间含下限、不含上限，边缘分组可能不完整。累计量从最优报价向外相加，名义金额是每个原始价位的价格乘数量后求和，不代表保证金或持仓规模。

依据：[币安行情接口](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data)、[本地订单簿同步规则](https://developers.binance.com/en/docs/products/derivatives-trading-usds-futures/websocket-market-streams/How-to-manage-a-local-order-book-correctly)、[WebSocket 路由说明](https://developers.binance.com/en/docs/products/derivatives-trading-usds-futures/websocket-market-streams/Important-WebSocket-Change-Notice)。

## Windows 本地运行

需要 Python 3.11 或更新版本，以及 Node.js 22.12+（本次开发使用 Python 3.11 和 Node.js 24）。在仓库根目录执行：

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.lock.txt
npm --prefix frontend ci
.\scripts\dev.ps1
```

浏览器打开 <http://127.0.0.1:5173>；后端接口文档位于 <http://127.0.0.1:8000/docs>。启动脚本将两个服务放在隐藏的后台进程中，日志位于已忽略的 `.local` 目录。停止服务：

```powershell
.\scripts\stop.ps1
```

需要查看终端日志或在其他系统开发时，可以分别在两个终端运行（使用相应虚拟环境的 Python）：

```shell
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
npm --prefix frontend run dev
```

后端需要访问币安公开行情域名；上游超时、限流或网络限制会显示明确错误。单次刷新部分失败时显示可用字段及失败提示；刷新整体失败时保留并标记上次成功数据。默认端口为 8000 和 5173，前端开发服务器将 `/api` 代理到后端。

## 构建与验证

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s backend -t . -p 'test_*.py' -v
npm --prefix frontend run build
# 先启动开发服务，再运行浏览器验证
npm --prefix frontend run test:e2e
```

Windows 浏览器验证默认使用已安装的 Chrome；可通过 `PLAYWRIGHT_CHANNEL` 指定其他已安装通道。其他系统默认使用 Playwright Chromium，首次运行前在 `frontend` 目录执行 `npx playwright install chromium`。浏览器验证包含真实行情、模块切换、刷新、移动端，以及使用测试专用响应模拟的失败重试、部分失败和请求竞态。

盘口验证另外覆盖快照衔接、更新丢失、删除与替换、共享连接释放、分组与累计量、实时价格变化、断线和无消息超时、后台暂停恢复及移动端布局。现货和合约的真实行情测试依赖上游网络及币安限流状态。

构建完成后重新启动 Python 后端，它会同时提供 `frontend/dist` 静态页面和 API，此时可访问 <http://127.0.0.1:8000>。这是本地运行配置，尚未配置公网部署。

## 持续集成（CI）

GitHub Actions 工作流位于 [`.github/workflows/ci.yml`](.github/workflows/ci.yml)，创建或更新 PR、向 `main` 推送代码时自动运行，也可以在 GitHub 的 Actions → CI → Run workflow 手动触发。

两个任务在 Ubuntu 上并行执行：

- **Backend tests**：使用 Python 3.11，按 `backend/requirements.lock.txt` 安装依赖，自动发现并运行后端 `test_*.py` 单元测试。
- **Frontend build and browser tests**：使用 Node.js 24 和 `npm ci`，执行 TypeScript 类型检查、生产构建，再用 Playwright Chromium 验证模拟行情场景。测试自动在 `127.0.0.1:4173` 启动构建预览，结束后关闭服务，无需运行后端。

CI 浏览器配置排除标记为 `@live` 的真实行情测试，避免币安限流或网络状态影响检查结果；新增依赖真实上游的测试也应添加此标记。保留原有 `test:e2e` 命令用于完整的本地验证。CI 配置禁止提交 `test.only`，失败时在对应运行的 Artifacts 中保存 `playwright-report`（HTML 报告、失败截图和 trace），保留 7 天。

本地复现 CI 检查，在仓库根目录执行：

```powershell
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.lock.txt
.\.venv\Scripts\python.exe -m unittest discover -s backend -t . -p 'test_*.py' -v
npm --prefix frontend ci
npm --prefix frontend run build
# 首次运行安装 CI 使用的 Chromium 无头浏览器；Linux 上加 --with-deps
npm --prefix frontend exec -- playwright install --only-shell chromium
npm --prefix frontend run test:e2e:ci
```

安装依赖和浏览器需要网络，测试用例本身使用模拟数据，无需币安 API Key。工作流缓存 pip/npm 下载，同一个 PR 或分支的新提交会取消仍在运行的旧检查；后端和前端任务分别设置 10 分钟、15 分钟超时。

## 历史成交数据

官方历史逐笔成交数据按市场、交易对和日期保存在 `data/`，支持下载并校验 U 本位合约的每日成交文件。目录约定、字段和追加下载方式见 [历史数据说明](data/README.md)。原始 ZIP 与整理后的 CSV 仅保存在本地，不进入 Git。

## API 调研文档

- [币安现货 REST API 清单](BINANCE_SPOT_REST_API.md)
- [币安合约 REST API 清单](BINANCE_FUTURES_REST_API.md)
