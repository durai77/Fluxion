import { ArrowLeft, Loader2, Search, SendHorizonal, ShieldCheck, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { AppShell, BrandMark, HeroBadge, ProgressBar, SurfaceCard } from "@/components/ui/fluxion-ui";
import { Input } from "@/components/ui/input";
import { getReceiverPublicKey, isRedactionSupported, redactFile, sendFile } from "@/lib/api";
import { getKeys } from "@/lib/keyStorage";
import {
  arrayBufferToBase64,
  concatenateBuffers,
  encryptAESKey,
  encryptFile,
  generateAESKey,
  generateNonce,
  getKeyFingerprint,
  hashData,
  importPublicKey,
  importSigningPrivateKey,
  signData,
} from "@/lib/crypto";

interface SendFileProps {
  onBack: () => void;
}

type SendState = "lookup" | "select" | "sending" | "success" | "error";

export function SendFile({ onBack }: SendFileProps) {
  const [state, setState] = useState<SendState>("lookup");
  const [receiverEmail, setReceiverEmail] = useState("");
  const [receiverData, setReceiverData] = useState<{ userId: string; publicKey: string } | null>(null);
  const [receiverFingerprint, setReceiverFingerprint] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [enableRedaction, setEnableRedaction] = useState(false);
  const [burnAfterReading, setBurnAfterReading] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState<number | null>(7);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLookupReceiver = async () => {
    if (!receiverEmail.trim()) {
      setError("Please enter a recipient email.");
      return;
    }

    setError("");
    setProgress("Looking up recipient...");

    try {
      const data = await getReceiverPublicKey(receiverEmail.trim());
      setReceiverData(data);
      try {
        const parsed = JSON.parse(data.publicKey);
        setReceiverFingerprint(await getKeyFingerprint(parsed.signing || data.publicKey));
      } catch {
        setReceiverFingerprint(await getKeyFingerprint(data.publicKey));
      }
      setState("select");
      setProgress("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "User not found");
      setProgress("");
    }
  };

  const handleSend = async () => {
    if (!selectedFile || !receiverData) return;

    setState("sending");
    setError("");

    try {
      const keys = await getKeys();
      if (!keys) throw new Error("Keys not available. Please log out and sign back in.");

      let fileToSend = selectedFile;
      if (enableRedaction && isRedactionSupported(selectedFile.name)) {
        setProgress("Redacting file...");
        try {
          const redactedBlob = await redactFile(selectedFile);
          const redactedName = `${selectedFile.name.replace(/\.[^.]+$/, "")}_redacted.pdf`;
          fileToSend = new File([redactedBlob], redactedName, { type: "application/pdf" });
        } catch (err) {
          console.warn("Redaction failed, falling back to original file:", err);
        }
      }

      setProgress("Reading file...");
      const fileBuffer = await fileToSend.arrayBuffer();

      setProgress("Generating encryption key...");
      const aesKey = await generateAESKey();
      const nonce = generateNonce();

      setProgress("Encrypting package...");
      const encryptedFileBuffer = await encryptFile(fileBuffer, aesKey, nonce);
      const encryptedFile = new Uint8Array(encryptedFileBuffer);
      const authTagLength = 16;
      const ciphertext = encryptedFile.slice(0, encryptedFile.length - authTagLength);
      const authTag = encryptedFile.slice(encryptedFile.length - authTagLength);

      setProgress("Wrapping session key...");
      let receiverEncryptionKey: string;
      try {
        const parsed = JSON.parse(receiverData.publicKey);
        receiverEncryptionKey = parsed.encryption;
      } catch {
        receiverEncryptionKey = receiverData.publicKey;
      }

      const receiverPublicKey = await importPublicKey(receiverEncryptionKey);
      const encryptedAESKey = await encryptAESKey(aesKey, receiverPublicKey);

      setProgress("Signing payload...");
      const dataToSign = concatenateBuffers(
        ciphertext.buffer as ArrayBuffer,
        nonce.buffer as ArrayBuffer,
        authTag.buffer as ArrayBuffer,
      );
      const hash = await hashData(dataToSign);
      const signingPrivateKey = await importSigningPrivateKey(keys.signingPrivateKey);
      const signature = await signData(hash, signingPrivateKey);

      setProgress("Uploading...");
      await sendFile({
        receiverId: receiverData.userId,
        encryptedAESKey: arrayBufferToBase64(encryptedAESKey),
        nonce: arrayBufferToBase64(nonce.buffer as ArrayBuffer),
        authTag: arrayBufferToBase64(authTag.buffer as ArrayBuffer),
        signature: arrayBufferToBase64(signature),
        senderPublicKey: keys.signingPublicKey,
        file: new Blob([ciphertext]),
        fileName: fileToSend.name,
        maxDownloads: burnAfterReading ? 1 : null,
        expiresInDays,
      });

      setProgress("");
      setState("success");
    } catch (err) {
      console.error("Send failed:", err);
      setError(err instanceof Error ? err.message : "Failed to send file");
      setProgress("");
      setState("error");
    }
  };

  const handleReset = () => {
    setState("lookup");
    setReceiverEmail("");
    setReceiverData(null);
    setReceiverFingerprint("");
    setSelectedFile(null);
    setError("");
    setProgress("");
    setEnableRedaction(false);
    setBurnAfterReading(false);
    setExpiresInDays(7);
  };

  return (
    <AppShell>
      <main className="mx-auto min-h-screen max-w-6xl px-5 py-8 md:px-8">
        <SurfaceCard className="mesh-highlight">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <BrandMark />
              <HeroBadge>Standalone send flow</HeroBadge>
              <h1 className="mt-5 font-display text-4xl font-semibold tracking-tight text-slate-950">Encrypt and send a file</h1>
              <p className="mt-3 max-w-2xl text-base leading-8 text-slate-600">
                This standalone screen mirrors the workspace send experience while keeping the process focused on recipient verification and controlled delivery.
              </p>
            </div>
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </div>
        </SurfaceCard>

        <div className="mt-6">
          <SurfaceCard eyebrow="Transfer flow" title="Prepare delivery" description="Verify the recipient first, then encrypt and upload the package.">
            {state === "lookup" && (
              <div className="mx-auto max-w-2xl space-y-4">
                <Input
                  type="email"
                  value={receiverEmail}
                  onChange={(event) => setReceiverEmail(event.target.value)}
                  placeholder="recipient@company.com"
                />
                {error ? <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}
                <Button className="w-full" size="lg" onClick={() => void handleLookupReceiver()} disabled={!!progress}>
                  {progress ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  {progress || "Verify recipient"}
                </Button>
              </div>
            )}

            {state === "select" && (
              <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                <div className="space-y-4">
                  <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-5">
                    <div className="text-sm font-semibold text-emerald-800">Recipient verified: {receiverEmail}</div>
                    {receiverFingerprint ? (
                      <div className="mt-2 text-xs leading-6 text-emerald-700">Safety fingerprint: {receiverFingerprint}</div>
                    ) : null}
                  </div>

                  <input ref={fileInputRef} type="file" onChange={(event) => setSelectedFile(event.target.files?.[0] || null)} className="hidden" />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center transition hover:border-sky-300 hover:bg-sky-50"
                  >
                    <Upload className="h-8 w-8 text-sky-600" />
                    <div className="mt-3 text-sm font-semibold text-slate-950">Choose a file to send</div>
                    <div className="mt-1 text-sm text-slate-500">All encryption happens locally.</div>
                  </button>

                  {selectedFile ? (
                    <div className="rounded-[28px] border border-slate-200 bg-white/86 p-5">
                      <div className="text-sm font-semibold text-slate-950">{selectedFile.name}</div>
                      <div className="mt-1 text-sm text-slate-500">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</div>

                      <div className="mt-4 space-y-3">
                        {isRedactionSupported(selectedFile.name) ? (
                          <label className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                            <input
                              type="checkbox"
                              checked={enableRedaction}
                              onChange={(event) => setEnableRedaction(event.target.checked)}
                              className="mt-1 h-4 w-4 accent-amber-500"
                            />
                            <div>
                              <div className="text-sm font-semibold text-amber-800">Redact before send</div>
                              <div className="mt-1 text-sm leading-6 text-amber-700">Convert supported files into a redacted PDF before encryption.</div>
                            </div>
                          </label>
                        ) : null}

                        <label className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                          <input
                            type="checkbox"
                            checked={burnAfterReading}
                            onChange={(event) => setBurnAfterReading(event.target.checked)}
                            className="mt-1 h-4 w-4 accent-rose-500"
                          />
                          <div>
                            <div className="text-sm font-semibold text-rose-800">Burn after reading</div>
                            <div className="mt-1 text-sm leading-6 text-rose-700">Allow only one download.</div>
                          </div>
                        </label>

                        <select
                          value={expiresInDays ?? "never"}
                          onChange={(event) => setExpiresInDays(event.target.value === "never" ? null : Number(event.target.value))}
                          className="flex h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                        >
                          <option value={1}>Expire in 24 hours</option>
                          <option value={7}>Expire in 7 days</option>
                          <option value={30}>Expire in 30 days</option>
                          <option value="never">Never expire</option>
                        </select>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-[28px] bg-slate-950 p-6 text-white">
                  <div className="flex items-center gap-2 text-sm font-semibold text-sky-300">
                    <ShieldCheck className="h-4 w-4" />
                    Delivery engine
                  </div>
                  <div className="mt-3 text-sm leading-6 text-slate-300">
                    The browser encrypts the file, wraps the AES key for the recipient, signs the payload, and only then uploads it.
                  </div>

                  {progress ? (
                    <div className="mt-6 space-y-3">
                      <div className="flex items-center gap-2 text-sm text-slate-200">
                        <Loader2 className="h-4 w-4 animate-spin text-sky-300" />
                        {progress}
                      </div>
                      <ProgressBar value={72} />
                    </div>
                  ) : null}

                  {error ? <div className="mt-6 rounded-2xl bg-rose-500/12 p-4 text-sm text-rose-200">{error}</div> : null}

                  <div className="mt-6 flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={handleReset}>
                      Cancel
                    </Button>
                    <Button className="flex-1" onClick={() => void handleSend()} disabled={!selectedFile}>
                      <SendHorizonal className="h-4 w-4" />
                      {enableRedaction ? "Redact and send" : "Encrypt and send"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {state === "sending" && (
              <div className="mx-auto max-w-xl text-center">
                <Loader2 className="mx-auto h-10 w-10 animate-spin text-sky-600" />
                <h2 className="mt-5 font-display text-2xl font-semibold text-slate-950">Sending secure package</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{progress}</p>
                <div className="mt-5">
                  <ProgressBar value={78} />
                </div>
              </div>
            )}

            {state === "success" && (
              <div className="mx-auto max-w-xl text-center">
                <h2 className="font-display text-3xl font-semibold text-slate-950">File delivered</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">The encrypted package was uploaded successfully.</p>
                <Button className="mt-6" onClick={handleReset}>
                  Send another file
                </Button>
              </div>
            )}

            {state === "error" && (
              <div className="mx-auto max-w-xl text-center">
                <h2 className="font-display text-3xl font-semibold text-slate-950">Transfer failed</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">{error}</p>
                <Button className="mt-6" onClick={handleReset}>
                  Try again
                </Button>
              </div>
            )}
          </SurfaceCard>
        </div>
      </main>
    </AppShell>
  );
}
