export const SESSION_COOKIE = "ddp_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours

export const DOCUMENT_CATEGORIES = [
  "General",
  "Policy",
  "Finance",
  "HR",
  "Technical",
  "Notice",
] as const;

export const MAX_UPLOAD_MB = 25;

export const INLINE_VIEW_TYPES = new Set([
  "application/pdf",
  "application/json",
  "application/xml",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/svg+xml",
  "text/plain",
  "text/csv",
  "text/html",
  "text/css",
  "text/xml",
  "text/markdown",
  "text/javascript",
]);

export const INLINE_VIEW_EXTENSIONS = new Set([
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".svg",
  ".txt",
  ".env",
  ".md",
  ".csv",
  ".json",
  ".xml",
  ".html",
  ".htm",
  ".css",
  ".js",
  ".ts",
  ".log",
  ".yml",
  ".yaml",
  ".ini",
  ".cfg",
  ".conf",
  ".sql",
  ".gitignore",
]);

export const TEXT_LIKE_EXTENSIONS = new Set([
  ".txt",
  ".env",
  ".md",
  ".csv",
  ".json",
  ".xml",
  ".html",
  ".htm",
  ".css",
  ".js",
  ".ts",
  ".log",
  ".yml",
  ".yaml",
  ".ini",
  ".cfg",
  ".conf",
  ".sql",
  ".gitignore",
]);
