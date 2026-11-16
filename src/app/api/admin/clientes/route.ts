import { z } from "zod";
import { errorResponse } from "@/lib/api";
import { listAdminCustomers } from "@/services/customer-reader";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const page = z.coerce.number().int().min(0).max(10_000).parse(params.get("page") ?? 0);
    const search = z.string().trim().max(80).parse(params.get("q") ?? "");
    return Response.json(await listAdminCustomers(page, search), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
