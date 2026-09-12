import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { jsonError } from "@/lib/serialize";
import { createNote, listNotes } from "@/lib/store";
import { serializeNote } from "@/lib/types";
import { saveNoteToDrive } from "@/lib/notes-drive";

export async function GET(request: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const url = new URL(request.url);
  const mineOnly = url.searchParams.get("mine") === "true";

  const notes = await listNotes(mineOnly ? user.id : undefined);
  return Response.json({ notes: notes.map(serializeNote) });
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  let body: {
    title?: string;
    content?: string;
    color?: string;
    category?: string;
    pinned?: boolean;
    save_to_drive?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const title = (body.title || "").trim();
  const content = (body.content || "").trim();

  if (!title && !content) {
    return jsonError("Note title or content is required", 400);
  }

  const note = await createNote({
    title,
    content,
    color: body.color || "default",
    category: body.category || "General",
    pinned: Boolean(body.pinned),
    user_id: user.id,
    author_name: user.name,
  });

  // If save_to_drive is true (or defaults to true)
  if (body.save_to_drive) {
    try {
      const doc = await saveNoteToDrive(note, user);
      note.drive_doc_id = doc.id;
    } catch (driveErr) {
      console.error("Failed to save note to drive:", driveErr);
    }
  }

  return Response.json({ note: serializeNote(note) }, { status: 201 });
}

