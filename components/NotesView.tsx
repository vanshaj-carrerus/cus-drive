"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NoteRecord } from "@/lib/types";

type NotesViewProps = {
  user: {
    id: string;
    name: string;
    role: "admin" | "user";
  };
};

const COLOR_MAP: Record<
  string,
  {
    bg: string;
    border: string;
    badge: string;
    accent: string;
    name: string;
    swatch: string;
  }
> = {
  default: {
    bg: "bg-surface",
    border: "border-border hover:border-secondary/40",
    badge: "bg-slate-100 text-slate-700",
    accent: "text-foreground",
    name: "Classic",
    swatch: "bg-white border-slate-300",
  },
  yellow: {
    bg: "bg-[#fef9c3]/70",
    border: "border-[#fef08a] hover:border-[#fde047]",
    badge: "bg-[#fef08a] text-amber-900",
    accent: "text-amber-950",
    name: "Butter",
    swatch: "bg-yellow-200 border-yellow-300",
  },
  blue: {
    bg: "bg-[#e0f2fe]/70",
    border: "border-[#bae6fd] hover:border-[#7dd3fc]",
    badge: "bg-[#bae6fd] text-sky-900",
    accent: "text-sky-950",
    name: "Sky",
    swatch: "bg-sky-200 border-sky-300",
  },
  green: {
    bg: "bg-[#dcfce7]/70",
    border: "border-[#bbf7d0] hover:border-[#86efac]",
    badge: "bg-[#bbf7d0] text-emerald-900",
    accent: "text-emerald-950",
    name: "Mint",
    swatch: "bg-emerald-200 border-emerald-300",
  },
  purple: {
    bg: "bg-[#f3e8ff]/70",
    border: "border-[#e9d5ff] hover:border-[#d8b4fe]",
    badge: "bg-[#e9d5ff] text-purple-900",
    accent: "text-purple-950",
    name: "Lavender",
    swatch: "bg-purple-200 border-purple-300",
  },
  rose: {
    bg: "bg-[#ffe4e6]/70",
    border: "border-[#fecdd3] hover:border-[#fda4af]",
    badge: "bg-[#fecdd3] text-rose-900",
    accent: "text-rose-950",
    name: "Peach",
    swatch: "bg-rose-200 border-rose-300",
  },
};

const CATEGORIES = ["General", "Work", "Meeting", "Tasks", "Ideas", "Documentation"];

export default function NotesView({ user }: NotesViewProps) {
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // New Note composer states
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newColor, setNewColor] = useState("default");
  const [newCategory, setNewCategory] = useState("General");
  const [newPinned, setNewPinned] = useState(false);
  const [newSaveToDrive, setNewSaveToDrive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingToDrive, setIsSavingToDrive] = useState<string | null>(null);

  // Edit Note modal state
  const [editingNote, setEditingNote] = useState<NoteRecord | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editColor, setEditColor] = useState("default");
  const [editCategory, setEditCategory] = useState("General");
  const [editPinned, setEditPinned] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const composerRef = useRef<HTMLDivElement>(null);
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  const fetchNotes = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/notes");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load notes");
      }
      setNotes(data.notes || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error fetching notes";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // Handle outside click to collapse new note composer if empty
  useEffect(() => {
    function handleClickOutside(event: globalThis.MouseEvent) {
      if (
        composerRef.current &&
        !composerRef.current.contains(event.target as Node) &&
        !newTitle.trim() &&
        !newContent.trim()
      ) {
        setIsComposerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [newTitle, newContent]);

  // Auto-resize composer textarea
  useEffect(() => {
    if (contentTextareaRef.current) {
      contentTextareaRef.current.style.height = "auto";
      contentTextareaRef.current.style.height = `${Math.min(
        Math.max(contentTextareaRef.current.scrollHeight, 80),
        360
      )}px`;
    }
  }, [newContent]);

  async function handleCreateNote() {
    if (!newTitle.trim() && !newContent.trim()) {
      showToast("Please write a title or some text first");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          content: newContent.trim(),
          color: newColor,
          category: newCategory,
          pinned: newPinned,
          save_to_drive: newSaveToDrive,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save note");
      }

      setNotes((prev) => [data.note, ...prev]);
      setNewTitle("");
      setNewContent("");
      setNewColor("default");
      setNewCategory("General");
      setNewPinned(false);
      setIsComposerOpen(false);

      if (newSaveToDrive && data.note?.drive_doc_id) {
        showToast("Note saved & created as file in My Drive! 📁");
      } else {
        showToast("Note saved successfully!");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save note";
      alert(message);
    } finally {
      setIsSaving(false);
    }
  }

  function startEdit(note: NoteRecord) {
    setEditingNote(note);
    setEditTitle(note.title);
    setEditContent(note.content);
    setEditColor(note.color || "default");
    setEditCategory(note.category || "General");
    setEditPinned(Boolean(note.pinned));
  }

  async function handleSaveEdit() {
    if (!editingNote) return;
    if (!editTitle.trim() && !editContent.trim()) {
      showToast("Note cannot be completely empty");
      return;
    }

    setIsUpdating(true);
    try {
      const res = await fetch(`/api/notes/${editingNote.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          content: editContent.trim(),
          color: editColor,
          category: editCategory,
          pinned: editPinned,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update note");
      }

      setNotes((prev) =>
        prev.map((item) => (item.id === editingNote.id ? data.note : item))
      );
      setEditingNote(null);
      showToast("Note updated!");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update note";
      alert(message);
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleExportToDrive(note: NoteRecord, event?: React.MouseEvent) {
    event?.stopPropagation();
    setIsSavingToDrive(note.id);
    try {
      const res = await fetch(`/api/notes/${note.id}/drive`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save to Drive");

      if (data.note) {
        setNotes((prev) => prev.map((item) => (item.id === note.id ? data.note : item)));
        if (editingNote?.id === note.id) {
          setEditingNote(data.note);
        }
      }
      showToast(`Saved to My Drive as ${(note.title || "Note").slice(0, 30)}.txt 📁`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error saving to Drive";
      alert(message);
    } finally {
      setIsSavingToDrive(null);
    }
  }

  async function handleTogglePin(note: NoteRecord, event?: React.MouseEvent) {
    event?.stopPropagation();
    try {
      const nextPin = !note.pinned;
      const res = await fetch(`/api/notes/${note.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: nextPin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to toggle pin");

      setNotes((prev) =>
        prev.map((item) => (item.id === note.id ? data.note : item))
      );
      showToast(nextPin ? "Note pinned to top" : "Note unpinned");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error updating pin";
      alert(message);
    }
  }

  async function handleDeleteNote(id: string, event?: React.MouseEvent) {
    event?.stopPropagation();
    if (!confirm("Are you sure you want to delete this note?")) return;

    try {
      const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete note");

      setNotes((prev) => prev.filter((item) => item.id !== id));
      if (editingNote?.id === id) setEditingNote(null);
      showToast("Note deleted");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error deleting note";
      alert(message);
    }
  }

  function handleCopyContent(content: string, title?: string, event?: React.MouseEvent) {
    event?.stopPropagation();
    const fullText = title ? `${title}\n\n${content}` : content;
    navigator.clipboard.writeText(fullText);
    showToast("Copied note to clipboard!");
  }

  function handleDownloadNote(note: NoteRecord, event?: React.MouseEvent) {
    event?.stopPropagation();
    const fileName = `${(note.title || "note").toLowerCase().replace(/[^a-z0-9_-]/gi, "_")}.txt`;
    const textContent = `Title: ${note.title || "Untitled"}\nCategory: ${note.category}\nDate: ${new Date(
      note.updated_at
    ).toLocaleString()}\nAuthor: ${note.author_name}\n\n------------------------\n\n${note.content}`;
    const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Downloaded note as text file");
  }

  // Filter notes
  const filteredNotes = useMemo(() => {
    return notes.filter((note) => {
      const matchCategory =
        activeCategory === "All"
          ? true
          : activeCategory === "Pinned"
          ? note.pinned
          : activeCategory === "Drive"
          ? Boolean(note.drive_doc_id)
          : note.category.toLowerCase() === activeCategory.toLowerCase();

      const query = searchQuery.trim().toLowerCase();
      const matchSearch =
        !query ||
        note.title.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query) ||
        note.category.toLowerCase().includes(query) ||
        note.author_name.toLowerCase().includes(query);

      return matchCategory && matchSearch;
    });
  }, [notes, activeCategory, searchQuery]);

  const pinnedNotes = useMemo(
    () => filteredNotes.filter((n) => n.pinned),
    [filteredNotes]
  );
  const otherNotes = useMemo(
    () => filteredNotes.filter((n) => !n.pinned),
    [filteredNotes]
  );

  function formatDateFriendly(isoDate: string) {
    try {
      const date = new Date(isoDate);
      const now = new Date();
      const isToday =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

      if (isToday) {
        return `Today, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
      }
      return date.toLocaleDateString([], {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      });
    } catch {
      return isoDate;
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-white shadow-xl animate-fade-in">
          <span>✓</span>
          <span>{toast}</span>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {/* Top Header & Search Bar */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                📝
              </span>
              Department Notes
            </h1>
            <p className="mt-0.5 text-xs text-secondary">
              Write, edit, organize notes, and save them directly as files in My Drive
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-72">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notes..."
                className="w-full rounded-full bg-surface py-2 pl-9 pr-4 text-sm ring-1 ring-border transition focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-secondary hover:text-foreground"
                >
                  ✕
                </button>
              )}
            </div>

            {/* View Mode Toggle */}
            <div className="flex rounded-full bg-surface p-0.5 ring-1 ring-border shadow-xs">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                title="Grid view"
                className={`rounded-full p-2 transition ${
                  viewMode === "grid" ? "bg-primary/10 text-primary font-medium" : "text-secondary hover:text-foreground"
                }`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                title="List view"
                className={`rounded-full p-2 transition ${
                  viewMode === "list" ? "bg-primary/10 text-primary font-medium" : "text-secondary hover:text-foreground"
                }`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Category Filters */}
        <div className="mb-6 flex flex-wrap items-center gap-1.5 border-b border-border/70 pb-3">
          {["All", "Pinned", "Drive", ...CATEGORIES].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`rounded-full px-3.5 py-1 text-xs font-medium transition ${
                activeCategory === cat
                  ? "bg-primary text-white shadow-xs"
                  : "bg-surface text-secondary ring-1 ring-border hover:bg-slate-50 hover:text-foreground"
              }`}
            >
              {cat === "Pinned" ? "📌 Pinned" : cat === "Drive" ? "📁 In Drive" : cat}
            </button>
          ))}
          <span className="ml-auto text-xs text-secondary">
            {filteredNotes.length} {filteredNotes.length === 1 ? "note" : "notes"}
          </span>
        </div>

        {/* Note Composer (Google Keep / Drive Notepad style) */}
        <div className="mb-8 flex justify-center">
          <div
            ref={composerRef}
            className={`w-full max-w-2xl rounded-2xl border transition-all duration-200 shadow-sm ${
              isComposerOpen
                ? `${COLOR_MAP[newColor].bg} border-primary/40 shadow-md ring-2 ring-primary/15`
                : "bg-surface border-border hover:border-secondary/40 hover:shadow"
            }`}
          >
            {!isComposerOpen ? (
              <div
                onClick={() => {
                  setIsComposerOpen(true);
                  setTimeout(() => contentTextareaRef.current?.focus(), 50);
                }}
                className="flex cursor-text items-center justify-between px-5 py-3.5 text-secondary"
              >
                <span className="text-sm font-medium">Take a note or write document text...</span>
                <div className="flex items-center gap-3 text-secondary">
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-medium">
                    📁 Auto-saves to Drive
                  </span>
                  <button
                    type="button"
                    title="Pin to top"
                    onClick={(e) => {
                      e.stopPropagation();
                      setNewPinned(true);
                      setIsComposerOpen(true);
                    }}
                    className="hover:text-primary transition"
                  >
                    📌
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition"
                  >
                    + Write
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 sm:p-5">
                {/* Title + Pin */}
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Title"
                    className="w-full bg-transparent text-base font-semibold text-foreground placeholder:text-secondary/70 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setNewPinned(!newPinned)}
                    title={newPinned ? "Unpin note" : "Pin note to top"}
                    className={`rounded-full p-1.5 text-base transition ${
                      newPinned ? "bg-amber-100 text-amber-600 ring-1 ring-amber-300" : "text-secondary hover:bg-black/5"
                    }`}
                  >
                    📌
                  </button>
                </div>

                {/* Content Textarea */}
                <textarea
                  ref={contentTextareaRef}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                      e.preventDefault();
                      handleCreateNote();
                    }
                  }}
                  placeholder="Write your note here... (Press Ctrl+Enter to save)"
                  rows={3}
                  className="mt-2 w-full resize-none bg-transparent text-sm leading-relaxed text-foreground placeholder:text-secondary/60 focus:outline-none"
                />

                {/* Palette, Category, Drive Checkbox and Actions toolbar */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-black/5 pt-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Color swatches */}
                    <div className="flex items-center gap-1">
                      {Object.entries(COLOR_MAP).map(([key, item]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setNewColor(key)}
                          title={item.name}
                          className={`h-5 w-5 rounded-full border transition ${item.swatch} ${
                            newColor === key ? "ring-2 ring-primary scale-110" : "hover:scale-105"
                          }`}
                        />
                      ))}
                    </div>

                    <span className="text-secondary/40">|</span>

                    {/* Category Selector */}
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="rounded-lg bg-black/5 px-2 py-1 text-xs font-medium text-foreground outline-none hover:bg-black/10 transition"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>

                    <span className="text-secondary/40">|</span>

                    {/* Save to Drive Checkbox */}
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs text-foreground/80 hover:text-foreground select-none">
                      <input
                        type="checkbox"
                        checked={newSaveToDrive}
                        onChange={(e) => setNewSaveToDrive(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                      />
                      <span className="flex items-center gap-1 font-medium">
                        <span>📁</span> Save to Drive as .txt
                      </span>
                    </label>
                  </div>

                  {/* Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsComposerOpen(false);
                        setNewTitle("");
                        setNewContent("");
                        setNewColor("default");
                        setNewCategory("General");
                        setNewPinned(false);
                      }}
                      className="rounded-full px-3 py-1 text-xs font-medium text-secondary hover:bg-black/5 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isSaving || (!newTitle.trim() && !newContent.trim())}
                      onClick={handleCreateNote}
                      className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-primary/90 disabled:opacity-50 transition"
                    >
                      {isSaving ? "Saving..." : "Save Note"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-600 ring-1 ring-red-200">
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <div
                key={idx}
                className="h-44 animate-pulse rounded-2xl border border-border bg-surface/50 p-4"
              />
            ))}
          </div>
        ) : filteredNotes.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/80 bg-surface/40 px-4 py-16 text-center">
            <span className="text-4xl">🗒️</span>
            <h3 className="mt-3 text-base font-semibold text-foreground">No notes found</h3>
            <p className="mt-1 max-w-sm text-xs text-secondary">
              {searchQuery
                ? `No notes matching "${searchQuery}". Try a different keyword.`
                : "Capture your ideas, department tasks, or important reminders above!"}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Pinned Notes Section */}
            {pinnedNotes.length > 0 && (
              <div>
                <h2 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-secondary">
                  <span>📌</span> Pinned ({pinnedNotes.length})
                </h2>
                <div
                  className={
                    viewMode === "grid"
                      ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                      : "flex flex-col gap-3"
                  }
                >
                  {pinnedNotes.map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      user={user}
                      viewMode={viewMode}
                      isSavingToDrive={isSavingToDrive === note.id}
                      onEdit={() => startEdit(note)}
                      onTogglePin={(e) => handleTogglePin(note, e)}
                      onDelete={(e) => handleDeleteNote(note.id, e)}
                      onCopy={(e) => handleCopyContent(note.content, note.title, e)}
                      onDownload={(e) => handleDownloadNote(note, e)}
                      onSaveToDrive={(e) => handleExportToDrive(note, e)}
                      formatDate={formatDateFriendly}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Other Notes Section */}
            {otherNotes.length > 0 && (
              <div>
                {pinnedNotes.length > 0 && (
                  <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-secondary">
                    Others ({otherNotes.length})
                  </h2>
                )}
                <div
                  className={
                    viewMode === "grid"
                      ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                      : "flex flex-col gap-3"
                  }
                >
                  {otherNotes.map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      user={user}
                      viewMode={viewMode}
                      isSavingToDrive={isSavingToDrive === note.id}
                      onEdit={() => startEdit(note)}
                      onTogglePin={(e) => handleTogglePin(note, e)}
                      onDelete={(e) => handleDeleteNote(note.id, e)}
                      onCopy={(e) => handleCopyContent(note.content, note.title, e)}
                      onDownload={(e) => handleDownloadNote(note, e)}
                      onSaveToDrive={(e) => handleExportToDrive(note, e)}
                      formatDate={formatDateFriendly}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Note Modal */}
      {editingNote && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
          onClick={() => setEditingNote(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-xl rounded-2xl border p-5 shadow-2xl transition-all ${
              COLOR_MAP[editColor]?.bg || "bg-surface"
            } border-border`}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-3">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Title"
                className="w-full bg-transparent text-lg font-bold text-foreground placeholder:text-secondary/70 focus:outline-none"
              />
              <div className="flex items-center gap-1.5 shrink-0">
                {editingNote.drive_doc_id ? (
                  <span className="flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-800">
                    📁 In Drive
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => setEditPinned(!editPinned)}
                  title={editPinned ? "Unpin note" : "Pin note"}
                  className={`rounded-full p-1.5 text-base transition ${
                    editPinned ? "bg-amber-100 text-amber-600 ring-1 ring-amber-300" : "text-secondary hover:bg-black/5"
                  }`}
                >
                  📌
                </button>
                <button
                  type="button"
                  onClick={() => setEditingNote(null)}
                  className="rounded-full p-1.5 text-secondary hover:bg-black/5 hover:text-foreground"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="Note content..."
              rows={8}
              className="mt-3 w-full resize-y bg-transparent text-sm leading-relaxed text-foreground placeholder:text-secondary/60 focus:outline-none"
            />

            {/* Note Info & Palette */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-black/5 pt-3">
              <div className="flex flex-wrap items-center gap-2">
                {/* Color swatches */}
                <div className="flex items-center gap-1">
                  {Object.entries(COLOR_MAP).map(([key, item]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setEditColor(key)}
                      title={item.name}
                      className={`h-5 w-5 rounded-full border transition ${item.swatch} ${
                        editColor === key ? "ring-2 ring-primary scale-110" : "hover:scale-105"
                      }`}
                    />
                  ))}
                </div>

                <span className="text-secondary/40">|</span>

                {/* Category selector */}
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="rounded-lg bg-black/5 px-2 py-1 text-xs font-medium text-foreground outline-none hover:bg-black/10 transition"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                {/* Save/Sync to Drive button */}
                <button
                  type="button"
                  disabled={isSavingToDrive === editingNote.id}
                  onClick={() => handleExportToDrive(editingNote)}
                  title="Save or sync this note into My Drive as a file"
                  className="flex items-center gap-1 rounded-full bg-surface px-3 py-1 text-xs font-medium text-foreground ring-1 ring-border hover:bg-slate-50 transition"
                >
                  <span>📁</span>
                  <span>
                    {isSavingToDrive === editingNote.id
                      ? "Saving..."
                      : editingNote.drive_doc_id
                      ? "Re-sync in Drive"
                      : "Save to Drive"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={(e) => handleCopyContent(editContent, editTitle, e)}
                  title="Copy text"
                  className="rounded-full p-2 text-secondary hover:bg-black/5 hover:text-foreground transition"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDownloadNote(editingNote, e)}
                  title="Download .txt"
                  className="rounded-full p-2 text-secondary hover:bg-black/5 hover:text-foreground transition"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
                {(editingNote.user_id === user.id || user.role === "admin") && (
                  <button
                    type="button"
                    onClick={(e) => handleDeleteNote(editingNote.id, e)}
                    title="Delete note"
                    className="rounded-full p-2 text-red-500 hover:bg-red-50 transition"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={handleSaveEdit}
                  className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-primary/90 disabled:opacity-50 transition"
                >
                  {isUpdating ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type NoteCardProps = {
  note: NoteRecord;
  user: {
    id: string;
    name: string;
    role: "admin" | "user";
  };
  viewMode: "grid" | "list";
  isSavingToDrive: boolean;
  onEdit: () => void;
  onTogglePin: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onCopy: (e: React.MouseEvent) => void;
  onDownload: (e: React.MouseEvent) => void;
  onSaveToDrive: (e: React.MouseEvent) => void;
  formatDate: (iso: string) => string;
};

function NoteCard({
  note,
  user,
  viewMode,
  isSavingToDrive,
  onEdit,
  onTogglePin,
  onDelete,
  onCopy,
  onDownload,
  onSaveToDrive,
  formatDate,
}: NoteCardProps) {
  const colorScheme = COLOR_MAP[note.color] || COLOR_MAP.default;
  const canModify = note.user_id === user.id || user.role === "admin";

  return (
    <div
      onClick={onEdit}
      className={`group relative flex cursor-pointer flex-col justify-between rounded-2xl border p-4 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md ${
        colorScheme.bg
      } ${colorScheme.border} ${viewMode === "list" ? "sm:flex-row sm:items-center sm:gap-6" : ""}`}
    >
      <div className="flex-1">
        {/* Card Header: Category, Drive Badge & Pin */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span
              className={`rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${colorScheme.badge}`}
            >
              {note.category || "General"}
            </span>
            {note.drive_doc_id && (
              <span
                title="Saved as a file in My Drive"
                className="flex items-center gap-1 rounded bg-sky-100/90 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800 ring-1 ring-sky-300"
              >
                <span>📁</span> Drive
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onTogglePin}
            title={note.pinned ? "Unpin note" : "Pin note to top"}
            className={`rounded-full p-1 text-xs transition ${
              note.pinned
                ? "text-amber-500 opacity-100"
                : "opacity-0 group-hover:opacity-100 text-secondary hover:text-foreground"
            }`}
          >
            📌
          </button>
        </div>

        {/* Title */}
        {note.title && (
          <h3 className="mt-2 text-sm font-semibold leading-snug text-foreground line-clamp-2">
            {note.title}
          </h3>
        )}

        {/* Content Preview */}
        <p
          className={`mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-secondary ${
            viewMode === "list" ? "line-clamp-2 sm:line-clamp-1" : "line-clamp-6"
          }`}
        >
          {note.content}
        </p>
      </div>

      {/* Card Footer: Author, Date, Quick Actions */}
      <div
        className={`mt-3 flex items-center justify-between gap-2 border-t border-black/5 pt-2.5 text-[11px] text-secondary ${
          viewMode === "list" ? "sm:mt-0 sm:border-0 sm:pt-0 sm:shrink-0 sm:gap-4" : ""
        }`}
      >
        <div className="flex items-center gap-1.5">
          <span>{formatDate(note.updated_at)}</span>
          {note.author_name && (
            <>
              <span>•</span>
              <span className="font-medium text-foreground/80">
                {note.user_id === user.id ? "You" : note.author_name}
              </span>
            </>
          )}
        </div>

        {/* Hover Actions */}
        <div
          className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            disabled={isSavingToDrive}
            onClick={onSaveToDrive}
            title={note.drive_doc_id ? "Sync in Drive" : "Save as file in My Drive"}
            className="rounded-md p-1 hover:bg-black/5 hover:text-primary transition"
          >
            <span className="text-xs">{isSavingToDrive ? "⏳" : "📁"}</span>
          </button>
          <button
            type="button"
            onClick={onCopy}
            title="Copy note text"
            className="rounded-md p-1 hover:bg-black/5 hover:text-foreground transition"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onDownload}
            title="Download note (.txt)"
            className="rounded-md p-1 hover:bg-black/5 hover:text-foreground transition"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
          {canModify && (
            <button
              type="button"
              onClick={onDelete}
              title="Delete note"
              className="rounded-md p-1 text-red-500 hover:bg-red-50 transition"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
