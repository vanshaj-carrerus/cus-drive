import { SignJWT, jwtVerify } from "jose";
import { SESSION_MAX_AGE_SECONDS } from "./constants";
import type { SessionUser } from "./session-types";

export type { SessionUser } from "./session-types";

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET must be set to a long random string");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: SessionUser) {
  return new SignJWT({
    name: user.name,
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

export async function readSessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub || typeof payload.email !== "string") {
      return null;
    }
    const role = payload.role === "admin" ? "admin" : "user";
    return {
      id: payload.sub,
      name: typeof payload.name === "string" ? payload.name : "",
      email: payload.email,
      role,
    };
  } catch {
    return null;
  }
}
