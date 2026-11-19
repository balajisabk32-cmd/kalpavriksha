import { VideoImportPage } from "@/modules/staff/content";
import { CONTENT_STANDARDS, subjectsFor } from "@/server/content";

export default function AdminVideoImportPage() {
  const subjectNames = Object.fromEntries(CONTENT_STANDARDS.flatMap((std) => subjectsFor(std).map((s) => [s.id, s.name])));
  return <VideoImportPage subjectNames={subjectNames} />;
}
