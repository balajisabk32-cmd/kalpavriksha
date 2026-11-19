/** Shown at once while a staff page loads, so a click never feels ignored. */
export function StaffPageLoading() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">Loading… · ஏற்றப்படுகிறது…</span>
      <div className="h-9 w-56 animate-pulse rounded-xl bg-line motion-reduce:animate-none" />
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-line/60 motion-reduce:animate-none" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-2xl bg-line/50 motion-reduce:animate-none" />
    </div>
  );
}
