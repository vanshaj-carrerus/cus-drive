"use client";

import { MAX_UPLOAD_MB } from "@/lib/constants";
import { formatBytes, formatDate } from "@/lib/format";
import {
  ChangeEvent,
  MouseEvent,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type FolderItem = {
  id: string;
  name: string;
  parent_id: string | null;
  is_locked?: boolean;
};

type DocumentItem = {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  is_locked?: boolean;
  created_at: string;
};

type Selection =
  | { kind: "folder"; id: string }
  | { kind: "file"; id: string }
  | null;

type MenuState = {
  x: number;
  y: number;
  target: Selection | "blank";
};

export default function DriveView() {
  const [folderId, setFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<FolderItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<Selection>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [renaming, setRenaming] = useState<Selection>(null);
  const [renameValue, setRenameValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const uploadFolderRef = useRef<string | null | undefined>(undefined);

  // Password Lock & Unlock States
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const [unlockedPasswords, setUnlockedPasswords] = useState<Record<string, string>>({});

  // Modal to set, change, or remove password
  const [passwordModal, setPasswordModal] = useState<{
    open: boolean;
    kind: "folder" | "file";
    id: string;
    name: string;
    is_locked: boolean;
  } | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordModalError, setPasswordModalError] = useState("");
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  // Modal to unlock a locked folder or file
  const [unlockModal, setUnlockModal] = useState<{
    open: boolean;
    kind: "folder" | "file";
    id: string;
    name: string;
    action?: "open" | "download";
  } | null>(null);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [isUnlocking, setIsUnlocking] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3000);
  }, []);

  const load = useCallback(async (id: string | null) => {
    setError("");
    const params = id ? `?folder=${encodeURIComponent(id)}` : "";
    const response = await fetch(`/api/drive${params}`);
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Could not load files");
      return;
    }
    setBreadcrumbs(data.breadcrumbs || []);
    setFolders(data.folders || []);
    setDocuments(data.documents || []);
  }, []);

  useEffect(() => {
    load(folderId).finally(() => setLoading(false));
  }, [folderId, load]);

  useEffect(() => {
    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [renaming]);

  function closeMenu() {
    setMenu(null);
    setNewOpen(false);
  }

  function openFolder(id: string | null) {
    setQuery("");
    setSelected(null);
    setRenaming(null);
    closeMenu();
    setFolderId(id);
  }

  function startRename(item: Exclude<Selection, null>) {
    closeMenu();
    setSelected(item);
    if (item.kind === "folder") {
      const folder = folders.find((entry) => entry.id === item.id);
      if (!folder) return;
      setRenameValue(folder.name);
    } else {
      const file = documents.find((entry) => entry.id === item.id);
      if (!file) return;
      setRenameValue(file.file_name);
    }
    setRenaming(item);
  }

  async function saveRename() {
    if (!renaming) return;
    const name = renameValue.trim();
    const current = renaming;
    setRenaming(null);
    if (!name) return;

    if (current.kind === "folder") {
      const response = await fetch(`/api/folders/${current.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not rename folder");
        return;
      }
      setFolders((items) =>
        items
          .map((item) => (item.id === current.id ? data.folder : item))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      setBreadcrumbs((items) =>
        items.map((item) => (item.id === current.id ? data.folder : item))
      );
      return;
    }

    const response = await fetch(`/api/documents/${current.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Could not rename file");
      return;
    }
    setDocuments((items) =>
      items.map((item) => (item.id === current.id ? data.document : item))
    );
  }

  async function createFolder() {
    closeMenu();
    const name = window.prompt("Folder name", "New folder");
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) return;

    const response = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed, parent_id: folderId }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Could not create folder");
      return;
    }
    setFolders((items) =>
      [...items, data.folder].sort((a, b) => a.name.localeCompare(b.name))
    );
    setSelected({ kind: "folder", id: data.folder.id });
  }

  async function removeFolder(id: string, name: string) {
    closeMenu();
    if (!window.confirm(`Delete folder "${name}" and all its contents?`)) return;
    const response = await fetch(`/api/folders/${id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Could not delete folder");
      return;
    }
    setFolders((items) => items.filter((item) => item.id !== id));
    if (selected?.kind === "folder" && selected.id === id) setSelected(null);
  }

  async function removeFile(id: string, name: string) {
    closeMenu();
    if (!window.confirm(`Delete file "${name}"?`)) return;
    const response = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Could not delete file");
      return;
    }
    setDocuments((items) => items.filter((item) => item.id !== id));
    if (selected?.kind === "file" && selected.id === id) setSelected(null);
  }

  function openFile(id: string, pwd?: string) {
    closeMenu();
    const query = pwd ? `&password=${encodeURIComponent(pwd)}` : "";
    window.open(`/api/documents/${id}/file?disposition=inline${query}`, "_blank");
  }

  function downloadFile(id: string, pwd?: string) {
    closeMenu();
    const query = pwd ? `?password=${encodeURIComponent(pwd)}` : "";
    window.location.href = `/api/documents/${id}/file${query}`;
  }

  // Intercept folder opening if locked
  function requestOpenFolder(id: string) {
    const folder = folders.find((f) => f.id === id);
    if (folder?.is_locked && !unlockedIds.has(id)) {
      closeMenu();
      setUnlockModal({
        open: true,
        kind: "folder",
        id,
        name: folder.name,
        action: "open",
      });
      setUnlockPassword("");
      setUnlockError("");
      return;
    }
    openFolder(id);
  }

  // Intercept file open if locked
  function requestOpenFile(id: string) {
    const file = documents.find((f) => f.id === id);
    const cachedPwd = unlockedPasswords[id];
    if (file?.is_locked && !unlockedIds.has(id) && !cachedPwd) {
      closeMenu();
      setUnlockModal({
        open: true,
        kind: "file",
        id,
        name: file.file_name,
        action: "open",
      });
      setUnlockPassword("");
      setUnlockError("");
      return;
    }
    openFile(id, cachedPwd);
  }

  // Intercept file download if locked
  function requestDownloadFile(id: string) {
    const file = documents.find((f) => f.id === id);
    const cachedPwd = unlockedPasswords[id];
    if (file?.is_locked && !unlockedIds.has(id) && !cachedPwd) {
      closeMenu();
      setUnlockModal({
        open: true,
        kind: "file",
        id,
        name: file.file_name,
        action: "download",
      });
      setUnlockPassword("");
      setUnlockError("");
      return;
    }
    downloadFile(id, cachedPwd);
  }

  // Submit unlock password prompt
  async function handleUnlockSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!unlockModal) return;
    const pwd = unlockPassword.trim();
    if (!pwd) {
      setUnlockError("Please enter the password");
      return;
    }

    setIsUnlocking(true);
    setUnlockError("");
    try {
      const endpoint =
        unlockModal.kind === "folder"
          ? `/api/folders/${unlockModal.id}/verify`
          : `/api/documents/${unlockModal.id}/verify`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwd }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Incorrect password");
      }

      // Cache unlock state
      setUnlockedIds((prev) => new Set([...prev, unlockModal.id]));
      setUnlockedPasswords((prev) => ({ ...prev, [unlockModal.id]: pwd }));

      const current = unlockModal;
      setUnlockModal(null);
      showToast("Unlocked successfully 🔓");

      if (current.kind === "folder") {
        openFolder(current.id);
      } else if (current.action === "download") {
        downloadFile(current.id, pwd);
      } else {
        openFile(current.id, pwd);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to unlock";
      setUnlockError(msg);
    } finally {
      setIsUnlocking(false);
    }
  }

  // Submit set/change/remove password
  async function handleSavePassword(remove: boolean = false) {
    if (!passwordModal) return;
    setPasswordModalError("");

    if (remove) {
      if (passwordModal.is_locked && !currentPassword.trim()) {
        setPasswordModalError("Please enter current password to remove protection");
        return;
      }
    } else {
      if (!newPassword.trim()) {
        setPasswordModalError("Password cannot be empty");
        return;
      }
      if (newPassword.trim().length < 3) {
        setPasswordModalError("Password must be at least 3 characters");
        return;
      }
      if (newPassword !== confirmPassword) {
        setPasswordModalError("Passwords do not match");
        return;
      }
    }

    setIsSubmittingPassword(true);
    try {
      const endpoint =
        passwordModal.kind === "folder"
          ? `/api/folders/${passwordModal.id}/password`
          : `/api/documents/${passwordModal.id}/password`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: remove ? null : newPassword.trim(),
          currentPassword: currentPassword.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update password");
      }

      // Update folder/doc state
      if (passwordModal.kind === "folder") {
        setFolders((prev) =>
          prev.map((f) =>
            f.id === passwordModal.id ? { ...f, is_locked: !remove } : f
          )
        );
      } else {
        setDocuments((prev) =>
          prev.map((d) =>
            d.id === passwordModal.id ? { ...d, is_locked: !remove } : d
          )
        );
      }

      if (!remove && newPassword.trim()) {
        setUnlockedIds((prev) => new Set([...prev, passwordModal.id]));
        setUnlockedPasswords((prev) => ({
          ...prev,
          [passwordModal.id]: newPassword.trim(),
        }));
      }

      setPasswordModal(null);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast(remove ? "Password protection removed 🔓" : "Password set successfully 🔒");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error saving password";
      setPasswordModalError(msg);
    } finally {
      setIsSubmittingPassword(false);
    }
  }

  function pickFile(intoFolder?: string | null) {
    closeMenu();
    uploadFolderRef.current = intoFolder === undefined ? folderId : intoFolder;
    fileInputRef.current?.click();
  }

  async function onFileChosen(event: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files || []);
    event.target.value = "";
    if (chosen.length === 0) return;

    const dest = uploadFolderRef.current === undefined ? folderId : uploadFolderRef.current;
    uploadFolderRef.current = undefined;
    setUploading(true);
    setError("");

    const uploadedItems: DocumentItem[] = [];
    const failed: string[] = [];

    for (const file of chosen) {
      if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
        failed.push(`${file.name} is larger than ${MAX_UPLOAD_MB} MB`);
        continue;
      }
      const form = new FormData();
      form.append("file", file);
      if (dest) form.append("folder_id", dest);
      try {
        const response = await fetch("/api/documents", { method: "POST", body: form });
        const text = await response.text();
        let data: { error?: string; document?: DocumentItem } = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          data = {};
        }
        if (!response.ok || !data.document) {
          failed.push(data.error || `${file.name} failed to upload`);
          continue;
        }
        uploadedItems.push(data.document);
      } catch {
        failed.push(`${file.name} failed to upload`);
      }
    }

    if (uploadedItems.length > 0 && dest === folderId) {
      setDocuments((items) => [...uploadedItems, ...items]);
      setSelected({ kind: "file", id: uploadedItems[0].id });
    } else if (uploadedItems.length > 0 && dest) {
      openFolder(dest);
    }
    if (failed.length > 0) {
      setError(failed.join(" · "));
    }
    setUploading(false);
  }

  function showMenu(event: MouseEvent, target: MenuState["target"]) {
    event.preventDefault();
    event.stopPropagation();
    const x = Math.min(event.clientX, window.innerWidth - 180);
    const y = Math.min(event.clientY, window.innerHeight - 240);
    setMenu({ x, y, target });
    if (target !== "blank") setSelected(target);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const tag = (event.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        createFolder();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "u") {
        event.preventDefault();
        pickFile();
        return;
      }
      if (event.key === "F2" && selected) {
        event.preventDefault();
        startRename(selected);
        return;
      }
      if (event.key === "Enter" && selected?.kind === "folder") {
        requestOpenFolder(selected.id);
        return;
      }
      if (event.key === "Enter" && selected?.kind === "file") {
        requestOpenFile(selected.id);
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selected) {
        event.preventDefault();
        if (selected.kind === "folder") {
          const folder = folders.find((item) => item.id === selected.id);
          if (folder) removeFolder(folder.id, folder.name);
        } else {
          const file = documents.find((item) => item.id === selected.id);
          if (file) removeFile(file.id, file.file_name);
        }
      }
      if (event.key === "Escape") {
        setSelected(null);
        closeMenu();
        setRenaming(null);
      }
    }

    function onClick() {
      closeMenu();
    }

    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick);
    };
  }, [selected, folders, documents, folderId, unlockedIds, unlockedPasswords]);

  const visibleFolders = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return folders;
    return folders.filter((item) => item.name.toLowerCase().includes(term));
  }, [folders, query]);

  const visibleFiles = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return documents;
    return documents.filter((item) => item.file_name.toLowerCase().includes(term));
  }, [documents, query]);

  const empty =
    !loading && visibleFolders.length === 0 && visibleFiles.length === 0;

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-white shadow-xl">
          <span>✓</span>
          <span>{toast}</span>
        </div>
      )}

      <aside className="hidden w-[256px] shrink-0 flex-col gap-3 p-3 md:flex">
        <div className="relative">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setMenu(null);
              setNewOpen((open) => !open);
            }}
            className="flex h-14 w-full items-center gap-3 rounded-2xl bg-surface px-5 text-sm font-medium text-foreground shadow-sm ring-1 ring-border hover:bg-background hover:shadow"
          >
            <span className="text-2xl leading-none text-primary">+</span>
            New
          </button>
          {newOpen ? (
            <div
              className="absolute left-0 top-[60px] z-50 w-56 rounded-xl bg-surface py-2 text-sm shadow-lg ring-1 ring-border"
              onClick={(event) => event.stopPropagation()}
            >
              <MenuItem onClick={createFolder}>New folder</MenuItem>
              <MenuItem onClick={() => pickFile()}>
                {uploading ? "Uploading..." : "File upload"}
              </MenuItem>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => openFolder(null)}
          className={`flex items-center gap-3 rounded-full px-4 py-2.5 text-sm ${
            folderId === null
              ? "bg-primary/10 font-medium text-primary"
              : "text-secondary hover:bg-surface"
          }`}
        >
          <FolderIcon className="h-5 w-5" />
          My Drive
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          onChange={onFileChosen}
        />
      </aside>

      <main className="min-w-0 flex-1 px-3 py-4 sm:px-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative block min-w-0 flex-1">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-secondary">
              <SearchIcon />
            </span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search in Drive"
              className="w-full rounded-full bg-primary/10 py-3 pl-12 pr-4 text-sm outline-none placeholder:text-secondary focus:bg-surface focus:ring-1 focus:ring-primary"
            />
          </label>
          <div className="flex gap-2 md:hidden">
            <button
              type="button"
              onClick={createFolder}
              className="rounded-full bg-surface px-4 py-2 text-sm font-medium text-primary shadow-sm ring-1 ring-border"
            >
              New folder
            </button>
            <button
              type="button"
              onClick={() => pickFile()}
              disabled={uploading}
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </div>

        <nav className="mb-3 flex min-h-8 flex-wrap items-center gap-1 text-sm">
          <button
            type="button"
            onClick={() => openFolder(null)}
            className={`rounded-full px-2 py-1 ${folderId ? "text-secondary hover:bg-surface hover:text-primary" : "font-medium text-foreground"}`}
          >
            My Drive
          </button>
          {breadcrumbs.map((crumb) => (
            <span key={crumb.id} className="flex items-center gap-1">
              <span className="text-secondary">›</span>
              <button
                type="button"
                onClick={() => requestOpenFolder(crumb.id)}
                className={`rounded-full px-2 py-1 ${
                  crumb.id === folderId
                    ? "font-medium text-foreground"
                    : "text-secondary hover:bg-surface hover:text-primary"
                }`}
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </nav>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
            {error}
          </div>
        )}

        <div
          className="min-h-[400px] rounded-3xl bg-surface p-4 ring-1 ring-border"
          onClick={() => {
            setSelected(null);
            closeMenu();
          }}
          onContextMenu={(event) => showMenu(event, "blank")}
        >
          {loading ? (
            <p className="mt-16 text-center text-sm text-secondary">Loading...</p>
          ) : empty ? (
            <div className="mt-24 text-center">
              <FolderIcon className="mx-auto h-16 w-16" />
              <p className="mt-4 text-base text-foreground">This folder is empty</p>
              <p className="mt-1 text-sm text-secondary">Use New to add a folder or upload files</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {visibleFolders.map((folder) => {
                const isSelected = selected?.kind === "folder" && selected.id === folder.id;
                const isRenaming = renaming?.kind === "folder" && renaming.id === folder.id;
                return (
                  <article
                    key={folder.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      closeMenu();
                      setSelected({ kind: "folder", id: folder.id });
                    }}
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      requestOpenFolder(folder.id);
                    }}
                    onContextMenu={(event) =>
                      showMenu(event, { kind: "folder", id: folder.id })
                    }
                    className={`group relative cursor-pointer rounded-2xl p-3 ${
                      isSelected ? "bg-primary/10" : "hover:bg-background"
                    }`}
                  >
                    <div className="relative mx-auto w-12">
                      <FolderIcon className="h-12 w-12" />
                      {folder.is_locked && (
                        <span
                          title="Password Protected Folder"
                          className="absolute -right-1.5 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[11px] shadow-xs ring-1 ring-amber-300"
                        >
                          🔒
                        </span>
                      )}
                    </div>
                    {isRenaming ? (
                      <RenameBox
                        inputRef={renameInputRef}
                        value={renameValue}
                        onChange={setRenameValue}
                        onSave={saveRename}
                        onCancel={() => setRenaming(null)}
                      />
                    ) : (
                      <p
                        onClick={(event) => {
                          event.stopPropagation();
                          closeMenu();
                          if (isSelected) {
                            startRename({ kind: "folder", id: folder.id });
                          } else {
                            setSelected({ kind: "folder", id: folder.id });
                          }
                        }}
                        onDoubleClick={(event) => {
                          event.stopPropagation();
                          startRename({ kind: "folder", id: folder.id });
                        }}
                        className="mt-2 truncate text-center text-sm"
                      >
                        {folder.name}
                      </p>
                    )}
                  </article>
                );
              })}
              {visibleFiles.map((file) => {
                const isSelected = selected?.kind === "file" && selected.id === file.id;
                const isRenaming = renaming?.kind === "file" && renaming.id === file.id;
                return (
                  <article
                    key={file.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      closeMenu();
                      setSelected({ kind: "file", id: file.id });
                    }}
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      requestOpenFile(file.id);
                    }}
                    onContextMenu={(event) => showMenu(event, { kind: "file", id: file.id })}
                    className={`group relative cursor-pointer rounded-2xl p-3 ${
                      isSelected ? "bg-primary/10" : "hover:bg-background"
                    }`}
                  >
                    <div className="relative mx-auto w-12">
                      <FileGlyph name={file.file_name} type={file.file_type} />
                      {file.is_locked && (
                        <span
                          title="Password Protected File"
                          className="absolute -right-1.5 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[11px] shadow-xs ring-1 ring-amber-300"
                        >
                          🔒
                        </span>
                      )}
                    </div>
                    {isRenaming ? (
                      <RenameBox
                        inputRef={renameInputRef}
                        value={renameValue}
                        onChange={setRenameValue}
                        onSave={saveRename}
                        onCancel={() => setRenaming(null)}
                      />
                    ) : (
                      <p
                        onClick={(event) => {
                          event.stopPropagation();
                          closeMenu();
                          if (isSelected) {
                            startRename({ kind: "file", id: file.id });
                          } else {
                            setSelected({ kind: "file", id: file.id });
                          }
                        }}
                        onDoubleClick={(event) => {
                          event.stopPropagation();
                          startRename({ kind: "file", id: file.id });
                        }}
                        className="mt-2 truncate text-center text-sm"
                      >
                        {file.file_name}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {/* Context Menu */}
        {menu ? (
          <div
            style={{ left: menu.x, top: menu.y }}
            className="fixed z-50 w-56 rounded-xl bg-surface py-1 text-sm shadow-xl ring-1 ring-border"
            onClick={(event) => event.stopPropagation()}
          >
            {menu.target === "blank" ? (
              <>
                <MenuItem onClick={createFolder}>New folder</MenuItem>
                <MenuItem onClick={() => pickFile()}>File upload</MenuItem>
              </>
            ) : null}
            {menu.target !== "blank" && menu.target.kind === "folder"
              ? (() => {
                  const folderTarget = menu.target;
                  const folder = folders.find((item) => item.id === folderTarget.id);
                  return (
                    <>
                      <MenuItem onClick={() => requestOpenFolder(folderTarget.id)}>Open</MenuItem>
                      <MenuItem onClick={() => pickFile(folderTarget.id)}>Upload files</MenuItem>
                      <MenuItem onClick={() => startRename(folderTarget)}>Rename</MenuItem>
                      <MenuItem
                        onClick={() => {
                          closeMenu();
                          if (folder) {
                            setPasswordModal({
                              open: true,
                              kind: "folder",
                              id: folder.id,
                              name: folder.name,
                              is_locked: Boolean(folder.is_locked),
                            });
                            setCurrentPassword("");
                            setNewPassword("");
                            setConfirmPassword("");
                            setPasswordModalError("");
                          }
                        }}
                      >
                        {folder?.is_locked ? "Manage Password 🔒" : "Lock with Password 🔒"}
                      </MenuItem>
                      <MenuItem
                        danger
                        onClick={() => {
                          if (folder) removeFolder(folder.id, folder.name);
                        }}
                      >
                        Delete
                      </MenuItem>
                    </>
                  );
                })()
              : null}
            {menu.target !== "blank" && menu.target.kind === "file"
              ? (() => {
                  const fileTarget = menu.target;
                  const file = documents.find((item) => item.id === fileTarget.id);
                  return (
                    <>
                      <MenuItem onClick={() => requestOpenFile(fileTarget.id)}>Open</MenuItem>
                      <MenuItem onClick={() => requestDownloadFile(fileTarget.id)}>Download</MenuItem>
                      <MenuItem onClick={() => startRename(fileTarget)}>Rename</MenuItem>
                      <MenuItem
                        onClick={() => {
                          closeMenu();
                          if (file) {
                            setPasswordModal({
                              open: true,
                              kind: "file",
                              id: file.id,
                              name: file.file_name,
                              is_locked: Boolean(file.is_locked),
                            });
                            setCurrentPassword("");
                            setNewPassword("");
                            setConfirmPassword("");
                            setPasswordModalError("");
                          }
                        }}
                      >
                        {file?.is_locked ? "Manage Password 🔒" : "Lock with Password 🔒"}
                      </MenuItem>
                      <MenuItem
                        danger
                        onClick={() => {
                          if (file) removeFile(file.id, file.file_name);
                        }}
                      >
                        Delete
                      </MenuItem>
                    </>
                  );
                })()
              : null}
          </div>
        ) : null}

        {/* Set / Manage Password Modal */}
        {passwordModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
            onClick={() => setPasswordModal(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-2xl ring-1 ring-border"
            >
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-base font-bold text-foreground">
                  <span>🔒</span>
                  <span>
                    {passwordModal.is_locked
                      ? `Manage Password for ${passwordModal.kind}`
                      : `Lock ${passwordModal.kind} with Password`}
                  </span>
                </h3>
                <button
                  type="button"
                  onClick={() => setPasswordModal(null)}
                  className="rounded-full p-1 text-secondary hover:bg-black/5 hover:text-foreground"
                >
                  ✕
                </button>
              </div>

              <p className="mt-1 truncate text-xs text-secondary">
                {passwordModal.name}
              </p>

              {passwordModalError && (
                <div className="mt-3 rounded-xl bg-red-50 p-2.5 text-xs text-red-600 ring-1 ring-red-200">
                  {passwordModalError}
                </div>
              )}

              <div className="mt-4 space-y-3">
                {passwordModal.is_locked && (
                  <div>
                    <label className="block text-xs font-medium text-secondary">
                      Current Password
                    </label>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-secondary">
                    {passwordModal.is_locked ? "New Password (leave blank if removing)" : "Password"}
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter password"
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-secondary">
                    Confirm Password
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs text-secondary hover:text-foreground select-none">
                    <input
                      type="checkbox"
                      checked={showPassword}
                      onChange={(e) => setShowPassword(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                    />
                    <span>Show passwords</span>
                  </label>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between gap-2 border-t border-border/70 pt-4">
                {passwordModal.is_locked ? (
                  <button
                    type="button"
                    disabled={isSubmittingPassword}
                    onClick={() => handleSavePassword(true)}
                    className="rounded-full px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition"
                  >
                    Remove Protection 🔓
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPasswordModal(null)}
                    className="rounded-full px-3.5 py-1.5 text-xs font-medium text-secondary hover:bg-black/5 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSubmittingPassword}
                    onClick={() => handleSavePassword(false)}
                    className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-primary/90 disabled:opacity-50 transition"
                  >
                    {isSubmittingPassword
                      ? "Saving..."
                      : passwordModal.is_locked
                      ? "Update Password"
                      : "Lock with Password"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Unlock Prompt Modal */}
        {unlockModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
            onClick={() => setUnlockModal(null)}
          >
            <form
              onSubmit={handleUnlockSubmit}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-2xl ring-1 ring-border"
            >
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-base font-bold text-foreground">
                  <span>🔒</span>
                  <span>Protected {unlockModal.kind === "folder" ? "Folder" : "File"}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setUnlockModal(null)}
                  className="rounded-full p-1 text-secondary hover:bg-black/5 hover:text-foreground"
                >
                  ✕
                </button>
              </div>

              <p className="mt-1 truncate text-xs text-secondary">
                Enter password to unlock <strong>"{unlockModal.name}"</strong>
              </p>

              {unlockError && (
                <div className="mt-3 rounded-xl bg-red-50 p-2.5 text-xs text-red-600 ring-1 ring-red-200">
                  {unlockError}
                </div>
              )}

              <div className="mt-4">
                <input
                  type="password"
                  autoFocus
                  value={unlockPassword}
                  onChange={(e) => setUnlockPassword(e.target.value)}
                  placeholder="Enter password..."
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setUnlockModal(null)}
                  className="rounded-full px-3.5 py-1.5 text-xs font-medium text-secondary hover:bg-black/5 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUnlocking || !unlockPassword.trim()}
                  className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-primary/90 disabled:opacity-50 transition"
                >
                  {isUnlocking ? "Verifying..." : "Unlock & Open"}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  danger = false,
}: {
  children: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full px-4 py-2 text-left hover:bg-background ${
        danger ? "text-red-700" : "text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function RenameBox({
  inputRef,
  value,
  onChange,
  onSave,
  onCancel,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <input
      ref={inputRef}
      value={value}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onSave}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
      className="mt-2 w-full rounded-md border border-primary bg-white px-1 py-0.5 text-sm outline-none"
    />
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3-3" />
    </svg>
  );
}

function FolderIcon({ className = "h-12 w-12" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="#fbbc04" aria-hidden>
      <path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z" />
    </svg>
  );
}

function FileGlyph({ name, type }: { name: string; type: string }) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const color =
    type.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp"].includes(ext)
      ? "#34a853"
      : type === "application/pdf" || ext === "pdf"
        ? "#ea4335"
        : ["xls", "xlsx", "csv"].includes(ext)
          ? "#188038"
          : ["doc", "docx"].includes(ext)
            ? "#1a73e8"
            : ext === "env" || ["txt", "md", "json"].includes(ext)
              ? "#5f6368"
              : "#1a73e8";

  return (
    <svg viewBox="0 0 24 24" className="mx-auto h-12 w-12" fill={color} aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm1 7V3.5L19.5 9H15z" />
    </svg>
  );
}
