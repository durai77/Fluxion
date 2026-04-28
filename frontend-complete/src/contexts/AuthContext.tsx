import React, { createContext, useContext, useEffect, ReactNode, useState } from 'react';
import { KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BrandMark } from '@/components/ui/fluxion-ui';
import { getSession, logout as apiLogout } from '@/lib/api';
import { areKeysUnlocked, clearKeys, hasPrivateKeys, hasPublicKeys, unlockKeys } from '@/lib/keyStorage';

interface AuthContextType {
  isLoggedIn: boolean;
  hasKeyPair: boolean;
  isLoadingKeys: boolean;
  setLoggedIn: (value: boolean) => void;
  setHasKeyPair: (value: boolean) => void;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasKeyPair, setHasKeyPair] = useState(false);
  const [isLoadingKeys, setIsLoadingKeys] = useState(true);
  const [needsUnlock, setNeedsUnlock] = useState(false);
  const [unlockPassphrase, setUnlockPassphrase] = useState('');
  const [unlockError, setUnlockError] = useState('');

  useEffect(() => {
    const initAuth = async () => {
      try {
        await getSession();
        setIsLoggedIn(true);

        // Check if public keys exist (user has completed signup)
        const exists = await hasPublicKeys();
        setHasKeyPair(exists);
        const privateKeysExist = await hasPrivateKeys();
        setNeedsUnlock(exists && privateKeysExist && !areKeysUnlocked());
      } catch {
        setIsLoggedIn(false);
        setHasKeyPair(false);
        setNeedsUnlock(false);
      } finally {
        setIsLoadingKeys(false);
      }
    };

    initAuth();
  }, []);

  const login = () => {
    setIsLoggedIn(true);
  };

  const logout = async () => {
    await apiLogout().catch(() => undefined);
    // Clear ALL keys from IndexedDB (revocation with logging)
    await clearKeys();
    setIsLoggedIn(false);
    setHasKeyPair(false);
    setNeedsUnlock(false);
  };

  const handleUnlock = async (event: React.FormEvent) => {
    event.preventDefault();
    setUnlockError('');

    try {
      await unlockKeys(unlockPassphrase);
      setUnlockPassphrase('');
      setNeedsUnlock(false);
      setHasKeyPair(true);
    } catch {
      setUnlockError('Could not unlock keys. Check your passphrase and try again.');
    }
  };

  const setLoggedIn = (value: boolean) => {
    setIsLoggedIn(value);
  };

  return (
    <AuthContext.Provider value={{ 
      isLoggedIn, 
      hasKeyPair,
      isLoadingKeys,
      setLoggedIn, 
      setHasKeyPair, 
      login, 
      logout 
    }}>
      {children}
      {needsUnlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <form onSubmit={handleUnlock} className="surface-card-strong w-full max-w-lg p-6 md:p-8">
            <BrandMark />
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
              <KeyRound className="h-3.5 w-3.5" />
              Session unlock
            </div>
            <h2 className="mt-5 font-display text-3xl font-semibold tracking-tight text-slate-950">Unlock private keys</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Enter your key passphrase for this browser session. Fluxion does not store the passphrase and uses it only to unwrap your protected private keys locally.
            </p>

            <div className="mt-6 rounded-[28px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-600" />
                <p className="text-sm leading-6 text-slate-600">
                  Unlocking happens inside the browser so encrypted downloads and signed sends can use your active key material.
                </p>
              </div>
            </div>

            <Input
              type="password"
              value={unlockPassphrase}
              onChange={(event) => setUnlockPassphrase(event.target.value)}
              className="mt-5"
              placeholder="Key passphrase"
              autoFocus
            />
            {unlockError ? <p className="mt-3 text-sm font-medium text-rose-600">{unlockError}</p> : null}
            <Button type="submit" className="mt-6 w-full" size="lg" disabled={unlockPassphrase.length < 1}>
              <LockKeyhole className="h-4 w-4" />
              Unlock keys
            </Button>
          </form>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
