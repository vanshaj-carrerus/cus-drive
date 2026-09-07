import { randomUUID } from "crypto";
import path from "path";
import { MAX_UPLOAD_MB, TEXT_LIKE_EXTENSIONS } from "./constants";
import { getCloudinary, isCloudinaryEnabled } from "./cloudinary";

export function extensionOf(fileName: string) {
  const base = path.basename(fileName);
  if (!base) return "";
  if (base.startsWith(".") && !base.slice(1).includes(".")) {
    return base.toLowerCase();
  }
  return path.extname(base).toLowerCase();
}

export function displayFileName(fileName: string, mimeType: string) {
  const cleaned = fileName.replace(/[/\\]/g, "_").slice(0, 255) || "document";
  if (extensionOf(cleaned) || cleaned.startsWith(".")) return cleaned;
  if (mimeType === "application/pdf") return `${cleaned}.pdf`;
  if (mimeType === "image/png") return `${cleaned}.png`;
  if (mimeType === "image/jpeg") return `${cleaned}.jpg`;
  return cleaned;
}

export function fileFormat(fileName: string, mimeType = "") {
  const ext = extensionOf(fileName).replace(".", "");
  if (ext) return ext;
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg") return "jpg";
  return "bin";
}

function uploadResourceType(file: File) {
  const type = file.type || "";
  if (
    type === "image/png" ||
    type === "image/jpeg" ||
    type === "image/gif" ||
    type === "image/webp" ||
    type === "image/bmp"
  ) {
    return "image";
  }
  return "raw";
}

export function isTextLikeFile(fileName: string, mimeType = "") {
  if (mimeType.startsWith("text/") || mimeType === "application/json") return true;
  return TEXT_LIKE_EXTENSIONS.has(extensionOf(fileName));
}

export function isAllowedFile(_fileName?: string, _mimeType?: string) {
  return true;
}

export function maxFileSizeBytes() {
  const mb = Number(process.env.MAX_FILE_SIZE_MB || MAX_UPLOAD_MB);
  return mb * 1024 * 1024;
}

export type StoredFile = {
  key: string;
  url: string;
  size: number;
  resource_type: string;
};

export async function savePrivateFile(file: File): Promise<StoredFile> {
  if (!isCloudinaryEnabled()) {
    throw new Error("Cloudinary is not configured");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const publicId = `department-docs/${randomUUID()}`;
  const cloudinary = getCloudinary();

  const result = await new Promise<{
    public_id: string;
    secure_url: string;
    bytes: number;
    resource_type: string;
  }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: uploadResourceType(file),
        type: "authenticated",
        overwrite: false,
        use_filename: false,
        unique_filename: false,
      },
      (error, uploaded) => {
        if (error || !uploaded) {
          const message =
            (error && "message" in error && String(error.message)) ||
            (error &&
              typeof error === "object" &&
              "error" in error &&
              error.error &&
              typeof error.error === "object" &&
              "message" in error.error &&
              String(error.error.message)) ||
            "Cloudinary upload failed";
          reject(new Error(message));
          return;
        }
        resolve({
          public_id: uploaded.public_id,
          secure_url: uploaded.secure_url,
          bytes: uploaded.bytes,
          resource_type: uploaded.resource_type,
        });
      }
    );
    stream.end(buffer);
  });

  return {
    key: result.public_id,
    url: result.secure_url,
    size: result.bytes || buffer.length,
    resource_type: result.resource_type || "raw",
  };
}

export function signedFileUrl(
  publicId: string,
  resourceType: string,
) {
  const cloudinary = getCloudinary();
  return cloudinary.url(publicId, {
    resource_type: resourceType || "raw",
    type: "authenticated",
    sign_url: true,
    secure: true,
    force_version: false,
    urlAnalytics: false,
    analytics: false,
  });
}

export async function readPrivateFile(
  publicId: string,
  resourceType: string,
  fileName: string,
  mimeType = ""
) {
  const cloudinary = getCloudinary();
  const format = fileFormat(fileName, mimeType);
  const resourceTypes = [...new Set([resourceType || "raw", "raw", "image"])];
  let lastError = "Could not read file from Cloudinary";

  for (const type of resourceTypes) {
    const downloadUrl = cloudinary.utils.private_download_url(publicId, format, {
      resource_type: type as "image" | "raw" | "video",
      type: "authenticated",
      attachment: false,
      expires_at: Math.floor(Date.now() / 1000) + 120,
    });
    const downloaded = await fetch(downloadUrl);
    if (downloaded.ok) {
      return {
        bytes: await downloaded.arrayBuffer(),
        contentType:
          mimeType ||
          downloaded.headers.get("content-type") ||
          "application/octet-stream",
      };
    }

    const signed = signedFileUrl(publicId, type);
    const delivered = await fetch(signed);
    if (delivered.ok) {
      return {
        bytes: await delivered.arrayBuffer(),
        contentType:
          mimeType ||
          delivered.headers.get("content-type") ||
          "application/octet-stream",
      };
    }
    lastError = `Cloudinary returned ${downloaded.status}`;
  }

  throw new Error(lastError);
}

export async function deletePrivateFile(
  storagePath: string,
  resourceType = "raw"
) {
  if (!storagePath || !isCloudinaryEnabled()) {
    return;
  }

  try {
    const cloudinary = getCloudinary();
    await cloudinary.uploader.destroy(storagePath, {
      resource_type: resourceType,
      type: "authenticated",
      invalidate: true,
    });
  } catch {
    // Metadata delete can still proceed if Cloudinary already removed the file.
  }
}
