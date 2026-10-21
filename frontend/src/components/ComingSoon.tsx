export default function ComingSoon({ title, description }: { title: string; description?: string }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <div role="status" className="rounded-lg border bg-card p-8 text-center">
        <p className="font-medium">This section is not built yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {description ?? "It will appear here once it is added. Nothing is shown until then."}
        </p>
      </div>
    </div>
  );
}