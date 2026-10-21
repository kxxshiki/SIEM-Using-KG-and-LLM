export default function PageSkeleton() {
  return (
    <div role="status" className="space-y-4">
      <span className="sr-only">Loading page</span>
      <div className="h-7 w-48 animate-pulse rounded-md bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg border bg-card" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-lg border bg-card" />
    </div>
  );
}