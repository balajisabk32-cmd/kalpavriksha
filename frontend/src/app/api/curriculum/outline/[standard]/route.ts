import { SUPPORTED_STANDARDS } from "@/lib/curriculum";
import { getStandardOutline } from "@/lib/curriculum-data";

/** Prerendered at build time: one small JSON file per class. */
export function generateStaticParams() {
  return SUPPORTED_STANDARDS.map((standard) => ({ standard: String(standard) }));
}

/** Subjects and chapter list for one class, without lesson text or questions. */
export async function GET(_request: Request, ctx: RouteContext<"/api/curriculum/outline/[standard]">) {
  const { standard } = await ctx.params;
  const outline = getStandardOutline(Number(standard));
  if (!outline) return Response.json({ error: `Class ${standard} is not supported.` }, { status: 404 });
  return Response.json(outline);
}
