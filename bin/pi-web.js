#!/usr/bin/env node
"use strict";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getUnsupportedNodeVersionMessage, isNodeVersionSupported } = require("./node-version");

if (!isNodeVersionSupported(process.versions.node)) {
  console.error(getUnsupportedNodeVersionMessage(process.versions.node));
  process.exit(1);
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { spawn } = require("child_process");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("fs");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getHelpText, parseLaunchOptions } = require("./pi-web-options");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getNextNodeArgs } = require("./pi-web-node-args");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { wireChildProcessLifecycle } = require("./process-lifecycle");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const remote = require("./remote");

async function main() {
  let launchOptions;
  try {
    launchOptions = parseLaunchOptions();
  } catch (error) {
    fs.writeSync(
      process.stderr.fd,
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  }

  if (launchOptions.help) {
    fs.writeSync(process.stdout.fd, getHelpText());
    process.exit(0);
  }

  const { port, openBrowser } = launchOptions;
  let hostname = launchOptions.hostname;
  const remoteMode = launchOptions.remote;

  const pkgDir = path.join(__dirname, "..");
  const nextDir = path.join(pkgDir, ".next");

  // Resolve next's CLI entry directly to avoid relying on .bin symlinks (which
  // may not exist when installed via npx).
  let nextBin;
  try {
    nextBin = require.resolve("next/dist/bin/next", { paths: [pkgDir] });
  } catch {
    // Fallback: locate next package root and derive the bin path manually.
    try {
      const nextPkg = require.resolve("next/package.json", { paths: [pkgDir] });
      nextBin = path.join(path.dirname(nextPkg), "dist", "bin", "next");
    } catch {
      nextBin = path.join(pkgDir, "node_modules", "next", "dist", "bin", "next");
    }
  }

  if (!fs.existsSync(nextDir)) {
    console.error("Build artifacts not found. Please report this issue.");
    process.exit(1);
  }

  // --- Remote mode setup ---------------------------------------------------
  // cloudflare (default): spawn a cloudflared quick tunnel to 127.0.0.1.
  // tailscale: bind the tailnet IP so only tailnet devices can reach pi-web.
  // both: bind the tailnet IP AND tunnel it through cloudflared, so either
  // entry point works. A password is mandatory (auto-generated when unset).
  let cloudflaredChild = null;
  let generatedPassword = false;
  const remoteUrls = [];

  if (remoteMode) {
    const wantsCloudflare = remoteMode === "cloudflare" || remoteMode === "both";
    const wantsTailscale = remoteMode === "tailscale" || remoteMode === "both";

    if (wantsCloudflare && !remote.isCloudflaredAvailable()) {
      console.error(
        "[pi-web] --remote requires the cloudflared CLI. Install it "
          + "(winget install cloudflared / scoop install cloudflared) and try again.",
      );
      process.exit(1);
    }
    if (wantsTailscale) {
      const tailnetIp = remote.getTailnetIp();
      if (!tailnetIp) {
        console.error(
          "[pi-web] --remote=tailscale requires Tailscale to be connected. "
            + "Start Tailscale or use --remote=cloudflare.",
        );
        process.exit(1);
      }
      hostname = tailnetIp;
    } else {
      // cloudflare-only: keep pi-web on loopback; the tunnel reaches it locally.
      hostname = "127.0.0.1";
    }

    if (!process.env.PI_WEB_PASSWORD) {
      process.env.PI_WEB_PASSWORD = remote.generatePassword();
      generatedPassword = true;
    }

    if (wantsCloudflare) {
      try {
        const tunnel = await remote.spawnCloudflaredTunnel(`http://${hostname}:${port}`);
        cloudflaredChild = tunnel.child;
        const tunnelHost = new URL(tunnel.url).host;
        const existing = process.env.PI_WEB_ALLOWED_HOSTS;
        process.env.PI_WEB_ALLOWED_HOSTS = existing
          ? `${existing},${tunnelHost}`
          : tunnelHost;
        remoteUrls.push(tunnel.url);
      } catch (error) {
        console.error(`[pi-web] Failed to start cloudflared tunnel: ${error.message}`);
        process.exit(1);
      }
    }
    if (wantsTailscale) {
      remoteUrls.push(`http://${hostname}:${port}`);
    }

    process.env.PI_WEB_REMOTE_URLS = JSON.stringify(remoteUrls);
  }

  const loopbackHostnames = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
  const passwordEnabled = Boolean(process.env.PI_WEB_PASSWORD);

  if (!loopbackHostnames.has(hostname) && !remoteMode) {
    if (passwordEnabled) {
      console.warn(
        `Warning: pi-web is listening on ${hostname} with password authentication over HTTP. Use HTTPS or a trusted VPN to protect the password in transit.`,
      );
    } else {
      console.warn(
        `Warning: pi-web is listening on ${hostname} without authentication. Only use this on a trusted network.`,
      );
    }
  }

  const nextArgs = ["start", "-p", port];
  nextArgs.push("-H", hostname);

  // Always run next's JS entry with node directly — avoids .bin symlink issues
  // and path-with-spaces problems on Windows when shell: true is used.
  const child = spawn(process.execPath, getNextNodeArgs(nextBin, nextArgs), {
    cwd: pkgDir,
    stdio: ["inherit", "pipe", "inherit"],
    env: { ...process.env, PI_WEB_HOSTNAME: hostname, PI_WEB_PORT: port },
  });
  wireChildProcessLifecycle(child);

  // Remote child lifecycle: cloudflared dies whenever pi-web exits; if the
  // tunnel dies first its URL is dead, so the whole thing stops.
  let stopping = false;
  const stopCloudflared = () => {
    stopping = true;
    if (cloudflaredChild) {
      try { cloudflaredChild.kill(); } catch { /* already gone */ }
    }
  };
  if (cloudflaredChild) {
    process.once("exit", stopCloudflared);
    process.once("SIGINT", stopCloudflared);
    process.once("SIGTERM", stopCloudflared);
    cloudflaredChild.on("error", (error) => {
      console.error(`[pi-web] cloudflared error: ${error.message}`);
      stopCloudflared();
      process.exit(1);
    });
    cloudflaredChild.on("exit", (code, signal) => {
      if (stopping) return;
      stopping = true;
      console.error(
        `[pi-web] cloudflared exited unexpectedly (${signal ? `signal ${signal}` : `code ${code}`}); stopping`,
      );
      try { child.kill(); } catch { /* already gone */ }
      process.exit(1);
    });
  }

  let browserOpened = false;
  const url = `http://${hostname}:${port}`;

  if (remoteMode) {
    console.log("\n[pi-web] Remote access enabled:");
    for (const remoteUrl of remoteUrls) {
      console.log(`  ${remoteUrl}`);
      await remote.printQr(remoteUrl, `  Scan to open: ${remoteUrl}`);
    }
    if (generatedPassword) {
      console.log(`  Password (log in with this on remote devices): ${process.env.PI_WEB_PASSWORD}`);
    }
    console.log("");
  }

  child.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    process.stdout.write(text);
    if (openBrowser && !browserOpened && text.includes("Ready")) {
      browserOpened = true;
      const isWindows = process.platform === "win32";
      const isMac = process.platform === "darwin";
      // Avoid `shell: true` to suppress Node.js DEP0190 deprecation
      // ("Passing args to a child process with shell option true can lead to
      // security vulnerabilities, as the arguments are not escaped").
      // Pass a structured argv so Node.js handles escaping instead of
      // concatenating the args into a shell command string.
      let opener;
      if (isWindows) {
        // `start` is a cmd.exe built-in, so invoke cmd directly. The empty
        // title argument is required by `start` before the target URL.
        opener = spawn(process.env.ComSpec || "cmd.exe", ["/c", "start", "", url], {
          stdio: "ignore",
          detached: true,
        });
      } else if (isMac) {
        opener = spawn("open", [url], {
          stdio: "ignore",
          detached: true,
        });
      } else {
        opener = spawn("xdg-open", [url], {
          stdio: "ignore",
          detached: true,
        });
      }

      opener.on("error", (error) => {
        console.warn(`Could not open browser automatically: ${error.message}`);
      });

      opener.unref();
    }
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
