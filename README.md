# Crypto

Python 3 + TypeScript Web 行情原型，展示币安 BTC、ETH 的现货和 U 本位永续合约行情。

## 当前功能

- 首页默认展示 ETH U 本位永续合约。现货、合约两个模块均可点击切换 BTC／ETH，页面只展示选中币种的行情；现货默认选择 BTC，合约默认选择 ETH，并在当前页面内分别记住所选币种。
- 最新成交价、24 小时涨跌、最高／最低价、成交量、成交额和成交笔数。
- 手动刷新、每 30 秒自动刷新、数据更新时间及失败／部分成功提示；后台标签页暂停轮询。
- ETH U 本位永续增加实时盘口：卖盘、最新成交价、买盘依次排列，支持原始价位或 0.1／1／5／10 USDT 分组，每侧显示 10／20／50 档，展示挂单量、累计量及名义金额。
- ETH 合约页面增加 CoinBoss 强平估算盘口：上方为空头潜在强平买入，下方为多头潜在强平卖出，中间共用币安实时成交价；展示每档预估名义金额及累计金额，不再乘杠杆。
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

打开首页即可查看 ETH 合约实时盘口，也可通过“合约市场 → ETH”返回，使用公开行情，无需账户或 API Key。

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

### ETH 强平估算（CoinBoss）

ETH 合约的实时盘口下方显示“潜在强平买卖盘”。后端 `GET /api/markets/futures/eth/liquidations` 调用公开接口 `https://api.coinboss.com/api/liq-map?symbol=ETH&range=1d`；目前限时免费，无需 API Key，未来访问条件以供应商为准。此功能是第三方模型结果，不能标成币安真实账户的强平挂单。

- 直接使用 `bins[].price`、`side` 和 `total`。`short` 表示空头潜在强平买入，`long` 表示多头潜在强平卖出；`total` 已是各杠杆组相加的仓位名义金额，不是保证金，不再乘杠杆。页面使用 USD 金额，不把它冒充 ETH 数量。
- 与实时盘口相同，提供“价格分组”和“每侧显示”控件。强平默认按 5 USD 显示价格区间，支持原始价位及 1／5／10／25／50／100 USD 分组；低于原始档宽 `binWidth` 的选项不可用，源档宽增大时自动提升到足够大的显示分组。默认每侧展示最近 10 个非零分组，支持 20／50／全部及显示零值组。
- 区间含下限、不含上限：按原始代表价格把完整档位归组，金额仅求和、不乘杠杆、不按比例拆分。分组只是展示口径，不推断接口未说明的源档精确边界；边缘分组可能不完整。先保留正确方向及当前价一侧的源档，再分组、累计、截取展示行数。累计从当前参考价格向外相加；汇总统计全部可用价档，不受展示行数和分组宽度影响。
- 币安实时价格为 USDT，CoinBoss 价档为 USD，跨来源数值仅作近似定位。缺少币安价格时明确使用模型参考价；断线时标记上次价格。若原有方向的价档落到当前价另一侧，暂不计入列表并显示数量，不翻转多空方向，不据此认定已经强平，也不移动源价格档。
- CoinBoss 官方说明模型约每 5 分钟更新。页面每 15 秒检查一次；同一后端进程的所有页面共享缓存及并发锁，15 秒内最多一次上游查询。仅在查看 ETH 页面时请求，隐藏或离开后暂停，返回后继续。此轮询独立于币安 REST 冷却和 24h 统计刷新开关。
- `updatedAt` 用于模型年龄，成功获取旧模型不会重置其更新时间。超过 10 分钟未更新、网络失败或源数据异常时明确标记旧估算；保留上次有效快照，不把失败显示成零金额。没有成功快照时显示暂无数据。重复快照整体替换，不累计多次响应；拒绝时间倒退、异常数值和重复价档。
- 遇到限流尊重 `Retry-After`（秒数或 HTTP 日期），失败递增退避；401／403 暂停至少 5 分钟后重试。免费状态变化会显示访问错误，不会回退到演示金额。

依据：[CoinBoss API 字段和免费规则](https://www.coinboss.com/api-docs)、[模型含义与更新周期](https://www.coinboss.com/pro/futures/LiquidationMap)。文档未提供该模型的交易所筛选参数，不承诺覆盖所有 ETH 仓位；预计受影响的仓位金额不等于保证实际发生的强平成交金额。

验证覆盖原始金额与累计值、并发缓存、重复快照替换、限流及失败恢复、模型陈旧与异常数据、价格越档方向、后台暂停以及移动端显示。模拟测试不访问 CoinBoss；真实接入可通过本地接口单独检查。

## Windows 本地运行

已安装依赖和 GNU Make 后，在项目根目录的 PowerShell 终端执行：

```powershell
cd ~/Crypto
make dev-gui
```

`~/Crypto` 应为项目目录（也可以是指向项目实际位置的目录联接）；如果项目在其他位置，进入实际目录后执行同一命令即可。`make dev-gui` 会在后台启动前后端，等待服务就绪后自动打开浏览器；日志保存在 `.local`。停止服务执行 `make stop-dev`。两个服务的默认端口为 8000、5173，如已启动本项目，先停止再重新启动。

首次配置时可通过 WinGet 安装 GNU Make，随后重新打开终端并确认 `make --version` 可用：

```powershell
winget install --id ezwinports.make --exact --source winget --scope user
```

不使用 Make 也可直接执行下面的 PowerShell 启动脚本。

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
