# Crypto

Python 3 + TypeScript Web 行情原型，展示币安 BTC、ETH 的现货和 U 本位永续合约行情。

## 当前功能

- 现货、合约两个模块，均展示 BTCUSDT、ETHUSDT。
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
.\.venv\Scripts\python.exe -m unittest backend.test_main -v
npm --prefix frontend run build
# 先启动开发服务，再运行浏览器验证
npm --prefix frontend run test:e2e
```

Windows 浏览器验证默认使用已安装的 Chrome；可通过 `PLAYWRIGHT_CHANNEL` 指定其他已安装通道。其他系统默认使用 Playwright Chromium，首次运行前在 `frontend` 目录执行 `npx playwright install chromium`。浏览器验证包含真实行情、模块切换、刷新、移动端，以及使用测试专用响应模拟的失败重试、部分失败和请求竞态。

构建完成后重新启动 Python 后端，它会同时提供 `frontend/dist` 静态页面和 API，此时可访问 <http://127.0.0.1:8000>。这是本地运行配置，尚未配置公网部署。

## API 调研文档

- [币安现货 REST API 清单](BINANCE_SPOT_REST_API.md)
- [币安合约 REST API 清单](BINANCE_FUTURES_REST_API.md)
