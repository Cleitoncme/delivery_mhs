import { requireAdmin } from "@/lib/admin-auth";
import { query } from "@/lib/db";
import { SHOP_TIME_ZONE } from "@/lib/shop-date";
import type { DeliveryOrderStatus } from "@/types/domain";

export type DashboardData = {
  summary: {
    revenue: number;
    completedOrders: number;
    averageTicket: number;
    canceledOrders: number;
    totalOrders: number;
    cancellationRate: number;
  };
  statusCounts: Record<DeliveryOrderStatus, number>;
  series: { date: string; revenue: number; orders: number }[];
  recentOrders: {
    id: string;
    number: string;
    customerName: string;
    status: DeliveryOrderStatus;
    total: number;
    createdAt: string;
  }[];
  alerts: { waiting: number; preparing: number };
};

type DashboardFilters = { date: string; days: 1 | 7 };
const bounds = `SELECT $2::date AS anchor,
  ($2::date - ($3::integer - 1))::date AS first_day`;

export async function readDashboard(
  filters: DashboardFilters,
): Promise<DashboardData> {
  const session = await requireAdmin();
  const values = [session.tenantId, filters.date, filters.days];
  const [summaryResult, statusResult, seriesResult, recentResult, alertResult] =
    await Promise.all([
      query<{
        revenue: string;
        completed_orders: number;
        canceled_orders: number;
        total_orders: number;
      }>(
        `WITH bounds AS (${bounds}),
         completed AS (
           SELECT DISTINCT o.id,o.total_cents FROM orders o
           JOIN order_status_history h ON h.order_id=o.id AND h.tenant_id=o.tenant_id AND h.status='COMPLETED'
           CROSS JOIN bounds b
           WHERE o.tenant_id=$1 AND o.status='COMPLETED'
             AND (h.created_at AT TIME ZONE '${SHOP_TIME_ZONE}')::date BETWEEN b.first_day AND b.anchor
         ), canceled AS (
           SELECT o.id FROM orders o CROSS JOIN bounds b
           WHERE o.tenant_id=$1 AND o.status='CANCELED'
             AND (o.created_at AT TIME ZONE '${SHOP_TIME_ZONE}')::date BETWEEN b.first_day AND b.anchor
         )
         SELECT COALESCE((SELECT sum(total_cents) FROM completed),0)::text revenue,
           (SELECT count(*)::integer FROM completed) completed_orders,
           (SELECT count(*)::integer FROM canceled) canceled_orders,
           count(*) FILTER (WHERE (o.created_at AT TIME ZONE '${SHOP_TIME_ZONE}')::date BETWEEN b.first_day AND b.anchor)::integer total_orders
         FROM orders o CROSS JOIN bounds b WHERE o.tenant_id=$1 GROUP BY b.first_day,b.anchor`,
        values,
      ),
      query<{ status: DeliveryOrderStatus; count: number }>(
        `SELECT status,count(*)::integer count FROM orders
         WHERE tenant_id=$1 GROUP BY status`,
        [session.tenantId],
      ),
      query<{ date: string; revenue: string; orders: number }>(
        `WITH bounds AS (${bounds}), days AS (
           SELECT generate_series(first_day,anchor,interval '1 day')::date date FROM bounds
         ), completed AS (
           SELECT (h.created_at AT TIME ZONE '${SHOP_TIME_ZONE}')::date date,
             o.id,o.total_cents
           FROM orders o JOIN order_status_history h
             ON h.order_id=o.id AND h.tenant_id=o.tenant_id AND h.status='COMPLETED'
           CROSS JOIN bounds b
           WHERE o.tenant_id=$1 AND o.status='COMPLETED'
             AND (h.created_at AT TIME ZONE '${SHOP_TIME_ZONE}')::date BETWEEN b.first_day AND b.anchor
         )
         SELECT to_char(d.date,'YYYY-MM-DD') date,
           COALESCE(sum(c.total_cents),0)::text revenue,
           count(c.id)::integer orders
         FROM days d LEFT JOIN completed c ON c.date=d.date
         GROUP BY d.date ORDER BY d.date`,
        values,
      ),
      query<{
        id: string;
        number: string;
        customerName: string;
        status: DeliveryOrderStatus;
        total: number;
        createdAt: string;
      }>(
        `WITH bounds AS (${bounds})
         SELECT o.id,o.number::text number,c.name AS "customerName",o.status,
           o.total_cents AS total,o.created_at AS "createdAt"
         FROM orders o JOIN customers c ON c.id=o.customer_id AND c.tenant_id=o.tenant_id
         CROSS JOIN bounds b
         WHERE o.tenant_id=$1 AND (
           o.status IN ('NEW','PREPARING','READY','OUT_FOR_DELIVERY') OR
           (o.created_at AT TIME ZONE '${SHOP_TIME_ZONE}')::date BETWEEN b.first_day AND b.anchor
         )
         ORDER BY o.created_at DESC,o.id DESC LIMIT 5`,
        values,
      ),
      query<{ waiting: number; preparing: number }>(
        `SELECT
           count(*) FILTER (WHERE status='NEW' AND created_at<now()-interval '10 minutes')::integer waiting,
           count(*) FILTER (WHERE status='PREPARING' AND updated_at<now()-interval '30 minutes')::integer preparing
         FROM orders WHERE tenant_id=$1`,
        [session.tenantId],
      ),
    ]);

  const summary = summaryResult.rows[0] ?? {
    revenue: "0",
    completed_orders: 0,
    canceled_orders: 0,
    total_orders: 0,
  };
  const statusCounts = Object.fromEntries(
    ["NEW", "PREPARING", "READY", "OUT_FOR_DELIVERY", "COMPLETED", "CANCELED"].map(
      (status) => [status, 0],
    ),
  ) as Record<DeliveryOrderStatus, number>;
  for (const row of statusResult.rows) statusCounts[row.status] = row.count;
  const revenue = Number(summary.revenue);
  return {
    summary: {
      revenue,
      completedOrders: summary.completed_orders,
      averageTicket: summary.completed_orders
        ? Math.round(revenue / summary.completed_orders)
        : 0,
      canceledOrders: summary.canceled_orders,
      totalOrders: summary.total_orders,
      cancellationRate: summary.total_orders
        ? Number(((summary.canceled_orders / summary.total_orders) * 100).toFixed(1))
        : 0,
    },
    statusCounts,
    series: seriesResult.rows.map((row) => ({
      date: row.date,
      revenue: Number(row.revenue),
      orders: row.orders,
    })),
    recentOrders: recentResult.rows,
    alerts: alertResult.rows[0] ?? { waiting: 0, preparing: 0 },
  };
}
