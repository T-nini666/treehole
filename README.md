# 🌳 树洞 · 电子手帐观影管理系统

一个本地运行的观影管理系统，集影视搜索、在线播放、手帐记录、书库管理于一体。基于 PowerShell 代理 + 纯前端实现，无需安装任何依赖。

## ✨ 功能

- **🎬 影视搜索 & 播放** — 通过代理搜索电影、电视剧、动漫，直接在线播放
- **📔 电子手帐** — 拖动元素、页面编辑器，记录观影笔记与心得
- **📚 书架 & 书库** — 管理书籍收藏，支持读书笔记和阅读进度
- **📋 待看清单 & 打卡** — 追踪想看的影视作品
- **💬 语录收藏** — 收集剧中经典台词
- **🎨 8 种自然主题** — 海洋、森林、日落、极光、春樱、秋枫、星空、极简
- **📊 阅读报告** — 可视化统计与回顾
- **📱 响应式设计** — 适配桌面和平板

## 🚀 快速开始

### 1. 一键启动（推荐）

双击桌面「树洞入口」快捷方式，或直接双击 `启动.vbs`，会自动：

- 后台启动代理服务
- 自动打开网页
- 无需任何配置

### 2. 手动启动

```powershell
# 启动代理
powershell -ExecutionPolicy RemoteSigned -File tv_proxy.ps1

# 浏览器访问
http://localhost:8765
```

### 3. 开机自启（可选）

右键以**管理员身份**运行 `setup_autostart.ps1`，代理将在开机时自动后台启动。

如需取消：
```powershell
Unregister-ScheduledTask -TaskName "TV Proxy Watchdog" -Confirm:$false
```

## 📁 项目结构

```
APP/
├── treehole.html              ← 前端页面（核心）
├── tv_proxy.ps1               ← TV 代理服务 (localhost:8765)
├── tv_proxy_watchdog.ps1      ← 守护进程（崩溃自动重启）
├── 启动.vbs                    ← 一键启动器（检测代理 → 启动 → 打开网页）
├── setup_autostart.ps1        ← 开机自启配置脚本
├── start_silent.vbs           ← 静默启动辅助脚本
├── test_api.ps1               ← API 调试工具
└── README.md
```

## 🔧 技术栈

| 层 | 技术 |
|---|------|
| 前端 | 原生 HTML/CSS/JavaScript，纯 Browser Side |
| 代理 | PowerShell HttpListener，HLS 流媒体代理 |
| 存储 | 浏览器 localStorage |
| 运行环境 | Windows 10/11（需 PowerShell 5.1+） |

## 📡 代理工作原理

```
浏览器 (treehole.html)
    ↓ fetch /api/search
localhost:8765 (tv_proxy.ps1)
    ↓ 转发请求 + 登录认证
远端影视 API
    ↓ 返回结果
浏览器渲染搜索结果 + HLS 播放
```

代理通过 `tv_proxy_watchdog.ps1` 守护运行，崩溃后自动重启，并通过 `tv_proxy.ps1` 内置的段缓存机制减少播放卡顿。

## 🔒 安全说明

- 所有数据存储在本地浏览器 localStorage
- 代理服务仅监听 `localhost`，外部不可访问
- 不需要任何数据库或第三方服务
- 登录凭证仅用于访问远端影视 API

## 📄 协议

仅供个人学习与研究使用。
