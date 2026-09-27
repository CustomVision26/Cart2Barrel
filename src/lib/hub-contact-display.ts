export function googleMapsSearchUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function hubContactHasPublicDetails(contact: {
  supportEmail: string | null;
  supportPhone: string | null;
  whatsappNumber: string | null;
  businessHours: string | null;
  businessAddress: string | null;
  socialLinks: { label: string; url: string }[];
}): boolean {
  return Boolean(
    contact.supportEmail ||
      contact.supportPhone ||
      contact.whatsappNumber ||
      contact.businessHours ||
      contact.businessAddress ||
      contact.socialLinks.length > 0,
  );
}
