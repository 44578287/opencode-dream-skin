# OpenCode Dream Skin

独立 Web 客户端：把 Dream Skin 主题包接到 OpenCode，桌面 IDE + 移动端远程壳。

GitHub Actions 会同时编译：

| 产物 | 文件 | 说明 |
| --- | --- | --- |
| **本体** | `opencode-web.zip` | `npm run build` 的 Vercel/Nitro 产物 |
| **APK** | `OpenCode.apk` | Capacitor 包装的安卓客户端（debug，可直接安装） |

## 下载

- 最新包：[Releases / nightly](https://github.com/44578287/opencode-dream-skin/releases)
- 每次推送的构建日志：[Actions](https://github.com/44578287/opencode-dream-skin/actions)

打 `v*` 标签会再发一版正式 Release。

## 本地

```bash
npm ci
npm run dev
```

```bash
npm run build
npm run apk:www
```

`android-www/` 是给 Capacitor 用的静态壳。APK 本身在 GitHub 的 Ubuntu runner 上用 JDK 21 + Android SDK 编，这个仓库不提交 `android/`。

## 接到真 OpenCode 主机

1. 本机或远端跑 `opencode serve`（或 `opencode web`）
2. 客户端「连接」页填主机地址；可选 Basic 认证
3. 勾选要同步的：主题 / 会话 / 工作区
