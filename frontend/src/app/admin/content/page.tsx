import { ContentOverviewPage } from "@/modules/staff/content";
import { coverage } from "@/server/content";
import { getDb } from "@/server/db";

export default async function AdminContentPage(props: PageProps<"/admin/content">) {
  const raw = (await props.searchParams).class;
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  const standard = n >= 4 && n <= 12 ? n : 4;
  return <ContentOverviewPage standard={standard} rows={await coverage(await getDb(), standard)} />;
}
