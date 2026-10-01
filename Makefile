.PHONY: dev-gui stop-dev

dev-gui:
	@powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File scripts/dev.ps1 -OpenBrowser

stop-dev:
	@powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File scripts/stop.ps1
