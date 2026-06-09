import { BRAND_NAME } from "@/lib/brand";

export type InvoiceCompanyProfile = {
  name: string;
  addressLines: string[];
  phone: string | null;
  email: string | null;
};

function readEnvLine(key: string): string | null {
  const value = process.env[key]?.trim();
  return value || null;
}

/** Merchant block shown on customer payment invoices / receipts. */
export function getInvoiceCompanyProfile(): InvoiceCompanyProfile {
  const name = readEnvLine("INVOICE_COMPANY_NAME") ?? BRAND_NAME;
  const addressLines = [
    readEnvLine("INVOICE_COMPANY_ADDRESS_LINE1"),
    readEnvLine("INVOICE_COMPANY_ADDRESS_LINE2"),
    readEnvLine("INVOICE_COMPANY_ADDRESS_LINE3"),
  ].filter((line): line is string => Boolean(line));

  if (addressLines.length === 0) {
    addressLines.push("United States");
  }

  return {
    name,
    addressLines,
    phone: readEnvLine("INVOICE_COMPANY_PHONE"),
    email: readEnvLine("INVOICE_COMPANY_EMAIL") ?? readEnvLine("RESEND_FROM_EMAIL"),
  };
}
