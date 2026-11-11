import { z } from "zod";
import { errorResponse } from "@/lib/api";
import { todayInShopTimeZone } from "@/lib/shop-date";
import { readDashboard } from "@/services/dashboard-reader";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const date = z.iso
      .date()
      .parse(searchParams.get("date") ?? todayInShopTimeZone());
    const days = z.union([z.literal(1), z.literal(7)]).parse(
      z.coerce.number().parse(searchParams.get("days") ?? 1),
    );
    return Response.json(await readDashboard({ date, days }), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
