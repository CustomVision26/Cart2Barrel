import { AdminDocumentationBrowser } from "@/components/documentation/admin-documentation-browser";

export default function AdminGuidePage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Admin guide
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Staff reference for every admin page and workflow. Each topic includes a
          quick reference for scanning and a full article for deeper reading. This
          guide is only available to admin users.
        </p>
      </div>

      <AdminDocumentationBrowser variant="page" />
    </div>
  );
}
