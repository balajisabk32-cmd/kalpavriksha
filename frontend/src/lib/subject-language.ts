/**
 * The Tamil subject is taught only in Tamil and the English subject only in
 * English, whatever the student's medium. Other subjects follow the medium.
 */
export function subjectLanguage(subjectOrChapterId: string): "en" | "ta" | null {
  const subjectId = subjectOrChapterId.replace(/-ch\d+$/, "");
  if (/^c\d+-tamil$/.test(subjectId)) return "ta";
  if (/^c\d+-english$/.test(subjectId)) return "en";
  return null;
}
