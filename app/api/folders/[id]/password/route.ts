import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { jsonError } from "@/lib/serialize";
import { findFolderById, setFolderPassword, verifyFolderPassword } from "@/lib/store";
import { serializeFolder } from "@/lib/types";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { id } = await context.params;
  const folder = await findFolderById(id);
  if (!folder) {
    return jsonError("Folder not found", 404);
  }

  let body: { password?: string; currentPassword?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  // If folder is already locked, verify current password unless admin
  if (folder.password_hash && user.role !== "admin") {
    if (!body.currentPassword) {
      return jsonError("Current password is required to change or remove protection", 400);
    }
    const match = await verifyFolderPassword(id, body.currentPassword);
    if (!match) {
      return jsonError("Current password is incorrect", 401);
    }
  }

  const newPassword = body.password ? body.password.trim() : null;
  const updated = await setFolderPassword(id, newPassword);
  if (!updated) {
    return jsonError("Failed to update folder password", 500);
  }

  return Response.json({
    ok: true,
    folder: serializeFolder(updated),
    is_locked: Boolean(updated.password_hash),
  });
}
