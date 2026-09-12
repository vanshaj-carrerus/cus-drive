export type UserRecord = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: "admin" | "user";
  status: "active" | "disabled";
  created_at: string;
  updated_at: string;
};

export type FolderRecord = {
  id: string;
  name: string;
  parent_id: string | null;
  password_hash?: string | null;
  created_at: string;
  updated_at: string;
};

export type DocumentRecord = {
  id: string;
  file_name: string;
  file_url: string;
  storage_path: string;
  storage_resource_type: string;
  file_type: string;
  file_size: number;
  folder_id: string | null;
  password_hash?: string | null;
  created_at: string;
  updated_at: string;
};

export function toPublicUser(user: UserRecord) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    created_at: user.created_at,
  };
}

export function serializeFolder(folder: FolderRecord) {
  return {
    id: folder.id,
    name: folder.name,
    parent_id: folder.parent_id,
    is_locked: Boolean(folder.password_hash),
    updated_at: folder.updated_at,
  };
}

export function serializeDocument(doc: DocumentRecord) {
  return {
    id: doc.id,
    file_name: doc.file_name,
    file_type: doc.file_type,
    file_size: doc.file_size,
    folder_id: doc.folder_id,
    is_locked: Boolean(doc.password_hash),
    created_at: doc.created_at,
  };
}

export type NoteRecord = {
  id: string;
  title: string;
  content: string;
  color: string;
  category: string;
  pinned: boolean;
  drive_doc_id?: string | null;
  user_id: string;
  author_name: string;
  created_at: string;
  updated_at: string;
};

export function serializeNote(note: NoteRecord) {
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    color: note.color || "default",
    category: note.category || "General",
    pinned: Boolean(note.pinned),
    drive_doc_id: note.drive_doc_id || null,
    user_id: note.user_id,
    author_name: note.author_name,
    created_at: note.created_at,
    updated_at: note.updated_at,
  };
}

