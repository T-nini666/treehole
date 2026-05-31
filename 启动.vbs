' ============================================
' 静默启动代理 + 打开网页
' 双击此文件 = 自动连代理 + 打开树洞页面
' ============================================

Set ws = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir  = fso.GetParentFolderName(WScript.ScriptFullName) & "\"

' 1. 测试代理是否已在运行
status = 0
on error resume next
Set http = CreateObject("MSXML2.ServerXMLHTTP")
http.Open "GET", "http://localhost:8765/api/ping", False
http.setTimeouts 3000, 3000, 3000, 3000
http.Send ""
status = http.status
Set http = Nothing
on error goto 0

' 2. 如果没运行，启动 watchdog
If status <> 200 Then
    ws.Run "powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -WindowStyle Hidden -File """ & dir & "tv_proxy_watchdog.ps1""", 0, False

    ' 等待就绪（最多 30 秒）
    For i = 1 To 15
        WScript.Sleep 2000
        on error resume next
        Set http = CreateObject("MSXML2.ServerXMLHTTP")
        http.Open "GET", "http://localhost:8765/api/ping", False
        http.setTimeouts 3000, 3000, 3000, 3000
        http.Send ""
        If http.status = 200 Then Exit For
        Set http = Nothing
        on error goto 0
    Next
End If

' 3. 打开网页
ws.Run """" & dir & "treehole.html"""
WScript.Quit
