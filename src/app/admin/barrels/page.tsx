import { redirect } from "next/navigation";

export default function AdminBarrelsCatalogMovedRedirect() {
  redirect("/admin/barrels/assign-to-barrel");
}
