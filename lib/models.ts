import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

function modelOf<T>(name: string, schema: Schema): Model<T> {
  if (mongoose.models && mongoose.models[name]) {
    delete (mongoose.models as Record<string, unknown>)[name];
  }
  return mongoose.model<T>(name, schema);
}

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password_hash: { type: String, required: true },
    role: { type: String, enum: ["admin", "user"], required: true },
    status: { type: String, enum: ["active", "disabled"], default: "active" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export type UserDoc = InferSchemaType<typeof userSchema> & {
  _id: mongoose.Types.ObjectId;
  created_at: Date;
  updated_at: Date;
};

export const User: Model<UserDoc> = modelOf<UserDoc>("User", userSchema);

const folderSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    parent_id: { type: Schema.Types.ObjectId, ref: "Folder", default: null },
    password_hash: { type: String, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export type FolderDoc = InferSchemaType<typeof folderSchema> & {
  _id: mongoose.Types.ObjectId;
  created_at: Date;
  updated_at: Date;
};

export const FolderModel: Model<FolderDoc> = modelOf<FolderDoc>(
  "Folder",
  folderSchema
);

const documentSchema = new Schema(
  {
    file_name: { type: String, required: true, trim: true },
    file_url: { type: String, required: true },
    storage_path: { type: String, required: true },
    storage_resource_type: { type: String, default: "raw" },
    file_type: { type: String, default: "" },
    file_size: { type: Number, default: 0 },
    folder_id: { type: Schema.Types.ObjectId, ref: "Folder", default: null },
    uploaded_by: { type: Schema.Types.ObjectId, ref: "User", required: false },
    uploaded_by_name: { type: String, required: false, default: "" },
    password_hash: { type: String, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export type DocumentDoc = InferSchemaType<typeof documentSchema> & {
  _id: mongoose.Types.ObjectId;
  created_at: Date;
  updated_at: Date;
};

export const DocumentModel: Model<DocumentDoc> = modelOf<DocumentDoc>(
  "Document",
  documentSchema
);

const noteSchema = new Schema(
  {
    title: { type: String, default: "", trim: true },
    content: { type: String, required: true },
    color: { type: String, default: "default" },
    category: { type: String, default: "General" },
    pinned: { type: Boolean, default: false },
    drive_doc_id: { type: Schema.Types.ObjectId, ref: "Document", default: null },
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: false },
    author_name: { type: String, default: "" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export type NoteDoc = InferSchemaType<typeof noteSchema> & {
  _id: mongoose.Types.ObjectId;
  created_at: Date;
  updated_at: Date;
};

export const NoteModel: Model<NoteDoc> = modelOf<NoteDoc>("Note", noteSchema);

