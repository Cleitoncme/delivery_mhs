import { z } from "zod";
import { errorResponse } from "@/lib/api";
import { listAdminOrders } from "@/services/order-reader";
export const runtime = "nodejs";
const status = z.enum([
  "NEW",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
  "COMPLETED",
  "CANCELED",
]);
function todayInShopTimeZone() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}
export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const page = z.coerce
      .number()
      .int()
      .min(0)
      .max(10000)
      .parse(searchParams.get("page") ?? 0);
    const date = z.iso
      .date()
      .parse(searchParams.get("date") ?? todayInShopTimeZone());
    const days = z.coerce
      .number()
      .int()
      .refine((value) => value === 1 || value === 7)
      .parse(searchParams.get("days") ?? 1);
    const selectedStatus = searchParams.get("status");
    const parsedStatus = selectedStatus ? status.parse(selectedStatus) : undefined;
    return Response.json(
      await listAdminOrders(page, { date, days, status: parsedStatus }),
      {
      headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
