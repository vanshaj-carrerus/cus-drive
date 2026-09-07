import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/auth";
import { countActiveAdmins, deleteUser, findUserById, updateUser } from "@/lib/store";
import { jsonError } from "@/lib/serialize";
import { toPublicUser } from "@/lib/types";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const { id } = await context.params;
  let body: { status?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request", 400);
  }

  const target = await findUserById(id);
  if (!target) {
    return jsonError("User not found", 404);
  }

  const patch: { status?: "active" | "disabled"; password_hash?: string } = {};

  if (body.status === "disabled" || body.status === "active") {
    if (target.id === user.id && body.status === "disabled") {
      return jsonError("You cannot disable your own account", 400);
    }
    if (target.role === "admin" && body.status === "disabled") {
      const activeAdmins = await countActiveAdmins(target.id);
      if (activeAdmins < 1) {
        return jsonError("At least one active admin is required", 400);
      }
    }
    patch.status = body.status;
  }

  if (typeof body.password === "string") {
    if (body.password.length < 8) {
      return jsonError("Password must be at least 8 characters", 400);
    }
    patch.password_hash = await bcrypt.hash(body.password, 12);
  }

  const updated = await updateUser(id, patch);
  if (!updated) {
    return jsonError("User not found", 404);
  }
  return Response.json({ user: toPublicUser(updated) });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const { id } = await context.params;
  if (id === user.id) {
    return jsonError("You cannot remove your own account", 400);
  }

  const target = await findUserById(id);
  if (!target) {
    return jsonError("User not found", 404);
  }

  if (target.role === "admin") {
    const activeAdmins = await countActiveAdmins(target.id);
    if (activeAdmins < 1) {
      return jsonError("At least one active admin is required", 400);
    }
  }

  await deleteUser(id);
  return Response.json({ ok: true });
}
