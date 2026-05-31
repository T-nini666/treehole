$ErrorActionPreference = "Continue"

# Load required .NET assemblies
Add-Type -AssemblyName System.Web

# Force TLS 1.2/1.3 for HTTPS requests
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13 -bor [Net.SecurityProtocolType]::Tls11
[Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }

# ====== CONFIG ======
$PORT = 8765
$TV_URL = "https://moontv.022340618.xyz"
$SCRIPT_DIR = Split-Path $PSCommandPath -Parent
$HTML_FILE = Join-Path $SCRIPT_DIR "treehole.html"
$USERNAME = "sond"
$PASSWORD = "123456"

# ====== Session ======
$global:tvSession = $null

# ====== Segment Cache (reduce stuttering) ======
# Cache TS segments and M3U8 manifests in memory to avoid re-download
$global:segCache = @{}
$global:segCacheMax = 300
$global:segCacheHits = 0
$global:segCacheMisses = 0
$global:segCacheLock = New-Object System.Object

function Get-FromCache($url) {
    [System.Threading.Monitor]::Enter($global:segCacheLock)
    try {
        if ($global:segCache.ContainsKey($url)) {
            $global:segCacheHits++
            return $global:segCache[$url]
        }
        $global:segCacheMisses++
        return $null
    } finally {
        [System.Threading.Monitor]::Exit($global:segCacheLock)
    }
}

function Set-Cache($url, $data) {
    [System.Threading.Monitor]::Enter($global:segCacheLock)
    try {
        if ($global:segCache.Count -ge $global:segCacheMax) {
            # Evict oldest 50 entries
            $keys = $global:segCache.Keys | Select-Object -First 50
            foreach ($k in $keys) { $global:segCache.Remove($k) }
        }
        $global:segCache[$url] = $data
    } finally {
        [System.Threading.Monitor]::Exit($global:segCacheLock)
    }
}

function Get-CacheStats {
    $total = $global:segCacheHits + $global:segCacheMisses
    if ($total -gt 0) {
        $pct = [math]::Round($global:segCacheHits * 100 / $total, 1)
    } else { $pct = 0 }
    return "${global:segCacheHits} hits / ${global:segCacheMisses} misses (${pct}%) · size=$($global:segCache.Count)"
}

function Login-TV {
    try {
        $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
        $body = "{`"username`":`"$USERNAME`",`"password`":`"$PASSWORD`"}"
        $r = Invoke-WebRequest -Uri "$TV_URL/api/login" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec 15 -WebSession $session
        if ($r.StatusCode -eq 200) {
            $global:tvSession = $session
            Write-Host "[OK] TV logged in as $USERNAME"
            return $true
        }
    } catch {
        Write-Host "[ERR] Login failed: $($_.Exception.Message)"
    }
    return $false
}

function Search-TV($rawQuery) {
    try {
        if (-not $global:tvSession) {
            if (-not (Login-TV)) { return '{"error":"TV login failed, check config"}' }
        }
        $url = "$TV_URL/api/search?$rawQuery"
        Write-Host "  -> $url"

        # Use WebClient with explicit UTF-8 to avoid encoding garbled text
        $wc = New-Object System.Net.WebClient
        $wc.Encoding = [System.Text.Encoding]::UTF8
        if ($global:tvSession.Cookies) {
            $cookieHdr = $global:tvSession.Cookies.GetCookieHeader($url)
            if ($cookieHdr) { try { $wc.Headers.Add([System.Net.HttpRequestHeader]::Cookie, $cookieHdr) } catch {} }
        }
        $result = $null
        try {
            $result = $wc.DownloadString($url)
            try { $wc.Dispose(); $wc = $null } catch {}
            return $result
        } catch [System.Net.WebException] {
            $resp = $_.Exception.Response
            $sc = if ($resp) { $resp.StatusCode } else { $null }
            try { if ($resp) { $resp.Close(); $resp.Dispose() } } catch {}
            try { if ($wc) { $wc.Dispose(); $wc = $null } } catch {}
            if ($sc -and $sc -eq [System.Net.HttpStatusCode]::Unauthorized) {
                Write-Host "  [WARN] Search session expired, re-logging..."
                if (Login-TV) {
                    $wc2 = New-Object System.Net.WebClient
                    $wc2.Encoding = [System.Text.Encoding]::UTF8
                    $cookieHdr2 = $global:tvSession.Cookies.GetCookieHeader($url)
                    if ($cookieHdr2) { try { $wc2.Headers.Add([System.Net.HttpRequestHeader]::Cookie, $cookieHdr2) } catch {} }
                    try {
                        $result = $wc2.DownloadString($url)
                        try { $wc2.Dispose() } catch {}
                        return $result
                    } catch {
                        try { $wc2.Dispose() } catch {}
                        $scMsg = if ($_.Exception.InnerException) { $_.Exception.InnerException.Message } else { $_.Exception.Message }
                        return ('{"error":"Search retry failed: ' + ($scMsg -replace '"',"'") + '"}')
                    }
                }
                return '{"error":"TV login failed, check username/password"}'
            }
            $scMsg = if ($sc) { "$sc" } elseif ($_.Exception.InnerException) { $_.Exception.InnerException.Message } else { $_.Exception.Message }
            if ($scMsg.Length -gt 100) { $scMsg = $scMsg.Substring(0, 100) }
            return ('{"error":"Search request failed: ' + ($scMsg -replace '"',"'") + '"}')
        } catch {
            try { if ($wc) { $wc.Dispose(); $wc = $null } } catch {}
            return ('{"error":"Search error: ' + ($_.Exception.Message.Substring(0, [Math]::Min($_.Exception.Message.Length, 100)) -replace '"',"'") + '"}')
        }
    } catch {
        $msg = if ($_.Exception.Message) { ($_.Exception.Message -replace '"',"'") } else { "Unknown error" }
        if ($msg.Length -gt 150) { $msg = $msg.Substring(0, 150) }
        return ('{"error":"Internal search error: ' + $msg + '"}')
    }
}

function Search-Detail($id) {
    try {
        if (-not $global:tvSession) {
            if (-not (Login-TV)) { return '{"error":"TV login failed, check proxy config"}' }
        }
        
        # Try multiple API endpoint paths - different sites use different patterns
        $paths = @(
            "/api/video?id=$id",
            "/api/vod/detail?id=$id", 
            "/api/movie?id=$id",
            "/api/vod?id=$id",
            "/api/vod/detail/$id",
            "/api.php/provide/vod/?ac=detail&ids=$id"
        )
        $lastError = @()
        $lastSc = 0

        foreach ($path in $paths) {
            $url = "$TV_URL$path"
            Write-Host "  -> $url"
            $wc = $null
            $resp = $null
            try {
                $wc = New-Object System.Net.WebClient
                $wc.Encoding = [System.Text.Encoding]::UTF8
                try { $wc.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)") } catch {}
                if ($global:tvSession.Cookies) {
                    $cookieHdr = $global:tvSession.Cookies.GetCookieHeader($TV_URL)
                    if ($cookieHdr) { 
                        try { $wc.Headers.Add([System.Net.HttpRequestHeader]::Cookie, $cookieHdr) } catch {}
                    }
                }
                $result = $wc.DownloadString($url)
                try { $wc.Dispose(); $wc = $null } catch {}
                if ($result -and ($result -notmatch '^\s*$') -and ($result -notmatch '("code"\s*:\s*-?\d+.*"msg"|404|not.?found)')) {
                    # Check if result looks like valid JSON
                    $testJson = $result.Trim()
                    if ($testJson.StartsWith('{') -or $testJson.StartsWith('[')) {
                        Write-Host "  [OK] Detail fetched via $path"
                        return $result
                    }
                }
            } catch [System.Net.WebException] {
                $resp = $_.Exception.Response
                $sc = if ($resp) { $resp.StatusCode.value__ } else { 0 }
                $lastSc = $sc
                Write-Host "  [WARN] $path returned $sc"
                if ($resp) { try { $resp.Close(); $resp.Dispose() } catch {} }
                if ($wc) { try { $wc.Dispose(); $wc = $null } catch {} }
                $lastError += "$path=$sc"
                # 401 Unauthorized - re-login and retry once
                if ($sc -eq 401) {
                    Write-Host "  [WARN] Session expired, re-logging..."
                    if (Login-TV) {
                        try {
                            $wc2 = New-Object System.Net.WebClient
                            $wc2.Encoding = [System.Text.Encoding]::UTF8
                            try { $wc2.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)") } catch {}
                            $cookieHdr2 = $global:tvSession.Cookies.GetCookieHeader($TV_URL)
                            if ($cookieHdr2) { try { $wc2.Headers.Add([System.Net.HttpRequestHeader]::Cookie, $cookieHdr2) } catch {} }
                            $result2 = $wc2.DownloadString($url)
                            if ($result2 -and ($result2 -notmatch '^\s*$')) { 
                                try { $wc2.Dispose() } catch {}
                                return $result2 
                            }
                            try { $wc2.Dispose() } catch {}
                        } catch {
                            if ($wc2) { try { $wc2.Dispose() } catch {} }
                        }
                    }
                }
            } catch {
                $errMsg = $_.Exception.Message
                if ($errMsg.Length -gt 80) { $errMsg = $errMsg.Substring(0, 80) }
                Write-Host "  [WARN] $path error: $errMsg"
                $lastError += "$path=error"
                if ($wc) { try { $wc.Dispose(); $wc = $null } catch {} }
            }
        }
        # All paths failed - return friendly error with diagnostic info
        $diag = if ($lastError.Count -gt 0) { ("Paths: " + ($lastError -join ', ')) } else { "" }
        return ('{"error":"All detail API paths unavailable. ' + $diag + '. Please try again later."}')
    } catch {
        $msg = if ($_.Exception.Message) { ($_.Exception.Message -replace '"',"'") } else { "Unknown error" }
        if ($msg.Length -gt 150) { $msg = $msg.Substring(0, 150) }
        return ('{"error":"Detail fetch error: ' + $msg + '"}')
    }
}

function Add-Cors($resp) {
    $resp.Headers.Add("Access-Control-Allow-Origin", "*")
    $resp.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    $resp.Headers.Add("Access-Control-Allow-Headers", "Content-Type")
    $resp.Headers.Add("Access-Control-Max-Age", "86400")
}

# ====== Server ======
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://+:$PORT/")

Write-Host "============================================"
Write-Host "  TV Proxy  :$PORT | $USERNAME"
Write-Host "============================================"

Login-TV

try {
    $listener.Start()
    Write-Host "[READY] http://localhost:$PORT"
    Write-Host "[INFO] Ctrl+C to stop`n"

    while ($listener.IsListening) {
        $ctx = $listener.GetContext()
        $req = $ctx.Request
        $resp = $ctx.Response
        Add-Cors $resp

        $path = $req.Url.AbsolutePath
        $rawQuery = $req.Url.Query.TrimStart('?')

        try {
            if ($req.HttpMethod -eq "OPTIONS") { $resp.StatusCode = 204; $resp.Close(); continue }

            if ($path -eq "/api/search") {
                $result = if ([string]::IsNullOrWhiteSpace($rawQuery)) { $resp.StatusCode = 400; '{"error":"Missing query"}' }
                           else { Write-Host "[SEARCH] $rawQuery"; Search-TV $rawQuery }
                $bytes = [Text.Encoding]::UTF8.GetBytes($result)
                $resp.ContentType = "application/json; charset=utf-8"
                $resp.ContentLength64 = $bytes.Length
                $resp.OutputStream.Write($bytes, 0, $bytes.Length)
                $resp.OutputStream.Close(); $resp.Close(); continue
            }

            if ($path -eq "/api/detail") {
                $id = [System.Web.HttpUtility]::UrlDecode([System.Web.HttpUtility]::ParseQueryString($req.Url.Query)["id"])
                if ([string]::IsNullOrWhiteSpace($id)) { $resp.StatusCode = 400; $eb = [Text.Encoding]::UTF8.GetBytes('{"error":"Missing id"}'); $resp.OutputStream.Write($eb,0,$eb.Length); $resp.OutputStream.Close(); $resp.Close(); continue }
                Write-Host "[DETAIL] id=$id"
                $detail = (Search-Detail $id)
                $bytes = [Text.Encoding]::UTF8.GetBytes($detail)
                $resp.ContentType = "application/json; charset=utf-8"
                $resp.ContentLength64 = $bytes.Length
                $resp.OutputStream.Write($bytes, 0, $bytes.Length)
                $resp.OutputStream.Close(); $resp.Close(); continue
            }

            if ($path -eq "/api/proxy") {
                $tgt = [System.Web.HttpUtility]::UrlDecode([System.Web.HttpUtility]::ParseQueryString($req.Url.Query)["url"])
                if ([string]::IsNullOrWhiteSpace($tgt)) {
                    $rawQ = $req.Url.Query.TrimStart('?')
                    if ($rawQ -match '^url=(.+)$') { $tgt = [System.Web.HttpUtility]::UrlDecode($Matches[1]) }
                }
                if ([string]::IsNullOrWhiteSpace($tgt)) { $resp.StatusCode = 400; $eb = [Text.Encoding]::UTF8.GetBytes('{"error":"Missing url"}'); $resp.OutputStream.Write($eb,0,$eb.Length); $resp.OutputStream.Close(); $resp.Close(); continue }
                Write-Host "[PROXY] $tgt"
                try {
                    $wc = New-Object System.Net.WebClient
                    try { $wc.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)") } catch {}
                    $wc.Encoding = [System.Text.Encoding]::UTF8
                    if ($global:tvSession.Cookies) {
                        $cookieHdr = $global:tvSession.Cookies.GetCookieHeader($tgt)
                        if ($cookieHdr) { try { $wc.Headers.Add([System.Net.HttpRequestHeader]::Cookie, $cookieHdr) } catch {} }
                    }
                    $data = $wc.DownloadData($tgt)
                    $ct = $wc.ResponseHeaders["Content-Type"]
                    if (-not $ct) { $ct = "application/octet-stream" }
                    $resp.ContentType = $ct
                    $resp.ContentLength64 = $data.Length
                    $resp.OutputStream.Write($data, 0, $data.Length)
                    try { $wc.Dispose() } catch {}
                } catch {
                    $errDetail = $_.Exception.Message
                    if ($errDetail.Length -gt 100) { $errDetail = $errDetail.Substring(0, 100) }
                    Write-Host "[PROXY ERR] $tgt : $errDetail"
                    $resp.StatusCode = 502
                }
                $resp.OutputStream.Close(); $resp.Close(); continue
            }

            # M3U8 HLS proxy
            if ($path -eq "/api/m3u8") {
                $tgt = [System.Web.HttpUtility]::UrlDecode([System.Web.HttpUtility]::ParseQueryString($req.Url.Query)["url"])
                if ([string]::IsNullOrWhiteSpace($tgt)) {
                    $rawQ = $req.Url.Query.TrimStart('?')
                    if ($rawQ -match '^url=(.+)$') { $tgt = [System.Web.HttpUtility]::UrlDecode($Matches[1]) }
                }
                if ([string]::IsNullOrWhiteSpace($tgt)) { $resp.StatusCode = 400; $eb = [Text.Encoding]::UTF8.GetBytes('{"error":"Missing url"}'); $resp.OutputStream.Write($eb,0,$eb.Length); $resp.OutputStream.Close(); $resp.Close(); continue }
                
                $cacheKey = "m3u8:" + $tgt
                $cached = Get-FromCache $cacheKey
                if ($cached -ne $null) {
                    $resp.ContentType = "application/vnd.apple.mpegurl"
                    $resp.ContentLength64 = $cached.Length
                    $resp.AddHeader("X-Cache", "HIT")
                    $resp.OutputStream.Write($cached, 0, $cached.Length)
                    $resp.OutputStream.Close(); $resp.Close(); continue
                }
                
                Write-Host "[M3U8] $tgt"
                try {
                    $wc = New-Object System.Net.WebClient
                    $wc.Encoding = [System.Text.Encoding]::UTF8
                    try { $wc.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36") } catch {}
                    try { $wc.Headers.Add("Referer", $TV_URL) } catch {}
                    try { $wc.Headers.Add("Origin", "https://moontv.022340618.xyz") } catch {}
                    try { $wc.Headers.Add("Accept", "*/*") } catch {}
                    $m3u8Text = $wc.DownloadString($tgt)
                    try { $wc.Dispose(); $wc = $null } catch {}
                    
                    $baseUrl = $tgt -replace '/[^/]+$','/'
                    $isMaster = $m3u8Text -match '#EXT-X-STREAM-INF'
                    
                    $lines = $m3u8Text -split "`n"
                    $rewritten = @()
                    foreach ($line in $lines) {
                        $trimmed = $line.Trim()
                        if ($trimmed -match '^#') {
                            $rewritten += $line
                        } elseif ($trimmed.Length -gt 0) {
                            $segUrl = if ($trimmed -match '^https?://') { $trimmed } else { $baseUrl + $trimmed }
                            $encoded = [System.Web.HttpUtility]::UrlEncode($segUrl)
                            if ($isMaster) {
                                $rewritten += "http://localhost:$PORT/api/m3u8?url=$encoded"
                            } else {
                                $rewritten += "http://localhost:$PORT/api/segment?url=$encoded"
                            }
                        } else {
                            $rewritten += $line
                        }
                    }
                    $rewrittenText = $rewritten -join "`n"
                    Write-Host "[M3U8 OK] $($rewrittenText.Length) bytes, master=$isMaster"
                    $bytes = [Text.Encoding]::UTF8.GetBytes($rewrittenText)
                    Set-Cache $cacheKey $bytes
                    $resp.ContentType = "application/vnd.apple.mpegurl"
                    $resp.ContentLength64 = $bytes.Length
                    $resp.AddHeader("X-Cache", "MISS")
                    $resp.AddHeader("Cache-Control", "public, max-age=5")
                    $resp.OutputStream.Write($bytes, 0, $bytes.Length)
                } catch {
                    $errMsg = if ($_.Exception.InnerException) { $_.Exception.InnerException.Message } else { $_.Exception.Message }
                    if ($errMsg.Length -gt 200) { $errMsg = $errMsg.Substring(0, 200) }
                    Write-Host "[M3U8 ERR] $errMsg"
                    $resp.StatusCode = 502
                }
                $resp.OutputStream.Close(); $resp.Close(); continue
            }

            # TS segment proxy - stream response for lower latency
            if ($path -eq "/api/segment") {
                $tgt = [System.Web.HttpUtility]::UrlDecode([System.Web.HttpUtility]::ParseQueryString($req.Url.Query)["url"])
                if ([string]::IsNullOrWhiteSpace($tgt)) {
                    $rawQ = $req.Url.Query.TrimStart('?')
                    if ($rawQ -match '^url=(.+)$') { $tgt = [System.Web.HttpUtility]::UrlDecode($Matches[1]) }
                }
                if ([string]::IsNullOrWhiteSpace($tgt)) { $resp.StatusCode = 400; $resp.OutputStream.Close(); $resp.Close(); continue }
                
                # Cache check (thread-safe)
                $cached = Get-FromCache $tgt
                if ($cached -ne $null) {
                    $resp.ContentType = "video/mp2t"
                    $resp.ContentLength64 = $cached.Length
                    $resp.AddHeader("X-Cache", "HIT")
                    $resp.AddHeader("Cache-Control", "public, max-age=3600")
                    $resp.OutputStream.Write($cached, 0, $cached.Length)
                    $resp.OutputStream.Close(); $resp.Close(); continue
                }
                
                # Cache miss - download + stream + cache
                try {
                    $webReq = [System.Net.HttpWebRequest]::Create($tgt)
                    $webReq.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
                    $webReq.Referer = $TV_URL
                    $webReq.Timeout = 25000
                    $webReq.ReadWriteTimeout = 25000
                    $webReq.AllowReadStreamBuffering = $false
                    $webReq.AutomaticDecompression = [System.Net.DecompressionMethods]::None
                    
                    $webResp = $webReq.GetResponse()
                    $stream = $webResp.GetResponseStream()
                    
                    $memStream = New-Object System.IO.MemoryStream
                    $buffer = New-Object byte[] 65536
                    $resp.ContentType = "video/mp2t"
                    $resp.AddHeader("X-Cache", "MISS")
                    $resp.AddHeader("Cache-Control", "public, max-age=3600")
                    
                    while (($read = $stream.Read($buffer, 0, $buffer.Length)) -gt 0) {
                        $memStream.Write($buffer, 0, $read)
                        $resp.OutputStream.Write($buffer, 0, $read)
                    }
                    
                    $stream.Close()
                    $webResp.Close()
                    
                    $data = $memStream.ToArray()
                    $memStream.Close()
                    Set-Cache $tgt $data
                } catch {
                    $errDetail = $_.Exception.Message
                    if ($errDetail.Length -gt 100) { $errDetail = $errDetail.Substring(0, 100) }
                    Write-Host "[SEG ERR] $errDetail"
                    $resp.StatusCode = 502
                }
                $resp.OutputStream.Close(); $resp.Close(); continue
            }

            if ($path -eq "/api/ping") {
                $status = if ($global:tvSession) { "ok" } else { "no_session" }
                $cacheStats = Get-CacheStats
                $result = '{"status":"' + $status + '","username":"' + $USERNAME + '","cache":"' + ($cacheStats -replace '"',"'") + '"}'
                $bytes = [Text.Encoding]::UTF8.GetBytes($result)
                $resp.ContentType = "application/json; charset=utf-8"
                $resp.ContentLength64 = $bytes.Length
                $resp.OutputStream.Write($bytes, 0, $bytes.Length)
                $resp.OutputStream.Close(); $resp.Close(); continue
            }

            if ($path -eq "/api/cache-clear") {
                [System.Threading.Monitor]::Enter($global:segCacheLock)
                try { $global:segCache.Clear(); $global:segCacheHits = 0; $global:segCacheMisses = 0 } finally { [System.Threading.Monitor]::Exit($global:segCacheLock) }
                Write-Host "[CACHE] Cleared"
                $result = '{"status":"cleared"}'
                $bytes = [Text.Encoding]::UTF8.GetBytes($result)
                $resp.ContentType = "application/json; charset=utf-8"
                $resp.ContentLength64 = $bytes.Length
                $resp.OutputStream.Write($bytes, 0, $bytes.Length)
                $resp.OutputStream.Close(); $resp.Close(); continue
            }

            if ($path -eq "/" -or $path -eq "/index.html") {
                if (Test-Path $HTML_FILE) {
                    $content = [IO.File]::ReadAllBytes($HTML_FILE)
                    $resp.ContentType = "text/html; charset=utf-8"
                    $resp.ContentLength64 = $content.Length
                    $resp.OutputStream.Write($content, 0, $content.Length)
                } else { $resp.StatusCode = 404; $e = [Text.Encoding]::UTF8.GetBytes("404"); $resp.OutputStream.Write($e,0,$e.Length) }
                $resp.OutputStream.Close(); $resp.Close(); continue
            }

            $resp.StatusCode = 404
            $eb = [Text.Encoding]::UTF8.GetBytes("404")
            $resp.OutputStream.Write($eb,0,$eb.Length)
            $resp.OutputStream.Close(); $resp.Close()
        } catch {
            try { $resp.StatusCode = 500; $m = [Text.Encoding]::UTF8.GetBytes("ERR: "+$_.Exception.Message); $resp.OutputStream.Write($m,0,$m.Length); $resp.OutputStream.Close(); $resp.Close() } catch {}
        }
    }
} finally {
    $listener.Stop()
    Write-Host "[STOP]"
}
