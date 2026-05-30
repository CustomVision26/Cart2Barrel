import { AdminHubContactForm } from "@/components/admin/admin-hub-contact-form";
import { loadHubContactSettings } from "@/data/hub-contact-settings";

export const dynamic = "force-dynamic";

export default async function AdminSupportContactPage() {
  const hubContact = await loadHubContactSettings();

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        These details appear on the shopper Contact us screen (email, phone,
        social links, and intro text).
      </p>
      <AdminHubContactForm initial={hubContact} />
    </div>
  );
}
