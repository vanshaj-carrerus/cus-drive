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
    created_at: doc.created_at,
  };
}
