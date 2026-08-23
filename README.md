# OpenCode Dream Skin

生产级 OpenCode 客户端：Dream Skin 主题 + 官方 HTTP/SSE 协议。网页自带 Grok 4.5 引擎，手机 APK 接到你自己的 `opencode serve`。

| 产物 | 文件 | 说明 |
| --- | --- | --- |
| **本体** | `opencode-web.zip` | `npm run build` 的 Vercel/Nitro 产物 |
| **APK** | `OpenCode.apk` | Capacitor 包装的安卓客户端（debug） |

## 下载

- 最新包：[Releases / nightly](https://github.com/44578287/opencode-dream-skin/releases)
- 构建日志：[Actions](https://github.com/44578287/opencode-dream-skin/actions)

## 用法

### 网页（本机 Grok 引擎）

打开站点会自动接上本机引擎。可以对工作区提问、规划、改文件；写入和 shell 会先问权限。规划模式只读。

### 接到真 OpenCode 主机

1. 电脑上运行：

```bash
opencode serve --port 4096 --cors <客户端来源>
```

手机 APK 的来源是 `https://localhost`。局域网示例：

```bash
opencode serve --port 4096 --cors https://localhost --cors http://127.0.0.1:8080
```

2. 客户端「连接」页填 `http://<电脑IP>:4096`
3. 可选 Basic 认证（`OPENCODE_SERVER_USERNAME` / `OPENCODE_SERVER_PASSWORD`）

连上之后：会话、消息流、文件树、搜索、差异、保存、终端、权限、提问都走官方接口。

## 功能

- 会话：新建 / 关闭 / 规划与构建模式 / 停止生成
- 工作区：文件树、新建文件、打开、编辑保存、差异、搜索
- 助手：Grok 4.5 流式输出，读文件 / 写文件 / 命令 / 提问
- 权限：写入和 shell 先确认（这次允许 / 本会话都允许 / 拒绝）
- 主题：Dream Skin 导入导出
- 客户端：PWA、安卓 APK、系统通知

## 本地开发

```bash
npm ci
npm run dev
```
