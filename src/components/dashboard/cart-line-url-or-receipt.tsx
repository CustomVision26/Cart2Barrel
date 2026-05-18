import { OutsidePurchaseReceiptLink } from "@/components/outside-purchase-receipt-link";
import { CartCheckoutProductUrlReveal } from "@/components/dashboard/cart-checkout-product-url-reveal";
import { isOutsidePurchaseProductUrl } from "@/lib/outside-purchase";

type CartLineUrlOrReceiptProps = {
  lineId: string;
  productUrl: string;
  outsidePurchaseReceiptImageUrl?: string | null;
};

export function CartLineUrlOrReceipt({
  lineId,
  productUrl,
  outsidePurchaseReceiptImageUrl,
}: CartLineUrlOrReceiptProps) {
  if (isOutsidePurchaseProductUrl(productUrl)) {
    const receiptUrl = outsidePurchaseReceiptImageUrl?.trim();
    if (receiptUrl) {
      return <OutsidePurchaseReceiptLink url={receiptUrl} className="text-sm" />;
    }
    return (
      <p className="text-xs text-muted-foreground">Receipt not uploaded yet.</p>
    );
  }

  return <CartCheckoutProductUrlReveal lineId={lineId} productUrl={productUrl} />;
}
