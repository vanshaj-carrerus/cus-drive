import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { jsonError } from "@/lib/serialize";
import { getDriveContents } from "@/lib/store";
import { serializeDocument, serializeFolder } from "@/lib/types";

export async function GET(request: NextRequest) {
  const { error } = await requireUser();
  if (error) return error;

  const folderId = request.nextUrl.searchParams.get("folder");
  const drive = await getDriveContents(folderId || null);
  if (!drive) {
    return jsonError("Folder not found", 404);
  }

  return Response.json({
    folder: drive.folder ? serializeFolder(drive.folder) : null,
    breadcrumbs: drive.breadcrumbs.map(serializeFolder),
    folders: drive.folders.map(serializeFolder),
    documents: drive.documents.map(serializeDocument),
  });
}
