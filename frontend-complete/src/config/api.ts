// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
export const REDACTION_SERVICE_URL = import.meta.env.VITE_REDACTION_SERVICE_URL || 'http://localhost:5000';

export const API_ENDPOINTS = {
  // Auth
  AUTH_GOOGLE: '/v1/auth/google',
  AUTH_SESSION: '/v1/auth/session',
  AUTH_REFRESH: '/v1/auth/refresh',
  AUTH_LOGOUT: '/v1/auth/logout',
  
  // Users
  USERS_PUBLIC_KEY: '/v1/users/public-key',
  
  // Files
  FILES_SEND: '/v1/files/send',
  FILES_INBOX: '/v1/files/inbox',
  FILES_DOWNLOAD: (fileId: string) => `/v1/files/download/${fileId}`,
  FILES_SHARE: (fileId: string) => `/v1/files/${fileId}/share`,
  FILES_AUDIT: (fileId: string) => `/v1/files/${fileId}/audit`,
  SHARE_ACCESS: (token: string) => `/v1/share/${token}`,
  WEBRTC_TOKEN: '/v1/webrtc/token',
  
  // Redaction (CoverUP microservice)
  REDACT_FILE: '/redact',
};
