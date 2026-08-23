# OpenCode Dream Skin

OpenCode 远程客户端：Dream Skin 主题 + 官方 HTTP/SSE。打开即直连你配置好的 `opencode serve`。密钥和模型都在 OpenCode 里配，客户端不填。

| 产物 | 文件 | 说明 |
| --- | --- | --- |
| **本体** | `opencode-web.zip` | `npm run build` 的 Vercel/Nitro 产物 |
| **APK** | `OpenCode.apk` | Capacitor 包装的安卓客户端（debug） |

## 下载

- 最新包：[Releases / nightly](https://github.com/44578287/opencode-dream-skin/releases)
- 构建日志：[Actions](https://github.com/44578287/opencode-dream-skin/actions)

## 用法

1. 电脑上运行官方 OpenCode：

```bash
opencode serve --port 4096 --cors https://localhost
```

模型默认用 OpenCode 免费接口（`opencode/mimo-v2.5-free` 等）。要换模型在 OpenCode 里配，不要在客户端填密钥。

2. 客户端「连接」页填 `http://<电脑IP>:4096`，点「保存并连接」。
3. 之后每次打开都会自动接上同一台主机。

网页预览会连本机官方 `opencode serve`（同源代理），同样不用填密钥。

连上之后：会话、消息流、文件树、搜索、权限、提问都走官方接口。

## 功能

- 会话：新建 / 关闭 / 规划与构建 / 停止
- 工作区：文件树、新建、打开、编辑、差异、搜索
- 助手：主机上的模型流式输出（默认免费模型）
- 权限：写入和 shell 先确认
- 主题：Dream Skin 导入导出
- 客户端：PWA、安卓 APK、系统通知；主机地址只配一次

## 本地开发

```bash
npm ci
npm run dev
```
