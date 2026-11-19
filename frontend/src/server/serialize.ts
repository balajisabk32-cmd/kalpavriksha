import type { StudentRow } from "./people";

/** Plain JSON for client components (dates as ISO strings). */
export function toListItem(s: StudentRow) {
  return { ...s, lastLoginAt: s.lastLoginAt?.toISOString() ?? null };
}
