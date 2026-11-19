/** The shape of a chapter explanation and how a pasted Gemini answer is read. Shared by server and browser. */
import { z } from "zod";

const line = (max: number) => z.string().trim().min(1).max(max);

export const explanationSchema = z.object({
  /** Two or three sentences: what the chapter is about and why it matters. */
  summary: line(1200),
  sections: z
    .array(
      z.object({
        heading: line(200),
        explanation: line(4000),
        analogy: z.object({ title: line(200), story: line(3000) }),
        example: z.string().trim().max(1500).optional(),
      }),
    )
    .min(1)
    .max(12),
  keyPoints: z.array(line(400)).min(1).max(15),
  checkYourself: z
    .array(z.object({ question: line(500), answer: line(1500) }))
    .max(10)
    .default([]),
  words: z
    .array(z.object({ term: line(120), meaning: line(500) }))
    .max(25)
    .default([]),
});
export type Explanation = z.infer<typeof explanationSchema>;

export type ParseResult = { ok: true; data: Explanation } | { ok: false; error: string };

/**
 * Reads what was pasted from Gemini: tolerates ```json fences, text around the
 * JSON and curly quotes. Returns a short reason when it can't be used.
 */
export function parseExplanation(raw: string): ParseResult {
  let text = raw.trim().replace(/^﻿/, "");
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  if (fenced) text = fenced[1]!.trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return { ok: false, error: "No JSON object found. Copy Gemini's whole answer." };
  text = text.slice(start, end + 1);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    try {
      // Gemini sometimes "prettifies" quotes or leaves trailing commas.
      json = JSON.parse(text.replace(/[“”]/g, '"').replace(/,\s*([}\]])/g, "$1"));
    } catch (err) {
      return { ok: false, error: `The JSON is broken: ${(err as Error).message}` };
    }
  }
  const parsed = explanationSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    return { ok: false, error: `${issue.path.join(".") || "answer"}: ${issue.message}` };
  }
  return { ok: true, data: parsed.data };
}

