import { Copy, Download, Loader2, PlugZap, Share2, Upload, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import Peer, { DataConnection } from "peerjs";

import { Button } from "@/components/ui/button";
import { AppShell, BrandMark, EmptyState, HeroBadge, ProgressBar, StatusBadge, SurfaceCard } from "@/components/ui/fluxion-ui";
import { Input } from "@/components/ui/input";
import { getWebrtcToken } from "@/lib/api";

interface TemporaryShareProps {
  onBack: () => void;
}

type Role = "sender" | "receiver" | null;
type StatusType = "info" | "success" | "error" | "warning" | "";
type TransferState = "idle" | "preparing" | "transferring" | "completed" | "failed";

interface Status {
  type: StatusType;
  message: string;
}

interface FileData {
  dataType: "FILE";
  file: Blob;
  fileName: string;
  fileType: string;
  fileSize: number;
}

interface TransferInfo {
  state: TransferState;
  fileName: string;
  fileSize: number;
  progress: number;
  direction: "upload" | "download" | null;
}

function formatFileSize(bytes: number) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

/** Generate a random peer ID for fallback mode (no backend needed) */
function generateFallbackPeerId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "flx-";
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function TemporaryShare({ onBack }: TemporaryShareProps) {
  const [role, setRole] = useState<Role>(null);
  const [peerId, setPeerId] = useState("");
  const [remotePeerId, setRemotePeerId] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isPeerStarted, setIsPeerStarted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>({ type: "", message: "" });
  const [connections, setConnections] = useState<string[]>([]);
  const [selectedConnection, setSelectedConnection] = useState("");
  const [transferInfo, setTransferInfo] = useState<TransferInfo>({
    state: "idle",
    fileName: "",
    fileSize: 0,
    progress: 0,
    direction: null,
  });

  const peerRef = useRef<Peer | null>(null);
  const connectionMapRef = useRef<Map<string, DataConnection>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (peerRef.current) {
        peerRef.current.destroy();
      }
    };
  }, []);

  const handleReceiveData = useCallback((data: FileData) => {
    if (data.dataType !== "FILE" || !data.file) return;

    setTransferInfo({
      state: "transferring",
      fileName: data.fileName,
      fileSize: data.fileSize || data.file.size,
      progress: 0,
      direction: "download",
    });
    setStatus({ type: "info", message: `Receiving ${data.fileName}` });

    let progress = 0;
    const interval = window.setInterval(() => {
      progress += 18;
      if (progress >= 92) {
        window.clearInterval(interval);
      }
      setTransferInfo((prev) => ({ ...prev, progress: Math.min(progress, 92) }));
    }, 100);

    const blob = new Blob([data.file], { type: data.fileType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = data.fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    window.clearInterval(interval);
    setTransferInfo((prev) => ({ ...prev, state: "completed", progress: 100 }));
    setStatus({ type: "success", message: `Downloaded ${data.fileName}` });

    window.setTimeout(() => {
      setTransferInfo({ state: "idle", fileName: "", fileSize: 0, progress: 0, direction: null });
    }, 2600);
  }, []);

  const handleNewConnection = useCallback(
    (conn: DataConnection) => {
      conn.on("open", () => {
        connectionMapRef.current.set(conn.peer, conn);
        setConnections((prev) => (prev.includes(conn.peer) ? prev : [...prev, conn.peer]));
        setIsConnected(true);
        setStatus({ type: "success", message: `Connected to ${conn.peer.slice(0, 8)}...` });

        if (!selectedConnection) {
          setSelectedConnection(conn.peer);
        }
      });

      conn.on("data", (data) => handleReceiveData(data as FileData));

      conn.on("close", () => {
        connectionMapRef.current.delete(conn.peer);
        setConnections((prev) => prev.filter((id) => id !== conn.peer));
        if (connectionMapRef.current.size === 0) {
          setIsConnected(false);
          setSelectedConnection("");
        }
      });

      conn.on("error", (err) => {
        console.error("Connection error:", err);
        setStatus({ type: "error", message: `Connection error: ${err.message}` });
      });
    },
    [handleReceiveData, selectedConnection],
  );

  const startPeerSession = useCallback(async () => {
    setIsLoading(true);
    setStatus({ type: "info", message: "Starting peer session..." });

    try {
      // Try to get a server-issued peer ID & token first
      let peerConfig: ConstructorParameters<typeof Peer>[1] | undefined;
      let assignedPeerId: string;

      try {
        const peerAuth = await getWebrtcToken();
        assignedPeerId = peerAuth.peerId;
        peerConfig = {
          host: import.meta.env.VITE_WEBRTC_HOST || "localhost",
          secure: import.meta.env.VITE_WEBRTC_SECURE === "true",
          port: Number(import.meta.env.VITE_WEBRTC_PORT) || 9000,
          path: import.meta.env.VITE_WEBRTC_PATH || "/",
          token: peerAuth.token,
        };
      } catch {
        // Fallback: use public PeerJS cloud (no backend required)
        console.warn("WebRTC token API unavailable — falling back to PeerJS cloud.");
        assignedPeerId = generateFallbackPeerId();
        peerConfig = undefined; // uses default PeerJS cloud server
      }

      const peer = peerConfig
        ? new Peer(assignedPeerId, peerConfig)
        : new Peer(assignedPeerId);

      peerRef.current = peer;

      peer.on("open", (id) => {
        setPeerId(id);
        setIsPeerStarted(true);
        setIsLoading(false);
        setStatus({ type: "success", message: "Session started. Share your peer ID." });
      });

      peer.on("error", (err) => {
        console.error("Peer error:", err);
        setStatus({ type: "error", message: err.message });
        setIsLoading(false);
      });

      peer.on("connection", (conn) => {
        handleNewConnection(conn);
      });
    } catch (err) {
      console.error("Failed to start peer session:", err);
      setStatus({ type: "error", message: "Failed to start peer session" });
      setIsLoading(false);
    }
  }, [handleNewConnection]);

  const connectToPeer = useCallback(async () => {
    if (!peerRef.current) {
      setStatus({ type: "error", message: "Start your session first." });
      return;
    }

    if (!remotePeerId.trim()) {
      setStatus({ type: "warning", message: "Enter the other person's peer ID." });
      return;
    }

    if (connectionMapRef.current.has(remotePeerId)) {
      setStatus({ type: "warning", message: "That peer is already connected." });
      return;
    }

    setIsLoading(true);
    setStatus({ type: "info", message: "Connecting..." });

    try {
      const conn = peerRef.current.connect(remotePeerId, { reliable: true });
      if (!conn) {
        throw new Error("Peer connection was not created");
      }

      handleNewConnection(conn);
      setIsLoading(false);
    } catch (err) {
      console.error("Failed to connect:", err);
      setStatus({ type: "error", message: "Failed to connect to peer" });
      setIsLoading(false);
    }
  }, [handleNewConnection, remotePeerId]);

  const sendFile = useCallback(async () => {
    if (!selectedFile) {
      setStatus({ type: "warning", message: "Choose a file first." });
      return;
    }

    if (!selectedConnection || !connectionMapRef.current.has(selectedConnection)) {
      setStatus({ type: "warning", message: "Choose an active connection first." });
      return;
    }

    setIsLoading(true);
    setTransferInfo({
      state: "preparing",
      fileName: selectedFile.name,
      fileSize: selectedFile.size,
      progress: 0,
      direction: "upload",
    });
    setStatus({ type: "info", message: `Sending ${selectedFile.name}` });

    try {
      const conn = connectionMapRef.current.get(selectedConnection);
      if (!conn) {
        throw new Error("Connection lost");
      }

      const arrayBuffer = await selectedFile.arrayBuffer();
      const fileData: FileData = {
        dataType: "FILE",
        file: new Blob([arrayBuffer]),
        fileName: selectedFile.name,
        fileType: selectedFile.type || "application/octet-stream",
        fileSize: selectedFile.size,
      };

      setTransferInfo((prev) => ({ ...prev, state: "transferring" }));

      let progress = 0;
      const interval = window.setInterval(() => {
        progress += 12;
        if (progress >= 88) {
          window.clearInterval(interval);
        }
        setTransferInfo((prev) => ({ ...prev, progress: Math.min(progress, 88) }));
      }, 120);

      conn.send(fileData);

      window.clearInterval(interval);
      setTransferInfo((prev) => ({ ...prev, state: "completed", progress: 100 }));
      setStatus({ type: "success", message: "File sent successfully." });
      setIsLoading(false);

      window.setTimeout(() => {
        setTransferInfo({ state: "idle", fileName: "", fileSize: 0, progress: 0, direction: null });
      }, 2600);
    } catch (err) {
      console.error("Failed to send file:", err);
      setStatus({ type: "error", message: "Failed to send file" });
      setTransferInfo((prev) => ({ ...prev, state: "failed", progress: 0 }));
      setIsLoading(false);

      window.setTimeout(() => {
        setTransferInfo({ state: "idle", fileName: "", fileSize: 0, progress: 0, direction: null });
      }, 2600);
    }
  }, [selectedConnection, selectedFile]);

  const stopSession = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    connectionMapRef.current.clear();
    setPeerId("");
    setRemotePeerId("");
    setIsPeerStarted(false);
    setIsConnected(false);
    setConnections([]);
    setSelectedConnection("");
    setSelectedFile(null);
    setTransferInfo({ state: "idle", fileName: "", fileSize: 0, progress: 0, direction: null });
    setStatus({ type: "info", message: "Session ended" });
  }, []);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus({ type: "success", message: "Copied to clipboard." });
    } catch {
      setStatus({ type: "error", message: "Copy failed." });
    }
  };

  const statusTone =
    status.type === "success"
      ? "success"
      : status.type === "error"
        ? "danger"
        : status.type === "warning"
          ? "warning"
          : "primary";

  // ─── Role picker ───
  if (!role) {
    return (
      <AppShell className="h-screen">
        <main className="flex h-full items-center px-3 py-3 sm:px-4 md:px-5 lg:px-8 xl:px-12">
          <div className="flex w-full flex-col gap-3 lg:flex-row lg:gap-3">
            <div className="surface-card mesh-highlight flex-1 p-3 sm:p-4 md:p-4 lg:flex-[1.05]">
              <BrandMark />
              <div className="mt-2"><HeroBadge>Direct WebRTC transfer</HeroBadge></div>
              <h1 className="mt-2 font-display text-xl font-semibold tracking-tight text-[var(--dash-text-primary)] sm:mt-3 sm:text-2xl md:text-[1.75rem] lg:text-[2rem]">
                Quick Share for fast device-to-device delivery.
              </h1>
              <p className="mt-2 text-xs leading-5 text-[var(--dash-text-muted)] sm:text-[0.8125rem] sm:leading-6">
                Start a temporary peer session, exchange IDs, and transfer files directly between browsers without routing through the server.
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-2.5">
                <div className="rounded-xl border border-[var(--dash-panel-border)] bg-[var(--dash-inset)] p-2.5 sm:p-3">
                  <Share2 className="h-4 w-4 text-[var(--dash-text-muted)]" />
                  <div className="mt-2 text-xs font-semibold text-[var(--dash-text-primary)] sm:text-[0.8125rem]">One-off collaboration</div>
                  <div className="mt-1 text-[0.625rem] leading-4 text-[var(--dash-text-muted)] sm:text-[0.6875rem] sm:leading-5">Quick handoffs without a full workspace.</div>
                </div>
                <div className="rounded-xl border border-[var(--dash-panel-border)] bg-[var(--dash-inset)] p-2.5 sm:p-3">
                  <Users className="h-4 w-4 text-[var(--dash-text-muted)]" />
                  <div className="mt-2 text-xs font-semibold text-[var(--dash-text-primary)] sm:text-[0.8125rem]">Human-readable flow</div>
                  <div className="mt-1 text-[0.625rem] leading-4 text-[var(--dash-text-muted)] sm:text-[0.6875rem] sm:leading-5">Exchange IDs and connect directly.</div>
                </div>
              </div>
            </div>

            <div className="surface-card flex-1 p-3 sm:p-4 md:p-4 lg:flex-[0.95]">
              <div className="text-[0.5625rem] font-semibold uppercase tracking-[0.24em] text-[var(--dash-text-subtle)] sm:text-[0.625rem]">Session role</div>
              <h2 className="mt-1.5 font-display text-base font-semibold tracking-tight text-[var(--dash-text-primary)] sm:text-lg md:text-xl">Choose how you want to participate</h2>
              <p className="mt-1.5 text-[0.6875rem] leading-5 text-[var(--dash-text-muted)] sm:text-xs">The transfer flow adjusts depending on whether you're sending or receiving.</p>
              <div className="mt-3 space-y-2.5">
                <button
                  type="button"
                  onClick={() => setRole("sender")}
                  className="w-full rounded-xl border border-[var(--dash-panel-border)] bg-[var(--dash-inset)] p-3 text-left transition hover:border-[var(--dash-text-subtle)] hover:bg-[var(--dash-row-hover)] sm:p-3.5"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="rounded-lg bg-[var(--dash-row-selected)] p-2 text-[var(--dash-text-muted)]">
                      <Upload className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[var(--dash-text-primary)] sm:text-[0.8125rem]">Send files</div>
                      <div className="mt-0.5 text-[0.625rem] leading-4 text-[var(--dash-text-muted)] sm:text-[0.6875rem] sm:leading-5">Connect to the receiver and push a file via WebRTC.</div>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setRole("receiver")}
                  className="w-full rounded-xl border border-[var(--dash-panel-border)] bg-[var(--dash-inset)] p-3 text-left transition hover:border-[var(--dash-text-subtle)] hover:bg-[var(--dash-row-hover)] sm:p-3.5"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="rounded-lg bg-[var(--dash-row-selected)] p-2 text-[var(--dash-text-muted)]">
                      <Download className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[var(--dash-text-primary)] sm:text-[0.8125rem]">Receive files</div>
                      <div className="mt-0.5 text-[0.625rem] leading-4 text-[var(--dash-text-muted)] sm:text-[0.6875rem] sm:leading-5">Share your ID and wait for the sender to deliver.</div>
                    </div>
                  </div>
                </button>

                <Button variant="ghost" size="sm" onClick={onBack}>
                  Back to landing page
                </Button>
              </div>
            </div>
          </div>
        </main>
      </AppShell>
    );
  }

  // ─── Active session ───
  return (
    <AppShell>
      <div className="flex h-screen flex-col overflow-hidden">
        {/* ─── Compact header bar ─── */}
        <header className="flex shrink-0 items-center justify-between border-b border-[var(--dash-panel-border)] bg-[var(--dash-panel)] px-3 py-2 sm:px-5 sm:py-2.5">
          <div className="flex items-center gap-2 sm:gap-3">
            <BrandMark compact />
            <div className="hidden h-4 w-px bg-[var(--dash-panel-border)] sm:block" />
            <div className="hidden sm:block">
              <div className="text-[11px] font-semibold text-[var(--dash-text-primary)] sm:text-xs">
                {role === "sender" ? "Quick Share — Sending" : "Quick Share — Receiving"}
              </div>
              <div className="text-[9px] text-[var(--dash-text-subtle)] sm:text-[10px]">Direct P2P WebRTC transfer</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {status.message ? (
              <StatusBadge tone={statusTone as "primary" | "success" | "warning" | "danger"}>{status.message}</StatusBadge>
            ) : null}
            <StatusBadge tone={role === "sender" ? "primary" : "success"}>{role === "sender" ? "Sender" : "Receiver"}</StatusBadge>
            <Button variant="outline" size="sm" onClick={() => { stopSession(); setRole(null); }}>
              Back
            </Button>
          </div>
        </header>

        {/* ─── Two-column work area ─── */}
        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden p-2.5 sm:flex-row sm:gap-3 sm:p-3">
          {/* ─── Left: Connection panel ─── */}
          <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[var(--dash-panel-border)] bg-[var(--dash-panel)] shadow-[var(--dash-shadow)] sm:flex-[1]">
            <div className="shrink-0 border-b border-[var(--dash-panel-border)] px-3 py-2 sm:px-4 sm:py-2.5">
              <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--dash-text-subtle)]">Connection</div>
              <div className="mt-0.5 text-xs font-semibold text-[var(--dash-text-primary)] sm:text-[13px]">Peer session</div>
            </div>

            <div className="flex-1 overflow-auto p-3 scrollbar-modern sm:p-4">
              {!isPeerStarted ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--dash-inset)]">
                    <PlugZap className="h-4 w-4 text-[var(--dash-text-muted)]" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[var(--dash-text-primary)]">Start your session</div>
                    <div className="mt-0.5 text-[10px] text-[var(--dash-text-subtle)] sm:text-[11px]">Generate a temporary peer ID to begin.</div>
                  </div>
                  <Button size="sm" onClick={() => void startPeerSession()} disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5" />}
                    {isLoading ? "Starting..." : "Start session"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {/* Your peer ID */}
                  <div className="rounded-lg border border-[var(--dash-panel-border)] bg-[var(--dash-inset)] p-3">
                    <div className="text-[11px] font-semibold text-[var(--dash-text-primary)]">Your peer ID</div>
                    <div className="mt-1.5 flex gap-1.5">
                      <Input value={peerId} readOnly className="h-8 flex-1 rounded-md font-mono-brand text-[11px]" />
                      <Button variant="outline" size="sm" onClick={() => void copyToClipboard(peerId)}>
                        <Copy className="h-3 w-3" />
                        Copy
                      </Button>
                    </div>
                    <div className="mt-1 text-[10px] text-[var(--dash-text-subtle)]">Share this ID with the other participant.</div>
                  </div>

                  {/* Connect to peer */}
                  <div className="rounded-lg border border-[var(--dash-panel-border)] bg-[var(--dash-inset)] p-3">
                    <div className="text-[11px] font-semibold text-[var(--dash-text-primary)]">Connect to peer</div>
                    <div className="mt-1.5 flex gap-1.5">
                      <Input
                        value={remotePeerId}
                        onChange={(event) => setRemotePeerId(event.target.value)}
                        placeholder="Enter their peer ID"
                        className="h-8 flex-1 rounded-md font-mono-brand text-[11px]"
                      />
                      <Button size="sm" onClick={() => void connectToPeer()} disabled={isLoading || !remotePeerId.trim()}>
                        {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Users className="h-3 w-3" />}
                        Connect
                      </Button>
                    </div>
                  </div>

                  {/* Connected peers */}
                  {connections.length > 0 ? (
                    <div className="rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] p-3 dark:border-[#14532D] dark:bg-[#052E16]">
                      <div className="text-[11px] font-semibold text-[#166534] dark:text-[#86EFAC]">Connected peers</div>
                      <div className="mt-1.5 space-y-1">
                        {connections.map((connectionId) => (
                          <button
                            key={connectionId}
                            type="button"
                            onClick={() => setSelectedConnection(connectionId)}
                            className={`w-full rounded-md border px-2.5 py-1.5 text-left font-mono-brand text-[10px] transition ${
                              selectedConnection === connectionId
                                ? "border-[#22C55E] bg-[var(--dash-panel)] text-[#166534] dark:text-[#86EFAC]"
                                : "border-[#BBF7D0] dark:border-[#14532D] bg-[#F0FDF4] dark:bg-[#052E16] text-[#166534] dark:text-[#86EFAC]"
                            }`}
                          >
                            {connectionId}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <Button variant="outline" size="sm" onClick={stopSession}>
                    Stop session
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* ─── Right: Transfer panel ─── */}
          <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[var(--dash-panel-border)] bg-[var(--dash-panel)] shadow-[var(--dash-shadow)] sm:flex-[1]">
            <div className="shrink-0 border-b border-[var(--dash-panel-border)] px-3 py-2 sm:px-4 sm:py-2.5">
              <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--dash-text-subtle)]">Transfer</div>
              <div className="mt-0.5 text-xs font-semibold text-[var(--dash-text-primary)] sm:text-[13px]">
                {role === "sender" ? "Send a file" : "Receive files"}
              </div>
            </div>

            <div className="flex flex-1 flex-col overflow-auto p-3 scrollbar-modern sm:p-4">
              {/* Active transfer progress */}
              {transferInfo.state !== "idle" ? (
                <div className="mb-3 rounded-lg border border-[var(--dash-panel-border)] bg-[var(--dash-inset)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-[var(--dash-text-primary)]">
                        {transferInfo.direction === "upload" ? "Sending" : "Receiving"}
                      </div>
                      <div className="mt-0.5 truncate text-[10px] text-[var(--dash-text-muted)]">{transferInfo.fileName}</div>
                      <div className="mt-0.5 text-[9px] uppercase tracking-[0.14em] text-[var(--dash-text-subtle)]">{formatFileSize(transferInfo.fileSize)}</div>
                    </div>
                    <StatusBadge
                      tone={
                        transferInfo.state === "completed"
                          ? "success"
                          : transferInfo.state === "failed"
                            ? "danger"
                            : "primary"
                      }
                    >
                      {transferInfo.state}
                    </StatusBadge>
                  </div>
                  <div className="mt-3">
                    <ProgressBar value={transferInfo.progress} tone={transferInfo.state === "completed" ? "success" : "primary"} />
                  </div>
                </div>
              ) : null}

              {/* Sender view */}
              {role === "sender" ? (
                isConnected ? (
                  <div className="flex flex-1 flex-col gap-2.5">
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-[var(--dash-field-border)] bg-[var(--dash-inset)] px-3 py-6 text-center transition hover:border-[var(--dash-text-subtle)] hover:bg-[var(--dash-row-hover)]"
                    >
                      <Upload className="h-5 w-5 text-[var(--dash-text-muted)]" />
                      <div className="mt-1.5 text-xs font-semibold text-[var(--dash-text-primary)]">Choose a file to send</div>
                      <div className="mt-0.5 text-[10px] text-[var(--dash-text-subtle)]">Transfers directly to the connected peer.</div>
                    </button>

                    {selectedFile ? (
                      <div className="rounded-lg border border-[var(--dash-panel-border)] bg-[var(--dash-inset)] px-3 py-2.5">
                        <div className="text-[11px] font-medium text-[var(--dash-text-primary)]">{selectedFile.name}</div>
                        <div className="mt-0.5 text-[10px] text-[var(--dash-text-subtle)]">{formatFileSize(selectedFile.size)}</div>
                      </div>
                    ) : null}

                    <Button className="w-full" size="sm" onClick={() => void sendFile()} disabled={!selectedFile || isLoading || transferInfo.state !== "idle"}>
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                      {isLoading ? "Sending..." : "Send file"}
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2.5 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--dash-inset)]">
                      <Users className="h-4 w-4 text-[var(--dash-text-subtle)]" />
                    </div>
                    <div className="text-xs font-semibold text-[var(--dash-text-primary)]">Waiting for connection</div>
                    <div className="max-w-xs text-[10px] text-[var(--dash-text-subtle)] sm:text-[11px]">Connect to the receiver using their peer ID, then pick a file to send.</div>
                  </div>
                )
              ) : (
                /* Receiver view */
                isConnected ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                    <div className="rounded-lg bg-[var(--dash-accent)] px-5 py-4">
                      <div className="text-xs font-semibold text-[var(--dash-bg)] sm:text-[13px]">Ready to receive</div>
                      <div className="mt-1.5 text-[10px] leading-4 text-[var(--dash-bg)] opacity-70 sm:text-[11px] sm:leading-5">
                        Keep this tab open. Files download automatically when the sender pushes them.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2.5 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--dash-inset)]">
                      <Download className="h-4 w-4 text-[var(--dash-text-subtle)]" />
                    </div>
                    <div className="text-xs font-semibold text-[var(--dash-text-primary)]">Waiting for sender</div>
                    <div className="max-w-xs text-[10px] text-[var(--dash-text-subtle)] sm:text-[11px]">Start a session, share your peer ID, and wait for the sender to connect.</div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default TemporaryShare;
