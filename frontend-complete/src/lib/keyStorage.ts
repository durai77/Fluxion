// Secure browser-based key storage.
// Public keys are stored as plain public material. Private keys are wrapped
// with a passphrase-derived AES-GCM key before they are persisted in IndexedDB.

const DB_NAME = 'vortex-keys';
const DB_VERSION = 3;
const STORE_NAME = 'keys';
const LOG_STORE_NAME = 'key-access-log';

export interface StoredKeys {
  encryptionPublicKey: string;
  encryptionPrivateKey: string;
  signingPublicKey: string;
  signingPrivateKey: string;
}

interface WrappedKeyRecord {
  wrapped: string;
  salt: string;
  iv: string;
  algorithm: 'RSA-OAEP' | 'RSA-PSS';
}

interface KeyAccessLogEntry {
  action: string;
  timestamp: string;
  details?: string;
}

let sessionKeys: StoredKeys | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      if (!db.objectStoreNames.contains(LOG_STORE_NAME)) {
        db.createObjectStore(LOG_STORE_NAME, { autoIncrement: true });
      }
    };
  });
}

async function logKeyAccess(action: string, details?: string): Promise<void> {
  try {
    const db = await openDB();
    const entry: KeyAccessLogEntry = {
      action,
      timestamp: new Date().toISOString(),
      details,
    };
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(LOG_STORE_NAME, 'readwrite');
      transaction.objectStore(LOG_STORE_NAME).add(entry);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch {
    // Logging is best-effort and must never block key access.
  }
}

export async function getKeyAccessLogs(): Promise<KeyAccessLogEntry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(LOG_STORE_NAME, 'readonly');
    const request = transaction.objectStore(LOG_STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// PBKDF2 stretches the user passphrase into an AES-GCM wrapping key. The high
// iteration count slows offline guessing if an IndexedDB export is stolen.
async function deriveWrappingKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey']
  );
}

async function importPrivateKeyForWrap(base64Key: string, algorithm: 'RSA-OAEP' | 'RSA-PSS'): Promise<CryptoKey> {
  // The private key is imported only so WebCrypto can wrap the PKCS#8 material;
  // the raw base64 value is never persisted after wrapping.
  return window.crypto.subtle.importKey(
    'pkcs8',
    base64ToArrayBuffer(base64Key),
    { name: algorithm, hash: 'SHA-256' },
    true,
    algorithm === 'RSA-OAEP' ? ['decrypt'] : ['sign']
  );
}

async function wrapPrivateKey(
  privateKeyBase64: string,
  passphrase: string,
  algorithm: 'RSA-OAEP' | 'RSA-PSS'
): Promise<WrappedKeyRecord> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const privateKey = await importPrivateKeyForWrap(privateKeyBase64, algorithm);
  const wrappingKey = await deriveWrappingKey(passphrase, salt);

  // AES-GCM provides confidentiality and integrity for the wrapped PKCS#8 key.
  const wrapped = await window.crypto.subtle.wrapKey('pkcs8', privateKey, wrappingKey, {
    name: 'AES-GCM',
    iv,
  });

  return {
    wrapped: arrayBufferToBase64(wrapped),
    salt: arrayBufferToBase64(salt.buffer as ArrayBuffer),
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
    algorithm,
  };
}

async function unwrapPrivateKey(record: WrappedKeyRecord, passphrase: string): Promise<string> {
  const salt = new Uint8Array(base64ToArrayBuffer(record.salt));
  const iv = new Uint8Array(base64ToArrayBuffer(record.iv));
  const wrappingKey = await deriveWrappingKey(passphrase, salt);

  // The passphrase-derived wrapping key unwraps the private key for this
  // session only; the passphrase itself is immediately discarded by the caller.
  const key = await window.crypto.subtle.unwrapKey(
    'pkcs8',
    base64ToArrayBuffer(record.wrapped),
    wrappingKey,
    { name: 'AES-GCM', iv },
    { name: record.algorithm, hash: 'SHA-256' },
    true,
    record.algorithm === 'RSA-OAEP' ? ['decrypt'] : ['sign']
  );

  return arrayBufferToBase64(await window.crypto.subtle.exportKey('pkcs8', key));
}

export async function storeKeys(keys: StoredKeys, passphrase: string): Promise<void> {
  if (passphrase.length < 12) {
    throw new Error('Passphrase must be at least 12 characters');
  }

  const [wrappedEncryptionPrivateKey, wrappedSigningPrivateKey] = await Promise.all([
    wrapPrivateKey(keys.encryptionPrivateKey, passphrase, 'RSA-OAEP'),
    wrapPrivateKey(keys.signingPrivateKey, passphrase, 'RSA-PSS'),
  ]);

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    store.put(keys.encryptionPublicKey, 'encryptionPublicKey');
    store.put(keys.signingPublicKey, 'signingPublicKey');
    store.put(wrappedEncryptionPrivateKey, 'wrappedEncryptionPrivateKey');
    store.put(wrappedSigningPrivateKey, 'wrappedSigningPrivateKey');
    store.delete('encryptionPrivateKey');
    store.delete('signingPrivateKey');
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });

  sessionKeys = keys;
  await logKeyAccess('KEYS_STORED', 'Private keys wrapped with PBKDF2 + AES-GCM');
}

export async function unlockKeys(passphrase: string): Promise<void> {
  const db = await openDB();
  const records = await new Promise<{
    encryptionPublicKey: string;
    signingPublicKey: string;
    wrappedEncryptionPrivateKey?: WrappedKeyRecord;
    wrappedSigningPrivateKey?: WrappedKeyRecord;
    legacyEncryptionPrivateKey?: string;
    legacySigningPrivateKey?: string;
  }>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const encryptionPublicKey = store.get('encryptionPublicKey');
    const signingPublicKey = store.get('signingPublicKey');
    const wrappedEncryptionPrivateKey = store.get('wrappedEncryptionPrivateKey');
    const wrappedSigningPrivateKey = store.get('wrappedSigningPrivateKey');
    const legacyEncryptionPrivateKey = store.get('encryptionPrivateKey');
    const legacySigningPrivateKey = store.get('signingPrivateKey');

    transaction.oncomplete = () => {
      const hasWrapped = wrappedEncryptionPrivateKey.result && wrappedSigningPrivateKey.result;
      const hasLegacy = legacyEncryptionPrivateKey.result && legacySigningPrivateKey.result;
      if (!encryptionPublicKey.result || !signingPublicKey.result || (!hasWrapped && !hasLegacy)) {
        reject(new Error('Wrapped keys are not available'));
        return;
      }

      resolve({
        encryptionPublicKey: encryptionPublicKey.result,
        signingPublicKey: signingPublicKey.result,
        wrappedEncryptionPrivateKey: wrappedEncryptionPrivateKey.result,
        wrappedSigningPrivateKey: wrappedSigningPrivateKey.result,
        legacyEncryptionPrivateKey: legacyEncryptionPrivateKey.result,
        legacySigningPrivateKey: legacySigningPrivateKey.result,
      });
    };
    transaction.onerror = () => reject(transaction.error);
  });

  if (records.legacyEncryptionPrivateKey && records.legacySigningPrivateKey) {
    const migratedKeys = {
      encryptionPublicKey: records.encryptionPublicKey,
      encryptionPrivateKey: records.legacyEncryptionPrivateKey,
      signingPublicKey: records.signingPublicKey,
      signingPrivateKey: records.legacySigningPrivateKey,
    };
    await storeKeys(migratedKeys, passphrase);
    await logKeyAccess('KEYS_MIGRATED', 'Legacy raw private keys wrapped with passphrase');
    return;
  }

  const [encryptionPrivateKey, signingPrivateKey] = await Promise.all([
    unwrapPrivateKey(records.wrappedEncryptionPrivateKey as WrappedKeyRecord, passphrase),
    unwrapPrivateKey(records.wrappedSigningPrivateKey as WrappedKeyRecord, passphrase),
  ]);

  sessionKeys = {
    encryptionPublicKey: records.encryptionPublicKey,
    encryptionPrivateKey,
    signingPublicKey: records.signingPublicKey,
    signingPrivateKey,
  };

  await logKeyAccess('KEYS_UNLOCKED', 'Wrapped private keys unlocked for current browser session');
}

export function areKeysUnlocked(): boolean {
  return sessionKeys !== null;
}

export async function getKeys(): Promise<StoredKeys | null> {
  if (sessionKeys) {
    await logKeyAccess('KEYS_ACCESSED', 'Keys read from session memory');
    return sessionKeys;
  }

  return null;
}

export async function clearKeys(): Promise<void> {
  sessionKeys = null;
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });

  await logKeyAccess('KEYS_REVOKED', 'All persisted key records cleared');
}

export async function hasKeys(): Promise<boolean> {
  return hasPublicKeys();
}

export async function hasPrivateKeys(): Promise<boolean> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const encPrivRequest = store.get('wrappedEncryptionPrivateKey');
    const sigPrivRequest = store.get('wrappedSigningPrivateKey');
    const legacyEncPrivRequest = store.get('encryptionPrivateKey');
    const legacySigPrivRequest = store.get('signingPrivateKey');
    
    transaction.oncomplete = () => {
      resolve(
        (!!encPrivRequest.result && !!sigPrivRequest.result) ||
        (!!legacyEncPrivRequest.result && !!legacySigPrivRequest.result)
      );
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function hasPublicKeys(): Promise<boolean> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const encPubRequest = store.get('encryptionPublicKey');
    const sigPubRequest = store.get('signingPublicKey');
    
    transaction.oncomplete = () => {
      resolve(!!encPubRequest.result && !!sigPubRequest.result);
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export function storePrivateKeyInSession(_privateKeys: { encryptionPrivateKey: string; signingPrivateKey: string }): Promise<void> {
  return Promise.resolve();
}

export function getPrivateKeysFromSession(): { encryptionPrivateKey: string; signingPrivateKey: string } | null {
  return sessionKeys
    ? {
        encryptionPrivateKey: sessionKeys.encryptionPrivateKey,
        signingPrivateKey: sessionKeys.signingPrivateKey,
      }
    : null;
}

export function clearPrivateKeysFromSession(): void {
  sessionKeys = null;
}

export function hasPrivateKeysInSession(): boolean {
  return areKeysUnlocked();
}
