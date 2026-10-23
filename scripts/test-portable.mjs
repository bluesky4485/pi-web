#!/usr/bin/env node

// Starts a portable bundle exactly the way its offline copy is started — through
// the launcher, with no system Node on PATH and a throwaway agent directory — and
// checks it answers. This is what catches the failures a bundle hides: a launcher
// that cannot find its runtime, a native module missing from the production
// install, or an app name baked into the build that never got renamed.
//
// Usage: node scripts/test-portable.mjs --target linux-x64 [--out dist/portable]

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { BIN_NAME } from "../bin/app-identity.js";

const ROOT = resolve(import.meta.dirname, "..");
const version = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;
const START_TIMEOUT_MS = 120_000;

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

  let output = "";
  let exitInfo = null;
  const log = () => `launcher output:\n${output}`;

  try {
    const child = spawn(
      isWin ? "cmd.exe" : launcher,
      [...(isWin ? ["/d", "/c", launcher] : []), "--no-open", "--hostname", "127.0.0.1", "--port", String(port)],
      { cwd: bundleDir, env, stdio: ["ignore", "pipe", "pipe"] },
    );
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    const exited = new Promise((resolved) => child.once("exit", (code, signal) => {
      exitInfo = { code, signal };
      resolved(exitInfo);
    }));

    console.log(`==> ${bundleDir}`);
    console.log(`    answering on ${url} with no node on PATH`);
    const deadline = Date.now() + START_TIMEOUT_MS;
    for (;;) {
      if (exitInfo) throw new Error(`the launcher exited (${exitInfo.signal ?? `code ${exitInfo.code}`}) before answering\n${log()}`);
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(3_000) });
        if (response.ok) break;
      } catch {
        // not listening yet
      }
      if (Date.now() > deadline) throw new Error(`no answer on ${url} within ${START_TIMEOUT_MS / 1000} s\n${log()}`);
      await delay(500);
    }

    const page = await (await fetch(`${url}/`)).text();
    assert(page.includes(BIN_NAME), `the served page never names ${BIN_NAME}\n${log()}`);

    const manifest = await (await fetch(`${url}/manifest.webmanifest`)).json();
    assert(manifest.name === BIN_NAME, `manifest name is ${manifest.name}, expected ${BIN_NAME}`);
    console.log(`    app name: ${manifest.name}`);

    // The launcher really runs the bundled runtime: the run record's server pid
    // must have it as its executable (nothing else on PATH could supply a node).
    const runDir = join(agentDir, `${BIN_NAME}-run`);
    const records = (existsSync(runDir) ? readdirSync(runDir) : []).map(
      (name) => JSON.parse(readFileSync(join(runDir, name), "utf8")),
    );
    assert(records.length === 1, `expected one run record in ${runDir}, found ${records.length}`);
    if (!isWin) {
      const args = spawnSync("ps", ["-p", String(records[0].nextPid), "-o", "args="], { encoding: "utf8" }).stdout;
      assert(args.includes(runtimeNode), `the server is not the bundled runtime:\n${args.trim()}`);
    }
    console.log(`    bundled runtime: ${runtimeNode}`);

    child.kill("SIGTERM");
    const stopped = await Promise.race([exited, delay(20_000).then(() => null)]);
    assert(stopped, "the launcher ignored SIGTERM for 20 s");
    console.log(`    stopped (${stopped.signal ?? `code ${stopped.code}`})`);
    return true;
  } finally {
    rmSync(agentDir, { recursive: true, force: true });
  }
}

try {
  assert(await main(), "the bundle did not pass its checks");
  console.log("==> ok");
} catch (error) {
  console.error(`==> FAIL: ${error.message}`);
  process.exitCode = 1;
}
