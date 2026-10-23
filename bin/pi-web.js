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
const { getHelpText, parseCommandLine } = require("./pi-web-options");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getNextNodeArgs } = require("./pi-web-node-args");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { wireChildProcessLifecycle } = require("./process-lifecycle");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const remote = require("./remote");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { rotatePreviewSecrets, getRotationWarning } = require("./rotate-preview-secrets");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { openInBrowser } = require("./browser-opener");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createRunRecordTracker, getOpenUrl, getRunDir } = require("./run-records");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getPackageVersion, runCommand } = require("./pi-web-commands");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { BIN_NAME } = require("./app-identity");

let launchOptions;
try {
  launchOptions = parseCommandLine();
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

if (launchOptions.command === "start") {
  startServer(launchOptions).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
} else {
  runCommand(launchOptions).then(
    exitWhenIdle,
    (error) => {
      console.error(error instanceof Error ? error.message : String(error));
      exitWhenIdle(1);
    },
  );
}

// Leave once the event loop drains instead of calling process.exit() right
// after a fetch(): on Windows, Node.js 23 up to 24.19 / 26.6 can then abort
// with a libuv assertion (UV_HANDLE_CLOSING, win/async.c) while background
// work from the fetch is still winding down (#1174, nodejs/node#56645). The
// unref'd timer only fires if something still holds the loop open.
function exitWhenIdle(code) {
  process.exitCode = code;
  setTimeout(() => process.exit(code), 2_000).unref();
}

async function startServer({ port, hostname, openBrowser, remote: remoteMode }) {
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

  // Replace the published preview-mode secrets with fresh random values so the
  // previewModeId baked into the npm tarball cannot be used to skip the proxy
  // (via the x-prerender-revalidate header). Must happen before `next start`.
  const rotation = rotatePreviewSecrets(nextDir);
  if (!rotation.ok) {
    console.warn(getRotationWarning(rotation.reason));
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
        `[${BIN_NAME}] --remote requires the cloudflared CLI. Install it `
          + "(winget install cloudflared / scoop install cloudflared) and try again.",
      );
      process.exit(1);
    }
    if (wantsTailscale) {
      const tailnetIp = remote.getTailnetIp();
      if (!tailnetIp) {
        console.error(
          `[${BIN_NAME}] --remote=tailscale requires Tailscale to be connected. `
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
        console.error(`[${BIN_NAME}] Failed to start cloudflared tunnel: ${error.message}`);
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

  // Remote mode already puts the server behind a tunnel or the tailnet with a
  // mandatory password, so its bind address is not the user's concern here.
  if (!loopbackHostnames.has(hostname) && !remoteMode) {
    if (passwordEnabled) {
      console.warn(
        `Warning: ${BIN_NAME} is listening on ${hostname} with password authentication over HTTP. Use HTTPS or a trusted VPN to protect the password in transit.`,
      );
    } else {
      console.warn(
        `Warning: ${BIN_NAME} is listening on ${hostname} without authentication. Only use this on a trusted network.`,
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

  // Port 0 lets the OS pick a port we never learn, so such a server gets no record.
  const runRecord = createRunRecordTracker({
    dir: getRunDir,
    record: {
      pid: process.pid,
      nextPid: child.pid,
      port: Number(port),
      hostname,
      url: getOpenUrl(hostname, port),
      version: getPackageVersion(pkgDir),
      startedAt: new Date().toISOString(),
    },
  });

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
      console.error(`[${BIN_NAME}] cloudflared error: ${error.message}`);
      stopCloudflared();
      process.exit(1);
    });
    cloudflaredChild.on("exit", (code, signal) => {
      if (stopping) return;
      stopping = true;
      console.error(
        `[${BIN_NAME}] cloudflared exited unexpectedly (${signal ? `signal ${signal}` : `code ${code}`}); stopping`,
      );
      try { child.kill(); } catch { /* already gone */ }
      process.exit(1);
    });
  }

  const url = `http://${hostname}:${port}`;

  if (remoteMode) {
    console.log(`\n[${BIN_NAME}] Remote access enabled:`);
    for (const remoteUrl of remoteUrls) {
      console.log(`  ${remoteUrl}`);
      await remote.printQr(remoteUrl, `  Scan to open: ${remoteUrl}`);
    }
    if (generatedPassword) {
      console.log(`  Password (log in with this on remote devices): ${process.env.PI_WEB_PASSWORD}`);
    }
    console.log("");
  }

  let serverReady = false;
  child.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    process.stdout.write(text);
    if (!serverReady && text.includes("Ready")) {
      serverReady = true;
      if (port !== "0") runRecord.markReady();
      if (openBrowser) openInBrowser(url);
    }
  });
}
