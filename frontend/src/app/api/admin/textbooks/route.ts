import { randomUUID } from "node:crypto";
import { getSessionUser } from "@/server/auth/current-user";
import { addTextbook, findSubject } from "@/server/content";
import { getDb } from "@/server/db";
import { MEDIUMS, type Medium } from "@/server/db/schema";
import { isPdf, pdfPageCount } from "@/server/pdf";
import { fileStore } from "@/server/storage";

/** Largest textbook accepted (the biggest Tamil Nadu books are ~60 MB). */
const MAX_BYTES = 100 * 1024 * 1024;

/** Uploads a textbook PDF (admins only). Form fields: file, subjectId, medium, term?, title?, pages?. */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (user?.role !== "admin") return Response.json({ error: "forbidden" }, { status: 403 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "file" }, { status: 400 });
  }
  const file = form.get("file");
  const subjectId = String(form.get("subjectId") ?? "");
  const medium = String(form.get("medium") ?? "en");
  const term = Number(form.get("term") || 0) || null;
  const typedPages = Number(form.get("pages") || 0) || null;
  if (!(file instanceof File) || file.size === 0) return Response.json({ error: "file" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "too_big" }, { status: 413 });
  if (!findSubject(subjectId) || !(MEDIUMS as readonly string[]).includes(medium)) return Response.json({ error: "not_found" }, { status: 400 });

  const data = new Uint8Array(await file.arrayBuffer());
  if (!isPdf(data)) return Response.json({ error: "not_pdf" }, { status: 400 });
  const pages = typedPages ?? pdfPageCount(data);
  const storageKey = `textbooks/${subjectId}/${medium}/${randomUUID()}.pdf`;
  await fileStore().put(storageKey, data);
  try {
    const book = await addTextbook(
      await getDb(),
      {
        subjectId,
        medium: medium as Medium,
        term: term && term >= 1 && term <= 3 ? term : null,
        title: String(form.get("title") ?? "") || file.name.replace(/\.pdf$/i, ""),
        storageKey,
        sizeBytes: data.byteLength,
        pages,
      },
      user.id,
    );
    return Response.json({ textbook: { id: book.id, pages: book.pages } });
  } catch (err) {
    await fileStore().remove(storageKey);
    console.error(err);
    return Response.json({ error: "server" }, { status: 500 });
  }
}
