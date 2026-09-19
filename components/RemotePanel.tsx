import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { copyText } from "@/lib/clipboard";

interface RemoteStatus {
  urls: string[];
  active: boolean;
  passwordSet: boolean;
  uiManaged: boolean;
  cloudflaredAvailable: boolean;
}

const EMOJI: Record<string, string> = {
  PASSWORD_REQUIRED: "Set PI_WEB_PASSWORD at startup, then restart.",
  ALREADY_ACTIVE: "Remote is already active.",
  TIMEOUT: "Timed out waiting for cloudflared.",
  SPAWN: "Could not start cloudflared.",
  EXITED: "cloudflared exited before creating a tunnel.",
};

// Sidebar footer button for remote access. Shows the active remote URL(s), and
// lets a locally-authenticated user start/stop a cloudflared tunnel. Starts
// require PI_WEB_PASSWORD to have been set at startup (never managed here).
export function RemotePanel() {
  const [status, setStatus] = useState<RemoteStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/remote");
      const data = (await response.json()) as RemoteStatus;
      setStatus(data);
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const controller = new AbortController();
    return () => controller.abort();
  }, [refresh]);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/remote", { method: "POST" });
      const data = (await response.json()) as { error?: string; code?: string };
      if (!response.ok) {
        setError(data.code ? (EMOJI[data.code] ?? data.error ?? "Start failed") : (data.error ?? "Start failed"));
      }
    } catch {
      setError("Could not start remote.");
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  const stop = async () => {
    setBusy(true);
    setError(null);
    try {
      await fetch("/api/remote", { method: "DELETE" });
    } catch {
      setError("Could not stop remote.");
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  const handleCopy = async (url: string) => {
    try {
      await copyText(url);
      setCopied(url);
      setTimeout(() => setCopied((current) => (current === url ? null : current)), 1500);
    } catch {
      // Clipboard unavailable; the link is still selectable text.
    }
  };

  const buttonStyle: CSSProperties = {
    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    height: 32, padding: 0, background: "none", border: "none",
    borderRadius: 9, color: "var(--text-muted)", cursor: "pointer",
    fontSize: 12, transition: "background 0.12s, color 0.12s",
  };

  const canStart = status !== null
    && !status.active
    && status.passwordSet
    && status.cloudflaredAvailable;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        title={status?.active ? "Remote active" : "Remote access"}
        aria-label="Remote access"
        style={
          status?.active
            ? { ...buttonStyle, color: "var(--accent)" }
            : buttonStyle
        }
        onMouseEnter={(event) => {
          event.currentTarget.style.background = "var(--bg-hover)";
          event.currentTarget.style.color = "var(--text)";
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.background = "none";
          event.currentTarget.style.color = status?.active ? "var(--accent)" : "var(--text-muted)";
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
        <span>Remote</span>
      </button>
      {open && (
        <div
          style={{
            position: "fixed", left: 12, bottom: 56, zIndex: 1000,
            width: 320, padding: 10, borderRadius: 10,
            background: "var(--bg-panel)", border: "1px solid var(--border)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
            display: "flex", flexDirection: "column", gap: 8,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>
            Remote access
          </div>

          {status === null && (
            <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Loading…</div>
          )}

          {status && status.active && status.urls.length > 0 && (
            <>
              {status.urls.map((url) => (
                <div key={url} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      flex: 1, fontSize: 12, color: "var(--accent)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}
                  >
                    {url}
                  </a>
                  <button
                    type="button"
                    onClick={() => void handleCopy(url)}
                    style={actionStyle}
                  >
                    {copied === url ? "Copied" : "Copy"}
                  </button>
                </div>
              ))}
              {status.uiManaged && (
                <button
                  type="button"
                  onClick={() => void stop()}
                  disabled={busy}
                  style={actionStyle}
                >
                  {busy ? "Stopping…" : "Stop remote"}
                </button>
              )}
              {!status.uiManaged && (
                <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                  Started via CLI (--remote). Stopped when pi-web exits.
                </div>
              )}
            </>
          )}

          {status && !status.active && (
            <>
              <button
                type="button"
                onClick={() => void start()}
                disabled={!canStart || busy}
                title={disabledReason(status)}
                style={{ ...actionStyle, fontWeight: 600 }}
              >
                {busy ? "Starting…" : "Start remote"}
              </button>
              {!status.passwordSet && (
                <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                  Set PI_WEB_PASSWORD at startup and restart to enable remote.
                </div>
              )}
              {status.passwordSet && !status.cloudflaredAvailable && (
                <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                  Install the cloudflared CLI (winget install cloudflared).
                </div>
              )}
            </>
          )}

          {error && (
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{error}</div>
          )}
        </div>
      )}
    </>
  );
}

const actionStyle: CSSProperties = {
  height: 26, padding: "0 10px", fontSize: 11, cursor: "pointer",
  background: "var(--bg-hover)", color: "var(--text)",
  border: "1px solid var(--border)", borderRadius: 6,
};

function disabledReason(status: RemoteStatus): string | undefined {
  if (status.active) return "Remote is active";
  if (!status.passwordSet) return "Set PI_WEB_PASSWORD at startup";
  if (!status.cloudflaredAvailable) return "Install cloudflared CLI";
  return undefined;
}