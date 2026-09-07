import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { jsonError } from "@/lib/serialize";
import { serializeDocument } from "@/lib/types";
import { createDocument, findFolderById, listDocuments } from "@/lib/store";
import {
  displayFileName,
  isAllowedFile,
  maxFileSizeBytes,
  savePrivateFile,
} from "@/lib/storage";

export async function GET(request: NextRequest) {
  const { error } = await requireUser();
  if (error) return error;

  const folderId = request.nextUrl.searchParams.get("folder");
  const docs = await listDocuments(folderId || null);
  return Response.json({ documents: docs.map(serializeDocument) });
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError(
      "The file is too large for the server to read. Use a file under 25 MB.",
      413
    );
  }
  const file = form.get("file");
  const folderId = String(form.get("folder_id") || "") || null;

  if (folderId) {
    const folder = await findFolderById(folderId);
    if (!folder) {
      return jsonError("Folder not found", 404);
    }
  }

  if (!(file instanceof File)) {
    return jsonError("Select a document to upload", 400);
  }

  if (file.size > maxFileSizeBytes()) {
    return jsonError(
      `File is too large. Maximum size is ${process.env.MAX_FILE_SIZE_MB || 25} MB.`,
      400
    );
  }

  if (!isAllowedFile(file.name, file.type)) {
    return jsonError("This file type is not allowed", 400);
  }

  let saved;
  try {
    saved = await savePrivateFile(file);
  } catch (uploadError) {
    const message =
      uploadError instanceof Error ? uploadError.message.toLowerCase() : "";
    if (
      message.includes("file size") ||
      message.includes("too large") ||
      message.includes("413")
    ) {
      return jsonError(
        "This file is too large for Cloudinary. Please upload a file under 10 MB.",
        400
      );
    }
    return jsonError(
      "Could not upload the file to Cloudinary. Try again or use a smaller file.",
      502
    );
  }

  try {
    const doc = await createDocument({
      file_name: displayFileName(file.name, file.type),
      file_url: saved.url,
      storage_path: saved.key,
      storage_resource_type: saved.resource_type,
      file_type: file.type || "application/octet-stream",
      file_size: saved.size,
      folder_id: folderId,
      uploaded_by: user.id,
      uploaded_by_name: user.name,
    });
    return Response.json({ document: serializeDocument(doc) }, { status: 201 });
  } catch (saveError) {
    const message =
      saveError instanceof Error ? saveError.message : "Could not save file";
    return jsonError(message, 500);
  }
}
