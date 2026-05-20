import { redirect } from "next/navigation";

export default function LegacyDeliverySettingsRedirect() {
  redirect("/dashboard/shipping/address");
}
