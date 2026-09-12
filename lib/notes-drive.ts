import { createDocument, updateNote } from "./store";
import { displayFileName, savePrivateFile } from "./storage";
import type { NoteRecord } from "./types";

export async function saveNoteToDrive(
  note: NoteRecord,
  user: { id: string; name: string }
) {
  const safeTitle =
    (note.title || "Untitled Note")
      .trim()
      .slice(0, 50)
      .replace(/[\\/:*?"<>|]/g, "_") || "Note";
  const fileName = `${safeTitle}.txt`;

  const header = `Title: ${note.title || "Untitled"}\nCategory: ${
    note.category || "General"
  }\nDate: ${new Date().toLocaleString()}\nAuthor: ${user.name}\n\n${"-".repeat(
    40
  )}\n\n`;
  const fileBody = `${header}${note.content}`;
  const buffer = Buffer.from(fileBody, "utf-8");

  const file = new File([buffer], fileName, { type: "text/plain" });
  const saved = await savePrivateFile(file);

  const doc = await createDocument({
    file_name: displayFileName(fileName, "text/plain"),
    file_url: saved.url,
    storage_path: saved.key,
    storage_resource_type: saved.resource_type,
    file_type: "text/plain",
    file_size: saved.size,
    folder_id: null,
    uploaded_by: user.id,
    uploaded_by_name: user.name,
  });

  await updateNote(note.id, { drive_doc_id: doc.id });
  return doc;
}
