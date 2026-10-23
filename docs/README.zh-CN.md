# Pi Web

[English](../README.md) | [日本語](./README.ja.md) | [Русский](./README.ru.md)

[pi 编程智能体](https://github.com/earendil-works/pi)的本地浏览器界面。Pi Web 与 pi 共用本机配置和会话文件，可在浏览器中查找和继续对话、运行智能体、配置模型与资源，并查看项目文件。

**本仓库是 `pi-web-remote` 分支**，npm 包名为 **`@hzrshz/pi-web-remote`**，安装后的命令是 **`pi-web-remote`**。它在上游 [agegr/pi-web](https://github.com/agegr/pi-web) 的基础上增加两件事：一条命令的远程访问（`--remote`，走 Cloudflare 快速隧道或你的 Tailscale 地址，见[远程访问](#远程访问)），以及自带 Node.js 运行时的各平台便携压缩包（见[便携压缩包](#便携压缩包离线安装)）。

**[在线体验演示 →](https://agegr.github.io/pi-web/)**：真实的 Pi Web 界面直接在浏览器里运行，带有示例会话、文件和模型。无需安装；回复都是预设内容，不会调用任何模型。

中文微信群：请查看 [GitHub Discussions 帖子](https://github.com/agegr/pi-web/discussions/271)。

![Pi Web 展示包含结构化 Markdown、工具调用和项目导航的 pi 会话](https://raw.githubusercontent.com/agegr/pi-web/main/docs/screenshot2.png)

## 功能

- **会话工作区**：按项目查找、继续、重命名、导出和删除对话，并查看运行状态、上下文占用、花费和压缩信息。
- **两种分支方式**：**新会话**会从较早的消息创建独立会话文件；**从此处编辑**会在当前会话内创建分支。
- **项目文件工具**：浏览和上传文件、查看 Git Diff，并预览源码、Markdown、图片、音频、PDF 和 DOCX；文件变化后会自动刷新。
- **Git worktree**：从侧边栏切换 checkout，同时把同一仓库不同 worktree 的会话归在一起。
- **网页配置**：无需离开 Pi Web，即可管理 Provider 登录和 API Key、模型、模型测试、插件包及技能。
- **一条命令远程访问**：`--remote` 把界面放到公网隧道或 tailnet 后面，并打印可用手机扫码的二维码。
- **英文、简体中文和繁体中文界面**：Pi Web 首次打开时跟随浏览器语言，也可从顶部栏切换语言。

## 快速开始

Pi Web 要求 Node.js 22.19.0 或更高版本。先用 `node --version` 检查版本，然后运行：

```bash
npx @hzrshz/pi-web-remote@latest
```

服务就绪后，命令行会尝试自动打开浏览器。如果没有打开，请访问 [http://127.0.0.1:30141](http://127.0.0.1:30141)。Pi Web 默认仅监听 `127.0.0.1`。

如果尚未配置模型 Provider，请打开**模型（Models）**面板登录或添加 API Key。

如需全局安装 `pi-web-remote` 命令：

```bash
npm install -g @hzrshz/pi-web-remote@latest
pi-web-remote
```

命令：

```bash
pi-web-remote version          # 打印已安装的版本
pi-web-remote status           # 列出正在运行的服务
pi-web-remote stop [--port N]  # 停止正在运行的服务
pi-web-remote open [--port N]  # 在浏览器中打开正在运行的服务
pi-web-remote update [--check] # 更新全局 npm 安装
```

更新时先运行 `pi-web-remote stop`，再运行 `pi-web-remote update`（也可以再次执行同一条安装命令）。卸载时运行 `npm uninstall -g @hzrshz/pi-web-remote`。

`pi-web-remote update` 只更新本包的全局 npm 安装，不会以别的名字安装任何东西，上游 `@agegr/pi-web` 不受影响。

### 便携压缩包（离线安装）

每个 [Release](https://github.com/bluesky4485/pi-web/releases) 还会为各平台提供一个自包含的便携压缩包，里面带有经过校验的 Node.js 运行时和生产依赖，目标机器**既不需要安装 Node.js，也不需要联网**：

| 压缩包 | 运行于 |
| --- | --- |
| `pi-web-remote-v<版本>-linux-x64.tar.gz` | Linux x86-64 |
| `pi-web-remote-v<版本>-linux-arm64.tar.gz` | Linux arm64 |
| `pi-web-remote-v<版本>-mac-arm64.tar.gz` | Apple Silicon 的 macOS |
| `pi-web-remote-v<版本>-win-x64.zip` | Windows x64 |

解压到任意位置，运行该目录里的启动器即可（macOS/Linux 是 `./pi-web-remote`，Windows 是 `pi-web-remote.cmd`）。不会向系统写入任何东西，而且启动器固定使用压缩包自带的运行时，不会去用机器上恰好装的 Node.js：

```bash
tar -xzf pi-web-remote-v1.0.0-linux-x64.tar.gz
cd pi-web-remote-v1.0.0-linux-x64
./pi-web-remote --remote
```

压缩包内 `node_modules` 里的原生二进制是分平台的，因此一个压缩包只能在打包时指定的平台上运行，请用对应平台的包，或改用 npm 安装。更新便携包的做法是解压一个新版本替换旧目录——会话、设置和 API Key 都保存在 pi 自己的 agent 目录（`~/.pi/agent`，pi CLI 也用同一个目录）里，不随目录消失。

## 配置

端口和主机名以命令行参数为准，优先于对应的环境变量。`--no-open` 与 `PI_WEB_NO_OPEN=1` 中任意一个都会关闭自动打开浏览器。运行 `pi-web-remote --help`（或 `-h`）可打印启动选项并以退出码 0 结束，不会启动服务；未知参数会报错并以退出码 1 结束。

| 参数或环境变量 | 用途 | 默认值 |
| --- | --- | --- |
| `--help`、`-h` | 打印启动选项并退出 | — |
| `--port <端口>`、`-p <端口>` 或 `PORT` | 服务端口 | `30141` |
| `--hostname <主机>`、`-H <主机>` 或 `PI_WEB_HOSTNAME` | 监听主机名 | `127.0.0.1` |
| `--remote[=模式]` | 远程暴露 Pi Web：`cloudflare`（默认）、`tailscale` 或 `both`，见[远程访问](#远程访问) | 关闭 |
| `--no-open` 或 `PI_WEB_NO_OPEN=1` | 不自动打开浏览器 | 自动打开 |
| `PI_WEB_APP_NAME` | PWA manifest 的 `name` 和 `short_name`；去除首尾空白，空值使用默认值 | `pi-web-remote` |
| `PI_WEB_ALLOWED_HOSTS` | 额外允许的代理或自定义主机名，多个值用逗号分隔，必须精确匹配 | 未设置 |
| `PI_WEB_PASSWORD` | 启用浏览器密码登录；API 客户端可使用用户名为 `pi` 的 Basic Auth | 不启用认证 |

在启动服务前设置 `PI_WEB_APP_NAME`，例如 `PI_WEB_APP_NAME='工作 Pi' pi-web-remote`。修改后重启服务即可提供新的 manifest，无需重新构建。已安装 PWA 的名称更新由浏览器管理，不保证立即生效；此设置不改变页面标题或图标。

例如：

```bash
pi-web-remote --help
pi-web-remote -p 8080 -H 0.0.0.0 --no-open
```

### 远程访问

`--remote` 让你在不用自己配置任何隧道的情况下，把 Pi Web 暴露到这台机器之外。Pi Web 会自己启动隧道、强制要求密码，并打印地址和一个可用手机扫码的二维码：

```bash
pi-web-remote --remote
```

```text
[pi-web-remote] Remote access enabled:
  https://a-random-hostname.trycloudflare.com

  Scan to open: https://a-random-hostname.trycloudflare.com
  <该地址的二维码>

  Password (log in with this on remote devices): 2db7e02e4e3ff9ec
```

| 参数 | 行为 | 前置条件 |
| --- | --- | --- |
| `--remote` 或 `--remote=cloudflare` | Pi Web 仍然只监听 `127.0.0.1`，前面套一个 Cloudflare 快速隧道，因此不需要对你的网络开放任何端口。隧道拿到的 `*.trycloudflare.com` 域名会自动加进 `PI_WEB_ALLOWED_HOSTS`。 | 已安装 `cloudflared` |
| `--remote=tailscale` | 把 Pi Web 绑定到本机的 Tailscale 地址（`100.x.y.z`），只有同一 tailnet 内的设备能访问，流量不经过第三方。 | Tailscale 已连接 |
| `--remote=both` | 既绑定 Tailscale 地址，又把它接到 Cloudflare 隧道上，两个地址同时可用。 | 以上两者 |

模式写错时会在启动前失败：`Invalid --remote value "…". Use: cloudflare (default), tailscale, or both.`

开启远程访问后，服务本身的变化：

- **密码变成必需。** 如果没设 `PI_WEB_PASSWORD`，Pi Web 会随机生成一个，并且只在上面那段输出里打印一次。想自己指定、或希望重启后仍是同一个，就显式设置：`PI_WEB_PASSWORD='足够长的随机密码' pi-web-remote --remote`。
- **隧道与进程共存亡。** `cloudflared` 一旦退出，隧道地址即失效，Pi Web 也会随之停止；反过来停止 Pi Web 也会带走隧道。
- **API 客户端使用 Basic Auth**，用户名为 `pi`，密码即 `PI_WEB_PASSWORD`。
- **快速隧道是一次性的。** 每次启动都会拿到一个新的随机 `trycloudflare.com` 域名，免费快速隧道有速率限制且不保证可用性。需要固定域名的话，请自己部署命名隧道（Named Tunnel）或任意反向代理，然后用 `--hostname` 加 `PI_WEB_PASSWORD` 启动 Pi Web。

#### 安装 cloudflared

Pi Web 不会打包 `cloudflared`：它只调用你已经装好的那个 CLI；`PATH` 上找不到命令时，`--remote` 会直接报错退出。下面的安装方式都可以用 `cloudflared --version` 验证；完整的包列表见 [Cloudflare Tunnel downloads](https://developers.cloudflare.com/tunnel/downloads/)。

**macOS**（Apple Silicon 或 Intel）：

```bash
brew install cloudflared
```

**Windows** —— 两种包管理器都会把 `cloudflared` 放进 `PATH`：

```powershell
winget install --id Cloudflare.cloudflared
choco install cloudflared
```

**Debian 和 Ubuntu** —— 官方 apt 源，可随系统一起更新：

```bash
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
  | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' \
  | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update && sudo apt-get install cloudflared
```

**Fedora、RHEL、CentOS 和 Stream** —— 官方 yum/dnf 源：

```bash
curl -fsSL https://pkg.cloudflare.com/cloudflared.repo \
  | sudo tee /etc/yum.repos.d/cloudflared.repo
sudo dnf install cloudflared
```

**任意 Linux、不加软件源** —— 直接下载独立二进制，加执行权限后放到 `PATH` 上：

```bash
# x86-64；arm64（含 64 位 Raspberry Pi OS）请改用 cloudflared-linux-arm64
curl -L --output cloudflared \
  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
chmod +x cloudflared && sudo mv cloudflared /usr/local/bin/
```

同一个发布页也提供 `.deb`（`cloudflared-linux-amd64.deb`、`cloudflared-linux-arm64.deb`）和 `.rpm`（`cloudflared-linux-x86_64.rpm`、`cloudflared-linux-aarch64.rpm`），可以一次性 `dpkg -i` / `rpm -ivh` 安装。

**Tailscale** 用不着为 `--remote=tailscale` 做额外配置：该选项只是读取 `tailscale ip -4` 的地址，客户端没连上时会以 `--remote=tailscale requires Tailscale to be connected` 报错退出。尚未安装的话见 [tailscale.com/download](https://tailscale.com/download)。

#### 不靠 `--remote`，自己暴露

监听非回环地址会暴露一个可执行高权限操作的智能体。在可信局域网中使用时，请设置足够长的随机密码：

```bash
PI_WEB_PASSWORD='足够长的随机密码' pi-web-remote --hostname 0.0.0.0
```

密码认证不会加密连接。不要通过明文 HTTP 将 Pi Web 暴露到互联网；远程访问应使用可信反向代理提供 HTTPS，或通过可信 VPN。如果反向代理传递外部主机名，请把该名称精确加入 `PI_WEB_ALLOWED_HOSTS`。这个白名单不会改变 Pi Web 的监听地址。

### HTTP 代理

服务端的模型和 API 请求会读取标准的 `HTTP_PROXY`、`HTTPS_PROXY` 和 `NO_PROXY` 环境变量。

macOS 或 Linux：

```bash
HTTP_PROXY=http://127.0.0.1:7890 \
HTTPS_PROXY=http://127.0.0.1:7890 \
NO_PROXY=localhost,127.0.0.1 \
npx @hzrshz/pi-web-remote@latest
```

Windows PowerShell：

```powershell
$env:HTTP_PROXY = "http://127.0.0.1:7890"
$env:HTTPS_PROXY = "http://127.0.0.1:7890"
$env:NO_PROXY = "localhost,127.0.0.1"
npx @hzrshz/pi-web-remote@latest
```

## 注意事项

- **智能体数据**：Pi Web 默认读取 `~/.pi/agent` 下的 pi 数据，包括 `sessions/<编码后的工作目录>/<时间戳>_<uuid>.jsonl` 中的会话文件。可通过 `PI_CODING_AGENT_DIR` 指定其他 pi agent 目录。
- **文件系统访问**：Pi Web 必须能读取智能体数据目录及会话记录中的工作目录。与现有 pi 会话共用数据时，请让 Pi Web 运行在与 pi 相同的文件系统环境中。
- **共享配置**：模型面板使用 pi 的模型、设置和凭据存储，因此两种界面都能看到相关更改。
- **文件访问边界**：文件浏览器仅能访问在 Pi Web 中选择过的工作目录，以及它已识别的项目或会话根目录；它不是通用的文件系统浏览器。
- **Git worktree**：切换器何时显示、如何创建 worktree，以及删除会产生什么影响，见 [Pi Web 里的 Worktree](./worktrees.zh-CN.md)。

## 开发

```bash
npm install
npm run dev
```

开发服务器运行在 [http://127.0.0.1:30141](http://127.0.0.1:30141)。常用检查命令：

```bash
npm test
node_modules/.bin/tsc --noEmit
npm run lint
```

日常开发时不要运行 `next build` 或 `npm run build`。它们会写入 `.next/`，可能干扰开发服务器；仅在发布流程中执行构建。

开始做新功能之前，请先阅读[参与贡献](./CONTRIBUTING.zh-CN.md)，了解哪些改动在范围内以及提交 PR 前的检查项。

贡献者文档：[国际化](./i18n.md)和[发布流程](./release.md)。

## 仓库结构

```text
app/             Next.js 界面和 API 路由
components/      React 界面组件
hooks/           客户端状态和交互 hooks
lib/             会话、智能体、模型、文件、Git 和安全逻辑
public/          静态资源和 PWA 文件
bin/             npm CLI 入口及启动参数解析
scripts/         便携压缩包的打包与自检脚本
docs/            面向用户和贡献者的专题文档
demo/            发布到 GitHub Pages 的静态演示站（见 demo/README.md）
```

架构说明和详细文件地图见 [AGENTS.md](../AGENTS.md)。

## 许可证

[MIT](../LICENSE)
