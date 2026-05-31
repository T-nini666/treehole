# ============================================
# TV Proxy Watchdog - Auto-restart on crash
# ============================================
$ErrorActionPreference = "Continue"
$SCRIPT_DIR = Split-Path $PSCommandPath -Parent
$PROXY_SCRIPT = Join-Path $SCRIPT_DIR "tv_proxy.ps1"
$LOG_FILE = Join-Path $SCRIPT_DIR "watchdog.log"
$RESTART_DELAY = 5
$MAX_RESTARTS_PER_MIN = 10

function Write-Log($msg) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$ts] $msg"
    Write-Host $line
    try { $line | Out-File -Append -FilePath $LOG_FILE -Encoding UTF8 } catch {}
}

Write-Log "Watchdog started, monitoring $PROXY_SCRIPT"

$restartCount = 0
$lastRestartWindow = Get-Date

while ($true) {
    Write-Log "Starting TV Proxy..."
    $proc = Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile", "-ExecutionPolicy", "RemoteSigned", "-File", "`"$PROXY_SCRIPT`"" -PassThru -WindowStyle Hidden
    
    Wait-Process -Id $proc.Id
    $exitCode = $proc.ExitCode
    Write-Log "TV Proxy exited with code $exitCode"
    
    # Rate-limit restarts to avoid infinite loop
    $now = Get-Date
    $elapsed = ($now - $lastRestartWindow).TotalMinutes
    if ($elapsed -gt 1) {
        $restartCount = 0
        $lastRestartWindow = $now
    }
    $restartCount++
    if ($restartCount -gt $MAX_RESTARTS_PER_MIN) {
        Write-Log "TOO MANY RESTARTS ($restartCount/min). Waiting 60s before retry..."
        Start-Sleep -Seconds 60
        $restartCount = 0
        $lastRestartWindow = Get-Date
        continue
    }
    
    Write-Log "Restarting in ${RESTART_DELAY}s... (restart #$restartCount)"
    Start-Sleep -Seconds $RESTART_DELAY
}
