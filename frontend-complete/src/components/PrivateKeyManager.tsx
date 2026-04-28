import { KeyRound, Loader2, ShieldCheck, Upload } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { AppShell, BrandMark, HeroBadge, SurfaceCard } from "@/components/ui/fluxion-ui";
import { Textarea } from "@/components/ui/textarea";
import { storePrivateKeyInSession } from "@/lib/keyStorage";

interface PrivateKeyManagerProps {
  onKeyLoaded: () => void;
}

export function PrivateKeyManager({ onKeyLoaded }: PrivateKeyManagerProps) {
  const [privateKey, setPrivateKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const keyData = JSON.parse(text);

      if (!keyData.encryptionPrivateKey || !keyData.signingPrivateKey) {
        throw new Error("Invalid private key file format");
      }

      setPrivateKey(JSON.stringify(keyData, null, 2));
      setError("");
    } catch (err) {
      console.error("File upload error:", err);
      setError("Failed to read the private key file. Make sure it contains both encryption and signing private keys.");
    }
  };

  const handleLoadKey = async () => {
    if (!privateKey.trim()) {
      setError("Please paste or upload your private key JSON.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const keyData = JSON.parse(privateKey);

      if (!keyData.encryptionPrivateKey || !keyData.signingPrivateKey) {
        throw new Error("Invalid private key format. Required fields: encryptionPrivateKey and signingPrivateKey.");
      }

      await storePrivateKeyInSession({
        encryptionPrivateKey: keyData.encryptionPrivateKey,
        signingPrivateKey: keyData.signingPrivateKey,
      });

      onKeyLoaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load private key");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <main className="mx-auto flex min-h-screen max-w-6xl items-center px-5 py-8 md:px-8">
        <div className="grid w-full gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <SurfaceCard className="mesh-highlight">
            <BrandMark />
            <HeroBadge>Session-only key access</HeroBadge>
            <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">
              Load a private key for decryption.
            </h1>
            <p className="mt-4 text-base leading-8 text-slate-600">
              This tool is for cases where you need to restore key access into the active browser session. The data is kept in memory only and is not persisted by this view.
            </p>

            <div className="mt-8 space-y-3">
              <div className="rounded-[24px] border border-slate-200 bg-white/86 p-4">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  <div className="text-sm font-semibold text-slate-950">No server upload</div>
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-600">The private material stays in browser memory for this session only.</div>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-white/86 p-4">
                <div className="flex items-center gap-3">
                  <KeyRound className="h-5 w-5 text-sky-700" />
                  <div className="text-sm font-semibold text-slate-950">Expected JSON</div>
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-600">
                  The payload must include both <code>encryptionPrivateKey</code> and <code>signingPrivateKey</code>.
                </div>
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard
            eyebrow="Recovery input"
            title="Upload or paste your key file"
            description="Use a JSON export from your original signup or recovery archive."
          >
            <div className="space-y-5">
              <label className="block">
                <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
                <div className="flex cursor-pointer flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center transition hover:border-sky-300 hover:bg-sky-50">
                  <Upload className="h-8 w-8 text-sky-600" />
                  <div className="mt-3 text-sm font-semibold text-slate-950">Click to upload a key JSON file</div>
                  <div className="mt-1 text-sm text-slate-500">The file is parsed locally in this browser.</div>
                </div>
              </label>

              <div className="relative text-center text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                <span className="bg-background px-3">Or paste JSON</span>
              </div>

              <Textarea
                value={privateKey}
                onChange={(event) => setPrivateKey(event.target.value)}
                placeholder='{"encryptionPrivateKey":"...","signingPrivateKey":"..."}'
                rows={10}
                className="font-mono-brand text-xs"
              />

              {error ? <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}

              <Button className="w-full" size="lg" onClick={() => void handleLoadKey()} disabled={loading || !privateKey.trim()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {loading ? "Loading key..." : "Load private key into session"}
              </Button>
            </div>
          </SurfaceCard>
        </div>
      </main>
    </AppShell>
  );
}
