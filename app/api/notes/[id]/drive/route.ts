import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { jsonError } from "@/lib/serialize";
import { findNoteById } from "@/lib/store";
import { serializeDocument, serializeNote } from "@/lib/types";
import { saveNoteToDrive } from "@/lib/notes-drive";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { id } = await context.params;
  const note = await findNoteById(id);
  if (!note) {
    return jsonError("Note not found", 404);
  }

  try {
    const doc = await saveNoteToDrive(note, user);
    const updatedNote = await findNoteById(id);
    return Response.json({
      ok: true,
      document: serializeDocument(doc),
      note: updatedNote ? serializeNote(updatedNote) : null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save note to Drive";
    return jsonError(message, 500);
  }
}
