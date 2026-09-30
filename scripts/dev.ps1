$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimePath = Join-Path $projectRoot '.local'
$pythonPath = Join-Path $projectRoot '.venv\Scripts\python.exe'
$vitePath = Join-Path $projectRoot 'frontend\node_modules\vite\bin\vite.js'

if (-not (Test-Path -LiteralPath $pythonPath) -or -not (Test-Path -LiteralPath $vitePath)) {
    throw '请先按 README 安装 Python 和前端依赖。'
}

foreach ($port in @(8000, 5173)) {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
    try { $listener.Start() }
    catch { throw "端口 $port 已被占用。如为本项目旧进程，请先运行 scripts\stop.ps1。" }
    finally { $listener.Stop() }
}

New-Item -ItemType Directory -Path $runtimePath -Force | Out-Null
$backend = Start-Process -FilePath $pythonPath -ArgumentList @('-m', 'uvicorn', 'backend.main:app', '--host', '127.0.0.1', '--port', '8000') -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimePath 'backend.log') -RedirectStandardError (Join-Path $runtimePath 'backend-error.log')
try {
    $frontend = Start-Process -FilePath (Get-Command node).Source -ArgumentList @('node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173', '--strictPort') -WorkingDirectory (Join-Path $projectRoot 'frontend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimePath 'frontend.log') -RedirectStandardError (Join-Path $runtimePath 'frontend-error.log')
} catch {
    & taskkill.exe /PID $backend.Id /T /F | Out-Null
    throw
}

@($backend, $frontend) | ForEach-Object {
    @{ id = $_.Id; started = $_.StartTime.ToUniversalTime().ToString('o') }
} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runtimePath 'processes.json') -Encoding utf8

$ready = $false
$deadline = [DateTime]::UtcNow.AddSeconds(25)
while ([DateTime]::UtcNow -lt $deadline) {
    try {
        $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/health' -TimeoutSec 2
        $page = Invoke-WebRequest -Uri 'http://127.0.0.1:5173' -TimeoutSec 2
        if ($health.status -eq 'ok' -and $page.StatusCode -eq 200) { $ready = $true; break }
    } catch { Start-Sleep -Milliseconds 300 }
}
if (-not $ready) {
    & (Join-Path $PSScriptRoot 'stop.ps1')
    throw '服务未能正常启动，请查看 .local 中的日志。'
}

Write-Output 'Web: http://127.0.0.1:5173'
Write-Output 'API: http://127.0.0.1:8000/docs'
Write-Output '日志位于 .local；停止服务请运行 scripts\stop.ps1。'
