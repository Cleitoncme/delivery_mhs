import { z } from "zod";
import { errorResponse, jsonRequest } from "@/lib/api";
import { requireAdmin, requireSameOrigin } from "@/lib/admin-auth";
import { cancellationReasons } from "@/lib/order-cancellation";
import { cancelOrder } from "@/services/order-reader";

export const runtime = "nodejs";

const schema = z
  .object({
    expectedStatus: z.enum(["NEW", "PREPARING", "READY", "OUT_FOR_DELIVERY"]),
    reason: z.enum(Object.keys(cancellationReasons) as [
      keyof typeof cancellationReasons,
      ...(keyof typeof cancellationReasons)[],
    ]),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export async function POST(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  try {
    requireSameOrigin(request);
    await requireAdmin(true);
    const id = z.uuid().parse((await context.params).orderId);
    const input = schema.parse(await jsonRequest(request));
    return Response.json(await cancelOrder(id, input), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
