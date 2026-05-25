import { AdminHubContactForm } from "@/components/admin/admin-hub-contact-form";
import { getHubContactSettingsForAdmin } from "@/data/hub-contact-settings";

export default async function AdminSupportContactPage() {
  const settings = await getHubContactSettingsForAdmin();

  return (
    <section>
      <h2 className="mb-4 text-lg font-medium text-foreground">Hub contact</h2>
      <AdminHubContactForm initial={settings} />
    </section>
  );
}
