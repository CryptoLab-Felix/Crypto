$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$processFile = Join-Path $projectRoot '.local\processes.json'
if (-not (Test-Path -LiteralPath $processFile)) { Write-Output '没有记录中的开发进程。'; exit 0 }

$records = Get-Content -LiteralPath $processFile -Raw | ConvertFrom-Json
foreach ($record in $records) {
    $process = Get-Process -Id $record.id -ErrorAction SilentlyContinue
    if ($null -ne $process -and $process.StartTime.ToUniversalTime().Ticks -eq ([DateTimeOffset]$record.started).UtcDateTime.Ticks) {
        # Include the child interpreter spawned by the Windows venv launcher.
        & taskkill.exe /PID $process.Id /T /F | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "无法停止开发进程 $($process.Id)。" }
    }
}
Write-Output '开发服务已停止。'
