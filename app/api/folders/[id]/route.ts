import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { jsonError } from "@/lib/serialize";
import { deleteFolder, renameFolder } from "@/lib/store";
import { deletePrivateFile } from "@/lib/storage";
import { serializeFolder } from "@/lib/types";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { error } = await requireUser();
  if (error) return error;

  const { id } = await context.params;
  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request", 400);
  }

  const folder = await renameFolder(id, body.name || "");
  if (!folder) {
    return jsonError("Folder not found", 404);
  }
  return Response.json({ folder: serializeFolder(folder) });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { error } = await requireUser();
  if (error) return error;

  const { id } = await context.params;
  const removed = await deleteFolder(id);
  if (!removed) {
    return jsonError("Folder not found", 404);
  }

  await Promise.all(
    removed.documents.map((doc) =>
      deletePrivateFile(doc.storage_path, doc.storage_resource_type)
    )
  );

  return Response.json({ ok: true });
}
