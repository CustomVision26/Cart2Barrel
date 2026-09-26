import type { InvoiceCompanyProfile } from "@/lib/invoice/company-profile";
import type { OutboundShippingChargeLineView } from "@/lib/barrel-outbound-shipping-charge";
import type { BarrelContentItem } from "@/lib/barrel-contents";

export type CustomsClearancePackPartner = {
  kindLabel: string;
  name: string;
  location: string | null;
  country: string | null;
  address: string | null;
  phone: string | null;
  cashappId: string | null;
  cashappAccount: string | null;
  zelleId: string | null;
  zelleAccount: string | null;
  lines: OutboundShippingChargeLineView[];
  totalCents: number;
  receiptUrl: string | null;
  paymentMethod: string | null;
  paidAt: string | null;
  notes: string | null;
};

export type CustomsClearancePackPdfPayload = {
  filename: string;
  containerName: string;
  containerAlias: string;
  containerImageUrl: string | null;
  contents: BarrelContentItem[];
  sender: InvoiceCompanyProfile;
  receiver: {
    name: string;
    phone: string | null;
    email: string | null;
    addressLines: string[];
  };
  freight: CustomsClearancePackPartner | null;
  broker: CustomsClearancePackPartner | null;
  courier: CustomsClearancePackPartner | null;
  tracking: {
    freightCompanyName: string | null;
    freightDropOffAt: string | null;
    estimatedArrivalAt: string | null;
    paymentReference: string | null;
    customsFormUrl: string | null;
  };
};
