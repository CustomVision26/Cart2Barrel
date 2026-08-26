import { OutsidePurchaseReceiptLink } from "@/components/outside-purchase-receipt-link";
import { AdminProductUrlDialog } from "@/components/admin/admin-product-url-dialog";
import { isOutsidePurchaseProductUrl } from "@/lib/outside-purchase";
import { isHubStockProductUrl } from "@/lib/hub-stock";

type AdminItemRequestUrlOrReceiptProps = {
  productUrl: string;
  outsidePurchaseReceiptImageUrl?: string | null;
};

export function AdminItemRequestUrlOrReceipt({
  productUrl,
  outsidePurchaseReceiptImageUrl,
}: AdminItemRequestUrlOrReceiptProps) {
  if (isOutsidePurchaseProductUrl(productUrl)) {
    const receiptUrl = outsidePurchaseReceiptImageUrl?.trim();
    if (receiptUrl) {
      return <OutsidePurchaseReceiptLink url={receiptUrl} className="text-xs" />;
    }
    return <span className="text-xs text-muted-foreground">No receipt</span>;
  }
  if (isHubStockProductUrl(productUrl)) {
    return <span className="text-xs text-muted-foreground">In-hub catalog</span>;
  }
  return <AdminProductUrlDialog productUrl={productUrl} />;
}
