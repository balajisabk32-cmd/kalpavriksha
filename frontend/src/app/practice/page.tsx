import type { Metadata } from "next";
import { Suspense } from "react";
import { PracticePage } from "@/modules/practice/practice-page";

export const metadata: Metadata = { title: "Exercises & solutions — Kalpavriksha", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense>
      <PracticePage />
    </Suspense>
  );
}
