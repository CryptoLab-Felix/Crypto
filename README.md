# Crypto

Python 3 + TypeScript Web 行情原型，展示币安 BTC、ETH 的现货和 U 本位永续合约行情。

## 当前功能

- 现货、合约两个模块，均可点击切换 BTC／ETH，页面只展示选中币种的行情。两个模块默认选择 BTC，并在当前页面内分别记住所选币种。
- 最新成交价、24 小时涨跌、最高／最低价、成交量、成交额和成交笔数。
- 手动刷新、每 30 秒自动刷新、数据更新时间及失败／部分成功提示；后台标签页暂停轮询。
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
