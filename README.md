# 🚀 Fluxion - Zero-Trust Encrypted File Sharing
live deployed project: https://fluxion-plum.vercel.app
                       https://app.gokulamaran.me
<div align="center">

![Fluxion Logo](https://img.shields.io/badge/Fluxion-Zero%20Trust-blue?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0xMyAxMFYzTDQgMTRoN3Y3bDktMTFoLTd6Ii8+PC9zdmc+)

**Military-Grade Encryption • Peer-to-Peer • Zero Knowledge**

[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=nodedotjs)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-8.0-47A248?style=flat-square&logo=mongodb)](https://www.mongodb.com/)
[![WebRTC](https://img.shields.io/badge/WebRTC-PeerJS-333333?style=flat-square&logo=webrtc)](https://peerjs.com/)

[Demo](#-demo) • [Features](#-key-features) • [Architecture](#-architecture) • [Quick Start](#-quick-start) • [API Reference](#-api-reference)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Architecture](#-architecture)
- [Repository Structure](#-repository-structure)
- [Tech Stack](#-tech-stack)
- [Cryptographic Design](#-cryptographic-design)
- [Quick Start](#-quick-start)
- [API Reference](#-api-reference)
- [Workflow Diagrams](#-workflow-diagrams)
- [Security Model](#-security-model)
- [Contributing](#-contributing)

---

## 🎯 Overview

**Fluxion** is a zero-trust, end-to-end encrypted file sharing platform that ensures your data remains private - even from us. Built with military-grade encryption (AES-256-GCM + RSA-2048), Fluxion offers two distinct sharing modes:

1. **🕐 Temporary Share (Quick)** - Instant P2P file transfer via WebRTC. No login required. Files never touch our servers.

2. **🔒 Permanent Share (Secure)** - Encrypted cloud storage with digital signatures. Files are encrypted client-side before upload.

### Why Fluxion?

| Traditional Cloud Storage | Fluxion |
|--------------------------|---------|
| Server can read your files | **Zero-knowledge encryption** - server only sees ciphertext |
| Trust the provider | **Trustless architecture** - verify with digital signatures |
| Centralized storage | **Hybrid P2P + Cloud** - choose your sharing method |
| Single encryption layer | **Layered encryption** - AES-256 + RSA-2048 |

---

## ✨ Key Features

### 🔐 Zero-Trust Security
- **Client-side encryption** - All cryptographic operations happen in your browser
- **Private keys never leave your device** - Wrapped with PBKDF2 + AES-GCM before IndexedDB storage
- **Digital signatures** - Verify sender authenticity with RSA-PSS signatures
- **No backdoors** - Even we cannot decrypt your files

### 📤 Dual Sharing Modes

#### Temporary Share (P2P)
- ✅ Authenticated peer tokens for signaling access
- ✅ Direct peer-to-peer transfer via WebRTC
- ✅ Files never stored on servers
- ✅ 6-digit room codes for easy sharing
- ✅ Real-time transfer progress

#### Permanent Share (Cloud)
- ✅ Google OAuth authentication
- ✅ Encrypted object storage in Supabase Storage with MongoDB metadata
- ✅ Send to any registered user by email
- ✅ Inbox with received files
- ✅ Sender verification with signatures

### 🛡️ Cryptographic Features
- **AES-256-GCM** - Symmetric encryption with authentication
- **RSA-OAEP (2048-bit)** - Asymmetric key exchange
- **RSA-PSS** - Digital signatures for authenticity
- **SHA-256** - Cryptographic hashing
- **Web Crypto API** - Browser-native, audited crypto

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│                              FLUXION ARCHITECTURE                          │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         FRONTEND (React + TypeScript)                │  │
│  │                                                                      │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐   │  │
│  │  │  Landing    │  │  Dashboard  │  │  Send File  │  │  Receive   │   │  │
│  │  │    Page     │  │             │  │             │  │   Files    │   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘   │  │
│  │                                                                      │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │  │
│  │  │                     CRYPTO LAYER (Web Crypto API)               │ │  │
│  │  │  • AES-256-GCM Encryption    • RSA-2048 Key Exchange            │ │  │
│  │  │  • RSA-PSS Signatures        • SHA-256 Hashing                  │ │  │
│  │  └─────────────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                           │                           │                    │
│                           ▼                           ▼                    │
│  ┌──────────────────────────────────┐  ┌───────────────────────────────┐   │
│  │     BACKEND-HYBRID (Express)     │  │   BACKEND-WEBRTC (PeerJS)     │   │
│  │                                  │  │                               │   │
│  │  • Google OAuth                  │  │  • Signaling Server           │   │
│  │  • JWT Authentication            │  │  • WebRTC Connection          │   │
│  │  • Encrypted File Storage        │  │  • Direct P2P Transfer        │   │
│  │  • User Management               │  │                               │   │
│  └──────────────────────────────────┘  └───────────────────────────────┘   │
│                           │                                                │
│                           ▼                                                │
│  ┌──────────────────────────────────┐                                      │
│  │           MONGODB                │                                      │
│  │  • User Profiles                 │                                      │
│  │  • Public Keys                   │                                      │
│  │  • File metadata + audit logs    │                                      │
│  └──────────────────────────────────┘                                      │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Repository Structure

```
infuxion/
│
├── 📂 frontend-complete/          # React + TypeScript Frontend
│   ├── 📂 src/
│   │   ├── 📂 components/         # UI Components
│   │   │   ├── Dashboard.tsx      # Main dashboard after login
│   │   │   ├── LandingPage.tsx    # Homepage with sharing options
│   │   │   ├── Login.tsx          # Google OAuth login
│   │   │   ├── SendFile.tsx       # Encrypted file sending
│   │   │   ├── ReceiveFiles.tsx   # Inbox & decryption
│   │   │   ├── TemporaryShare.tsx # P2P WebRTC sharing
│   │   │   ├── PrivateKeyManager.tsx # Key import/export
│   │   │   └── 📂 ui/             # Shadcn UI components
│   │   │
│   │   ├── 📂 lib/                # Core Libraries
│   │   │   ├── crypto.ts          # 🔐 All cryptographic operations
│   │   │   ├── keyStorage.ts      # IndexedDB + session key storage
│   │   │   ├── api.ts             # Backend API client
│   │   │   └── utils.ts           # Utility functions
│   │   │
│   │   ├── 📂 contexts/           # React Contexts
│   │   │   └── AuthContext.tsx    # Authentication state
│   │   │
│   │   ├── 📂 config/             # Configuration
│   │   │   └── api.ts             # API endpoints config
│   │   │
│   │   ├── 📂 pages/              # Route Pages
│   │   │   ├── Index.tsx          # /app route
│   │   │   └── NotFound.tsx       # 404 page
│   │   │
│   │   ├── App.tsx                # Main app with routing
│   │   └── main.tsx               # Entry point
│   │
│   ├── package.json
│   ├── vite.config.ts             # Vite configuration
│   ├── tailwind.config.ts         # Tailwind CSS config
│   └── tsconfig.json              # TypeScript config
│
├── 📂 backend-hybrid/             # Express.js REST API
│   ├── 📂 src/
│   │   ├── index.js               # Server entry point
│   │   │
│   │   ├── 📂 config/
│   │   │   └── db.js              # MongoDB connection
│   │   │
│   │   ├── 📂 controllers/        # Route handlers
│   │   │   ├── authController.js  # Google OAuth logic
│   │   │   ├── usersController.js # Public key management
│   │   │   └── filesController.js # Encrypted file operations
│   │   │
│   │   ├── 📂 middleware/
│   │   │   └── auth.js            # JWT verification
│   │   │
│   │   ├── 📂 models/             # MongoDB Schemas
│   │   │   ├── User.js            # User profile + public key
│   │   │   └── File.js            # Encrypted file metadata
│   │   │
│   │   └── 📂 routes/             # API Routes
│   │       ├── auth.js            # POST /v1/auth/google
│   │       ├── users.js           # GET/POST /v1/users/public-key
│   │       └── files.js           # POST /v1/files/send, GET /v1/files/inbox
│   │
│   └── package.json
│
├── 📂 backend-webrtc/             # PeerJS Signaling Server
│   ├── server.js                  # WebRTC signaling logic
│   └── package.json
│
└── README.md                      # You are here! 📍
```

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 18** | UI framework with hooks |
| **TypeScript** | Type-safe JavaScript |
| **Vite 7** | Lightning-fast build tool |
| **TailwindCSS** | Utility-first styling |
| **Shadcn/UI** | Accessible component library |
| **PeerJS** | WebRTC abstraction |
| **TanStack Query** | Server state management |
| **React Router** | Client-side routing |
| **Web Crypto API** | Native browser cryptography |

### Backend
| Technology | Purpose |
|------------|---------|
| **Node.js 18+** | JavaScript runtime |
| **Express.js** | REST API framework |
| **MongoDB** | Document database |
| **Mongoose** | ODM for MongoDB |
| **JWT + Redis** | Short-lived access cookies + rotating refresh tokens |
| **Google Auth Library** | OAuth 2.0 verification |
| **Multer** | File upload handling |
| **PeerJS Server** | WebRTC signaling |

---

## 🔐 Cryptographic Design

### Key Hierarchy

```
User Registration
        │
        ▼
┌───────────────────────────────────────┐
│     CLIENT-SIDE KEY GENERATION        │
├───────────────────────────────────────┤
│                                       │
│  ┌─────────────────────────────────┐  │
│  │    ENCRYPTION KEY PAIR          │  │
│  │    (RSA-OAEP 2048-bit)          │  │
│  │                                 │  │
│  │  • Public Key → Server (DB)     │  │
│  │  • Private Key → User Download  │  │
│  └─────────────────────────────────┘  │
│                                       │
│  ┌─────────────────────────────────┐  │
│  │    SIGNING KEY PAIR             │  │
│  │    (RSA-PSS 2048-bit)           │  │
│  │                                 │  │
│  │  • Public Key → Server (DB)     │  │
│  │  • Private Key → User Download  │  │
│  └─────────────────────────────────┘  │
│                                       │
└───────────────────────────────────────┘
```

### File Encryption Flow

```
SENDER                                            RECEIVER
  │                                                   │
  │  1. Select File                                   │
  │  2. Generate AES-256 Key + Nonce                  │
  │  3. Encrypt File with AES-256-GCM                 │
  │         │                                         │
  │         ▼                                         │
  │  ┌─────────────────┐                              │
  │  │ Encrypted File  │──────────┐                   │
  │  └─────────────────┘          │                   │
  │                               │                   │
  │  4. Encrypt AES Key with      │                   │
  │     Receiver's RSA Public Key │                   │
  │         │                     │                   │
  │         ▼                     │                   │
  │  ┌─────────────────┐          │                   │
  │  │ Encrypted Key   │──────────┤                   │
  │  └─────────────────┘          │                   │
  │                               │                   │
  │  5. Sign Hash with            │                   │
  │     Sender's RSA Private Key  │                   │
  │         │                     │                   │
  │         ▼                     │                   │
  │  ┌─────────────────┐          │                   │
  │  │   Signature     │──────────┤                   │
  │  └─────────────────┘          │                   │
  │                               │                   │
  │                               ▼                   │
  │                        ┌─────────────┐            │
  │                        │   SERVER    │            │
  │                        │  (MongoDB)  │            │
  │                        └─────────────┘            │
  │                               │                   │
  │                               ▼                   │
  │                    6. Download Package            │
  │                               │                   │
  │                               │     7. Verify Signature
  │                               │        with Sender's Public Key
  │                               │            │
  │                               │            ▼
  │                               │     8. Decrypt AES Key
  │                               │        with Private Key
  │                               │            │
  │                               │            ▼
  │                               │     9. Decrypt File
  │                               │        with AES Key
  │                               │            │
  │                               │            ▼
  │                               │     ┌─────────────┐
  │                               └────▶│ Plain File  │
  │                                     └─────────────┘
```

### Private Key Storage Strategy

```
┌─────────────────────────────────────────────────────────┐
│                  KEY STORAGE MODEL                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  INDEXEDDB (Persistent)         SESSION MEMORY (Temp)   │
│  ┌───────────────────┐          ┌───────────────────┐   │
│  │  • Encryption     │          │  • Encryption     │   │
│  │    Public Key     │          │    Private Key    │   │
│  │                   │          │                   │   │
│  │  • Signing        │          │  • Signing        │   │
│  │    Public Key     │          │    Private Key    │   │
│  └───────────────────┘          └───────────────────┘   │
│                                         ▲               │
│                                         │               │
│                              User imports from          │
│                              downloaded .pem file       │
│                                                         │
│  ⚠️  Private keys NEVER persist in browser storage      │
│  ⚠️  Private keys cleared on tab close/logout           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ 
- **MongoDB** (local or Atlas)
- **Google Cloud Console** project with OAuth 2.0 credentials

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/fluxion.git
cd fluxion
```

### 2. Setup Backend (Hybrid API)

```bash
cd backend-hybrid
npm install
```

Create `.env` file:
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/fluxion
JWT_SECRET=your-super-secret-jwt-key
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
FRONTEND_URL=http://localhost:5173
```

Start the server:
```bash
npm run dev
```

### 3. Setup Backend (WebRTC Signaling)

```bash
cd backend-webrtc
npm install
npm run dev
```

Server runs on port `9000` by default.

### 4. Setup Frontend

```bash
cd frontend-complete
npm install
```

Create `.env` file:
```env
VITE_API_BASE_URL=http://localhost:3000
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
VITE_WEBRTC_HOST=localhost
VITE_WEBRTC_PORT=9000
```

Start the development server:
```bash
npm run dev
```

### 5. Open in Browser

Navigate to `http://localhost:5173` 🎉

---

## 📡 API Reference

### Authentication

#### `POST /v1/auth/google`
Authenticate with Google OAuth credential.

**Request:**
```json
{
  "credential": "google-id-token"
}
```

**Response:**
```json
{
  "isNewUser": true,
  "userId": "user-mongo-id"
}
```

The server sets `accessToken` and `refreshToken` as httpOnly cookies.

---

### Users

#### `POST /v1/users/public-key`
Upload user's public keys (registration).

**Auth:** httpOnly cookies (`credentials: include`)

**Request:**
```json
{
  "publicKey": "{\"encryption\":\"base64...\",\"signing\":\"base64...\"}"
}
```

#### `GET /v1/users/public-key?email=user@example.com`
Get receiver's public key.

**Auth:** httpOnly cookies (`credentials: include`)

**Response:**
```json
{
  "userId": "receiver-mongo-id",
  "publicKey": "{\"encryption\":\"base64...\",\"signing\":\"base64...\"}"
}
```

---

### Files

#### `POST /v1/files/send`
Upload encrypted file.

**Auth:** httpOnly cookies (`credentials: include`)

**Body:** `multipart/form-data`
- `file` - Encrypted file blob
- `receiverId` - Recipient user ID
- `encryptedAESKey` - RSA-encrypted AES key (base64)
- `nonce` - AES-GCM IV (base64)
- `authTag` - AES-GCM auth tag (base64)
- `signature` - RSA-PSS signature (base64)
- `senderPublicKey` - Sender's signing public key

#### `GET /v1/files/inbox?limit=20&before=<cursor>`
List received files.

**Auth:** httpOnly cookies (`credentials: include`)

**Response:**
```json
{
  "files": [
    {
      "fileId": "file-mongo-id",
      "fileName": "document.pdf",
      "senderEmail": "sender@example.com",
      "uploadedAt": "2026-01-10T12:00:00Z"
    }
  ],
  "hasMore": false,
  "nextCursor": null
}
```

#### `GET /v1/files/download/:fileId`
Download encrypted file with metadata.

**Auth:** httpOnly cookies (`credentials: include`)

**Response:**
```json
{
  "downloadUrl": "https://signed-object-url",
  "encryptedAESKey": "base64...",
  "nonce": "base64...",
  "authTag": "base64...",
  "signature": "base64...",
  "senderPublicKey": "base64...",
  "fileName": "document.pdf"
}
```

---

## 📊 Workflow Diagrams

### Permanent Share Flow

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  User   │     │ Frontend│     │ Backend │     │ MongoDB │
└────┬────┘     └────┬────┘     └────┬────┘     └────┬────┘
     │               │               │               │
     │  Select File  │               │               │
     │──────────────▶│               │               │
     │               │               │               │
     │               │ Encrypt File  │               │
     │               │ (AES-256-GCM) │               │
     │               │               │               │
     │               │ Encrypt Key   │               │
     │               │ (RSA-OAEP)    │               │
     │               │               │               │
     │               │ Sign Data     │               │
     │               │ (RSA-PSS)     │               │
     │               │               │               │
     │               │  POST /files  │               │
     │               │──────────────▶│               │
     │               │               │    Store      │
     │               │               │──────────────▶│
     │               │               │               │
     │               │   Success     │               │
     │◀──────────────│◀──────────────│               │
     │               │               │               │
```

### Temporary Share Flow (P2P)

```
┌─────────┐                              ┌─────────┐
│ Sender  │                              │Receiver │
└────┬────┘                              └────┬────┘
     │                                        │
     │  Start Session                         │
     │  (Get Peer ID: 123456)                 │
     │                                        │
     │         Share Peer ID                  │
     │───────────────────────────────────────▶│
     │                                        │
     │                          Enter Peer ID │
     │◀───────────────────────────────────────│
     │                                        │
     │         WebRTC Connection              │
     │◀══════════════════════════════════════▶│
     │         (via PeerJS Server)            │
     │                                        │
     │  Select File                           │
     │                                        │
     │         Direct P2P Transfer            │
     │═══════════════════════════════════════▶│
     │         (No server storage)            │
     │                                        │
     │                            File Saved  │
     │                                        │
```

---

## 🔒 Security Model

### Threat Model

| Threat | Mitigation |
|--------|------------|
| Server compromise | Zero-knowledge encryption - server only stores ciphertext |
| Man-in-the-middle | TLS + WebRTC DTLS encryption |
| Key theft | Private keys never leave client, session-only storage |
| Sender impersonation | RSA-PSS digital signatures |
| Data tampering | AES-GCM authenticated encryption |
| Brute force | 2048-bit RSA, 256-bit AES |

### What We Can't See

- ❌ Original file content
- ❌ File names (encrypted)
- ❌ Private keys
- ❌ P2P transfer content

### What We Store

- ✅ Encrypted file blobs
- ✅ Encrypted AES keys
- ✅ Public keys
- ✅ User emails (for lookup)
- ✅ Cryptographic metadata (nonce, auth tag, signature)

---

## 🧪 Testing

```bash
# Frontend tests
cd frontend-complete
npm run lint

# Backend tests (if available)
cd backend-hybrid
npm test
```

---

## 🚀 Deployment

### Environment Variables (Production)

**Backend:**
```env
PORT=3000
MONGODB_URI=<mongo-connection-string>
JWT_SECRET=<64-byte-random-secret>
GOOGLE_CLIENT_ID=<google-oauth-client-id>
FRONTEND_URL=https://your-frontend-domain.com
REDIS_URL=<redis-url>
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-key>
SUPABASE_STORAGE_BUCKET=<supabase-storage-bucket>
```

**Frontend:**
```env
VITE_API_BASE_URL=https://your-backend-domain.com
VITE_GOOGLE_CLIENT_ID=your-production-google-client-id
VITE_WEBRTC_HOST=your-webrtc-server.com
```

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👥 Team

Built with ❤️ for the hackathon by the Fluxion Team.

---

<div align="center">

**⚡ Fluxion - Share Files Your Way ⚡**

[Report Bug](https://github.com/your-username/fluxion/issues) • [Request Feature](https://github.com/your-username/fluxion/issues)

</div>
