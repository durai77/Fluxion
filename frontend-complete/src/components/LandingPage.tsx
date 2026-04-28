import { ArrowRight, CheckCircle2, LockKeyhole, ScanSearch, Share2, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { AppShell, BrandMark, HeroBadge } from "@/components/ui/fluxion-ui";

const trustPoints = [
  "Private keys stay in browser storage and unlock only for the active session.",
  "Every transfer uses encryption plus digital signatures for sender verification.",
  "Share links deliver encrypted payloads so recipients still need the right private key.",
];

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <AppShell className="h-screen">
      <main className="flex h-full flex-col px-3 py-2 sm:px-4 sm:py-3 md:px-5 md:py-3 lg:px-8 xl:px-12">
        {/* ─── Top nav ─── */}
        <div className="surface-card-strong flex items-center justify-between px-3 py-2 sm:px-4 sm:py-2.5 md:px-6 md:py-3">
          <BrandMark />
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => navigate("/quick-share")}>
              Quick Share
            </Button>
            <Button size="sm" onClick={() => navigate("/app")}>Open Workspace</Button>
          </div>
        </div>

        {/* ─── Main content ─── */}
        <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2 sm:mt-3 sm:gap-3 lg:mt-3 lg:flex-row lg:gap-3">
          {/* ─── Left column ─── */}
          <div className="surface-card mesh-highlight flex min-h-0 flex-1 flex-col justify-between overflow-hidden p-3 sm:p-4 md:p-5 lg:flex-[1.15] lg:p-5">
            <div>
              <HeroBadge>Zero-trust file operations</HeroBadge>
              <h1 className="mt-2 text-balance font-display text-xl font-semibold leading-tight tracking-tight text-[var(--dash-text-primary)] sm:mt-3 sm:text-2xl md:text-3xl lg:text-[1.875rem]">
                Production-grade secure file transfer with a cleaner control room.
              </h1>
              <p className="mt-2 max-w-2xl text-xs leading-5 text-[var(--dash-text-muted)] sm:text-[0.8125rem] sm:leading-6 md:text-sm md:leading-6">
                Fluxion brings encrypted delivery, key custody, share links, audit-friendly controls, and direct P2P exchange into a single polished workspace.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:mt-3">
                <Button size="sm" onClick={() => navigate("/app")}>
                  Launch secure workspace
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => navigate("/quick-share")}>
                  Start quick share
                </Button>
              </div>
            </div>

            {/* Metric strip */}
            <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-2.5">
              {[
                { label: "Encryption", value: "AES-256", detail: "Per-file symmetric" },
                { label: "Integrity", value: "ECDSA", detail: "Signed delivery" },
                { label: "Modes", value: "3", detail: "Vault, link, WebRTC" },
              ].map(({ label, value, detail }) => (
                <div key={label} className="rounded-xl border border-[var(--dash-panel-border)] bg-[var(--dash-inset)] p-2 sm:p-2.5 md:p-3">
                  <div className="text-[0.5625rem] font-semibold uppercase tracking-[0.18em] text-[var(--dash-text-subtle)] sm:text-[0.625rem]">{label}</div>
                  <div className="mt-1 font-display text-base font-semibold tracking-tight text-[var(--dash-text-primary)] sm:text-lg md:text-xl">{value}</div>
                  <div className="mt-0.5 text-[0.625rem] text-[var(--dash-text-muted)] sm:text-[0.6875rem]">{detail}</div>
                </div>
              ))}
            </div>

            {/* Features strip — hidden on very small screens, compact on mobile */}
            <div className="mt-2 hidden grid-cols-3 gap-2 sm:grid sm:gap-2">
              {[
                { title: "Managed vault", desc: "Google auth, local keys.", icon: LockKeyhole },
                { title: "Quick share", desc: "P2P without sign-in.", icon: Zap },
                { title: "Controls", desc: "Expiry, burn, redaction.", icon: ScanSearch },
              ].map(({ title, desc, icon: Icon }) => (
                <div key={title} className="flex items-start gap-2 rounded-xl border border-[var(--dash-panel-border)] bg-[var(--dash-inset)] p-2 sm:p-2.5">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--dash-row-selected)] text-[var(--dash-text-muted)] sm:h-7 sm:w-7">
                    <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  </div>
                  <div>
                    <div className="text-[0.6875rem] font-semibold text-[var(--dash-text-primary)] sm:text-xs">{title}</div>
                    <div className="mt-0.5 text-[0.5625rem] leading-4 text-[var(--dash-text-muted)] sm:text-[0.625rem]">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ─── Right column ─── */}
          <div className="flex min-h-0 flex-col gap-2 sm:gap-3 lg:flex-[0.85] lg:gap-3">
            {/* Trust points card */}
            <div className="surface-card flex-1 p-3 sm:p-4 md:p-4">
              <div className="text-[0.5625rem] font-semibold uppercase tracking-[0.24em] text-[var(--dash-text-subtle)] sm:text-[0.625rem]">Platform snapshot</div>
              <h2 className="mt-1.5 font-display text-base font-semibold tracking-tight text-[var(--dash-text-primary)] sm:text-lg md:text-xl">Built for real delivery workflows</h2>
              <p className="mt-1 text-[0.6875rem] leading-5 text-[var(--dash-text-muted)] sm:text-xs sm:leading-5">
                From private recipient lookup to expiring links, the product reads like a polished application.
              </p>
              <div className="mt-2 space-y-1.5 sm:mt-2.5 sm:space-y-2">
                {trustPoints.map((point) => (
                  <div key={point} className="flex gap-2 rounded-lg border border-[var(--dash-panel-border)] bg-[var(--dash-inset)] p-2 sm:rounded-xl sm:p-2.5">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#22C55E]" />
                    <p className="text-[0.6875rem] leading-5 text-[var(--dash-text-muted)] sm:text-xs sm:leading-5">{point}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Use cases panel */}
            <div className="rounded-2xl border border-[var(--dash-panel-border)] bg-[var(--dash-highlight-bg)] p-3 sm:p-4 md:p-4">
              <div className="text-[0.5625rem] font-semibold uppercase tracking-[0.22em] text-[var(--dash-highlight-muted)] sm:text-[0.625rem]">Use cases</div>
              <div className="mt-2 space-y-1.5 sm:mt-2.5">
                {[
                  { label: "External client handoff", icon: Share2 },
                  { label: "Confidential document review", icon: LockKeyhole },
                  { label: "Fast ad-hoc transfer", icon: Zap },
                ].map(({ label, icon: Icon }) => (
                  <div key={label} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 sm:rounded-xl sm:px-3.5 sm:py-2">
                    <span className="text-[0.6875rem] text-[var(--dash-highlight-text)] sm:text-xs">{label}</span>
                    <Icon className="h-3.5 w-3.5 text-[var(--dash-highlight-muted)]" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
