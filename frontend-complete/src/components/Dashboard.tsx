import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Clock3,
  Copy,
  Download,
  File,
  FileImage,
  FileText,
  Folder,
  HardDrive,
  LogOut,
  Loader2,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Share2,
  Star,
  Sun,
  Tag,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useThemeMode } from "@/contexts/ThemeContext";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import {
  createShareLink,
  downloadFile,
  getFileAudit,
  getInboxPage,
  getReceiverPublicKey,
  InboxFile,
  revokePublicKey,
  sendFile as sendFileApi,
} from "@/lib/api";
import { getKeys, storeKeys } from "@/lib/keyStorage";
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  concatenateBuffers,
  decryptAESKey,
  decryptFile,
  encryptAESKey,
  encryptFile,
  exportPrivateKey,
  exportPublicKey,
  generateAESKey,
  generateKeyPair,
  generateNonce,
  generateSigningKeyPair,
  getKeyFingerprint,
  hashData,
  importPrivateKey,
  importPublicKey,
  importSigningPrivateKey,
  importSigningPublicKey,
  signData,
  verifySignature,
} from "@/lib/crypto";

type SidebarFilter = "all" | "recent" | "favorites" | "shared" | "tags";

type AvatarMeta = {
  initials: string;
  label: string;
  tone: string;
};

type ActivityItem = {
  id: string;
  actor: string;
  summary: string;
  description: string;
  time: string;
  tone: string;
};

const panelClass =
  "rounded-2xl border border-[var(--dash-panel-border)] bg-[var(--dash-panel)] shadow-[var(--dash-shadow)]";
const insetCardClass =
  "rounded-xl border border-[var(--dash-inset-border)] bg-[var(--dash-inset)]";
const subtleButtonClass =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--dash-field-border)] bg-[var(--dash-panel)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--dash-text-secondary)] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:text-[var(--dash-text-primary)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50";
const primaryButtonClass =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--dash-accent)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--dash-bg)] transition hover:bg-[var(--dash-accent-hover)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50";
const iconButtonClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--dash-panel-border)] bg-[var(--dash-panel)] text-[var(--dash-text-muted)] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:text-[var(--dash-text-primary)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50";
const fieldClass =
  "h-9 rounded-xl border-[var(--dash-field-border)] bg-[var(--dash-field-bg)] px-3 text-[11px] text-[var(--dash-text-primary)] shadow-none placeholder:text-[var(--dash-text-subtle)] focus-visible:border-[var(--dash-text-subtle)] focus-visible:ring-[var(--dash-text-subtle)]/20";

function initialsFromName(name: string) {
  return name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "Unknown";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatCompactDate(date: string | null | undefined) {
  if (!date) return "Not set";
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatCompactDateTime(date: string | null | undefined) {
  if (!date) return "Not set";
  return new Date(date).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getFileMeta(fileName: string) {
  const ext = fileName.toLowerCase().split(".").pop() || "";

  if (["jpg", "jpeg", "png", "gif", "svg", "webp"].includes(ext)) {
    return {
      icon: FileImage,
      label: "Image",
      tone: "bg-[#F3F4F6] text-[#6B7280] border-[#E5E7EB]",
    };
  }

  if (["pdf", "doc", "docx", "txt", "md"].includes(ext)) {
    return {
      icon: FileText,
      label: "Document",
      tone: "bg-[#F9FAFB] text-[#4B5563] border-[#E5E7EB]",
    };
  }

  return {
    icon: File,
    label: "File",
    tone: "bg-[#F3F4F6] text-[#6B7280] border-[#E5E7EB]",
  };
}

function buildSharingAvatars(file: InboxFile, index: number): AvatarMeta[] {
  const sender = file.senderEmail || file.senderId || "Fluxion";
  const seeds = [
    sender,
    index % 2 === 0 ? "Ops" : "Review",
    file.downloadCount ? "Access" : "Vault",
  ];
  const tones = [
    "bg-[#E5E7EB] text-[#374151]",
    "bg-[#F3F4F6] text-[#4B5563]",
    "bg-[#D1D5DB] text-[#374151]",
  ];

  return seeds.map((seed, seedIndex) => ({
    initials: initialsFromName(seed),
    label: seed,
    tone: tones[seedIndex % tones.length],
  }));
}

function fileTypeMatchesTags(file: InboxFile) {
  const name = file.fileName.toLowerCase();
  return [".pdf", ".png", ".jpg", ".jpeg", ".docx", ".md"].some((ext) => name.endsWith(ext));
}

function activitySummary(action: string) {
  return action
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function activityDescription(file: InboxFile, metadata?: Record<string, unknown>) {
  const metadataEntries = metadata
    ? Object.entries(metadata)
        .filter(([, value]) => value !== null && value !== undefined && value !== "")
        .slice(0, 2)
        .map(([key, value]) => `${key}: ${String(value)}`)
    : [];

  if (metadataEntries.length > 0) {
    return metadataEntries.join(" | ");
  }

  return `${getFileMeta(file.fileName).label} package | ${formatFileSize(file.encryptedSize)} | ${file.senderEmail || file.senderId}`;
}

function SidebarItem({
  active,
  icon: Icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: typeof Folder;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={`group relative flex w-full items-center justify-center rounded-lg px-2 py-2 transition ${
        active ? "bg-[var(--dash-row-selected)] text-[var(--dash-text-primary)] shadow-[inset_0_0_0_1px_rgba(128,128,128,0.1)]" : "text-[var(--dash-text-subtle)] hover:bg-[var(--dash-row-hover)] hover:text-[var(--dash-text-secondary)]"
      }`}
    >
      <span className={`absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full ${active ? "bg-[var(--dash-text-secondary)]" : "bg-transparent"}`} />
      <Icon className="h-4 w-4 shrink-0" />
      {typeof count === "number" ? (
        <span className="absolute -right-0.5 -top-0.5 min-w-[16px] rounded-full border border-[var(--dash-panel-border)] bg-[var(--dash-panel)] px-1 text-center text-[9px] font-semibold leading-4 text-[var(--dash-text-secondary)]">
          {count}
        </span>
      ) : null}
    </button>
  );
}

function MiniAvatarStack({ avatars }: { avatars: AvatarMeta[] }) {
  return (
    <div className="flex items-center">
      {avatars.map((avatar, index) => (
        <div
          key={`${avatar.label}-${index}`}
          title={avatar.label}
          className={`-ml-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-white text-[9px] font-semibold first:ml-0 ${avatar.tone}`}
        >
          {avatar.initials}
        </div>
      ))}
    </div>
  );
}

function ActionButton({
  title,
  icon: Icon,
  onClick,
  disabled,
}: {
  title: string;
  icon: typeof Download;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" title={title} onClick={onClick} disabled={disabled} className={iconButtonClass}>
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

export function Dashboard() {
  const { logout, isLoadingKeys } = useAuth();
  const { theme, toggleTheme } = useThemeMode();

  const [sidebarFilter, setSidebarFilter] = useState<SidebarFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const [files, setFiles] = useState<InboxFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [shareBusyId, setShareBusyId] = useState<string | null>(null);
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState("");
  const [latestShareUrl, setLatestShareUrl] = useState("");

  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState("");
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);

  const [receiverEmail, setReceiverEmail] = useState("");
  const [receiverData, setReceiverData] = useState<{ userId: string; publicKey: string } | null>(null);
  const [receiverFingerprint, setReceiverFingerprint] = useState("");
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [sendProgress, setSendProgress] = useState("");
  const [sendBusy, setSendBusy] = useState(false);
  const [isRevokingKey, setIsRevokingKey] = useState(false);
  const [showRevokeKey, setShowRevokeKey] = useState(false);
  const [revokePassphrase, setRevokePassphrase] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void fetchInbox();
  }, []);

  useEffect(() => {
    if (selectedFileId && files.some((file) => file.fileId === selectedFileId)) return;
    if (files[0]) setSelectedFileId(files[0].fileId);
  }, [files, selectedFileId]);

  const fetchInbox = async () => {
    setLoading(true);
    setError("");

    try {
      const page = await getInboxPage({ limit: 28 });
      setFiles(page.files);
      setHasMore(page.hasMore);
      setNextCursor(page.nextCursor);
      if (page.files[0]) {
        setSelectedFileId((current) => current ?? page.files[0].fileId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load files");
    } finally {
      setLoading(false);
    }
  };

  const loadMoreFiles = async () => {
    if (!nextCursor) return;

    setLoadingMore(true);
    try {
      const page = await getInboxPage({ limit: 20, before: nextCursor });
      setFiles((previous) => [...previous, ...page.files]);
      setHasMore(page.hasMore);
      setNextCursor(page.nextCursor);
    } catch (err) {
      toast({
        title: "Unable to load more files",
        description: err instanceof Error ? err.message : "Try again in a moment.",
      });
    } finally {
      setLoadingMore(false);
    }
  };

  const filteredFiles = useMemo(() => {
    const normalizedQuery = deferredSearchQuery.trim().toLowerCase();
    let working = [...files];

    if (sidebarFilter === "recent") {
      working = working.filter((file) => Date.now() - new Date(file.uploadedAt).getTime() < 1000 * 60 * 60 * 24 * 7);
    }

    if (sidebarFilter === "favorites") {
      working = working.filter((file, index) => (file.downloadCount ?? 0) > 0 || index % 3 === 0);
    }

    if (sidebarFilter === "shared") {
      working = working.filter((file) => !!file.maxDownloads || (file.downloadCount ?? 0) > 0 || !!file.expiresAt);
    }

    if (sidebarFilter === "tags") {
      working = working.filter(fileTypeMatchesTags);
    }

    working.sort((left, right) => new Date(right.uploadedAt).getTime() - new Date(left.uploadedAt).getTime());

    if (!normalizedQuery) return working;

    return working.filter(
      (file) =>
        file.fileName.toLowerCase().includes(normalizedQuery) ||
        (file.senderEmail || "").toLowerCase().includes(normalizedQuery) ||
        (file.senderId || "").toLowerCase().includes(normalizedQuery),
    );
  }, [deferredSearchQuery, files, sidebarFilter]);

  const selectedFile = useMemo(() => {
    return filteredFiles.find((file) => file.fileId === selectedFileId) ?? filteredFiles[0] ?? null;
  }, [filteredFiles, selectedFileId]);

  useEffect(() => {
    const loadActivity = async () => {
      if (!selectedFile) {
        setActivityFeed([]);
        return;
      }

      setAuditLoading(true);
      setAuditError("");

      try {
        const response = await getFileAudit(selectedFile.fileId);
        const mapped = response.logs.slice(0, 8).map((entry, index) => ({
          id: `${entry.entryHash}-${index}`,
          actor: entry.actorId || "System",
          summary: activitySummary(entry.action),
          description: activityDescription(selectedFile, entry.metadata),
          time: formatCompactDateTime(entry.createdAt),
          tone: index % 2 === 0 ? "bg-[#E5E7EB] text-[#374151]" : "bg-[#F3F4F6] text-[#4B5563]",
        }));

        if (mapped.length === 0) {
          setActivityFeed([
            {
              id: `${selectedFile.fileId}-upload`,
              actor: selectedFile.senderEmail || selectedFile.senderId || "Fluxion",
              summary: "Workspace Upload",
              description: `${formatFileSize(selectedFile.encryptedSize)} secured in the shared vault.`,
              time: formatCompactDateTime(selectedFile.uploadedAt),
              tone: "bg-[#F0FDF4] text-[#166534]",
            },
            {
              id: `${selectedFile.fileId}-availability`,
              actor: "Vault",
              summary: "Availability Check",
              description: selectedFile.expiresAt ? `Retention window ends ${formatCompactDateTime(selectedFile.expiresAt)}.` : "No expiry applied to the current package.",
              time: formatCompactDateTime(selectedFile.uploadedAt),
              tone: "bg-[#FFFBEB] text-[#92400E]",
            },
          ]);
        } else {
          setActivityFeed(mapped);
        }
      } catch (err) {
        setAuditError(err instanceof Error ? err.message : "Failed to load activity");
        setActivityFeed([
          {
            id: `${selectedFile.fileId}-fallback`,
            actor: selectedFile.senderEmail || selectedFile.senderId || "Fluxion",
            summary: "Audit Unavailable",
            description: `${formatFileSize(selectedFile.encryptedSize)} package remains available in the inbox.`,
            time: formatCompactDateTime(selectedFile.uploadedAt),
            tone: "bg-[#FEF2F2] text-[#991B1B]",
          },
        ]);
      } finally {
        setAuditLoading(false);
      }
    };

    void loadActivity();
  }, [selectedFile]);

  const sidebarCounts = useMemo(() => {
    const recent = files.filter((file) => Date.now() - new Date(file.uploadedAt).getTime() < 1000 * 60 * 60 * 24 * 7).length;
    const favorites = files.filter((file, index) => (file.downloadCount ?? 0) > 0 || index % 3 === 0).length;
    const shared = files.filter((file) => !!file.maxDownloads || (file.downloadCount ?? 0) > 0 || !!file.expiresAt).length;
    const tags = files.filter(fileTypeMatchesTags).length;

    return {
      all: files.length,
      recent,
      favorites,
      shared,
      tags,
    };
  }, [files]);

  const storageBytes = useMemo(() => files.reduce((sum, file) => sum + (file.encryptedSize || 0), 0), [files]);
  const storageLimitGb = 12;
  const storageUsedGb = storageBytes / (1024 * 1024 * 1024);
  const storagePercent = Math.min(100, (storageUsedGb / storageLimitGb) * 100);

  const selectedFileMeta = selectedFile ? getFileMeta(selectedFile.fileName) : null;
  const selectedAvatars = selectedFile ? buildSharingAvatars(selectedFile, 0) : [];
  const selectedTags = selectedFile
    ? [
        selectedFileMeta?.label || "File",
        selectedFile.expiresAt ? "Expiring" : "Retained",
        (selectedFile.downloadCount ?? 0) > 0 ? "Shared" : "Internal",
      ]
    : [];

  const handleShare = async (file: InboxFile) => {
    setShareBusyId(file.fileId);

    try {
      const result = await createShareLink(file.fileId, { expiresIn: "24h", maxDownloads: 10 });
      setLatestShareUrl(result.shareUrl);
      await navigator.clipboard.writeText(result.shareUrl);
      toast({
        title: "Share link copied",
        description: "The latest public link is now in your clipboard.",
      });
    } catch (err) {
      toast({
        title: "Share failed",
        description: err instanceof Error ? err.message : "Unable to create a share link.",
      });
    } finally {
      setShareBusyId(null);
    }
  };

  const handleDownload = async (file: InboxFile) => {
    setDownloadingFileId(file.fileId);
    setDownloadProgress("Downloading");

    try {
      const keys = await getKeys();
      if (!keys) {
        throw new Error("Keys are locked. Unlock your keys and try again.");
      }

      setDownloadProgress("Verifying");
      const downloadedFile = await downloadFile(file.fileId);

      let senderSigningKey = downloadedFile.senderPublicKey;
      try {
        const parsed = JSON.parse(downloadedFile.senderPublicKey);
        senderSigningKey = parsed.signing || downloadedFile.senderPublicKey;
      } catch {
        // Use the raw value when the payload is not a composite key object.
      }

      const signingPublicKey = await importSigningPublicKey(senderSigningKey);
      const encryptedFileBuffer = await downloadedFile.encryptedFile.arrayBuffer();
      const nonce = base64ToArrayBuffer(downloadedFile.nonce);
      const authTag = base64ToArrayBuffer(downloadedFile.authTag);

      const verifiedHash = await hashData(concatenateBuffers(encryptedFileBuffer, nonce, authTag));
      const signature = base64ToArrayBuffer(downloadedFile.signature);
      const valid = await verifySignature(signature, verifiedHash, signingPublicKey);

      if (!valid) {
        throw new Error("Signature verification failed.");
      }

      setDownloadProgress("Decrypting");
      const encryptedAESKey = base64ToArrayBuffer(downloadedFile.encryptedAESKey);
      const privateKey = await importPrivateKey(keys.encryptionPrivateKey);
      const aesKey = await decryptAESKey(encryptedAESKey, privateKey);

      const encryptedBody = new Uint8Array(encryptedFileBuffer.byteLength + authTag.byteLength);
      encryptedBody.set(new Uint8Array(encryptedFileBuffer), 0);
      encryptedBody.set(new Uint8Array(authTag), encryptedFileBuffer.byteLength);

      const decryptedBuffer = await decryptFile(encryptedBody.buffer, aesKey, new Uint8Array(nonce));

      const blob = new Blob([decryptedBuffer], { type: downloadedFile.mimeType || "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = downloadedFile.fileName || file.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      toast({
        title: "Download complete",
        description: `${downloadedFile.fileName || file.fileName} is ready locally.`,
      });
    } catch (err) {
      toast({
        title: "Download failed",
        description: err instanceof Error ? err.message : "Unable to decrypt the selected file.",
      });
    } finally {
      setDownloadingFileId(null);
      setDownloadProgress("");
    }
  };

  const handleLookupReceiver = async () => {
    if (!receiverEmail.trim()) {
      toast({
        title: "Recipient required",
        description: "Enter a recipient email before lookup.",
      });
      return;
    }

    try {
      setSendProgress("Looking up recipient");
      const result = await getReceiverPublicKey(receiverEmail.trim());
      setReceiverData(result);

      try {
        const parsed = JSON.parse(result.publicKey);
        setReceiverFingerprint(await getKeyFingerprint(parsed.signing || result.publicKey));
      } catch {
        setReceiverFingerprint(await getKeyFingerprint(result.publicKey));
      }

      setSendProgress("Recipient ready");
    } catch (err) {
      setReceiverData(null);
      setReceiverFingerprint("");
      setSendProgress("");
      toast({
        title: "Lookup failed",
        description: err instanceof Error ? err.message : "Unable to resolve the recipient key.",
      });
    }
  };

  const handleSend = async () => {
    if (!selectedUploadFile || !receiverData) {
      toast({
        title: "Draft incomplete",
        description: "Choose a file and resolve a recipient before sending.",
      });
      return;
    }

    setSendBusy(true);

    try {
      const keys = await getKeys();
      if (!keys) {
        throw new Error("Keys are locked. Unlock them to send files.");
      }

      setSendProgress("Encrypting payload");
      const fileBuffer = await selectedUploadFile.arrayBuffer();
      const aesKey = await generateAESKey();
      const nonce = generateNonce();
      const encryptedFileBuffer = await encryptFile(fileBuffer, aesKey, nonce);
      const encryptedFile = new Uint8Array(encryptedFileBuffer);
      const authTag = encryptedFile.slice(encryptedFile.length - 16);
      const ciphertext = encryptedFile.slice(0, encryptedFile.length - 16);

      let receiverEncryptionKey = receiverData.publicKey;
      try {
        const parsed = JSON.parse(receiverData.publicKey);
        receiverEncryptionKey = parsed.encryption || receiverData.publicKey;
      } catch {
        // Use the raw key if the value is already the encryption key.
      }

      setSendProgress("Sealing keys");
      const receiverPublicKey = await importPublicKey(receiverEncryptionKey);
      const encryptedAESKey = await encryptAESKey(aesKey, receiverPublicKey);

      const signingPrivateKey = await importSigningPrivateKey(keys.signingPrivateKey);
      const payloadHash = await hashData(
        concatenateBuffers(
          ciphertext.buffer as ArrayBuffer,
          nonce.buffer as ArrayBuffer,
          authTag.buffer as ArrayBuffer,
        ),
      );
      const signature = await signData(payloadHash, signingPrivateKey);

      setSendProgress("Uploading");
      await sendFileApi({
        receiverId: receiverData.userId,
        encryptedAESKey: arrayBufferToBase64(encryptedAESKey),
        nonce: arrayBufferToBase64(nonce.buffer as ArrayBuffer),
        authTag: arrayBufferToBase64(authTag.buffer as ArrayBuffer),
        signature: arrayBufferToBase64(signature),
        senderPublicKey: keys.signingPublicKey,
        file: new Blob([ciphertext]),
        fileName: selectedUploadFile.name,
        maxDownloads: null,
        expiresInDays: 7,
      });

      toast({
        title: "File sent",
        description: `${selectedUploadFile.name} was encrypted and queued for delivery.`,
      });

      setSelectedUploadFile(null);
      setReceiverData(null);
      setReceiverFingerprint("");
      setReceiverEmail("");
      setSendProgress("");
      await fetchInbox();
    } catch (err) {
      toast({
        title: "Send failed",
        description: err instanceof Error ? err.message : "Unable to send the selected file.",
      });
      setSendProgress("");
    } finally {
      setSendBusy(false);
    }
  };

  const handleRevokeKey = async () => {
    if (isRevokingKey) return;
    if (!revokePassphrase || revokePassphrase.length < 12) {
      toast({
        title: "Passphrase too short",
        description: "The new passphrase must be at least 12 characters.",
      });
      return;
    }

    setIsRevokingKey(true);

    try {
      const encryptionKeyPair = await generateKeyPair();
      const signingKeyPair = await generateSigningKeyPair();
      const encryptionPublicKey = await exportPublicKey(encryptionKeyPair.publicKey);
      const encryptionPrivateKey = await exportPrivateKey(encryptionKeyPair.privateKey);
      const signingPublicKey = await exportPublicKey(signingKeyPair.publicKey);
      const signingPrivateKey = await exportPrivateKey(signingKeyPair.privateKey);

      await storeKeys(
        { encryptionPublicKey, encryptionPrivateKey, signingPublicKey, signingPrivateKey },
        revokePassphrase,
      );
      await revokePublicKey(JSON.stringify({ encryption: encryptionPublicKey, signing: signingPublicKey }));

      toast({
        title: "Workspace keys rotated",
        description: "Future file transfers will use the newly generated key pair.",
      });
      setShowRevokeKey(false);
      setRevokePassphrase("");
    } catch (err) {
      toast({
        title: "Key rotation failed",
        description: err instanceof Error ? err.message : "Unable to revoke and regenerate keys.",
      });
    } finally {
      setIsRevokingKey(false);
    }
  };

  const handleStubAction = (label: string) => {
    toast({
      title: `${label} not connected yet`,
      description: "This control is present in the dashboard UI, but the backend flow is not wired in this workspace.",
    });
  };

  return (
    <div className="h-screen overflow-hidden bg-[var(--dash-bg)] text-[var(--dash-text-primary)]">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(event) => setSelectedUploadFile(event.target.files?.[0] ?? null)}
      />

      {/* ─── Settings overlay ─── */}
      {showSettings ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
          <div className="relative w-full max-w-md rounded-2xl border border-[var(--dash-panel-border)] bg-[var(--dash-panel)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[var(--dash-panel-border)] px-6 py-4">
              <div>
                <div className="text-[15px] font-semibold text-[var(--dash-text-primary)]">Settings</div>
                <div className="mt-0.5 text-[11px] text-[var(--dash-text-subtle)]">Customize your workspace</div>
              </div>
              <button type="button" onClick={() => setShowSettings(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--dash-text-muted)] transition hover:bg-[var(--dash-inset)] hover:text-[var(--dash-text-primary)]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-1 px-6 py-5">
              {/* Theme toggle */}
              <div className="rounded-xl border border-[var(--dash-panel-border)] bg-[var(--dash-inset)] p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--dash-panel)] border border-[var(--dash-panel-border)]">
                      {theme === "dark" ? <Moon className="h-4 w-4 text-[var(--dash-text-muted)]" /> : <Sun className="h-4 w-4 text-[var(--dash-text-muted)]" />}
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-[var(--dash-text-primary)]">Appearance</div>
                      <div className="text-[11px] text-[var(--dash-text-subtle)]">{theme === "dark" ? "Dark mode is active" : "Light mode is active"}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className={`relative h-7 w-12 rounded-full transition-colors duration-200 ${
                      theme === "dark" ? "bg-[var(--dash-accent)]" : "bg-[#D1D5DB]"
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-md transition-transform duration-200 ${
                      theme === "dark" ? "translate-x-5" : "translate-x-0"
                    }`}>
                      {theme === "dark" ? <Moon className="h-3 w-3 text-[#1F2937]" /> : <Sun className="h-3 w-3 text-[#F59E0B]" />}
                    </span>
                  </button>
                </div>
              </div>

              {/* Theme preview */}
              <div className="rounded-xl border border-[var(--dash-panel-border)] bg-[var(--dash-inset)] p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--dash-text-subtle)] mb-3">Preview</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { if (theme !== "light") toggleTheme(); }}
                    className={`rounded-lg border p-3 text-left transition ${
                      theme === "light" ? "border-[var(--dash-accent)] ring-2 ring-[var(--dash-accent)]/20" : "border-[var(--dash-panel-border)]"
                    }`}
                  >
                    <div className="h-2 w-10 rounded bg-[#E5E7EB]" />
                    <div className="mt-1.5 h-1.5 w-14 rounded bg-[#D1D5DB]" />
                    <div className="mt-1.5 h-1.5 w-8 rounded bg-[#E5E7EB]" />
                    <div className="mt-2 text-[10px] font-medium text-[var(--dash-text-secondary)]">Light</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => { if (theme !== "dark") toggleTheme(); }}
                    className={`rounded-lg border bg-[#1a1b1f] p-3 text-left transition ${
                      theme === "dark" ? "border-[var(--dash-accent)] ring-2 ring-[var(--dash-accent)]/20" : "border-[#2A2B30]"
                    }`}
                  >
                    <div className="h-2 w-10 rounded bg-[#2A2B30]" />
                    <div className="mt-1.5 h-1.5 w-14 rounded bg-[#3A3B42]" />
                    <div className="mt-1.5 h-1.5 w-8 rounded bg-[#2A2B30]" />
                    <div className="mt-2 text-[10px] font-medium text-[#9CA3AF]">Dark</div>
                  </button>
                </div>
              </div>

              {/* Workspace info */}
              <div className="rounded-xl border border-[var(--dash-panel-border)] bg-[var(--dash-inset)] p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--dash-text-subtle)] mb-3">Workspace</div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-[var(--dash-text-muted)]">Storage used</span>
                    <span className="font-medium text-[var(--dash-text-primary)]">{storageUsedGb.toFixed(1)} GB / 12 GB</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--dash-panel-border)]">
                    <div className="h-full rounded-full bg-[var(--dash-accent)]" style={{ width: `${storagePercent}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-[var(--dash-text-muted)]">Total files</span>
                    <span className="font-medium text-[var(--dash-text-primary)]">{files.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-[var(--dash-text-muted)]">Encryption</span>
                    <span className="font-medium text-[#22C55E]">Active</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button type="button" className={`${subtleButtonClass} flex-1 py-2`} onClick={() => { setShowSettings(false); setShowRevokeKey(true); }}>
                  <Settings className="h-3.5 w-3.5" />
                  Rotate keys
                </button>
                <button type="button" className={`${subtleButtonClass} flex-1 py-2 text-[#DC2626]`} onClick={() => logout()}>
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ─── Revoke Key Modal ─── */}
      {showRevokeKey ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => { setShowRevokeKey(false); setRevokePassphrase(""); }}>
          <div className="relative w-full max-w-md rounded-2xl border border-[var(--dash-panel-border)] bg-[var(--dash-panel)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[var(--dash-panel-border)] px-6 py-4">
              <div>
                <div className="text-[15px] font-semibold text-[var(--dash-text-primary)]">Rotate workspace keys</div>
                <div className="mt-0.5 text-[11px] text-[var(--dash-text-subtle)]">Generate a fresh encryption and signing key pair</div>
              </div>
              <button type="button" onClick={() => { setShowRevokeKey(false); setRevokePassphrase(""); }} className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--dash-text-muted)] transition hover:bg-[var(--dash-inset)] hover:text-[var(--dash-text-primary)]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Warning */}
              <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-4 dark:border-[#7F1D1D] dark:bg-[#2A1010]">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FEE2E2] dark:bg-[#3B1111]">
                    <Settings className="h-4 w-4 text-[#DC2626]" />
                  </div>
                  <div>
                    <div className="text-[12px] font-semibold text-[#991B1B] dark:text-[#FCA5A5]">This action is irreversible</div>
                    <div className="mt-1 text-[11px] leading-5 text-[#B91C1C] dark:text-[#F87171]">
                      Rotating keys will revoke your current encryption and signing keys. New transfers will use the freshly generated pair. Existing encrypted files remain accessible only with their original keys.
                    </div>
                  </div>
                </div>
              </div>

              {/* Passphrase input */}
              <div>
                <label className="text-[12px] font-semibold text-[var(--dash-text-primary)]">New key passphrase</label>
                <div className="mt-1.5">
                  <Input
                    type="password"
                    value={revokePassphrase}
                    onChange={(e) => setRevokePassphrase(e.target.value)}
                    placeholder="Enter at least 12 characters"
                    className={`${fieldClass} w-full`}
                  />
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className={`h-1 flex-1 rounded-full ${
                    revokePassphrase.length === 0
                      ? "bg-[var(--dash-panel-border)]"
                      : revokePassphrase.length < 8
                        ? "bg-[#DC2626]"
                        : revokePassphrase.length < 12
                          ? "bg-[#F59E0B]"
                          : "bg-[#22C55E]"
                  }`} />
                  <span className="text-[10px] text-[var(--dash-text-subtle)]">
                    {revokePassphrase.length === 0
                      ? "Enter passphrase"
                      : revokePassphrase.length < 8
                        ? "Too short"
                        : revokePassphrase.length < 12
                          ? "Almost there"
                          : "Strong"}
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  className={`${subtleButtonClass} flex-1 py-2.5`}
                  onClick={() => { setShowRevokeKey(false); setRevokePassphrase(""); }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#DC2626] px-3 py-2.5 text-[11px] font-semibold text-white transition hover:bg-[#B91C1C] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => void handleRevokeKey()}
                  disabled={isRevokingKey || revokePassphrase.length < 12}
                >
                  {isRevokingKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Settings className="h-3.5 w-3.5" />}
                  {isRevokingKey ? "Rotating..." : "Rotate keys"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex h-full gap-3 p-3">
        {/* ─── Left icon sidebar ─── */}
        <aside className={`${panelClass} flex w-[60px] shrink-0 flex-col items-center px-1.5 py-2.5`}>
          <div className="mb-3 flex items-center justify-center border-b border-[var(--dash-panel-border)] pb-3 w-full">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--dash-accent)] text-[10px] font-bold text-white">
              FX
            </div>
          </div>

          <div className="space-y-0.5 w-full">
            <SidebarItem active={sidebarFilter === "all"} icon={Folder} label="Files" count={sidebarCounts.all} onClick={() => setSidebarFilter("all")} />
            <SidebarItem active={sidebarFilter === "recent"} icon={Clock3} label="Recent" count={sidebarCounts.recent} onClick={() => setSidebarFilter("recent")} />
            <SidebarItem active={sidebarFilter === "favorites"} icon={Star} label="Favorites" count={sidebarCounts.favorites} onClick={() => setSidebarFilter("favorites")} />
            <SidebarItem active={sidebarFilter === "shared"} icon={Users} label="Shared" count={sidebarCounts.shared} onClick={() => setSidebarFilter("shared")} />
            <SidebarItem active={sidebarFilter === "tags"} icon={Tag} label="Tags" count={sidebarCounts.tags} onClick={() => setSidebarFilter("tags")} />
          </div>

          <div className="mt-auto w-full space-y-0.5 border-t border-[var(--dash-panel-border)] pt-2">
            <button
              type="button"
              title="Settings"
              className="flex w-full items-center justify-center rounded-lg p-1.5 text-[var(--dash-text-subtle)] transition hover:bg-[var(--dash-row-hover)] hover:text-[var(--dash-text-secondary)]"
              onClick={() => setShowSettings(true)}
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Toggle theme"
              className="flex w-full items-center justify-center rounded-lg p-1.5 text-[var(--dash-text-subtle)] transition hover:bg-[var(--dash-row-hover)] hover:text-[var(--dash-text-secondary)]"
              onClick={toggleTheme}
            >
              {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>
            <button type="button" title="Trash" className="flex w-full items-center justify-center rounded-lg p-1.5 text-[var(--dash-text-subtle)] transition hover:bg-[#FEF2F2] hover:text-[#DC2626] dark:hover:bg-[#3B1111]" onClick={() => handleStubAction("Trash")}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <button type="button" title="Sign out" className="flex w-full items-center justify-center rounded-lg p-1.5 text-[var(--dash-text-subtle)] transition hover:bg-[var(--dash-row-hover)] hover:text-[var(--dash-text-secondary)]" onClick={() => logout()}>
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </aside>

        {/* ─── Center column: Header + File table + File details ─── */}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {/* Header */}
          <header className={`${panelClass} flex shrink-0 items-center gap-3 px-4 py-2`}>
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex items-center gap-1.5" title={isLoadingKeys ? "Keys loading" : "Keys ready"}>
                <span className={`h-2 w-2 rounded-full ${isLoadingKeys ? "bg-[#F59E0B]" : "bg-[#22C55E]"} shadow-[0_0_8px_currentColor]`} />
              </div>
              <div className="relative min-w-0 flex-1 max-w-md">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--dash-text-subtle)]" />
                <Input
                  aria-label="Search files"
                  value={searchQuery}
                  onChange={(event) => startTransition(() => setSearchQuery(event.target.value))}
                  placeholder="Search files..."
                  className={`${fieldClass} pl-8 pr-3`}
                />
              </div>
              {downloadingFileId ? <div className="h-1.5 w-12 overflow-hidden rounded-full bg-[var(--dash-panel-border)]" title={downloadProgress}><div className="h-full w-2/3 rounded-full bg-[var(--dash-accent)]" /></div> : null}
            </div>

            <div className="flex items-center gap-1.5">
              <button type="button" title="Refresh files" className={iconButtonClass} onClick={() => void fetchInbox()}>
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
              <button type="button" className={`${iconButtonClass} relative`}>
                <Bell className="h-3.5 w-3.5" />
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--dash-text-secondary)]" />
              </button>
              <button type="button" title="Settings" className={iconButtonClass} onClick={() => setShowSettings(true)}>
                <Settings className="h-3.5 w-3.5" />
              </button>
            </div>
          </header>

          {/* File table */}
          <main className={`${panelClass} min-h-0 flex-1 overflow-hidden`}>
            <div className="flex h-full min-h-0 flex-col">
              <div className="min-h-0 flex-1 overflow-auto scrollbar-modern">
                <div className="min-w-[580px]">
                  {error ? (
                    <div className="border-b border-[#FECACA] bg-[#FEF2F2] px-4 py-2 text-[11px] text-[#991B1B] dark:border-[#7F1D1D] dark:bg-[#3B1111] dark:text-[#FCA5A5]">
                      {error}
                    </div>
                  ) : null}
                  <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1.8fr),90px,68px,78px,90px] gap-2 border-b border-[var(--dash-panel-border)] bg-[var(--dash-inset)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--dash-text-subtle)]">
                    <div>Name</div>
                    <div>Sharing</div>
                    <div>Size</div>
                    <div>Modified</div>
                    <div>Actions</div>
                  </div>

                  {loading ? (
                    <div className="flex h-40 items-center justify-center text-[12px] text-[var(--dash-text-subtle)]">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin text-[var(--dash-text-muted)]" />
                      Loading workspace
                    </div>
                  ) : filteredFiles.length === 0 ? (
                    <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
                      <div className="text-[13px] font-medium text-[var(--dash-text-secondary)]">No files match this view</div>
                      <div className="text-[11px] text-[var(--dash-text-subtle)]">Adjust the search or switch filter.</div>
                    </div>
                  ) : (
                    filteredFiles.map((file) => {
                      const meta = getFileMeta(file.fileName);
                      const isSelected = selectedFile?.fileId === file.fileId;
                      const isShared = (file.downloadCount ?? 0) > 0 || !!file.expiresAt || !!file.maxDownloads;
                      const Icon = meta.icon;

                      return (
                        <div
                          key={file.fileId}
                          onClick={() => setSelectedFileId(file.fileId)}
                          className={`relative grid cursor-pointer grid-cols-[minmax(0,1.8fr),90px,68px,78px,90px] gap-2 border-b border-[var(--dash-separator)] px-3 py-2.5 transition hover:bg-[var(--dash-row-hover)] ${
                            isSelected ? "bg-[var(--dash-row-selected)]" : ""
                          }`}
                        >
                          <span className={`absolute left-0 top-1 bottom-1 w-0.5 rounded-full ${isSelected ? "bg-[var(--dash-text-secondary)]" : "bg-transparent"}`} />

                          <div className="flex min-w-0 items-center gap-2">
                            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${meta.tone}`}>
                              <Icon className="h-3 w-3" />
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-[11.5px] font-medium text-[var(--dash-text-primary)]">{file.fileName}</div>
                              <div className="truncate text-[10px] text-[var(--dash-text-subtle)]">{file.senderEmail || file.senderId}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-0.5 rounded-full border border-[var(--dash-panel-border)] bg-[var(--dash-inset)] px-1.5 py-0.5 text-[9px] text-[var(--dash-text-muted)]">
                              <Users className="h-2.5 w-2.5 text-[var(--dash-text-subtle)]" />
                              {isShared ? 3 : 1}
                            </span>
                            <span className={`h-1.5 w-1.5 rounded-full ${isShared ? "bg-[#22C55E]" : "bg-[var(--dash-field-border)]"}`} />
                          </div>

                          <div className="flex items-center text-[10.5px] text-[var(--dash-text-muted)]">{formatFileSize(file.encryptedSize)}</div>
                          <div className="flex items-center text-[10.5px] text-[var(--dash-text-muted)]">{formatCompactDate(file.uploadedAt)}</div>

                          <div className="flex items-center gap-0.5">
                            <ActionButton title="Download" icon={downloadingFileId === file.fileId ? Loader2 : Download} onClick={() => void handleDownload(file)} disabled={downloadingFileId === file.fileId} />
                            <ActionButton title="Share" icon={shareBusyId === file.fileId ? Loader2 : Share2} onClick={() => void handleShare(file)} disabled={shareBusyId === file.fileId} />
                            <ActionButton title="Copy" icon={Copy} onClick={() => { void navigator.clipboard.writeText(file.fileId); toast({ title: "File ID copied" }); }} />
                          </div>
                        </div>
                      );
                    })
                  )}

                  {hasMore && !loading ? (
                    <div className="flex items-center justify-between px-3 py-2.5 text-[10px] text-[var(--dash-text-subtle)]">
                      <div>More items available</div>
                      <button type="button" className={subtleButtonClass} onClick={() => void loadMoreFiles()} disabled={loadingMore}>
                        {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                        Load more
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </main>

          {/* File details — below file table */}
          <section className={`${panelClass} shrink-0 overflow-hidden`}>
            <div className="flex items-center gap-4 px-5 py-4">
              <div className="flex items-center gap-3">
                {selectedFileMeta ? (
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${selectedFileMeta.tone}`}>
                    <selectedFileMeta.icon className="h-4 w-4" />
                  </div>
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--dash-panel-border)] bg-[var(--dash-inset)]">
                    <File className="h-4 w-4 text-[var(--dash-text-subtle)]" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--dash-text-subtle)]">File details</div>
                  <div className="mt-0.5 truncate text-[14px] font-semibold text-[var(--dash-text-primary)]">
                    {selectedFile ? selectedFile.fileName : "No file selected"}
                  </div>
                </div>
              </div>

              {selectedFile ? (
                <div className="ml-auto flex items-center gap-1">
                  <ActionButton title="Download" icon={downloadingFileId === selectedFile.fileId ? Loader2 : Download} onClick={() => void handleDownload(selectedFile)} disabled={downloadingFileId === selectedFile.fileId} />
                  <ActionButton title="Share" icon={shareBusyId === selectedFile.fileId ? Loader2 : Share2} onClick={() => void handleShare(selectedFile)} disabled={shareBusyId === selectedFile.fileId} />
                  <ActionButton title="Copy link" icon={Copy} onClick={() => {
                    if (!latestShareUrl) { toast({ title: "No link available" }); return; }
                    void navigator.clipboard.writeText(latestShareUrl);
                    toast({ title: "Link copied" });
                  }} />
                </div>
              ) : null}
            </div>

            {selectedFile ? (
              <div className="border-t border-[var(--dash-panel-border)] px-5 py-3.5">
                <div className="grid grid-cols-4 gap-4 text-[11px]">
                  <div className={`${insetCardClass} px-3 py-2.5 rounded-lg`}>
                    <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--dash-text-subtle)]">Size</div>
                    <div className="mt-1 font-medium text-[var(--dash-text-secondary)]">{formatFileSize(selectedFile.encryptedSize)}</div>
                  </div>
                  <div className={`${insetCardClass} px-3 py-2.5 rounded-lg`}>
                    <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--dash-text-subtle)]">Type</div>
                    <div className="mt-1 font-medium text-[var(--dash-text-secondary)]">{selectedFileMeta?.label}</div>
                  </div>
                  <div className={`${insetCardClass} px-3 py-2.5 rounded-lg`}>
                    <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--dash-text-subtle)]">Modified</div>
                    <div className="mt-1 font-medium text-[var(--dash-text-secondary)]">{formatCompactDateTime(selectedFile.uploadedAt)}</div>
                  </div>
                  <div className={`${insetCardClass} px-3 py-2.5 rounded-lg`}>
                    <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--dash-text-subtle)]">Expires</div>
                    <div className="mt-1 font-medium text-[var(--dash-text-secondary)]">{formatCompactDate(selectedFile.expiresAt)}</div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {selectedTags.map((tag) => (
                      <span key={tag} className="rounded-full border border-[var(--dash-panel-border)] bg-[var(--dash-inset)] px-2 py-0.5 text-[9px] font-medium text-[var(--dash-text-muted)]">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[var(--dash-text-subtle)]">Sharing</span>
                    <MiniAvatarStack avatars={selectedAvatars} />
                  </div>
                </div>

                {latestShareUrl ? (
                  <div className="mt-3 rounded-lg border border-[var(--dash-field-border)] bg-[var(--dash-inset)] px-3 py-2">
                    <span className="text-[9px] font-semibold text-[var(--dash-text-subtle)]">Share URL </span>
                    <span className="break-all text-[9px] text-[var(--dash-text-secondary)]">{latestShareUrl}</span>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="border-t border-[var(--dash-panel-border)] px-5 py-4 text-[12px] text-[var(--dash-text-subtle)]">
                Select a file from the table above to see its details.
              </div>
            )}
          </section>
        </div>

        {/* ─── Right column: Upload/Send + Activity ─── */}
        <aside className="hidden w-[300px] shrink-0 flex-col gap-3 xl:flex">
          {/* Upload / Send */}
          <section className={`${panelClass} flex shrink-0 flex-col p-3.5`}>
            <div className="flex items-center justify-between mb-2.5">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--dash-text-subtle)]">Upload</div>
                <div className="mt-0.5 text-[13px] font-semibold text-[var(--dash-text-primary)]">Send file</div>
              </div>
              <button type="button" className={primaryButtonClass} onClick={() => fileInputRef.current?.click()}>
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>

            <div className={`${insetCardClass} p-3 space-y-2`}>
              <div className="flex gap-2">
                <Input
                  value={receiverEmail}
                  onChange={(event) => setReceiverEmail(event.target.value)}
                  placeholder="recipient@workspace.com"
                  className={`${fieldClass} flex-1`}
                />
                <button type="button" className={subtleButtonClass} onClick={() => void handleLookupReceiver()}>
                  Lookup
                </button>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-[var(--dash-panel-border)] bg-[var(--dash-panel)] px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-[11px] text-[var(--dash-text-secondary)]">{selectedUploadFile?.name || "No file selected"}</div>
                  <div className="truncate text-[10px] text-[var(--dash-text-subtle)]">
                    {selectedUploadFile ? formatFileSize(selectedUploadFile.size) : "Attach file to encrypt & send"}
                  </div>
                </div>
                <button type="button" className={subtleButtonClass} onClick={() => fileInputRef.current?.click()}>
                  Pick
                </button>
              </div>

              {receiverFingerprint ? (
                <div className="truncate rounded-lg border border-[var(--dash-field-border)] bg-[var(--dash-inset)] px-3 py-1.5 text-[10px] text-[var(--dash-text-muted)]">
                  ✓ {receiverFingerprint}
                </div>
              ) : null}

              <div className="flex gap-2">
                <button
                  type="button"
                  className={`${primaryButtonClass} flex-1`}
                  onClick={() => void handleSend()}
                  disabled={!selectedUploadFile || !receiverData || sendBusy}
                >
                  {sendBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Send
                </button>
                <button
                  type="button"
                  className={subtleButtonClass}
                  onClick={() => {
                    setSelectedUploadFile(null);
                    setReceiverData(null);
                    setReceiverEmail("");
                    setReceiverFingerprint("");
                    setSendProgress("");
                  }}
                >
                  Clear
                </button>
              </div>
              {sendProgress ? <div className="text-[10px] text-[var(--dash-text-subtle)]">{sendProgress}</div> : null}
            </div>
          </section>

          {/* Activity feed */}
          <section className={`${panelClass} min-h-0 flex-1 overflow-hidden flex flex-col`}>
            <div className="shrink-0 border-b border-[var(--dash-panel-border)] px-3.5 py-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--dash-text-subtle)]">Activity</div>
                  <div className="mt-0.5 text-[12px] font-medium text-[var(--dash-text-primary)]">Timeline</div>
                </div>
                {auditError ? <div className="max-w-[90px] text-right text-[9px] text-[#DC2626]">{auditError}</div> : null}
              </div>
            </div>

            <div className="flex-1 overflow-auto p-3.5 scrollbar-modern">
              {auditLoading ? (
                <div className="flex items-center gap-2 py-3 text-[10.5px] text-[var(--dash-text-subtle)]">
                  <Loader2 className="h-3 w-3 animate-spin text-[var(--dash-text-muted)]" />
                  Refreshing
                </div>
              ) : activityFeed.length === 0 ? (
                <div className="py-3 text-[10.5px] text-[var(--dash-text-subtle)]">Activity appears when a file is selected.</div>
              ) : (
                <div className="space-y-1.5">
                  {activityFeed.map((item) => (
                    <div key={item.id} className="grid grid-cols-[20px,minmax(0,1fr)] gap-2 rounded-lg border border-[var(--dash-panel-border)] bg-[var(--dash-inset)] p-2.5">
                      <div className={`flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-semibold ${item.tone}`}>
                        {initialsFromName(item.actor)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <div className="truncate text-[10.5px] font-medium text-[var(--dash-text-secondary)]">{item.summary}</div>
                          <div className="shrink-0 text-[8px] text-[var(--dash-text-subtle)]">{item.time}</div>
                        </div>
                        <div className="mt-0.5 truncate text-[9px] text-[var(--dash-text-subtle)]">{item.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className={`${insetCardClass} mt-2.5 flex items-center justify-between px-2.5 py-1.5`}>
                <div className="flex items-center gap-1.5 text-[9px] text-[var(--dash-text-subtle)]">
                  <HardDrive className="h-3 w-3 text-[var(--dash-text-muted)]" />
                  Secure view
                </div>
                <div className="text-[9px] text-[var(--dash-text-subtle)]">{filteredFiles.length} rows</div>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

