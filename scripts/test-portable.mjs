#!/usr/bin/env node

// Starts a portable bundle exactly the way its offline copy is started — through
// the launcher, with no system Node on PATH and a throwaway agent directory — and
// checks it answers. This is what catches the failures a bundle hides: a launcher
// that cannot find its runtime, a native module missing from the production
// install, or an app name baked into the build that never got renamed.
//
// Every exit path stops the server it started and forces the process out, because
// a leftover child holds the launcher's output pipe open: without that, a failed
// check here would hang until the CI job timed out instead of reporting anything.
//
// Usage: node scripts/test-portable.mjs --target linux-x64 [--out dist/portable]

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { BIN_NAME } from "../bin/app-identity.js";

const ROOT = resolve(import.meta.dirname, "..");
const version = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;
const START_TIMEOUT_MS = 120_000;
const STOP_TIMEOUT_MS = 20_000;

/** Whatever the launcher printed, kept for the failure message. */
let launcherOutput = "";

function parseArgs(argv) {
  const options = { target: "", out: join(ROOT, "dist", "portable") };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--target") options.target = argv[++index];
    else if (arg === "--out") options.out = resolve(argv[++index]);
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (!/^(win|mac|linux)-/.test(options.target)) {
    throw new Error("Use --target win-x64 | mac-arm64 | linux-x64 | linux-arm64");
  }
  return options;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/** A port nothing is holding right now, so a parallel checkout cannot collide. */
async function getFreePort() {
  const server = createServer();
  await new Promise((startListening) => server.listen(0, "127.0.0.1", startListening));
  const { port } = server.address();
  await new Promise((closed) => server.close(closed));
  return port;
}

/** PATH without any directory that holds a node binary: the bundle may not borrow one. */
function selfContainedPath() {
  const binary = process.platform === "win32" ? "node.exe" : "node";
  const separator = process.platform === "win32" ? ";" : ":";
  return (process.env.PATH ?? "")
    .split(separator)
    .filter((dir) => dir !== "" && !existsSync(join(dir, binary)))
    .join(separator);
}

/**
 * Ask the launcher to stop, then make sure nothing of it is left. On Windows a
 * plain kill ends only the cmd.exe wrapper, so the whole tree is asked there; the
 * Next.js pid from the run record is the last resort on every platform.
 */
async function stopBundle(child, { isWin, nextPid }) {
  const running = (proc) => proc !== null && proc.exitCode === null && proc.signalCode === null;
  if (running(child)) {
    if (isWin) spawnSync("taskkill", ["/t", "/f", "/pid", String(child.pid)], { stdio: "ignore" });
    else child.kill("SIGTERM");
    await Promise.race([
      new Promise((resolved) => child.once("exit", resolved)),
      delay(STOP_TIMEOUT_MS),
    ]);
    if (running(child)) child.kill("SIGKILL");
  }
  if (!isWin && nextPid) {
    try {
      process.kill(nextPid, "SIGKILL");
    } catch {
      // already gone
    }
  }
}

/**
 * The executable a running process really is, as the OS reports it: `/proc` on
 * Linux, `ps -o comm=` on macOS. The command line cannot be asked (`ps -o args=`)
 * because a program is free to rewrite its own process title.
 */
function processExecutable(pid) {
  if (process.platform === "linux") {
    try {
      return realpathSync(`/proc/${pid}/exe`);
    } catch {
      return null;
    }
  }
  const command = spawnSync("ps", ["-p", String(pid), "-o", "comm="], { encoding: "utf8" }).stdout?.trim();
  if (!command) return null;
  try {
    return realpathSync(command);
  } catch {
    return command;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const bundleDir = join(options.out, `${BIN_NAME}-v${version}-${options.target}`);
  const isWin = options.target.startsWith("win-");
  const runtimeNode = isWin
    ? join(bundleDir, "runtime", "node.exe")
    : join(bundleDir, "runtime", "bin", "node");
  const launcher = join(bundleDir, isWin ? `${BIN_NAME}.cmd` : BIN_NAME);
  assert(existsSync(launcher), `${launcher} is missing from the bundle`);

  const port = await getFreePort();
  const url = `http://127.0.0.1:${port}`;
  const agentDir = mkdtempSync(join(tmpdir(), `${BIN_NAME}-portable-test-`));
  const env = {
    ...process.env,
    PATH: selfContainedPath(),
    PI_CODING_AGENT_DIR: agentDir,
    PI_WEB_SKIP_VERSION_CHECK: "1",
  };
  delete env.PI_WEB_PASSWORD;
  delete env.PORT;

  const log = () => `launcher output:\n${launcherOutput}`;
  let exitInfo = null;
  let nextPid = null;
  let child = null;

  try {
    child = spawn(
      isWin ? "cmd.exe" : launcher,
      [...(isWin ? ["/d", "/c", launcher] : []), "--no-open", "--hostname", "127.0.0.1", "--port", String(port)],
      { cwd: bundleDir, env, stdio: ["ignore", "pipe", "pipe"] },
    );
    child.stdout.on("data", (chunk) => { launcherOutput += chunk; });
    child.stderr.on("data", (chunk) => { launcherOutput += chunk; });
    child.once("exit", (code, signal) => { exitInfo = { code, signal }; });

    console.log(`==> ${bundleDir}`);
    console.log(`    answering on ${url} with no node on PATH`);
    const deadline = Date.now() + START_TIMEOUT_MS;
    for (;;) {
      if (exitInfo) {
        throw new Error(
          `the launcher exited (${exitInfo.signal ?? `code ${exitInfo.code}`}) before answering\n${log()}`,
        );
      }
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(3_000) });
        if (response.ok) break;
      } catch {
        // not listening yet
      }
      if (Date.now() > deadline) {
        throw new Error(`no answer on ${url} within ${START_TIMEOUT_MS / 1000} s\n${log()}`);
      }
      await delay(500);
    }

    const page = await (await fetch(`${url}/`)).text();
    assert(page.includes(BIN_NAME), `the served page never names ${BIN_NAME}\n${log()}`);

    const manifest = await (await fetch(`${url}/manifest.webmanifest`)).json();
    assert(manifest.name === BIN_NAME, `manifest name is ${manifest.name}, expected ${BIN_NAME}\n${log()}`);
    console.log(`    app name: ${manifest.name}`);

    // The launcher really runs the bundled runtime: Next.js is spawned with
    // `process.execPath`, so the node the launcher itself is proves the server
    // too. The server rewrites its process title, so ask about the launcher pid.
    const runDir = join(agentDir, `${BIN_NAME}-run`);
    const records = (existsSync(runDir) ? readdirSync(runDir) : []).map(
      (name) => JSON.parse(readFileSync(join(runDir, name), "utf8")),
    );
    assert(records.length === 1, `expected one run record in ${runDir}, found ${records.length}\n${log()}`);
    nextPid = records[0].nextPid;
    if (isWin) {
      assert(existsSync(runtimeNode), `${runtimeNode} is missing from the bundle`);
      console.log(`    bundled runtime: ${runtimeNode}`);
    } else {
      const bundleRoot = realpathSync(bundleDir);
      const executable = processExecutable(records[0].pid);
      assert(executable !== null, `could not read the executable of launcher pid ${records[0].pid}\n${log()}`);
      assert(
        executable.startsWith(bundleRoot + sep),
        `the launcher runs ${executable}, which is outside the bundle at ${bundleRoot}\n${log()}`,
      );
      console.log(`    bundled runtime: ${executable}`);
    }

    await stopBundle(child, { isWin, nextPid });
    assert(exitInfo, `the launcher did not stop within ${STOP_TIMEOUT_MS / 1000} s\n${log()}`);
    console.log(`    stopped (${exitInfo.signal ?? `code ${exitInfo.code}`})`);
  } finally {
    await stopBundle(child, { isWin, nextPid });
    // A server that outlives its launcher keeps these pipes open, and an open
    // stream is a handle this process would wait for.
    child?.stdout?.destroy();
    child?.stderr?.destroy();
    rmSync(agentDir, { recursive: true, force: true });
  }
}

let failed = false;
try {
  await main();
  console.log("==> ok");
} catch (error) {
  console.error(`==> FAIL: ${error.message}`);
  failed = true;
}

// Whatever is left waiting, the check has said its piece: leave after a grace
// long enough for the output above to flush.
setTimeout(() => process.exit(failed ? 1 : 0), 5_000).unref();
