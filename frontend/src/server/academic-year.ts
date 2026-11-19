/** Academic-year arithmetic. All dates are taken in India time (IST, UTC+5:30). */

export type MonthDay = { readonly month: number; readonly day: number };
export const DEFAULT_PROMOTION_DATE: MonthDay = { month: 6, day: 1 };

/** Year, month (1–12) and day of `date` in India. */
export function istParts(date: Date): { year: number; month: number; day: number } {
  const ist = new Date(date.getTime() + 330 * 60_000);
  return { year: ist.getUTCFullYear(), month: ist.getUTCMonth() + 1, day: ist.getUTCDate() };
}

/**
 * The academic year `date` falls in, named by its start year: with a 1 June
 * promotion date, 31 May 2027 is in 2026 (2026–27) and 1 June 2027 is in 2027.
 */
export function academicYearOf(date: Date, promotion: MonthDay = DEFAULT_PROMOTION_DATE): number {
  const { year, month, day } = istParts(date);
  const beforePromotion = month < promotion.month || (month === promotion.month && day < promotion.day);
  return beforePromotion ? year - 1 : year;
}

/** "2026–27". */
export function academicYearLabel(year: number): string {
  return `${year}–${String((year + 1) % 100).padStart(2, "0")}`;
}

export function isValidMonthDay(v: unknown): v is MonthDay {
  if (!v || typeof v !== "object") return false;
  const { month, day } = v as Record<string, unknown>;
  if (!Number.isInteger(month) || !Number.isInteger(day)) return false;
  const m = month as number;
  const d = day as number;
  // 28 Feb at most in February so the date exists every year.
  const max = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  return m >= 1 && m <= 12 && max !== undefined && d >= 1 && d <= max;
}
