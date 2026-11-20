"use client";

import { ModuleShell } from "@/components/module-shell";
import { getModule } from "@/modules/registry";
import { PracticeScreen } from "./practice-screen";

/** Exercises & solutions inside the Digital Learning frame (header, background, sign-in). */
export function PracticePage() {
  return (
    <ModuleShell module={getModule("learn")!}>
      {() => (
        <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-4 sm:px-6">
          <PracticeScreen />
        </div>
      )}
    </ModuleShell>
  );
}
