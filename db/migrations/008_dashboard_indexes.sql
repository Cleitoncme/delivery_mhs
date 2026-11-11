CREATE INDEX order_status_history_tenant_status_created_idx
  ON order_status_history (tenant_id, status, created_at DESC)
  INCLUDE (order_id);

CREATE INDEX orders_tenant_created_idx
  ON orders (tenant_id, created_at DESC)
  INCLUDE (status, total_cents);
