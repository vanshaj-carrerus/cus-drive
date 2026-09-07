import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import bcrypt from "bcryptjs";
import { connectMongo, isMongoEnabled } from "./db";
import { DocumentModel, FolderModel, User } from "./models";
import type { DocumentRecord, FolderRecord, UserRecord } from "./types";

type LocalStore = {
  users: UserRecord[];
  folders: FolderRecord[];
  documents: DocumentRecord[];
};

const DATA_FILE = path.join(process.cwd(), "data", "store.json");

function nowIso() {
  return new Date().toISOString();
}

function asUser(user: {
  _id: { toString(): string };
  name: string;
  email: string;
  password_hash: string;
  role: string;
  status: string;
  created_at?: Date;
  updated_at?: Date;
}): UserRecord {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    password_hash: user.password_hash,
    role: user.role === "admin" ? "admin" : "user",
    status: user.status === "disabled" ? "disabled" : "active",
    created_at: (user.created_at || new Date()).toISOString(),
    updated_at: (user.updated_at || new Date()).toISOString(),
  };
}

function asFolder(folder: {
  _id: { toString(): string };
  name: string;
  parent_id?: { toString(): string } | null;
  created_at?: Date;
  updated_at?: Date;
}): FolderRecord {
  return {
    id: folder._id.toString(),
    name: folder.name,
    parent_id: folder.parent_id ? folder.parent_id.toString() : null,
    created_at: (folder.created_at || new Date()).toISOString(),
    updated_at: (folder.updated_at || new Date()).toISOString(),
  };
}

function asDocument(doc: {
  _id: { toString(): string };
  file_name: string;
  file_url?: string;
  storage_path: string;
  storage_resource_type?: string;
  file_type?: string;
  file_size?: number;
  folder_id?: { toString(): string } | null;
  created_at?: Date;
  updated_at?: Date;
}): DocumentRecord {
  return {
    id: doc._id.toString(),
    file_name: doc.file_name,
    file_url: doc.file_url || "",
    storage_path: doc.storage_path,
    storage_resource_type: doc.storage_resource_type || "raw",
    file_type: doc.file_type || "",
    file_size: doc.file_size || 0,
    folder_id: doc.folder_id ? doc.folder_id.toString() : null,
    created_at: (doc.created_at || new Date()).toISOString(),
    updated_at: (doc.updated_at || new Date()).toISOString(),
  };
}

function folderFilter(parentId: string | null) {
  return parentId ? { parent_id: parentId } : { $or: [{ parent_id: null }, { parent_id: { $exists: false } }] };
}

function documentFilter(folderId: string | null) {
  return folderId
    ? { folder_id: folderId }
    : { $or: [{ folder_id: null }, { folder_id: { $exists: false } }] };
}

async function readLocal(): Promise<LocalStore> {
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as LocalStore;
    return {
      users: parsed.users || [],
      folders: parsed.folders || [],
      documents: (parsed.documents || []).map((doc) => ({
        ...doc,
        folder_id: doc.folder_id ?? null,
        file_url: doc.file_url || "",
      })),
    };
  } catch {
    return { users: [], folders: [], documents: [] };
  }
}

async function writeLocal(store: LocalStore) {
  await mkdir(path.dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
}

async function seedAdminIfNeeded() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;

  if (isMongoEnabled()) {
    const found = await User.findOne({ email });
    if (found) return;
    await User.create({
      name: "Admin",
      email,
      password_hash: await bcrypt.hash(password, 12),
      role: "admin",
      status: "active",
    });
    return;
  }

  const store = await readLocal();
  if (store.users.some((user) => user.email === email)) return;
  const timestamp = nowIso();
  store.users.push({
    id: randomUUID(),
    name: "Admin",
    email,
    password_hash: await bcrypt.hash(password, 12),
    role: "admin",
    status: "active",
    created_at: timestamp,
    updated_at: timestamp,
  });
  await writeLocal(store);
}

export async function ensureStore() {
  if (isMongoEnabled()) {
    await connectMongo();
    await seedAdminIfNeeded();
    return;
  }
  await seedAdminIfNeeded();
}

export async function findUserByEmail(email: string) {
  await ensureStore();
  if (isMongoEnabled()) {
    const user = await User.findOne({ email });
    return user ? asUser(user) : null;
  }
  const store = await readLocal();
  return store.users.find((user) => user.email === email) || null;
}

export async function findUserById(id: string) {
  await ensureStore();
  if (isMongoEnabled()) {
    const user = await User.findById(id);
    return user ? asUser(user) : null;
  }
  const store = await readLocal();
  return store.users.find((user) => user.id === id) || null;
}

export async function listUsers() {
  await ensureStore();
  if (isMongoEnabled()) {
    const users = await User.find().sort({ created_at: 1 });
    return users.map(asUser);
  }
  const store = await readLocal();
  return [...store.users].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function createUser(input: {
  name: string;
  email: string;
  password_hash: string;
  role: "admin" | "user";
}) {
  await ensureStore();
  if (isMongoEnabled()) {
    const created = await User.create({
      name: input.name,
      email: input.email,
      password_hash: input.password_hash,
      role: input.role,
      status: "active",
    });
    return asUser(created);
  }
  const store = await readLocal();
  const timestamp = nowIso();
  const created: UserRecord = {
    id: randomUUID(),
    name: input.name,
    email: input.email,
    password_hash: input.password_hash,
    role: input.role,
    status: "active",
    created_at: timestamp,
    updated_at: timestamp,
  };
  store.users.push(created);
  await writeLocal(store);
  return created;
}

export async function updateUser(
  id: string,
  patch: Partial<Pick<UserRecord, "status" | "password_hash">>
) {
  await ensureStore();
  if (isMongoEnabled()) {
    const user = await User.findById(id);
    if (!user) return null;
    if (patch.status) user.status = patch.status;
    if (patch.password_hash) user.password_hash = patch.password_hash;
    await user.save();
    return asUser(user);
  }
  const store = await readLocal();
  const user = store.users.find((item) => item.id === id);
  if (!user) return null;
  if (patch.status) user.status = patch.status;
  if (patch.password_hash) user.password_hash = patch.password_hash;
  user.updated_at = nowIso();
  await writeLocal(store);
  return user;
}

export async function deleteUser(id: string) {
  await ensureStore();
  if (isMongoEnabled()) {
    const user = await User.findById(id);
    if (!user) return false;
    await user.deleteOne();
    return true;
  }
  const store = await readLocal();
  const nextUsers = store.users.filter((item) => item.id !== id);
  if (nextUsers.length === store.users.length) return false;
  store.users = nextUsers;
  await writeLocal(store);
  return true;
}

export async function countActiveAdmins(excludeId?: string) {
  const users = await listUsers();
  return users.filter(
    (user) => user.role === "admin" && user.status === "active" && user.id !== excludeId
  ).length;
}

export async function findFolderById(id: string) {
  await ensureStore();
  if (isMongoEnabled()) {
    const folder = await FolderModel.findById(id);
    return folder ? asFolder(folder) : null;
  }
  const store = await readLocal();
  return store.folders.find((item) => item.id === id) || null;
}

export async function listFolders(parentId: string | null) {
  await ensureStore();
  if (isMongoEnabled()) {
    const folders = await FolderModel.find(folderFilter(parentId)).sort({ name: 1 });
    return folders.map(asFolder);
  }
  const store = await readLocal();
  return store.folders
    .filter((item) => item.parent_id === parentId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getBreadcrumbs(folderId: string | null) {
  const crumbs: FolderRecord[] = [];
  let current = folderId;
  const guard = new Set<string>();
  while (current && !guard.has(current)) {
    guard.add(current);
    const folder = await findFolderById(current);
    if (!folder) break;
    crumbs.unshift(folder);
    current = folder.parent_id;
  }
  return crumbs;
}

export async function createFolder(name: string, parentId: string | null) {
  await ensureStore();
  const trimmed = name.trim().slice(0, 80) || "Untitled folder";
  if (isMongoEnabled()) {
    const created = await FolderModel.create({
      name: trimmed,
      parent_id: parentId || null,
    });
    return asFolder(created);
  }
  const store = await readLocal();
  const timestamp = nowIso();
  const created: FolderRecord = {
    id: randomUUID(),
    name: trimmed,
    parent_id: parentId,
    created_at: timestamp,
    updated_at: timestamp,
  };
  store.folders.push(created);
  await writeLocal(store);
  return created;
}

export async function renameFolder(id: string, name: string) {
  await ensureStore();
  const trimmed = name.trim().slice(0, 80);
  if (!trimmed) return null;
  if (isMongoEnabled()) {
    const folder = await FolderModel.findById(id);
    if (!folder) return null;
    folder.name = trimmed;
    await folder.save();
    return asFolder(folder);
  }
  const store = await readLocal();
  const folder = store.folders.find((item) => item.id === id);
  if (!folder) return null;
  folder.name = trimmed;
  folder.updated_at = nowIso();
  await writeLocal(store);
  return folder;
}

async function collectFolderIds(id: string): Promise<string[]> {
  const ids = [id];
  const children = await listFolders(id);
  for (const child of children) {
    ids.push(...(await collectFolderIds(child.id)));
  }
  return ids;
}

export async function deleteFolder(id: string) {
  await ensureStore();
  const folder = await findFolderById(id);
  if (!folder) return null;
  const ids = await collectFolderIds(id);
  const removedDocs: DocumentRecord[] = [];

  if (isMongoEnabled()) {
    const docs = await DocumentModel.find({ folder_id: { $in: ids } });
    removedDocs.push(...docs.map(asDocument));
    await DocumentModel.deleteMany({ folder_id: { $in: ids } });
    await FolderModel.deleteMany({ _id: { $in: ids } });
    return { folder, documents: removedDocs };
  }

  const store = await readLocal();
  const idSet = new Set(ids);
  for (const doc of store.documents) {
    if (doc.folder_id && idSet.has(doc.folder_id)) removedDocs.push(doc);
  }
  store.documents = store.documents.filter(
    (doc) => !doc.folder_id || !idSet.has(doc.folder_id)
  );
  store.folders = store.folders.filter((item) => !idSet.has(item.id));
  await writeLocal(store);
  return { folder, documents: removedDocs };
}

export async function listDocuments(folderId: string | null = null) {
  await ensureStore();
  if (isMongoEnabled()) {
    const docs = await DocumentModel.find(documentFilter(folderId)).sort({
      created_at: -1,
    });
    return docs.map(asDocument);
  }
  const store = await readLocal();
  return store.documents
    .filter((doc) => doc.folder_id === folderId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function findDocumentById(id: string) {
  await ensureStore();
  if (isMongoEnabled()) {
    const doc = await DocumentModel.findById(id);
    return doc ? asDocument(doc) : null;
  }
  const store = await readLocal();
  return store.documents.find((item) => item.id === id) || null;
}

export async function createDocument(
  input: Omit<DocumentRecord, "id" | "created_at" | "updated_at"> & {
    uploaded_by?: string | null;
    uploaded_by_name?: string;
  }
) {
  await ensureStore();
  if (isMongoEnabled()) {
    const created = await DocumentModel.create({
      file_name: input.file_name,
      file_url: input.file_url,
      storage_path: input.storage_path,
      storage_resource_type: input.storage_resource_type,
      file_type: input.file_type,
      file_size: input.file_size,
      folder_id: input.folder_id || null,
      uploaded_by: input.uploaded_by || undefined,
      uploaded_by_name: input.uploaded_by_name || "",
    });
    return asDocument(created);
  }
  const store = await readLocal();
  const timestamp = nowIso();
  const created: DocumentRecord = {
    id: randomUUID(),
    ...input,
    created_at: timestamp,
    updated_at: timestamp,
  };
  store.documents.unshift(created);
  await writeLocal(store);
  return created;
}

export async function renameDocument(id: string, name: string) {
  await ensureStore();
  const trimmed = name.trim().slice(0, 255).replace(/[/\\]/g, "_");
  if (!trimmed) return null;
  if (isMongoEnabled()) {
    const doc = await DocumentModel.findById(id);
    if (!doc) return null;
    doc.file_name = trimmed;
    await doc.save();
    return asDocument(doc);
  }
  const store = await readLocal();
  const doc = store.documents.find((item) => item.id === id);
  if (!doc) return null;
  doc.file_name = trimmed;
  doc.updated_at = nowIso();
  await writeLocal(store);
  return doc;
}

export async function deleteDocument(id: string) {
  await ensureStore();
  if (isMongoEnabled()) {
    const doc = await DocumentModel.findById(id);
    if (!doc) return null;
    const record = asDocument(doc);
    await doc.deleteOne();
    return record;
  }
  const store = await readLocal();
  const doc = store.documents.find((item) => item.id === id);
  if (!doc) return null;
  store.documents = store.documents.filter((item) => item.id !== id);
  await writeLocal(store);
  return doc;
}

export async function getDriveContents(folderId: string | null) {
  const current = folderId ? await findFolderById(folderId) : null;
  if (folderId && !current) {
    return null;
  }
  const [breadcrumbs, folders, documents] = await Promise.all([
    getBreadcrumbs(folderId),
    listFolders(folderId),
    listDocuments(folderId),
  ]);
  return { folder: current, breadcrumbs, folders, documents };
}
