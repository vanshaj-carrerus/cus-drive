import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { INLINE_VIEW_EXTENSIONS, INLINE_VIEW_TYPES } from "@/lib/constants";
import { findDocumentById, verifyDocumentPassword } from "@/lib/store";
import { jsonError } from "@/lib/serialize";
import { extensionOf, isTextLikeFile, readPrivateFile } from "@/lib/storage";

type RouteContext = { params: Promise<{ id: string }> };

function contentDisposition(inline: boolean, fileName: string) {
  const safe = fileName.replace(/["\\\r\n]/g, "_");
  const encoded = encodeURIComponent(fileName);
  return `${inline ? "inline" : "attachment"}; filename="${safe}"; filename*=UTF-8''${encoded}`;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { id } = await context.params;
  const doc = await findDocumentById(id);
  if (!doc) {
    return jsonError("Document not found", 404);
  }

  if (doc.password_hash) {
    const providedPassword =
      request.nextUrl.searchParams.get("password") ||
      request.headers.get("x-file-password");
    if (!providedPassword) {
      return jsonError("This file is password protected. Password required.", 401);
    }
    const match = await verifyDocumentPassword(id, providedPassword);
    if (!match) {
      return jsonError("Incorrect password for this file", 401);
    }
  }

  const dispositionParam = request.nextUrl.searchParams.get("disposition");
  const canInline =
    INLINE_VIEW_TYPES.has(doc.file_type) ||
    INLINE_VIEW_EXTENSIONS.has(extensionOf(doc.file_name)) ||
    doc.file_type.startsWith("text/") ||
    doc.file_type.startsWith("image/");
  const inline = dispositionParam === "inline" && canInline;

  try {
    const file = await readPrivateFile(
      doc.storage_path,
      doc.storage_resource_type,
      doc.file_name,
      doc.file_type
    );

    const contentType = isTextLikeFile(doc.file_name, doc.file_type)
      ? "text/plain; charset=utf-8"
      : file.contentType || doc.file_type || "application/octet-stream";

    return new NextResponse(new Uint8Array(file.bytes), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentDisposition(inline, doc.file_name),
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return jsonError("Could not open this file. Try again or re-upload it.", 502);
  }
}
