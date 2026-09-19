"use strict";

// `npm run dev:remote` — dev-server equivalent of `pi-web --remote`:
// spawn a cloudflared quick tunnel, inject the tunnel host into the env, and
// run `next dev`. Manually replicating what bin/pi-web.js does for production,
// since the dev server does not go through that launcher.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { spawn } = require("node:child_process");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const remote = require("./remote");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getNextNodeArgs } = require("./pi-web-node-args");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { wireChildProcessLifecycle } = require("./process-lifecycle");

const PORT = process.env.PORT || "30141";

async function main() {
  if (!remote.isCloudflaredAvailable()) {
    console.error(
      "[pi-web] dev:remote requires the cloudflared CLI. Install it "
        + "(winget install cloudflared / scoop install cloudflared) and try again.",
    );
    process.exit(1);
  }

  let generatedPassword = false;
  if (!process.env.PI_WEB_PASSWORD) {
    process.env.PI_WEB_PASSWORD = remote.generatePassword();
    generatedPassword = true;
  }

  let tunnel;
  try {
    tunnel = await remote.spawnCloudflaredTunnel(`http://127.0.0.1:${PORT}`);
  } catch (error) {
    console.error(`[pi-web] Failed to start cloudflared tunnel: ${error.message}`);
    process.exit(1);
  }

  const tunnelHost = new URL(tunnel.url).host;
  const existing = process.env.PI_WEB_ALLOWED_HOSTS;
  process.env.PI_WEB_ALLOWED_HOSTS = existing ? `${existing},${tunnelHost}` : tunnelHost;
  process.env.PI_WEB_REMOTE_URLS = JSON.stringify([tunnel.url]);

  // Resolve next's CLI entry directly (same approach as bin/pi-web.js) to
  // avoid .bin symlink issues on Windows.
  const pkgDir = path.join(__dirname, "..");
  let nextBin;
  try {
    nextBin = require.resolve("next/dist/bin/next", { paths: [pkgDir] });
  } catch {
    const nextPkg = require.resolve("next/package.json", { paths: [pkgDir] });
    nextBin = path.join(path.dirname(nextPkg), "dist", "bin", "next");
  }

  const nextArgs = ["dev", "-H", "127.0.0.1", "-p", PORT];
  const child = spawn(process.execPath, getNextNodeArgs(nextBin, nextArgs), {
    cwd: pkgDir,
    stdio: "inherit",
    env: process.env,
  });
  wireChildProcessLifecycle(child);

  // Kill the tunnel whenever this process stops; stop the whole thing if the
  // tunnel dies first (its URL is dead either way).
  let stopping = false;
  const stopTunnel = () => {
    stopping = true;
    try { tunnel.child.kill(); } catch { /* already gone */ }
  };
  process.once("exit", stopTunnel);
  process.once("SIGINT", stopTunnel);
  process.once("SIGTERM", stopTunnel);
  tunnel.child.on("exit", (code, signal) => {
    if (stopping) return;
    stopping = true;
    console.error(
      `[pi-web] cloudflared exited unexpectedly (${signal ? `signal ${signal}` : `code ${code}`}); stopping`,
    );
    try { child.kill(); } catch { /* already gone */ }
    process.exit(1);
  });

  console.log("\n[pi-web] Remote dev session:");
  console.log(`  Local:  http://127.0.0.1:${PORT}`);
  console.log(`  Remote: ${tunnel.url}`);
  await remote.printQr(tunnel.url, `  Scan to open: ${tunnel.url}`);
  if (generatedPassword) {
    console.log(`  Password (log in with this on remote devices): ${process.env.PI_WEB_PASSWORD}`);
  }
  console.log("");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});