import { Download, KeyRound, Link2, Loader2 } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { AppShell, BrandMark, HeroBadge, SurfaceCard } from "@/components/ui/fluxion-ui";
import { Input } from "@/components/ui/input";
import { accessShareLink } from "@/lib/api";

export function ShareDownload() {
  const { token = "" } = useParams();
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleDownload = async () => {
    setStatus("Preparing encrypted download...");
    setError("");
    setIsLoading(true);

    try {
      const file = await accessShareLink(token, password || undefined);
      const url = URL.createObjectURL(file.encryptedFile);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${file.fileName}.encrypted`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      setStatus("Encrypted file downloaded.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Share link failed");
      setStatus("");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppShell>
      <main className="mx-auto flex min-h-screen max-w-6xl items-center px-5 py-8 md:px-8">
        <div className="grid w-full gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <SurfaceCard className="mesh-highlight">
            <BrandMark />
            <HeroBadge>Encrypted share package</HeroBadge>
            <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight text-[#111827] md:text-5xl">
              Download the protected file bundle.
            </h1>
            <p className="mt-4 text-base leading-8 text-[#6B7280]">
              This route delivers the encrypted payload only. The recipient still needs the correct private key and decryption flow inside Fluxion to open the content.
            </p>

            <div className="mt-8 space-y-3">
              <div className="rounded-[24px] border border-[#E5E7EB] bg-[#FAFAFA] p-4">
                <div className="flex items-center gap-3">
                  <Link2 className="h-5 w-5 text-[#4B5563]" />
                  <div className="text-sm font-semibold text-[#111827]">Share link token detected</div>
                </div>
                <div className="mt-2 break-all text-sm leading-6 text-[#6B7280]">{token || "Missing token"}</div>
              </div>
              <div className="rounded-[24px] border border-[#E5E7EB] bg-[#FAFAFA] p-4">
                <div className="flex items-center gap-3">
                  <KeyRound className="h-5 w-5 text-[#4B5563]" />
                  <div className="text-sm font-semibold text-[#111827]">Optional password gate</div>
                </div>
                <div className="mt-2 text-sm leading-6 text-[#6B7280]">
                  If the sender added a share password, enter it before downloading the encrypted package.
                </div>
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard
            eyebrow="Recipient action"
            title="Download encrypted package"
            description="Use this page to collect the protected file, then decrypt it from a trusted Fluxion workspace that has the matching private key."
          >
            <div className="rounded-[28px] border border-[#E5E7EB] bg-[#FAFAFA] p-6">
              <label className="text-sm font-semibold text-[#111827]">Share password</label>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter password if required"
                className="mt-3"
              />

              {error ? <div className="mt-4 rounded-2xl bg-[#FEF2F2] p-4 text-sm text-[#991B1B]">{error}</div> : null}
              {status ? <div className="mt-4 rounded-2xl bg-[#F3F4F6] p-4 text-sm text-[#374151]">{status}</div> : null}

              <Button className="mt-6 w-full" size="lg" onClick={() => void handleDownload()} disabled={!token || isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {isLoading ? "Downloading..." : "Download encrypted file"}
              </Button>
            </div>
          </SurfaceCard>
        </div>
      </main>
    </AppShell>
  );
}
