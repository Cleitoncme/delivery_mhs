import { ApiError } from "@/lib/api";
import { requireAdmin } from "@/lib/admin-auth";
import { query } from "@/lib/db";
import type { DeliveryOrderStatus, FulfillmentType } from "@/types/domain";

const PAGE_SIZE = 20;

export type CustomerListData = {
  customers: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    createdAt: string;
    orderCount: number;
    completedOrders: number;
    totalSpent: number;
    lastOrderAt: string | null;
  }[];
  page: number;
  hasMore: boolean;
};

export type CustomerDetailData = {
  customer: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    createdAt: string;
  };
  summary: {
    orderCount: number;
    completedOrders: number;
    canceledOrders: number;
    totalSpent: number;
    averageTicket: number;
    lastOrderAt: string | null;
  };
  addresses: {
    id: string;
    street: string;
    number: string;
    complement: string | null;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
    reference: string | null;
  }[];
  orders: {
    id: string;
    number: string;
    status: DeliveryOrderStatus;
    fulfillmentType: FulfillmentType;
    total: number;
    createdAt: string;
  }[];
  orderPage: number;
  hasMoreOrders: boolean;
};

export async function listAdminCustomers(
  page: number,
  search: string,
): Promise<CustomerListData> {
  const session = await requireAdmin();
  const term = search.trim();
  const result = await query<CustomerListData["customers"][number]>(
    `SELECT c.id,c.name,c.phone,c.email,c.created_at AS "createdAt",
       count(o.id)::integer AS "orderCount",
       count(o.id) FILTER (WHERE o.status='COMPLETED')::integer AS "completedOrders",
       COALESCE(sum(o.total_cents) FILTER (WHERE o.status='COMPLETED'),0)::integer AS "totalSpent",
       max(o.created_at) AS "lastOrderAt"
     FROM customers c
     LEFT JOIN orders o ON o.customer_id=c.id AND o.tenant_id=c.tenant_id
     WHERE c.tenant_id=$1 AND ($2='' OR c.name ILIKE '%' || $2 || '%'
       OR c.phone ILIKE '%' || $2 || '%' OR COALESCE(c.email,'') ILIKE '%' || $2 || '%')
     GROUP BY c.id
     ORDER BY max(o.created_at) DESC NULLS LAST,c.created_at DESC,c.id DESC
     LIMIT $3 OFFSET $4`,
    [session.tenantId, term, PAGE_SIZE + 1, page * PAGE_SIZE],
  );
  return {
    customers: result.rows.slice(0, PAGE_SIZE),
    page,
    hasMore: result.rows.length > PAGE_SIZE,
  };
}

export async function readAdminCustomer(
  customerId: string,
  orderPage: number,
): Promise<CustomerDetailData> {
  const session = await requireAdmin();
  const values = [session.tenantId, customerId];
  const [customerResult, summaryResult, addressResult, orderResult] =
    await Promise.all([
      query<CustomerDetailData["customer"]>(
        `SELECT id,name,phone,email,created_at AS "createdAt"
         FROM customers WHERE tenant_id=$1 AND id=$2`,
        values,
      ),
      query<{
        orderCount: number;
        completedOrders: number;
        canceledOrders: number;
        totalSpent: number;
        lastOrderAt: string | null;
      }>(
        `SELECT count(*)::integer AS "orderCount",
           count(*) FILTER (WHERE status='COMPLETED')::integer AS "completedOrders",
           count(*) FILTER (WHERE status='CANCELED')::integer AS "canceledOrders",
           COALESCE(sum(total_cents) FILTER (WHERE status='COMPLETED'),0)::integer AS "totalSpent",
           max(created_at) AS "lastOrderAt"
         FROM orders WHERE tenant_id=$1 AND customer_id=$2`,
        values,
      ),
      query<CustomerDetailData["addresses"][number]>(
        `SELECT id,street,number,complement,neighborhood,city,state,
           zip_code AS "zipCode",reference
         FROM addresses WHERE tenant_id=$1 AND customer_id=$2
         ORDER BY created_at DESC,id DESC`,
        values,
      ),
      query<CustomerDetailData["orders"][number]>(
        `SELECT id,number::text,status,fulfillment AS "fulfillmentType",
           total_cents AS total,created_at AS "createdAt"
         FROM orders WHERE tenant_id=$1 AND customer_id=$2
         ORDER BY created_at DESC,id DESC LIMIT $3 OFFSET $4`,
        [...values, PAGE_SIZE + 1, orderPage * PAGE_SIZE],
      ),
    ]);
  const customer = customerResult.rows[0];
  if (!customer) throw new ApiError(404, "Cliente não encontrado.");
  const summary = summaryResult.rows[0] ?? {
    orderCount: 0,
    completedOrders: 0,
    canceledOrders: 0,
    totalSpent: 0,
    lastOrderAt: null,
  };
  return {
    customer,
    summary: {
      ...summary,
      averageTicket: summary.completedOrders
        ? Math.round(summary.totalSpent / summary.completedOrders)
        : 0,
    },
    addresses: addressResult.rows,
    orders: orderResult.rows.slice(0, PAGE_SIZE),
    orderPage,
    hasMoreOrders: orderResult.rows.length > PAGE_SIZE,
  };
}
