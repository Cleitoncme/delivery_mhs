import type { DeliveryOrderStatus, FulfillmentType } from "@/types/domain";

type NumberedOrder = { number: string; createdAt: string };

export function compareOrdersByNumber(
  first: NumberedOrder,
  second: NumberedOrder,
) {
  const numberDifference = Number(first.number) - Number(second.number);
  if (Number.isFinite(numberDifference) && numberDifference !== 0)
    return numberDifference;
  return new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime();
}

export const orderStatusNames: Record<DeliveryOrderStatus, string> = {
  NEW: "Pedido recebido",
  PREPARING: "Em separação",
  READY: "Pronto",
  OUT_FOR_DELIVERY: "Saiu para entrega",
  COMPLETED: "Concluído",
  CANCELED: "Cancelado",
};

export function nextOrderStatus(
  status: DeliveryOrderStatus,
  fulfillment: FulfillmentType,
): DeliveryOrderStatus | undefined {
  switch (status) {
    case "NEW":
      return "PREPARING";
    case "PREPARING":
      return "READY";
    case "READY":
      return fulfillment === "PICKUP" ? "COMPLETED" : "OUT_FOR_DELIVERY";
    case "OUT_FOR_DELIVERY":
      return fulfillment === "DELIVERY" ? "COMPLETED" : undefined;
    default:
      return undefined;
  }
}
