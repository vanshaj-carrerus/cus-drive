import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { findUserByEmail } from "@/lib/store";
import { applySessionCookie, createSessionCookieValue } from "@/lib/session";
import { allowLoginAttempt, clearLoginAttempts, getClientIp } from "@/lib/rate-limit";
import { jsonError } from "@/lib/serialize";

export const runtime = "nodejs";


export const dynamic = "force-dynamic";

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

function fail(
  request: NextRequest,
  json: boolean,
  message: string,
  status: number,
  code: string
) {
  if (json) {
    return jsonError(message, status);
  }
  const url = new URL("/login", request.url);
  url.searchParams.set("error", code);
  return NextResponse.redirect(url, 303);
}

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/login", request.url));
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const contentType = request.headers.get("content-type") || "";
  const wantsJson = contentType.includes("application/json");

  try {
    const limit = allowLoginAttempt(ip);
    if (!limit.ok) {
      return fail(
        request,
        wantsJson,
        "Too many login attempts. Try again later.",
        429,
        "rate"
      );
    }

    let credentials: { email: string; password: string; json: boolean };
    try {
      credentials = await readCredentials(request);
    } catch {
      return fail(request, wantsJson, "Invalid request", 400, "required");
    }

    const { email, password, json } = credentials;

    if (!email || !password) {
      return fail(request, json, "User ID and password are required", 400, "required");
    }

    if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 16) {
      return fail(
        request,
        json,
        "Server is missing AUTH_SECRET. Add it in Vercel environment variables.",
        500,
        "server"
      );
    }

    if (!process.env.MONGODB_URI?.trim()) {
      return fail(
        request,
        json,
        "Server is missing MONGODB_URI. Add it in Vercel environment variables.",
        500,
        "server"
      );
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
  } catch (error) {
    console.error("Login failed", error);
    return fail(
      request,
      wantsJson,
      "Could not sign in. Check MongoDB access and Vercel environment variables.",
      500,
      "server"
    );
  }
}

