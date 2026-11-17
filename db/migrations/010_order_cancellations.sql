CREATE TABLE order_cancellations (
  order_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  previous_status order_status NOT NULL CHECK (
    previous_status IN ('NEW', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY')
  ),
  reason varchar(40) NOT NULL CHECK (
    reason IN (
      'OUT_OF_STOCK',
      'STORE_CLOSED',
      'DELIVERY_UNAVAILABLE',
      'CUSTOMER_REQUEST',
      'DUPLICATE_ORDER',
      'PAYMENT_ISSUE',
      'OTHER'
    )
  ),
  internal_note varchar(500),
  actor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cancellation_order_tenant_fk
    FOREIGN KEY (order_id, tenant_id) REFERENCES orders (id, tenant_id),
  CONSTRAINT cancellation_actor_tenant_fk
    FOREIGN KEY (actor_id, tenant_id) REFERENCES admin_users (id, tenant_id),
  UNIQUE (order_id, tenant_id)
);

CREATE INDEX order_cancellations_tenant_created_idx
  ON order_cancellations (tenant_id, created_at DESC);
