import { ArrowLeft, Download, Inbox, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { AppShell, BrandMark, EmptyState, HeroBadge, StatusBadge, SurfaceCard } from "@/components/ui/fluxion-ui";
import { downloadFile, getInbox, InboxFile } from "@/lib/api";
import { getKeys } from "@/lib/keyStorage";
import {
  base64ToArrayBuffer,
  concatenateBuffers,
  decryptAESKey,
  decryptFile,
  hashData,
  importPrivateKey,
  importSigningPublicKey,
  verifySignature,
} from "@/lib/crypto";

interface ReceiveFilesProps {
  onBack: () => void;
}

export function ReceiveFiles({ onBack }: ReceiveFilesProps) {
  const [files, setFiles] = useState<InboxFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState("");

  useEffect(() => {
    void fetchInbox();
  }, []);

  const fetchInbox = async () => {
    setLoading(true);
    setError("");
    try {
      const inboxFiles = await getInbox();
      setFiles(inboxFiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch inbox");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (file: InboxFile) => {
    setDownloadingId(file.fileId);
    setDownloadProgress("Downloading...");

    try {
      const keys = await getKeys();
      if (!keys) throw new Error("Keys not available. Please log out and log back in.");

      setDownloadProgress("Fetching encrypted file...");
      const downloadedFile = await downloadFile(file.fileId);

      setDownloadProgress("Verifying signature...");
      let senderSigningKey: string;
      try {
        const parsed = JSON.parse(downloadedFile.senderPublicKey);
        senderSigningKey = parsed.signing;
      } catch {
        senderSigningKey = downloadedFile.senderPublicKey;
      }

      const signingPublicKey = await importSigningPublicKey(senderSigningKey);
      const encryptedFileBuffer = await downloadedFile.encryptedFile.arrayBuffer();
      const nonce = base64ToArrayBuffer(downloadedFile.nonce);
      const authTag = base64ToArrayBuffer(downloadedFile.authTag);
      const dataToVerify = concatenateBuffers(encryptedFileBuffer, nonce, authTag);
      const hash = await hashData(dataToVerify);
      const signature = base64ToArrayBuffer(downloadedFile.signature);
      const isValid = await verifySignature(signature, hash, signingPublicKey);

      if (!isValid) throw new Error("Signature verification failed");

      setDownloadProgress("Decrypting...");
      const encryptedAESKey = base64ToArrayBuffer(downloadedFile.encryptedAESKey);
      const privateKey = await importPrivateKey(keys.encryptionPrivateKey);
      const aesKey = await decryptAESKey(encryptedAESKey, privateKey);

      const ciphertextWithTag = new Uint8Array(encryptedFileBuffer.byteLength + authTag.byteLength);
      ciphertextWithTag.set(new Uint8Array(encryptedFileBuffer), 0);
      ciphertextWithTag.set(new Uint8Array(authTag), encryptedFileBuffer.byteLength);
      const decryptedBuffer = await decryptFile(ciphertextWithTag.buffer, aesKey, new Uint8Array(nonce));

      const blob = new Blob([decryptedBuffer]);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = downloadedFile.fileName || file.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      setDownloadProgress("");
    } catch (err) {
      console.error("Download failed:", err);
      alert(err instanceof Error ? err.message : "Download failed");
      setDownloadProgress("");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <AppShell>
      <main className="mx-auto min-h-screen max-w-6xl px-5 py-8 md:px-8">
        <SurfaceCard className="mesh-highlight">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <BrandMark />
              <HeroBadge>Inbox retrieval</HeroBadge>
              <h1 className="mt-5 font-display text-4xl font-semibold tracking-tight text-slate-950">Receive and decrypt files</h1>
              <p className="mt-3 max-w-2xl text-base leading-8 text-slate-600">
                Pull incoming encrypted packages, verify signatures, and decrypt them locally with your active private key.
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button variant="outline" onClick={() => void fetchInbox()} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </SurfaceCard>

        <div className="mt-6">
          <SurfaceCard eyebrow="Inbox" title="Available packages" description="Each file remains encrypted until you verify the signature and decrypt it in the browser.">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-24 animate-pulse rounded-[28px] bg-slate-100" />
                ))}
              </div>
            ) : error ? (
              <EmptyState title="Inbox unavailable" description={error} action={<Button onClick={() => void fetchInbox()}>Retry</Button>} />
            ) : files.length === 0 ? (
              <EmptyState title="Inbox is empty" description="No one has sent you an encrypted package yet." />
            ) : (
              <div className="space-y-3">
                {files.map((file) => (
                  <div key={file.fileId} className="rounded-[28px] border border-slate-200 bg-white/86 p-4 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-display text-lg font-semibold text-slate-950">{file.fileName}</h3>
                          <StatusBadge>{file.senderEmail || "Sender available"}</StatusBadge>
                        </div>
                        <div className="mt-2 text-sm text-slate-600">
                          Received on {new Date(file.uploadedAt).toLocaleString()}
                        </div>
                      </div>
                      <Button onClick={() => void handleDownload(file)} disabled={downloadingId === file.fileId}>
                        {downloadingId === file.fileId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        {downloadingId === file.fileId ? downloadProgress || "Downloading..." : "Download"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 rounded-[28px] bg-slate-950 p-5 text-white">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Inbox className="h-4 w-4 text-sky-300" />
                Retrieval notes
              </div>
              <div className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                <div>1. Download the encrypted object and metadata.</div>
                <div>2. Validate the signature from the sender key.</div>
                <div>3. Decrypt locally using your session key material.</div>
              </div>
            </div>
          </SurfaceCard>
        </div>
      </main>
    </AppShell>
  );
}
