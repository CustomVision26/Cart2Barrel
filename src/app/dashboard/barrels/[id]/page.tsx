export default async function DashboardBarrelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Barrel {id}
      </h1>
      <p className="text-sm text-muted-foreground">
        Barrel contents and status will load here.
      </p>
    </div>
  );
}
