import { NextResponse } from "next/server";
import { findUserById } from "./store";
import { clearSessionCookie, getSessionFromCookies, type SessionUser } from "./session";

export type AuthUser = SessionUser & {
  status: "active" | "disabled";
};

export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await getSessionFromCookies();
  if (!session) {
    return null;
  }

  const user = await findUserById(session.id);
  if (!user || user.status !== "active") {
    await clearSessionCookie();
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
  };
}

export async function requireUser(): Promise<
  { user: AuthUser; error: null } | { user: null; error: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { user, error: null };
}

export async function requireAdmin(): Promise<
  { user: AuthUser; error: null } | { user: null; error: NextResponse }
> {
  const result = await requireUser();
  if (result.error) {
    return result;
  }
  if (result.user.role !== "admin") {
    return {
      user: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { user: result.user, error: null };
}
