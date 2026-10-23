"use strict";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { execFileSync, spawnSync } = require("child_process");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("fs");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { BIN_NAME, PKG_BASE, PKG_NAME, PKG_SCOPE } = require("./app-identity");

// The identity `update` installs comes from this package's own package.json, so a
// renamed fork can never end up installing somebody else's package over itself.
const NPM_LATEST_URL = `https://registry.npmjs.org/@${PKG_SCOPE}%2F${PKG_BASE}/latest`;
const FETCH_TIMEOUT_MS = 10_000;
const MANUAL_COMMAND = `npm install -g ${PKG_NAME}@latest`;

// Port of lib/app-update.ts (bin cannot import TypeScript).
function parseStableVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) return null;
  const parts = match.slice(1).map(Number);
  return parts.every(Number.isSafeInteger) ? parts : null;
}

function isNewerStableVersion(candidate, current) {
  const candidateParts = parseStableVersion(candidate);
  const currentParts = parseStableVersion(current);
  if (!candidateParts || !currentParts) return false;
  for (let index = 0; index < candidateParts.length; index += 1) {
    if (candidateParts[index] !== currentParts[index]) {
      return candidateParts[index] > currentParts[index];
    }
  }
  return false;
}

async function fetchLatestVersion() {
  const response = await fetch(NPM_LATEST_URL, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`npm registry returned HTTP ${response.status}`);
  const { version } = await response.json();
  if (typeof version !== "string" || !parseStableVersion(version)) {
    throw new Error("npm registry returned an invalid version");
  }
  return version;
}

// npm's own CLI script run through this node, so no shell is needed on
// Windows (same lookup as lib/node-cli.ts). null: no way to run npm safely.
function findNpmInvocation(args, nodeDir = path.dirname(process.execPath), platform = process.platform, exists = fs.existsSync) {
  for (const script of [
    path.join(nodeDir, "node_modules", "npm", "bin", "npm-cli.js"),
    path.join(nodeDir, "..", "lib", "node_modules", "npm", "bin", "npm-cli.js"),
  ]) {
    if (exists(script)) return { command: process.execPath, args: [script, ...args] };
  }
  return platform === "win32" ? null : { command: "npm", args };
}

function realpathOrSelf(target, realpath = fs.realpathSync) {
  try {
    return realpath(target);
  } catch {
    return path.resolve(target);
  }
}

// "global": pkgDir is <npm root -g>/@scope/pi-web-remote; "npx": an npx cache; else "other".
function getInstallKind({ pkgDir, npmRoot, realpath = fs.realpathSync }) {
  const realPkgDir = realpathOrSelf(pkgDir, realpath);
  if (realPkgDir.split(/[\\/]/).includes("_npx")) return "npx";
  if (!npmRoot) return "other";
  const inGlobalRoot =
    path.basename(realPkgDir) === PKG_BASE &&
    path.basename(path.dirname(realPkgDir)) === `@${PKG_SCOPE}` &&
    realpathOrSelf(path.dirname(path.dirname(realPkgDir)), realpath) === realpathOrSelf(npmRoot, realpath);
  return inGlobalRoot ? "global" : "other";
}

function getGlobalNpmRoot() {
  const invocation = findNpmInvocation(["root", "-g"]);
  if (!invocation) return null;
  try {
    return execFileSync(invocation.command, invocation.args, { encoding: "utf8", timeout: 30_000 }).trim();
  } catch {
    return null;
  }
}

function runNpmInstall(version) {
  const invocation = findNpmInvocation(["install", "-g", `${PKG_NAME}@${version}`]);
  if (!invocation) return null;
  const result = spawnSync(invocation.command, invocation.args, { stdio: "inherit" });
  return result.status ?? 1;
}

async function runUpdate({
  check,
  currentVersion,
  pkgDir,
  listRecords,
  formatRecord,
  fetchLatest = fetchLatestVersion,
  getNpmRoot = getGlobalNpmRoot,
  install = runNpmInstall,
  realpath = fs.realpathSync,
  log = console.log,
  error = console.error,
}) {
  let latest;
  try {
    latest = await fetchLatest();
  } catch (fetchError) {
    error(`Could not check for updates: ${fetchError.message}`);
    return 1;
  }
  if (!isNewerStableVersion(latest, currentVersion)) {
    log(`${BIN_NAME} ${currentVersion} is up to date.`);
    return 0;
  }
  log(`${BIN_NAME} ${latest} is available (installed: ${currentVersion}).`);
  if (check) return 0;

  // A running `next start` has .next/ open; never replace it underneath.
  const running = await listRecords();
  if (running.length > 0) {
    error(`${BIN_NAME} is running:\n${running.map(formatRecord).join("\n")}\nRun \`${BIN_NAME} stop\` first, then update.`);
    return 1;
  }

  const kind = getInstallKind({ pkgDir, npmRoot: getNpmRoot(), realpath });
  if (kind === "npx") {
    error(`This ${BIN_NAME} runs from the npx cache. Run \`npx ${PKG_NAME}@latest\` instead.`);
    return 1;
  }
  if (kind !== "global") {
    error(`This ${BIN_NAME} is not a global npm install. Update it yourself, for example: ${MANUAL_COMMAND}`);
    return 1;
  }

  const code = install(latest);
  if (code === null) {
    error(`Could not find npm. Run: ${MANUAL_COMMAND}`);
    return 1;
  }
  return code;
}

module.exports = { findNpmInvocation, getInstallKind, isNewerStableVersion, runUpdate };
