#!/usr/bin/env node

// Builds one per-platform portable bundle for offline install: the built app, its
// production dependencies and a verified Node.js runtime, next to a launcher that
// runs the bundled Node instead of whatever the machine has.
//
// A bundle is platform-specific because node_modules holds native code: node-pty
// ships a prebuild per OS/arch and next resolves its matching SWC binary at
// install time. So each target must be packed on a runner of that same platform,
// which this script checks rather than shipping a bundle that dies on first start.
//
// Usage: node scripts/make-portable.mjs --target linux-x64 [--out dist/portable]
//        [--skip-node] [--skip-install] [--skip-archive]

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const APP_NAME = packageJson.name.slice(packageJson.name.lastIndexOf("/") + 1);

// The runtime every bundle ships, so an offline install needs no Node at all.
// Keep at or above the `engines.node` floor in package.json.
const NODE_VERSION = process.env.PORTABLE_NODE_VERSION ?? "22.19.0";
const NODE_DIST_URL = `https://nodejs.org/dist/v${NODE_VERSION}`;

const TARGETS = {
  "linux-x64": { platform: "linux", arch: "x64", nodeFile: `node-v${NODE_VERSION}-linux-x64.tar.xz`, archive: "tar.gz" },
  "linux-arm64": { platform: "linux", arch: "arm64", nodeFile: `node-v${NODE_VERSION}-linux-arm64.tar.xz`, archive: "tar.gz" },
  "mac-arm64": { platform: "darwin", arch: "arm64", nodeFile: `node-v${NODE_VERSION}-darwin-arm64.tar.gz`, archive: "tar.gz" },
  "win-x64": { platform: "win32", arch: "x64", nodeFile: `node-v${NODE_VERSION}-win-x64.zip`, archive: "zip" },
};

/** package.json's own `files`, plus the lockfile the production install needs. */
const APP_PAYLOAD = ["bin", "public", ".next", "next.config.ts", "package.json", "package-lock.json"];

/** The published `.next` exclusions, so the bundle holds only what `next start` reads. */
function keepAppFile(sourcePath) {
  const relative = sourcePath.slice(ROOT.length + 1).split(sep).join("/");
  if (!relative.startsWith(".next/")) return true;
  if (/(^|\/)(cache|dev)(\/|$)/.test(relative.slice(".next/".length))) return false;
  return !relative.endsWith(".js.map");
}

function run(command, args, { cwd, echo = true, stdio } = {}) {
  const result = spawnSync(command, args, { cwd, stdio: stdio ?? (echo ? "inherit" : "ignore") });
  if (result.error) throw new Error(`${command} failed: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} exited with ${result.status}`);
}

// curl writes only where the directory already exists, and its `--show-error`
// message is the one thing that says why a download failed, so stderr stays open.
function download(url, destPath) {
  mkdirSync(dirname(destPath), { recursive: true });
  run("curl", ["--fail", "--silent", "--show-error", "--location", "--output", destPath, url], {
    stdio: ["ignore", "ignore", "inherit"],
  });
}

/** Check the runtime against nodejs.org's published digest: an offline install is
 * exactly the case where nobody can inspect the download by hand afterwards. */
function assertChecksum(archivePath, nodeFile) {
  const shasumPath = join(dirname(archivePath), "SHASUMS256.txt");
  download(`${NODE_DIST_URL}/SHASUMS256.txt`, shasumPath);
  const line = new RegExp(`^([0-9a-f]{64})  ${nodeFile.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m")
    .exec(readFileSync(shasumPath, "utf8"));
  if (!line) throw new Error(`SHASUMS256.txt has no entry for ${nodeFile}`);
  const actual = createHash("sha256").update(readFileSync(archivePath)).digest("hex");
  if (actual !== line[1]) throw new Error(`${nodeFile} checksum mismatch: got ${actual}, expected ${line[1]}`);
}

function copyNodeRuntime(target, runtimeDir, workDir) {
  const nodeFile = TARGETS[target].nodeFile;
  const archivePath = join(workDir, nodeFile);
  download(`${NODE_DIST_URL}/${nodeFile}`, archivePath);
  assertChecksum(archivePath, nodeFile);

  const unpackDir = join(workDir, "node-dist");
  mkdirSync(unpackDir, { recursive: true });
  run("tar", ["-xf", archivePath, "-C", unpackDir]);

  // Every official Node archive holds one top-level `node-vX-<platform>/` folder;
  // its contents become the bundle's `runtime/`, so the launcher path is fixed.
  cpSync(join(unpackDir, readdirSync(unpackDir)[0]), runtimeDir, { recursive: true, dereference: true });
}

/** The launcher that puts the bundled runtime under the bundled app. */
function writeLaunchers(bundleDir, target) {
  if (target.startsWith("win-")) {
    writeFileSync(join(bundleDir, `${APP_NAME}.cmd`), [
      "@echo off",
      "setlocal",
      'set "BUNDLE=%~dp0"',
      `"%BUNDLE%runtime\\node.exe" "%BUNDLE%app\\bin\\pi-web.js" %*`,
      'set "CODE=%ERRORLEVEL%"',
      "endlocal",
      "exit /b %CODE%",
      "",
    ].join("\r\n"));
    return;
  }
  const launcherPath = join(bundleDir, APP_NAME);
  writeFileSync(launcherPath, [
    "#!/bin/sh",
    "# Portable launcher: the bundled Node.js runtime running the bundled app.",
    'DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)',
    'exec "$DIR/runtime/bin/node" "$DIR/app/bin/pi-web.js" "$@"',
    "",
  ].join("\n"));
  chmodSync(launcherPath, 0o755);
}

function writeReadme(bundleDir, target) {
  const win = target.startsWith("win-");
  const lines = [
    `${APP_NAME} ${packageJson.version} — portable bundle for ${target}`,
    "".padEnd(64, "="),
    "",
    "Unpack anywhere and run the launcher in this folder. Nothing is installed on",
    "the system and no Node.js is needed: the runtime beside it is the one used.",
    "",
    win ? `  ${APP_NAME}.cmd` : `  ./${APP_NAME}`,
    "",
    "Options (the launcher takes them all; see --help):",
    "  --remote            expose it outside this machine (cloudflared quick tunnel;",
    "                      a password is generated and printed with the URL)",
    "  --remote=tailscale  bind the Tailscale address instead, tailnet only",
    "  -p, --port <port>   default 30141",
    "  --no-open           do not open a browser",
    "",
    "Sessions, settings and API keys stay in pi's agent directory (~/.pi/agent),",
    "which the pi CLI uses too, so they outlive this folder and any update of it.",
    "",
    `Built for ${target} and runs only there: its node_modules holds platform-`,
    "specific native binaries. Use the matching bundle for another platform, or",
    `install from npm: npm install -g ${packageJson.name}`,
    "",
  ];
  writeFileSync(join(bundleDir, "README.txt"), lines.join(win ? "\r\n" : "\n"));
}

/** Install the production tree with the runtime that will run it, so the npm and
 * node versions baked into the bundle are the shipped ones (system npm otherwise). */
function installProductionDependencies(appDir, runtimeDir, target) {
  const nodeBin = join(runtimeDir, target.startsWith("win-") ? "node.exe" : "bin/node");
  const npmCli = ["lib/node_modules/npm/bin/npm-cli.js", "node_modules/npm/bin/npm-cli.js"]
    .map((relative) => join(runtimeDir, relative))
    .find((candidate) => existsSync(candidate));
  const command = existsSync(nodeBin) && npmCli ? nodeBin : "npm";
  const args = npmCli ? [npmCli, "ci", "--omit=dev", "--no-audit", "--no-fund"]
    : ["ci", "--omit=dev", "--no-audit", "--no-fund"];
  run(command, args, { cwd: appDir });
}

function archiveBundle(bundleDir, outDir, target) {
  const name = basename(bundleDir);
  if (TARGETS[target].archive === "zip") {
    // bsdtar ships with Windows and writes the zip directly.
    run("tar", ["-a", "-c", "-f", `${name}.zip`, "-C", outDir, name]);
  } else {
    run("tar", ["-czf", `${name}.tar.gz`, "-C", outDir, name]);
  }
  return name;
}

function parseArgs(argv) {
  const options = { target: "", out: join(ROOT, "dist", "portable"), skipNode: false, skipInstall: false, skipArchive: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--target") options.target = argv[++index];
    else if (arg === "--out") options.out = resolve(argv[++index]);
    else if (arg === "--skip-node") options.skipNode = true;
    else if (arg === "--skip-install") options.skipInstall = true;
    else if (arg === "--skip-archive") options.skipArchive = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (!Object.hasOwn(TARGETS, options.target)) {
    throw new Error(`Use --target one of: ${Object.keys(TARGETS).join(", ")}`);
  }
  return options;
}

const options = parseArgs(process.argv.slice(2));
const target = options.target;
const expected = TARGETS[target];
if (expected.platform !== process.platform || expected.arch !== process.arch) {
  throw new Error(
    `${target} must be packed on a ${expected.platform}/${expected.arch} machine (its node_modules holds`
      + ` native binaries), this is ${process.platform}/${process.arch}.`,
  );
}
if (!existsSync(join(ROOT, ".next", "BUILD_ID"))) {
  throw new Error("No production build found: run `npm run build` first.");
}

const bundleName = `${APP_NAME}-v${packageJson.version}-${target}`;
const bundleDir = join(options.out, bundleName);
const appDir = join(bundleDir, "app");
const runtimeDir = join(bundleDir, "runtime");
const workDir = join(options.out, ".work");

console.log(`==> ${bundleName}`);
rmSync(bundleDir, { recursive: true, force: true });
rmSync(workDir, { recursive: true, force: true });
mkdirSync(appDir, { recursive: true });

for (const entry of APP_PAYLOAD) {
  if (!existsSync(join(ROOT, entry))) throw new Error(`${entry} belongs in the bundle but is not in the checkout`);
  cpSync(join(ROOT, entry), join(appDir, entry), { recursive: true, filter: keepAppFile });
}

if (!options.skipNode) {
  console.log(`==> Node.js v${NODE_VERSION} runtime`);
  copyNodeRuntime(target, runtimeDir, workDir);
}

if (!options.skipInstall) {
  console.log("==> production dependencies");
  installProductionDependencies(appDir, runtimeDir, target);
}

writeLaunchers(bundleDir, target);
writeReadme(bundleDir, target);

const archiveBase = options.skipArchive ? null : archiveBundle(bundleDir, options.out, target);
rmSync(workDir, { recursive: true, force: true });

console.log(`==> ${archiveBase ? join(options.out, archiveBase) : bundleDir}`);
