import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/auth";
import { createUser, findUserByEmail, listUsers } from "@/lib/store";
import { jsonError } from "@/lib/serialize";
import { toPublicUser } from "@/lib/types";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const users = await listUsers();
  return Response.json({ users: users.map(toPublicUser) });
}

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  let body: {
    name?: string;
    email?: string;
    password?: string;
    role?: string;
  };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request", 400);
  }

  const name = body.name?.trim() || "";
  const email = body.email?.trim().toLowerCase() || "";
  const password = body.password || "";
  const role = body.role === "admin" ? "admin" : "user";

  if (!name || !email || !password) {
    return jsonError("Name, user ID, and temporary password are required", 400);
  }

  if (password.length < 8) {
    return jsonError("Password must be at least 8 characters", 400);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !/^[a-z0-9._-]{3,}$/i.test(email)) {
    return jsonError("Enter a valid email or user ID", 400);
  }

  const exists = await findUserByEmail(email);
  if (exists) {
    return jsonError("A user with this ID already exists", 409);
  }

  const created = await createUser({
    name,
    email,
    password_hash: await bcrypt.hash(password, 12),
    role,
  });

  return Response.json({ user: toPublicUser(created) }, { status: 201 });
}
