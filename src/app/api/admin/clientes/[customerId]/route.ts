import { z } from "zod";
import { errorResponse } from "@/lib/api";
import { readAdminCustomer } from "@/services/customer-reader";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ customerId: string }> },
) {
  try {
    const { customerId } = await context.params;
    const id = z.uuid().parse(customerId);
    const page = z.coerce.number().int().min(0).max(10_000).parse(
      new URL(request.url).searchParams.get("page") ?? 0,
    );
    return Response.json(await readAdminCustomer(id, page), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
