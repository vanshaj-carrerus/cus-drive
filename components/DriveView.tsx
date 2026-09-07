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
};

type DocumentItem = {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
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
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<Selection>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [renaming, setRenaming] = useState<Selection>(null);
  const [renameValue, setRenameValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const uploadFolderRef = useRef<string | null | undefined>(undefined);

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
    const response = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Untitled folder", parent_id: folderId }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Could not create folder");
      return;
    }
    setFolders((items) =>
      [...items, data.folder].sort((a, b) => a.name.localeCompare(b.name))
    );
    const item = { kind: "folder" as const, id: data.folder.id };
    setSelected(item);
    setRenameValue(data.folder.name);
    setRenaming(item);
  }

  async function removeFolder(id: string, name: string) {
    closeMenu();
    if (!window.confirm(`Delete folder “${name}” and everything inside it?`)) return;
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
    if (!window.confirm(`Delete “${name}”?`)) return;
    const response = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Could not delete file");
      return;
    }
    setDocuments((items) => items.filter((item) => item.id !== id));
    if (selected?.kind === "file" && selected.id === id) setSelected(null);
  }

  function openFile(id: string) {
    closeMenu();
    window.open(`/api/documents/${id}/file?disposition=inline`, "_blank");
  }

  function downloadFile(id: string) {
    closeMenu();
    window.location.href = `/api/documents/${id}/file`;
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
    const y = Math.min(event.clientY, window.innerHeight - 180);
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
        openFolder(selected.id);
        return;
      }
      if (event.key === "Enter" && selected?.kind === "file") {
        openFile(selected.id);
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
  }, [selected, folders, documents, folderId]);

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
                onClick={() => openFolder(crumb.id)}
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

        {uploading ? (
          <p className="mb-3 text-sm text-primary">Uploading...</p>
        ) : null}
        {error ? (
          <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        <section
          className="min-h-[calc(100vh-14rem)] rounded-2xl bg-surface p-2 sm:p-3"
          onClick={() => {
            setSelected(null);
            setRenaming(null);
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
                    openFolder(folder.id);
                  }}
                  onContextMenu={(event) =>
                    showMenu(event, { kind: "folder", id: folder.id })
                  }
                  className={`cursor-pointer rounded-2xl p-3 ${
                    isSelected ? "bg-primary/10" : "hover:bg-background"
                  }`}
                >
                  <FolderIcon className="mx-auto h-12 w-12" />
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
                    openFile(file.id);
                  }}
                  onContextMenu={(event) => showMenu(event, { kind: "file", id: file.id })}
                  className={`cursor-pointer rounded-2xl p-3 ${
                    isSelected ? "bg-primary/10" : "hover:bg-background"
                  }`}
                >
                  <FileGlyph name={file.file_name} type={file.file_type} />
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
                      title={`${file.file_name} · ${formatBytes(file.file_size)} · ${formatDate(file.created_at)}`}
                    >
                      {file.file_name}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {menu ? (
        <div
          className="fixed z-50 min-w-48 rounded-xl bg-surface py-2 text-sm shadow-lg ring-1 ring-border"
          style={{ left: menu.x, top: menu.y }}
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
                    <MenuItem onClick={() => openFolder(folderTarget.id)}>Open</MenuItem>
                    <MenuItem onClick={() => pickFile(folderTarget.id)}>Upload files</MenuItem>
                    <MenuItem onClick={() => startRename(folderTarget)}>Rename</MenuItem>
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
                    <MenuItem onClick={() => openFile(fileTarget.id)}>Open</MenuItem>
                    <MenuItem onClick={() => downloadFile(fileTarget.id)}>Download</MenuItem>
                    <MenuItem onClick={() => startRename(fileTarget)}>Rename</MenuItem>
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
