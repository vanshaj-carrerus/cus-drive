import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { findUserByEmail } from "@/lib/store";
import { applySessionCookie, createSessionCookieValue } from "@/lib/session";
import { allowLoginAttempt, clearLoginAttempts, getClientIp } from "@/lib/rate-limit";
import { jsonError } from "@/lib/serialize";

async function readCredentials(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as { email?: string; password?: string };
    return {
      email: body.email?.trim().toLowerCase() || "",
      password: body.password || "",
      json: true,
    };
  }

  const form = await request.formData();
  return {
    email: String(form.get("email") || "")
      .trim()
      .toLowerCase(),
    password: String(form.get("password") || ""),
    json: false,
  };
}

function fail(request: NextRequest, json: boolean, message: string, status: number, code: string) {
  if (json) {
    return jsonError(message, status);
  }
  const url = new URL("/login", request.url);
  url.searchParams.set("error", code);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const limit = allowLoginAttempt(ip);
  if (!limit.ok) {
    const contentType = request.headers.get("content-type") || "";
    return fail(
      request,
      contentType.includes("application/json"),
      "Too many login attempts. Try again later.",
      429,
      "rate"
    );
  }

  let credentials: { email: string; password: string; json: boolean };
  try {
    credentials = await readCredentials(request);
  } catch {
    return fail(request, true, "Invalid request", 400, "required");
  }

  const { email, password, json } = credentials;

  if (!email || !password) {
    return fail(request, json, "User ID and password are required", 400, "required");
  }

  const user = await findUserByEmail(email);
  if (!user || user.status !== "active") {
    return fail(request, json, "Invalid user ID or password", 401, "invalid");
  }

  const matches = await bcrypt.compare(password, user.password_hash);
  if (!matches) {
    return fail(request, json, "Invalid user ID or password", 401, "invalid");
  }

  clearLoginAttempts(ip);
  const token = await createSessionCookieValue({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  });

  if (json) {
    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
    return applySessionCookie(response, token);
  }

  const response = NextResponse.redirect(new URL("/documents", request.url), 303);
  return applySessionCookie(response, token);
}
