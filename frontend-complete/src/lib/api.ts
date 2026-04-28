// API Client for Zero-Trust File Sharing
import { API_BASE_URL, REDACTION_SERVICE_URL, API_ENDPOINTS } from '@/config/api';

const AUTH_FETCH_OPTIONS: RequestInit = {
  credentials: 'include',
};

function authHeaders(): HeadersInit {
  return {};
}

function jsonAuthHeaders(): HeadersInit {
  return {
    ...authHeaders(),
    'Content-Type': 'application/json',
  };
}

async function parseError(response: Response, fallback: string): Promise<Error> {
  const error = await response.json().catch(() => ({ error: fallback }));
  return new Error(error.error || fallback);
}

async function refreshSession(): Promise<boolean> {
  const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.AUTH_REFRESH}`, {
    method: 'POST',
    ...AUTH_FETCH_OPTIONS,
    headers: authHeaders(),
  });

  return response.ok;
}

async function apiFetch(input: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const response = await fetch(input, {
    ...init,
    credentials: 'include',
    headers: init.headers,
  });

  if (response.status === 401 && retry) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return apiFetch(input, init, false);
    }
  }

  return response;
}

export async function authGoogle(credential: string): Promise<{ isNewUser: boolean; userId: string }> {
  const response = await apiFetch(`${API_BASE_URL}${API_ENDPOINTS.AUTH_GOOGLE}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ credential }),
  }, false);
  
  if (!response.ok) {
    throw await parseError(response, 'Authentication failed');
  }
  
  return response.json();
}

export async function getSession(): Promise<{ userId: string }> {
  const response = await apiFetch(`${API_BASE_URL}${API_ENDPOINTS.AUTH_SESSION}`, {
    method: 'GET',
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw await parseError(response, 'Not authenticated');
  }

  return response.json();
}

export async function logout(): Promise<void> {
  const response = await apiFetch(`${API_BASE_URL}${API_ENDPOINTS.AUTH_LOGOUT}`, {
    method: 'POST',
    headers: authHeaders(),
  }, false);

  if (!response.ok && response.status !== 401) {
    throw await parseError(response, 'Logout failed');
  }
}

export async function uploadPublicKey(publicKey: string): Promise<{ message: string }> {
  const response = await apiFetch(`${API_BASE_URL}${API_ENDPOINTS.USERS_PUBLIC_KEY}`, {
    method: 'POST',
    headers: jsonAuthHeaders(),
    body: JSON.stringify({ publicKey }),
  });
  
  if (!response.ok) {
    throw await parseError(response, 'Failed to upload public key');
  }
  
  return response.json();
}

export async function revokePublicKey(publicKey: string): Promise<{ message: string }> {
  const response = await apiFetch(`${API_BASE_URL}${API_ENDPOINTS.USERS_PUBLIC_KEY}`, {
    method: 'PUT',
    headers: jsonAuthHeaders(),
    body: JSON.stringify({ publicKey }),
  });
  
  if (!response.ok) {
    throw await parseError(response, 'Failed to revoke public key');
  }
  
  return response.json();
}

export async function getReceiverPublicKey(email: string): Promise<{ userId: string; publicKey: string; publicKeyFingerprint?: string }> {
  const response = await apiFetch(`${API_BASE_URL}${API_ENDPOINTS.USERS_PUBLIC_KEY}?email=${encodeURIComponent(email)}`, {
    method: 'GET',
    headers: authHeaders(),
  });
  
  if (!response.ok) {
    throw await parseError(response, 'User not found');
  }
  
  return response.json();
}

export interface SendFilePayload {
  receiverId: string;
  encryptedAESKey: string;
  nonce: string;
  authTag: string;
  signature: string;
  senderPublicKey: string;
  file: Blob;
  fileName: string;
  maxDownloads?: number | null;
  expiresInDays?: number | null;
}

export async function sendFile(payload: SendFilePayload): Promise<{ fileId: string; message: string }> {
  const formData = new FormData();
  formData.append('receiverId', payload.receiverId);
  formData.append('encryptedAESKey', payload.encryptedAESKey);
  formData.append('nonce', payload.nonce);
  formData.append('authTag', payload.authTag);
  formData.append('signature', payload.signature);
  formData.append('senderPublicKey', payload.senderPublicKey);
  if (payload.maxDownloads) formData.append('maxDownloads', String(payload.maxDownloads));
  if (payload.expiresInDays) formData.append('expiresInDays', String(payload.expiresInDays));
  formData.append('file', payload.file, payload.fileName);
  
  const response = await apiFetch(`${API_BASE_URL}${API_ENDPOINTS.FILES_SEND}`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });
  
  if (!response.ok) {
    throw await parseError(response, 'Failed to send file');
  }
  
  return response.json();
}

export interface InboxFile {
  fileId: string;
  fileName: string;
  senderId: string;
  senderEmail?: string;
  uploadedAt: string;
  encryptedSize?: number;
  downloadedAt?: string | null;
  expiresAt?: string | null;
  maxDownloads?: number | null;
  downloadCount?: number;
}

export interface InboxResponse {
  files: InboxFile[];
  hasMore: boolean;
  nextCursor: string | null;
}

export async function getInboxPage(params: { limit?: number; before?: string | null } = {}): Promise<InboxResponse> {
  const search = new URLSearchParams();
  if (params.limit) search.set('limit', String(params.limit));
  if (params.before) search.set('before', params.before);

  const response = await apiFetch(`${API_BASE_URL}${API_ENDPOINTS.FILES_INBOX}${search.toString() ? `?${search}` : ''}`, {
    method: 'GET',
    headers: authHeaders(),
  });
  
  if (!response.ok) {
    throw await parseError(response, 'Failed to fetch inbox');
  }
  
  return response.json();
}

export async function getInbox(): Promise<InboxFile[]> {
  return (await getInboxPage()).files;
}

export interface DownloadedFile {
  encryptedFile: Blob;
  encryptedAESKey: string;
  nonce: string;
  authTag: string;
  signature: string;
  senderPublicKey: string;
  senderPublicKeyFingerprint?: string;
  fileName: string;
  mimeType?: string;
}

async function hydrateDownloadedFile(metadata: Omit<DownloadedFile, 'encryptedFile'> & { downloadUrl: string }): Promise<DownloadedFile> {
  const objectResponse = await fetch(metadata.downloadUrl);
  if (!objectResponse.ok) {
    throw new Error('Failed to download encrypted object');
  }

  return {
    encryptedFile: await objectResponse.blob(),
    encryptedAESKey: metadata.encryptedAESKey,
    nonce: metadata.nonce,
    authTag: metadata.authTag,
    signature: metadata.signature,
    senderPublicKey: metadata.senderPublicKey,
    senderPublicKeyFingerprint: metadata.senderPublicKeyFingerprint,
    fileName: metadata.fileName,
    mimeType: metadata.mimeType,
  };
}

export async function downloadFile(fileId: string): Promise<DownloadedFile> {
  const response = await apiFetch(`${API_BASE_URL}${API_ENDPOINTS.FILES_DOWNLOAD(fileId)}`, {
    method: 'GET',
    headers: authHeaders(),
  });
  
  if (!response.ok) {
    throw await parseError(response, 'Failed to download file');
  }
  
  return hydrateDownloadedFile(await response.json());
}

export interface ShareLinkResponse {
  token: string;
  shareUrl: string;
  expiresAt: string | null;
  hasPassword: boolean;
  maxDownloads: number | null;
}

export async function createShareLink(
  fileId: string,
  payload: { expiresIn: '1h' | '24h' | '7d' | 'never'; password?: string; maxDownloads?: number | null }
): Promise<ShareLinkResponse> {
  const response = await apiFetch(`${API_BASE_URL}${API_ENDPOINTS.FILES_SHARE(fileId)}`, {
    method: 'POST',
    headers: jsonAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw await parseError(response, 'Failed to create share link');
  }

  return response.json();
}

export async function accessShareLink(token: string, password?: string): Promise<DownloadedFile> {
  const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.SHARE_ACCESS(token)}`, {
    method: 'GET',
    headers: password ? { 'X-Share-Password': password } : {},
  });

  if (!response.ok) {
    throw await parseError(response, 'Failed to access share link');
  }

  return hydrateDownloadedFile(await response.json());
}

export interface AuditLogEntry {
  actorId: string | null;
  action: string;
  metadata?: Record<string, unknown>;
  previousHash: string | null;
  entryHash: string;
  createdAt: string;
}

export async function getFileAudit(fileId: string): Promise<{ logs: AuditLogEntry[] }> {
  const response = await apiFetch(`${API_BASE_URL}${API_ENDPOINTS.FILES_AUDIT(fileId)}`, {
    method: 'GET',
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw await parseError(response, 'Failed to fetch audit log');
  }

  return response.json();
}

export async function getWebrtcToken(peerId?: string): Promise<{ peerId: string; token: string; expiresIn: number }> {
  const response = await apiFetch(`${API_BASE_URL}${API_ENDPOINTS.WEBRTC_TOKEN}`, {
    method: 'POST',
    headers: jsonAuthHeaders(),
    body: JSON.stringify(peerId ? { peerId } : {}),
  });

  if (!response.ok) {
    throw await parseError(response, 'Failed to create peer token');
  }

  return response.json();
}

export const SUPPORTED_REDACTION_FORMATS = ['.pdf', '.png', '.jpg', '.jpeg'];

export function isRedactionSupported(fileName: string): boolean {
  const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
  return SUPPORTED_REDACTION_FORMATS.includes(ext);
}

export async function redactFile(file: File): Promise<Blob> {
  const formData = new FormData();
  formData.append('file', file, file.name);

  const response = await fetch(`${REDACTION_SERVICE_URL}${API_ENDPOINTS.REDACT_FILE}`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw await parseError(response, 'Failed to redact file');
  }

  return response.blob();
}
