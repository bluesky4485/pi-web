import { spawn, spawnSync, type ChildProcess } from "node:child_process";

// In-process manager for a UI-started (cloudflared) remote tunnel. Complements
// the CLI `--remote` path: that one spawns cloudflared in the launcher process
// and only informs this one via PI_WEB_REMOTE_URLS, whereas this manager owns a
// tunnel spawned directly by the Next server process, so it can be started and
// stopped from the UI. The password is intentionally NOT managed here — remote
// mode only works when PI_WEB_PASSWORD was set at startup.

const TUNNEL_URL_RE = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;
const SPAWN_TIMEOUT_MS = 20_000;

export function defaultLocalPort(): string {
  return process.env.PI_WEB_PORT ?? process.env.PORT ?? "30141";
}

export class RemoteManagerError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
  }
}

export type TunnelResult = { url: string; child: ChildProcess };

function defaultSpawn(localUrl: string): Promise<TunnelResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "cloudflared",
      ["tunnel", "--url", localUrl, "--no-autoupdate"],
      { stdio: ["ignore", "pipe", "ignore"] },
    );
    let buffer = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new RemoteManagerError("Timed out waiting for cloudflared", "TIMEOUT"));
    }, SPAWN_TIMEOUT_MS);
    child.stdout?.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const match = TUNNEL_URL_RE.exec(buffer);
      if (match && !settled) {
        settled = true;
        clearTimeout(timer);
        resolve({ url: match[0], child });
      }
    });
    child.on("error", (cause) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new RemoteManagerError(`cloudflared failed to start: ${cause.message}`, "SPAWN"));
    });
    child.on("exit", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new RemoteManagerError(
        `cloudflared exited before creating a tunnel (${signal ? `signal ${signal}` : `code ${code}`})`,
        "EXITED",
      ));
    });
  });
}

type State = { child: ChildProcess | null; url: string | null };

function appendHost(hosts: string | undefined, host: string): string {
  const list = (hosts ?? "")
    .split(",").map((entry) => entry.trim()).filter(Boolean);
  if (list.includes(host)) return hosts ?? host;
  return [...list, host].join(",");
}

function removeHost(hosts: string | undefined, host: string): string {
  return (hosts ?? "")
    .split(",").map((entry) => entry.trim())
    .filter((entry) => entry && entry !== host)
    .join(",");
}

export function createRemoteManager(
  spawnTunnel: (localUrl: string) => Promise<TunnelResult> = defaultSpawn,
  stateKey = "__piWebRemote",
) {
  const getState = (): State => {
    const globals = globalThis as Record<string, unknown>;
    if (!globals[stateKey]) globals[stateKey] = { child: null, url: null };
    return globals[stateKey] as State;
  };

  let exitWired = false;

  const clearEnvHost = (url: string | null): void => {
    if (!url) return;
    const host = new URL(url).host;
    process.env.PI_WEB_ALLOWED_HOSTS = removeHost(process.env.PI_WEB_ALLOWED_HOSTS, host);
  };

  const start = async (): Promise<{ url: string }> => {
    if (!process.env.PI_WEB_PASSWORD) {
      throw new RemoteManagerError(
        "Remote requires PI_WEB_PASSWORD to be set at startup",
        "PASSWORD_REQUIRED",
      );
    }
    const state = getState();
    if (state.child || state.url) {
      throw new RemoteManagerError("Remote is already active", "ALREADY_ACTIVE");
    }
    // A CLI-started tunnel (`--remote` / `dev:remote`) is reflected in the env;
    // refuse to stack a second tunnel on top of it.
    let envActive = false;
    try {
      const raw = JSON.parse(process.env.PI_WEB_REMOTE_URLS ?? "[]");
      envActive = Array.isArray(raw) && raw.length > 0;
    } catch {
      envActive = false;
    }
    if (envActive) {
      throw new RemoteManagerError("Remote is already active", "ALREADY_ACTIVE");
    }

    const localUrl = `http://${process.env.PI_WEB_HOSTNAME || "127.0.0.1"}:${defaultLocalPort()}`;
    const { url, child } = await spawnTunnel(localUrl);
    child.unref?.();
    state.child = child;
    state.url = url;

    process.env.PI_WEB_ALLOWED_HOSTS = appendHost(process.env.PI_WEB_ALLOWED_HOSTS, new URL(url).host);
    process.env.PI_WEB_REMOTE_URLS = JSON.stringify([url]);

    // Auto-clear if the tunnel dies on its own, so the UI can start a new one.
    child.on("exit", () => {
      if (getState().child !== child) return;
      getState().child = null;
      const deadUrl = getState().url;
      getState().url = null;
      clearEnvHost(deadUrl);
      process.env.PI_WEB_REMOTE_URLS = "[]";
    });

    // Belt-and-suspenders: kill the tunnel on process exit so a manually started
    // tunnel cannot outlive pi-web (the user rarely clicks Stop).
    if (!exitWired) {
      exitWired = true;
      process.once("exit", stop);
    }

    return { url };
  };

  const stop = (): void => {
    const state = getState();
    const { child, url } = state;
    state.child = null;
    state.url = null;
    if (child) {
      try { child.kill(); } catch { /* already gone */ }
    }
    clearEnvHost(url);
    process.env.PI_WEB_REMOTE_URLS = "[]";
  };

  const isActive = (): boolean => Boolean(getState().child || getState().url);

  const url = (): string | null => getState().url;

  return { start, stop, isActive, url };
}

export function isCloudflaredAvailable(): boolean {
  const result = spawnSync("cloudflared", ["--version"], {
    encoding: "utf8",
    timeout: 5_000,
    stdio: ["ignore", "pipe", "ignore"],
  });
  return result.error === undefined && result.status === 0;
}

// Default singleton, owned by the Next server process.
export const remoteManager = createRemoteManager();