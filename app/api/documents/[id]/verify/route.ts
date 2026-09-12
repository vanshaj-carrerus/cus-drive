import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { jsonError } from "@/lib/serialize";
import { findDocumentById, verifyDocumentPassword } from "@/lib/store";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { error } = await requireUser();
  if (error) return error;

  const { id } = await context.params;
  const doc = await findDocumentById(id);
  if (!doc) {
    return jsonError("Document not found", 404);
  }

  if (!doc.password_hash) {
    return Response.json({ ok: true, is_locked: false });
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  if (!body.password) {
    return jsonError("Password is required", 400);
  }

  const valid = await verifyDocumentPassword(id, body.password);
  if (!valid) {
    return jsonError("Incorrect password", 401);
  }

  return Response.json({ ok: true, is_locked: true });
}
