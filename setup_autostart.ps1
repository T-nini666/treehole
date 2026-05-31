# ============================================
# Run once (as Administrator) to enable auto-start
# ============================================
$SCRIPT_DIR = Split-Path $PSCommandPath -Parent
$WATCHDOG = Join-Path $SCRIPT_DIR "tv_proxy_watchdog.ps1"

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy RemoteSigned -WindowStyle Hidden -File `"$WATCHDOG`""
$trigger = New-ScheduledTaskTrigger -AtLogon -User "$env:USERDOMAIN\$env:USERNAME"
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -RunLevel Highest

Register-ScheduledTask -TaskName "TV Proxy Watchdog" -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Auto-start TV proxy on login" -Force

Write-Host "[OK] Auto-start enabled. Proxy will launch on next login." -ForegroundColor Green
Write-Host "[INFO] Run this if you want to remove: Unregister-ScheduledTask -TaskName 'TV Proxy Watchdog' -Confirm:`$false" -ForegroundColor Gray

# Start proxy now too
Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy RemoteSigned -WindowStyle Hidden -File `"$WATCHDOG`"" -WindowStyle Hidden
Write-Host "[OK] Proxy started now. Opening browser..." -ForegroundColor Green
Start-Process "$SCRIPT_DIR\treehole.html"
