# Pi Web

[中文文档](./docs/README.zh-CN.md) | [日本語](./docs/README.ja.md) | [Русский](./docs/README.ru.md)

Local browser UI for the [pi coding agent](https://github.com/earendil-works/pi). Pi Web uses the same local configuration and session files as pi, so you can browse and resume conversations, run agent turns, configure models and resources, and inspect project files from a browser.

**This repository is the `pi-web-remote` fork**, published as **`@hzrshz/pi-web-remote`** and installed as the **`pi-web-remote`** command. It keeps what upstream [agegr/pi-web](https://github.com/agegr/pi-web) does and adds two things: one-command remote access through a Cloudflare quick tunnel or your Tailscale address ([Remote access](#remote-access)), and per-platform portable bundles that carry their own Node.js runtime ([Portable bundle](#portable-bundle-offline-install)).

**[Try the interactive demo →](https://agegr.github.io/pi-web/)** The real Pi Web UI runs entirely in your browser, with sample sessions, files and models. There is nothing to install; replies are pre-written and no model is called.

![Pi Web displaying a pi session with structured Markdown, tool calls, and project navigation](https://raw.githubusercontent.com/agegr/pi-web/main/docs/screenshot2.png)

## Features

- **Session workspace**: browse, resume, rename, export, and delete conversations grouped by project, with running state, context usage, cost, and compaction details.
- **Two ways to branch**: **New session** creates an independent session file from an earlier message; **Edit from here** creates a branch inside the current session.
- **Project file tools**: browse and upload files, inspect Git diffs, and preview source, Markdown, images, audio, PDFs, and DOCX files with automatic refresh.
- **Git worktrees**: switch checkouts from the sidebar while keeping sessions from the same repository grouped together.
- **Web-based configuration**: manage provider login and API keys, models, model tests, plugin packages, and skills without leaving Pi Web.
- **One-command remote access**: `--remote` puts the UI behind a public HTTPS tunnel or your tailnet and prints a QR code to scan from a phone.
- **English, Simplified Chinese, and Traditional Chinese UI**: Pi Web follows the browser language initially and provides a language switcher in the top bar.

## Quick Start

Pi Web requires Node.js 22.19.0 or newer. Check your version with `node --version`, then run:

```bash
npx @hzrshz/pi-web-remote@latest
```

The CLI opens a browser after the server is ready. If it does not, open [http://127.0.0.1:30141](http://127.0.0.1:30141). Pi Web listens only on `127.0.0.1` by default.

If no model provider is configured yet, open the **Models** panel to sign in or add an API key.

To install the `pi-web-remote` command globally:

```bash
npm install -g @hzrshz/pi-web-remote@latest
pi-web-remote
```

Commands:

```bash
pi-web-remote version          # print the installed version
pi-web-remote status           # list running servers
pi-web-remote stop [--port N]  # stop a running server
pi-web-remote open [--port N]  # open a running server in the browser
pi-web-remote update [--check] # update a global npm install
```

To update, run `pi-web-remote stop`, then `pi-web-remote update` (or run the same install command again). To uninstall, run `npm uninstall -g @hzrshz/pi-web-remote`.

`pi-web-remote update` updates a global npm install of this package only. It never installs anything under another name, so the upstream `@agegr/pi-web` package stays untouched.

### Portable bundle (offline install)

Every [release](https://github.com/bluesky4485/pi-web/releases) also ships one self-contained bundle per platform. Each carries its own verified Node.js runtime and its production dependencies, so the machine it is copied to needs neither Node.js nor internet access:

| Bundle | Runs on |
| --- | --- |
| `pi-web-remote-v<version>-linux-x64.tar.gz` | Linux x86-64 |
| `pi-web-remote-v<version>-linux-arm64.tar.gz` | Linux arm64 |
| `pi-web-remote-v<version>-mac-arm64.tar.gz` | Apple Silicon macOS |
| `pi-web-remote-v<version>-win-x64.zip` | Windows x64 |

Unpack it anywhere and run the launcher in that folder — `./pi-web-remote`, or `pi-web-remote.cmd` on Windows. Nothing is written to the system, and the launcher always uses the bundled runtime instead of whatever Node.js the machine happens to have:

```bash
tar -xzf pi-web-remote-v1.0.0-linux-x64.tar.gz
cd pi-web-remote-v1.0.0-linux-x64
./pi-web-remote --remote
```

A bundle runs only on the platform it was packed for, because its `node_modules` holds platform-specific native binaries. Use the matching bundle, or install from npm. To update a bundle, unpack the new release over a folder of the same name — sessions, settings and API keys live in pi's own agent directory (`~/.pi/agent`), which the pi CLI uses too, so they outlive any folder.

## Configuration

For port and hostname, command-line options override the corresponding environment variables. Either `--no-open` or `PI_WEB_NO_OPEN=1` disables automatic browser opening. Run `pi-web-remote --help` (or `-h`) to print startup options and exit without starting the server. Unknown options exit with an error.

| Option or environment variable | Purpose | Default |
| --- | --- | --- |
| `--help`, `-h` | Print startup options and exit | — |
| `--port <port>`, `-p <port>`, or `PORT` | Server port | `30141` |
| `--hostname <host>`, `-H <host>`, or `PI_WEB_HOSTNAME` | Bind hostname | `127.0.0.1` |
| `--remote[=mode]` | Expose Pi Web remotely: `cloudflare` (default), `tailscale`, or `both`. See [Remote access](#remote-access). | Off |
| `--no-open` or `PI_WEB_NO_OPEN=1` | Do not open a browser automatically | Browser opens |
| `PI_WEB_APP_NAME` | PWA manifest `name` and `short_name`; surrounding whitespace is trimmed, empty values use the default | `pi-web-remote` |
| `PI_WEB_SKIP_VERSION_CHECK=1` | Disable Pi Web update checks | Unset |
| `PI_WEB_ALLOWED_HOSTS` | Additional exact proxy or custom hostnames, comma-separated | Unset |
| `PI_WEB_PASSWORD` | Enable browser password login; API clients may use Basic Auth with username `pi` | Authentication disabled |
| `PI_WEB_IDLE_TIMEOUT_MS` | Session idle timeout in milliseconds, up to `2147483647`; `0` disables idle shutdown; invalid or out-of-range values use the default | `600000` (10 min) |
| `PI_WEB_SHUTDOWN_DEADLINE_MS` | How long extensions get to handle `session_shutdown` before a closing session is disposed anyway, in milliseconds up to `2147483647`; `0`, invalid or out-of-range values use the default | `5000` (5 s) |

Set `PI_WEB_APP_NAME` before starting the server (for example, `PI_WEB_APP_NAME='Work Pi' pi-web-remote`). After changing it, restart the server to serve the new manifest; no rebuild is required. Updates to the name of an already installed PWA are managed by the browser and are not guaranteed to appear immediately. This does not change the page title or icons.

For example:

```bash
pi-web-remote --help
pi-web-remote -p 8080 -H 0.0.0.0 --no-open
```

## Remote Access

`--remote` exposes Pi Web outside this machine without you configuring a tunnel. Pi Web starts the tunnel itself, makes a password mandatory, and prints the address with a QR code to scan from a phone:

```bash
pi-web-remote --remote
```

```text
[pi-web-remote] Remote access enabled:
  https://a-random-hostname.trycloudflare.com

  Scan to open: https://a-random-hostname.trycloudflare.com
  <a QR code of that address>

  Password (log in with this on remote devices): 2db7e02e4e3ff9ec
```

| Option | What it does | Requires |
| --- | --- | --- |
| `--remote` or `--remote=cloudflare` | Keeps Pi Web bound to `127.0.0.1` and puts a Cloudflare quick tunnel in front of it, so nothing on your network is opened. The `*.trycloudflare.com` host the tunnel gets is added to `PI_WEB_ALLOWED_HOSTS` for you. | `cloudflared` installed |
| `--remote=tailscale` | Binds Pi Web to this machine's Tailscale address (`100.x.y.z`), so only devices on your tailnet can reach it. No third party sees the traffic. | Tailscale connected |
| `--remote=both` | Binds the Tailscale address **and** tunnels that through cloudflared, so both addresses work at once. | both of the above |

An invalid mode fails before anything starts: `Invalid --remote value "…". Use: cloudflare (default), tailscale, or both.`

What changes about the server itself:

- **A password becomes mandatory.** If `PI_WEB_PASSWORD` is unset, Pi Web generates a random one and prints it once, in the block above. Set it yourself if you want to choose it, or to reuse the same one across restarts: `PI_WEB_PASSWORD='a-long-random-password' pi-web-remote --remote`.
- **The tunnel owns the process.** If `cloudflared` dies, its URL is dead, so Pi Web stops too; stopping Pi Web stops the tunnel.
- **API clients authenticate with Basic Auth**, username `pi`, password `PI_WEB_PASSWORD`.
- **Quick tunnels are ephemeral.** Each start gets a new random `trycloudflare.com` hostname, and free quick tunnels are rate-limited with no uptime guarantee. For a stable hostname, run a named Cloudflare Tunnel (or any reverse proxy) yourself and start Pi Web with `--hostname` and `PI_WEB_PASSWORD` instead.

### Installing cloudflared

Pi Web never bundles `cloudflared`: it only spawns the CLI you installed. `--remote` exits with an error when the command is not on `PATH`. Verify any install below with `cloudflared --version`; the full package list is on [Cloudflare Tunnel downloads](https://developers.cloudflare.com/tunnel/downloads/).

**macOS** (Apple Silicon or Intel):

```bash
brew install cloudflared
```

**Windows** — either package manager puts `cloudflared` on `PATH`:

```powershell
winget install --id Cloudflare.cloudflared
choco install cloudflared
```

**Debian and Ubuntu** — the official apt repository, which keeps the client updated:

```bash
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
  | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' \
  | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update && sudo apt-get install cloudflared
```

**Fedora, RHEL, CentOS and Stream** — the official yum/dnf repository:

```bash
curl -fsSL https://pkg.cloudflare.com/cloudflared.repo \
  | sudo tee /etc/yum.repos.d/cloudflared.repo
sudo dnf install cloudflared
```

**Any Linux, no repository** — download the standalone binary, make it executable, and put it somewhere on `PATH`:

```bash
# x86-64; use cloudflared-linux-arm64 on arm64 (including Raspberry Pi OS 64-bit)
curl -L --output cloudflared \
  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
chmod +x cloudflared && sudo mv cloudflared /usr/local/bin/
```

The same release page also carries `.deb` (`cloudflared-linux-amd64.deb`, `cloudflared-linux-arm64.deb`) and `.rpm` (`cloudflared-linux-x86_64.rpm`, `cloudflared-linux-aarch64.rpm`) files for a one-off `dpkg -i` / `rpm -ivh` install.

**Tailscale** needs no separate step for `--remote=tailscale` beyond a connected client: the option reads the address from `tailscale ip -4` and fails with `--remote=tailscale requires Tailscale to be connected` when it is not. See [tailscale.com/download](https://tailscale.com/download) if it is not installed.

### Exposing it manually instead

Binding to a non-loopback address exposes an agent that can execute high-privilege actions. On a trusted LAN, require a long random password:

```bash
PI_WEB_PASSWORD='a-long-random-password' pi-web-remote --hostname 0.0.0.0
```

Password authentication does not encrypt the connection. Do not expose Pi Web over plain HTTP to the internet; use HTTPS through a trusted reverse proxy or a trusted VPN. If a reverse proxy sends an external hostname, add that exact name to `PI_WEB_ALLOWED_HOSTS`. This allow-list does not change the address Pi Web binds to.

### HTTP Proxy

Server-side model and API requests honor the standard `HTTP_PROXY`, `HTTPS_PROXY`, and `NO_PROXY` environment variables.

On macOS or Linux:

```bash
HTTP_PROXY=http://127.0.0.1:7890 \
HTTPS_PROXY=http://127.0.0.1:7890 \
NO_PROXY=localhost,127.0.0.1 \
npx @hzrshz/pi-web-remote@latest
```

On Windows PowerShell:

```powershell
$env:HTTP_PROXY = "http://127.0.0.1:7890"
$env:HTTPS_PROXY = "http://127.0.0.1:7890"
$env:NO_PROXY = "localhost,127.0.0.1"
npx @hzrshz/pi-web-remote@latest
```

## Notes

- **Agent data**: Pi Web reads pi data from `~/.pi/agent` by default, including session files under `sessions/<encoded-cwd>/<timestamp>_<uuid>.jsonl`. Set `PI_CODING_AGENT_DIR` to use another pi agent directory.
- **Filesystem access**: Pi Web must be able to read the agent data directory and the working directories recorded by its sessions. Run Pi Web in the same filesystem environment as pi when sharing existing sessions.
- **Shared configuration**: the Models panel uses pi's model, settings, and credential storage, so changes are visible to both interfaces. An open session applies a saved edit of its model when you select the model again.
- **File access boundary**: the file browser is limited to working directories selected in Pi Web and project or session roots it already knows about; it is not a general filesystem browser.
- **Git worktrees**: see [Worktrees in Pi Web](./docs/worktrees.md) for switcher visibility, worktree creation, and removal behavior.

### Downstream Session Context Menu

Electron wrappers and other downstream integrations can provide a session-row
context menu without patching `SessionSidebar`. Listen for the cancelable
`pi-web:session-row-contextmenu` browser event and call `preventDefault()`
synchronously when the integration will handle it:

```js
window.addEventListener("pi-web:session-row-contextmenu", (event) => {
  event.preventDefault();
  const { id, path, cwd, name, clientX, clientY, refresh } = event.detail;

  void openSessionMenu({ id, path, cwd, name, clientX, clientY }).then((changed) => {
    if (changed) refresh();
  });
});
```

The detail object contains `id`, `path`, `cwd`, optional `name`, pointer
coordinates, and a `refresh()` callback for actions that change the session
list. If no listener cancels the extension event, Pi Web opens its built-in
session menu (pin, rename, fork, mark read or unread, archive, open in new
tab, delete) at the pointer instead of the browser's native context menu.
The row's `⋯` button always opens the built-in menu and does not dispatch the
event. Sessions not yet saved to disk get no built-in menu, so the native one
still appears for them. This hook is browser-side and independent of Pi agent
extensions.

### Extension Session Liveness

Server-side Pi extensions with detached work can prevent automatic idle
session eviction through the versioned global registry:

```js
const liveness = globalThis[Symbol.for("@agegr/pi-web/session-liveness/v1")];
const release = liveness?.version === 1
  ? liveness.register({
      name: "my-extension",
      sessionId,
      sessionFile: sessionFile || undefined,
      isActive: () => detachedJobs.size > 0,
    })
  : () => {};
```

Register once per active extension session and call the returned idempotent
`release` function on session shutdown, replacement, or reload. `isActive`
must be synchronous, cheap, and scoped to the supplied exact session id or
file. Provider errors fail safe by preserving that session. This lease only
affects automatic idle eviction; explicit shutdown and Stop fallback cleanup
still take precedence.

The registry key keeps upstream's `@agegr/pi-web` spelling on purpose: it is a
protocol identifier shared with extensions written for upstream, not this
package's name. Renaming it would break those extensions.

## Development

```bash
npm install
npm run dev
```

The development server runs at [http://127.0.0.1:30141](http://127.0.0.1:30141). Run the common checks with:

```bash
npm test
node_modules/.bin/tsc --noEmit
npm run lint
```

Do not run `next build` or `npm run build` during normal development. It writes to `.next/` and can interfere with the development server; leave builds for release work.

Before starting on a feature, read [Contributing](./CONTRIBUTING.md) for what is in scope and the pull request checklist.

Contributor guides: [Internationalization](./docs/i18n.md) and [Release process](./docs/release.md).

## Repository Layout

```text
app/             Next.js UI and API routes
components/      React UI components
hooks/           Client state and interaction hooks
lib/             Session, agent, model, file, Git, and security logic
public/          Static assets and PWA files
bin/             npm CLI entrypoint and launch option parsing
scripts/         Portable bundle build and check scripts
docs/            Focused user and contributor guides
demo/            Static browser demo published to GitHub Pages (see demo/README.md)
```

See [AGENTS.md](./AGENTS.md) for the architecture notes and detailed file map.

## License

[MIT](./LICENSE)
