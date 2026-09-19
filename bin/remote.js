"use strict";

// Remote access helpers for `pi-web --remote`. pi-web never bundles tunnel
// binaries; it only spawns CLIs the operator already installed (cloudflared /
// tailscale) and manages their lifecycle alongside the Next.js process.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { spawn, spawnSync } = require("node:child_process");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const crypto = require("node:crypto");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const QRCode = require("qrcode");

// cloudflared prints this when a quick tunnel is ready.
const CLOUDFLARED_URL_RE = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;
// Tailscale CGNAT range used for tailnet IPv4 addresses (octets 0-255).
const TAILNET_IP_RE = /^100\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){2}$/;

/** Extract the quick-tunnel URL from cloudflared's accumulated output. */
function extractTunnelUrl(buffer) {
  const match = CLOUDFLARED_URL_RE.exec(buffer);
  return match ? match[0] : null;
}

function runCommand(cmd, args) {
  const result = spawnSync(cmd, args, { encoding: "utf8", timeout: 5_000 });
  if (result.error || result.status !== 0) return null;
  return (result.stdout ?? "") + (result.stderr ?? "");
}

function isCloudflaredAvailable() {
  return runCommand("cloudflared", ["--version"]) !== null;
}

/** Return the machine's tailnet IPv4, or null when Tailscale is offline. */
function getTailnetIp() {
  const output = runCommand("tailscale", ["ip", "-4"]);
  if (!output) return null;
  const ip = output.trim().split(/\s+/)[0];
  return TAILNET_IP_RE.test(ip) ? ip : null;
}

function generatePassword(length = 16) {
  return crypto.randomBytes(Math.ceil(length / 2)).toString("hex").slice(0, length);
}

/**
 * Spawn cloudflared and resolve once the quick-tunnel URL is printed.
 * Rejects (and kills the child) on timeout or early exit.
 */
function spawnCloudflaredTunnel(localUrl, { timeoutMs = 20_000 } = {}) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(
        "cloudflared",
        ["tunnel", "--url", localUrl, "--no-autoupdate"],
        { stdio: ["ignore", "pipe", "inherit"] },
      );
    } catch (error) {
      reject(error);
      return;
    }

    let settled = false;
    let buffer = "";
    const timer = setTimeout(() => {
      settled = true;
      child.kill();
      reject(new Error("Timed out waiting for cloudflared to create a tunnel"));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      buffer += chunk.toString();
      const url = extractTunnelUrl(buffer);
      if (url) {
        settled = true;
        clearTimeout(timer);
        resolve({ child, url });
      }
    });
    child.on("error", (error) => {
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("exit", (code, signal) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error(
          `cloudflared exited before creating a tunnel (${signal ? `signal ${signal}` : `code ${code}`})`,
        ));
      }
    });
  });
}

async function printQr(text, label) {
  const qr = await QRCode.toString(text, { type: "terminal" });
  process.stdout.write(`\n${label}\n${qr}\n`);
}

module.exports = {
  CLOUDFLARED_URL_RE,
  TAILNET_IP_RE,
  extractTunnelUrl,
  isCloudflaredAvailable,
  getTailnetIp,
  generatePassword,
  spawnCloudflaredTunnel,
  printQr,
};
