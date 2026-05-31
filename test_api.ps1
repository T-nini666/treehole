try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    $r = Invoke-WebRequest -Uri "https://moontv.022340618.xyz/api/login" -Method POST -Body '{"username":"sond","password":"123456"}' -ContentType "application/json" -UseBasicParsing -TimeoutSec 15 -WebSession $s
    "LOGIN OK" | Out-Host
    $r2 = Invoke-WebRequest -Uri "https://moontv.022340618.xyz/api/search?q=%E7%8B%82%E9%A3%99" -UseBasicParsing -TimeoutSec 15 -WebSession $s
    "SEARCH OK" | Out-Host
    $r2.Content | Out-File -FilePath "C:\Users\Administrator\OneDrive\Desktop\APP\result.json" -Encoding UTF8 -NoNewline
    "SAVED" | Out-Host
} catch {
    "ERR: $_" | Out-Host
}
