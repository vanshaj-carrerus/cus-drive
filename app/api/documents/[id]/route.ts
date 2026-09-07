import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { jsonError } from "@/lib/serialize";
import { serializeDocument } from "@/lib/types";
import { deleteDocument, findDocumentById, renameDocument } from "@/lib/store";
import { deletePrivateFile } from "@/lib/storage";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { error } = await requireUser();
  if (error) return error;

  const { id } = await context.params;
  const doc = await findDocumentById(id);
  if (!doc) {
    return jsonError("Document not found", 404);
  }
  return Response.json({ document: serializeDocument(doc) });
}

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

  const doc = await renameDocument(id, body.name || "");
  if (!doc) {
    return jsonError("Document not found", 404);
  }
  return Response.json({ document: serializeDocument(doc) });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { error } = await requireUser();
  if (error) return error;

  const { id } = await context.params;
  const doc = await deleteDocument(id);
  if (!doc) {
    return jsonError("Document not found", 404);
  }

  await deletePrivateFile(doc.storage_path, doc.storage_resource_type);
  return Response.json({ ok: true });
}
