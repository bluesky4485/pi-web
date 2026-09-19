import { NextResponse } from "next/server";
import {
  RemoteManagerError,
  isCloudflaredAvailable,
  remoteManager,
} from "@/lib/remote-manager";

// GET /api/remote - remote share status. Views the CLI-started tunnel (set via
// PI_WEB_REMOTE_URLS env by `--remote` / `dev:remote`) plus any tunnel started
// from this UI (managed here). The password is never exposed.
export function GET() {
  const managerUrls = remoteManager.url() ? [remoteManager.url() as string] : [];
  let envUrls: string[] = [];
  try {
    const raw = JSON.parse(process.env.PI_WEB_REMOTE_URLS ?? "[]");
    if (Array.isArray(raw)) {
      envUrls = raw.filter((entry): entry is string => typeof entry === "string");
    }
  } catch {
    envUrls = [];
  }
  const urls = Array.from(new Set([...managerUrls, ...envUrls]));
  return NextResponse.json({
    urls,
    active: remoteManager.isActive() || envUrls.length > 0,
    passwordSet: Boolean(process.env.PI_WEB_PASSWORD),
    // Only UI-started tunnels can be stopped from this UI; CLI-started ones are
    // owned by the launcher process.
    uiManaged: remoteManager.isActive(),
    cloudflaredAvailable: isCloudflaredAvailable(),
  });
}

// POST /api/remote - start a cloudflared tunnel from the UI.
export async function POST() {
  try {
    const { url } = await remoteManager.start();
    return NextResponse.json({ ok: true, url, active: true, uiManaged: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = error instanceof RemoteManagerError ? error.code : "INTERNAL";
    const status = code === "PASSWORD_REQUIRED" || code === "TIMEOUT" || code === "SPAWN" || code === "EXITED"
      ? 400
      : 409;
    return NextResponse.json({ error: message, code }, { status });
  }
}

// DELETE /api/remote - stop a UI-started tunnel. No-op if none is active.
export async function DELETE() {
  remoteManager.stop();
  return NextResponse.json({ ok: true, urls: [], active: false, uiManaged: false });
}