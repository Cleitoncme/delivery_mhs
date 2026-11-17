export const cancellationReasons = {
  OUT_OF_STOCK: "Item indisponível",
  STORE_CLOSED: "Loja impossibilitada de atender",
  DELIVERY_UNAVAILABLE: "Entrega indisponível para o endereço",
  CUSTOMER_REQUEST: "Solicitado pelo cliente",
  DUPLICATE_ORDER: "Pedido duplicado",
  PAYMENT_ISSUE: "Problema no pagamento",
  OTHER: "Outro motivo",
} as const;

export type CancellationReason = keyof typeof cancellationReasons;

export const activeOrderStatuses = [
  "NEW",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
] as const;
