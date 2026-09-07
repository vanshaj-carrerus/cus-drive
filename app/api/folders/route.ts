import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { jsonError } from "@/lib/serialize";
import { createFolder, findFolderById } from "@/lib/store";
import { serializeFolder } from "@/lib/types";

export async function POST(request: NextRequest) {
  const { error } = await requireUser();
  if (error) return error;

  let body: { name?: string; parent_id?: string | null };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request", 400);
  }

  const parentId = body.parent_id || null;
  if (parentId) {
    const parent = await findFolderById(parentId);
    if (!parent) {
      return jsonError("Parent folder not found", 404);
    }
  }

  const folder = await createFolder(body.name || "Untitled folder", parentId);
  return Response.json({ folder: serializeFolder(folder) }, { status: 201 });
}
