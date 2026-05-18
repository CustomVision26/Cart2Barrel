UPDATE order_items AS oi
SET fulfillment_status = 'paid_outside_purchase_service_fee'
FROM orders AS o
INNER JOIN item_requests AS ir ON ir.id = oi.item_request_id
WHERE oi.order_id = o.id
  AND o.status = 'paid'
  AND oi.fulfillment_status IN ('paid_pending_company_purchase', 'pending_payment')
  AND (
    ir.source = 'outside_purchase'
    OR ir.outside_purchase_reference IS NOT NULL
    OR ir.product_url LIKE 'https://intake.cart2barrel.invalid/outside-purchase/%'
  );
