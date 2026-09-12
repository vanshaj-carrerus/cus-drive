import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { jsonError } from "@/lib/serialize";
import { deleteNote, findNoteById, updateNote } from "@/lib/store";
import { serializeNote } from "@/lib/types";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { error } = await requireUser();
  if (error) return error;

  const { id } = await context.params;
  const note = await findNoteById(id);
  if (!note) {
    return jsonError("Note not found", 404);
  }

  return Response.json({ note: serializeNote(note) });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { id } = await context.params;
  const existing = await findNoteById(id);
  if (!existing) {
    return jsonError("Note not found", 404);
  }

  // Author or admin can update note
  if (existing.user_id && existing.user_id !== user.id && user.role !== "admin") {
    return jsonError("You can only edit your own notes", 403);
  }

  let body: {
    title?: string;
    content?: string;
    color?: string;
    category?: string;
    pinned?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const updated = await updateNote(id, {
    title: body.title,
    content: body.content,
    color: body.color,
    category: body.category,
    pinned: body.pinned,
  });

  if (!updated) {
    return jsonError("Failed to update note", 500);
  }

  return Response.json({ note: serializeNote(updated) });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { id } = await context.params;
  const existing = await findNoteById(id);
  if (!existing) {
    return jsonError("Note not found", 404);
  }

  // Author or admin can delete note
  if (existing.user_id && existing.user_id !== user.id && user.role !== "admin") {
    return jsonError("You can only delete your own notes", 403);
  }

  const deleted = await deleteNote(id);
  if (!deleted) {
    return jsonError("Failed to delete note", 500);
  }

  return Response.json({ ok: true, note: serializeNote(deleted) });
}
