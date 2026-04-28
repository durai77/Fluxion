import { useCallback, useEffect, useState } from "react";
import { Fingerprint, KeyRound, ShieldCheck, Sparkles } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { authGoogle, uploadPublicKey } from "@/lib/api";
import { exportPrivateKey, exportPublicKey, generateKeyPair, generateSigningKeyPair } from "@/lib/crypto";
import { hasKeys, storeKeys } from "@/lib/keyStorage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppShell, BrandMark, HeroBadge } from "@/components/ui/fluxion-ui";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (element: HTMLElement, config: {
            theme: string;
            size: string;
            width: number;
          }) => void;
          prompt: () => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

export function Login() {
  const { login, setHasKeyPair } = useAuth();
  const [showPassphraseSetup, setShowPassphraseSetup] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [setupError, setSetupError] = useState("");
  const [isSettingUpKeys, setIsSettingUpKeys] = useState(false);

  const handleCredentialResponse = useCallback(
    async (response: { credential: string }) => {
      try {
        const authResult = await authGoogle(response.credential);

        if (authResult.isNewUser) {
          setShowPassphraseSetup(true);
          return;
        }

        login();
        const keysExist = await hasKeys();
        setHasKeyPair(keysExist);

        if (!keysExist) {
          console.warn("Existing user signed in without local keys present.");
        }
      } catch (error) {
        console.error("Login failed:", error);
        alert("Login failed. Please try again.");
      }
    },
    [login, setHasKeyPair],
  );

  const completeKeySetup = async (event: React.FormEvent) => {
    event.preventDefault();
    setSetupError("");

    if (passphrase.length < 12) {
      setSetupError("Use at least 12 characters.");
      return;
    }

    if (passphrase !== confirmPassphrase) {
      setSetupError("Passphrases do not match.");
      return;
    }

    setIsSettingUpKeys(true);

    try {
      const encryptionKeyPair = await generateKeyPair();
      const signingKeyPair = await generateSigningKeyPair();

      const encryptionPublicKey = await exportPublicKey(encryptionKeyPair.publicKey);
      const encryptionPrivateKey = await exportPrivateKey(encryptionKeyPair.privateKey);
      const signingPublicKey = await exportPublicKey(signingKeyPair.publicKey);
      const signingPrivateKey = await exportPrivateKey(signingKeyPair.privateKey);

      await storeKeys(
        {
          encryptionPublicKey,
          encryptionPrivateKey,
          signingPublicKey,
          signingPrivateKey,
        },
        passphrase,
      );

      const combinedPublicKey = JSON.stringify({
        encryption: encryptionPublicKey,
        signing: signingPublicKey,
      });
      await uploadPublicKey(combinedPublicKey);

      setPassphrase("");
      setConfirmPassphrase("");
      setShowPassphraseSetup(false);
      setHasKeyPair(true);
      login();
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : "Failed to set up keys.");
    } finally {
      setIsSettingUpKeys(false);
    }
  };

  useEffect(() => {
    const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');

    const initializeGoogle = () => {
      if (window.google && GOOGLE_CLIENT_ID) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
        });

        const buttonDiv = document.getElementById("google-signin-button");
        if (buttonDiv) {
          buttonDiv.innerHTML = "";
          window.google.accounts.id.renderButton(buttonDiv, {
            theme: "outline",
            size: "large",
            width: 280,
          });
        }
      }
    };

    if (existingScript && window.google) {
      initializeGoogle();
      return;
    }

    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = initializeGoogle;
      script.onerror = () => console.error("Failed to load Google Sign-In script");
      document.body.appendChild(script);
    }
  }, [handleCredentialResponse]);

  return (
    <AppShell className="h-screen">
      {/* ─── Passphrase modal ─── */}
      {showPassphraseSetup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-3 backdrop-blur-sm">
          <form onSubmit={completeKeySetup} className="surface-card-strong w-full max-w-md p-4 sm:p-6">
            <HeroBadge>First-time device setup</HeroBadge>
            <h2 className="mt-3 font-display text-xl font-semibold tracking-tight text-[var(--dash-text-primary)] sm:text-2xl">
              Create your key protection passphrase
            </h2>
            <p className="mt-2 text-xs leading-5 text-[var(--dash-text-muted)] sm:text-sm sm:leading-6">
              Fluxion wraps your private keys before storing them in IndexedDB. This passphrase is not recoverable by the service.
            </p>
            <div className="mt-4 space-y-3">
              <Input
                type="password"
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
                placeholder="Create a passphrase"
                autoFocus
              />
              <Input
                type="password"
                value={confirmPassphrase}
                onChange={(event) => setConfirmPassphrase(event.target.value)}
                placeholder="Confirm your passphrase"
              />
            </div>
            {setupError ? <p className="mt-3 text-xs font-medium text-[#DC2626]">{setupError}</p> : null}
            <div className="mt-4 flex items-start gap-2.5 rounded-2xl bg-[var(--dash-inset)] border border-[var(--dash-panel-border)] p-3">
              <KeyRound className="mt-0.5 h-4 w-4 text-[var(--dash-text-muted)]" />
              <p className="text-xs leading-5 text-[var(--dash-text-muted)]">
                Use a long memorable phrase. You will need it whenever this browser session needs to unlock your private keys.
              </p>
            </div>
            <div className="mt-4 flex gap-2.5">
              <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => setShowPassphraseSetup(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="flex-1" disabled={isSettingUpKeys}>
                {isSettingUpKeys ? "Generating keys..." : "Generate protected keys"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ─── Main layout ─── */}
      <main className="flex h-full items-center px-3 py-3 sm:px-4 md:px-5 lg:px-8 xl:px-12">
        <div className="flex w-full flex-col gap-3 lg:flex-row lg:gap-3">

          {/* ─── Left: Branding + Info ─── */}
          <div className="flex flex-col gap-3 lg:flex-[0.95] lg:order-1 order-2">
            <div className="surface-card flex-1 p-3 sm:p-4 md:p-4">
              <BrandMark />
              <div className="mt-2 sm:mt-3">
                <HeroBadge>Trusted access</HeroBadge>
              </div>
              <h1 className="mt-2 font-display text-xl font-semibold tracking-tight text-[var(--dash-text-primary)] sm:mt-3 sm:text-2xl md:text-[1.75rem] lg:text-[2rem]">
                Sign in to your secure transfer workspace.
              </h1>
              <p className="mt-2 max-w-xl text-xs leading-5 text-[var(--dash-text-muted)] sm:text-[0.8125rem] sm:leading-6">
                Use Google for identity, then keep encryption keys local to the device. Returning users pick up where they left off, while new users provision their own browser-bound key pair.
              </p>

              {/* Metric cards */}
              <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-2.5">
                <div className="rounded-xl border border-[var(--dash-panel-border)] bg-[var(--dash-inset)] p-2.5 sm:p-3">
                  <div className="text-[0.5625rem] font-semibold uppercase tracking-[0.18em] text-[var(--dash-text-subtle)] sm:text-[0.625rem]">Identity</div>
                  <div className="mt-1 font-display text-base font-semibold tracking-tight text-[var(--dash-text-primary)] sm:text-lg">Google</div>
                  <div className="mt-0.5 text-[0.625rem] text-[var(--dash-text-muted)] sm:text-[0.6875rem]">Managed sign-in with session refresh</div>
                </div>
                <div className="rounded-xl border border-[var(--dash-panel-border)] bg-[var(--dash-inset)] p-2.5 sm:p-3">
                  <div className="text-[0.5625rem] font-semibold uppercase tracking-[0.18em] text-[var(--dash-text-subtle)] sm:text-[0.625rem]">Custody</div>
                  <div className="mt-1 font-display text-base font-semibold tracking-tight text-[var(--dash-text-primary)] sm:text-lg">Local keys</div>
                  <div className="mt-0.5 text-[0.625rem] text-[var(--dash-text-muted)] sm:text-[0.6875rem]">Private material stays with the browser</div>
                </div>
              </div>
            </div>

            {/* Features strip */}
            <div className="rounded-2xl border border-[var(--dash-panel-border)] bg-[var(--dash-highlight-bg)] p-3 sm:p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-3">
                {[
                  { icon: ShieldCheck, text: "Session-authenticated access to the full workspace." },
                  { icon: Fingerprint, text: "Fingerprint-based trust checks for recipients and senders." },
                  { icon: Sparkles, text: "A cleaner onboarding flow that fits the rest of the app." },
                ].map(({ icon: Icon, text }) => (
                  <div key={text}>
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 sm:h-8 sm:w-8">
                      <Icon className="h-3.5 w-3.5 text-[var(--dash-highlight-text)]" />
                    </div>
                    <p className="mt-1.5 text-[0.6875rem] leading-5 text-[var(--dash-highlight-text)] sm:text-xs sm:leading-5">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ─── Right: Auth + Info cards ─── */}
          <div className="surface-card mesh-highlight flex flex-col justify-between p-3 sm:p-4 md:p-4 lg:flex-[1.05] lg:order-2 order-1">
            <div>
              <div className="text-[0.5625rem] font-semibold uppercase tracking-[0.24em] text-[var(--dash-text-subtle)] sm:text-[0.625rem]">Workspace access</div>
              <h2 className="mt-1.5 font-display text-base font-semibold tracking-tight text-[var(--dash-text-primary)] sm:text-lg md:text-xl">Authenticate and continue</h2>
              <p className="mt-1.5 text-[0.6875rem] leading-5 text-[var(--dash-text-muted)] sm:text-xs sm:leading-5">
                Once Google verifies identity, Fluxion restores your workspace session and checks whether protected keys already exist for this device.
              </p>
            </div>

            <div className="mt-3 space-y-2.5">
              {/* Google auth */}
              {GOOGLE_CLIENT_ID ? (
                <div className="rounded-xl border border-[var(--dash-panel-border)] bg-[var(--dash-inset)] p-3 sm:p-4">
                  <div className="text-[0.5625rem] font-semibold uppercase tracking-[0.22em] text-[var(--dash-text-subtle)] sm:text-[0.625rem]">Continue with Google</div>
                  <div className="mt-3 flex justify-center">
                    <div id="google-signin-button" />
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3 dark:border-[#7F1D1D] dark:bg-[#450A0A]">
                  <div className="text-xs font-semibold text-[#991B1B] dark:text-[#FCA5A5]">Google Client ID not configured</div>
                  <div className="mt-1 text-[0.6875rem] leading-5 text-[#DC2626] dark:text-[#F87171] sm:text-xs">
                    Set <code className="rounded bg-black/5 px-1 py-0.5 dark:bg-white/10">VITE_GOOGLE_CLIENT_ID</code> in the frontend environment before using the sign-in flow.
                  </div>
                </div>
              )}

              {/* Info cards */}
              <div className="grid gap-2">
                <div className="rounded-lg border border-[var(--dash-panel-border)] bg-[var(--dash-inset)] p-3 sm:rounded-xl">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--dash-row-selected)] text-[var(--dash-text-muted)]">
                      <KeyRound className="h-3 w-3" />
                    </div>
                    <div className="text-xs font-semibold text-[var(--dash-text-primary)]">New on this device?</div>
                  </div>
                  <div className="mt-1 text-[0.6875rem] leading-5 text-[var(--dash-text-muted)] sm:text-xs">
                    Fluxion will create a fresh encryption and signing pair after sign-in and wrap both with your passphrase.
                  </div>
                </div>
                <div className="rounded-lg border border-[var(--dash-panel-border)] bg-[var(--dash-inset)] p-3 sm:rounded-xl">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--dash-row-selected)] text-[var(--dash-text-muted)]">
                      <Fingerprint className="h-3 w-3" />
                    </div>
                    <div className="text-xs font-semibold text-[var(--dash-text-primary)]">Returning user?</div>
                  </div>
                  <div className="mt-1 text-[0.6875rem] leading-5 text-[var(--dash-text-muted)] sm:text-xs">
                    Your browser keeps the wrapped private keys and asks to unlock them when the workspace needs active access.
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>
    </AppShell>
  );
}
