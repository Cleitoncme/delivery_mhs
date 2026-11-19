CREATE INDEX customers_tenant_created_idx ON customers (tenant_id, created_at DESC);

CREATE INDEX orders_tenant_customer_created_idx
  ON orders (tenant_id, customer_id, created_at DESC)
  INCLUDE (status, total_cents, number, fulfillment);
