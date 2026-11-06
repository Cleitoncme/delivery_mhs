import { describe, expect, it } from "vitest";
import { compareOrdersByNumber } from "./order-flow";

describe("ordenação operacional dos pedidos", () => {
  it("mantém os menores números no topo da coluna", () => {
    const orders = [
      { number: "10042", createdAt: "2026-11-06T12:03:00Z" },
      { number: "10014", createdAt: "2026-11-06T12:01:00Z" },
      { number: "10039", createdAt: "2026-11-06T12:02:00Z" },
    ];

    expect(orders.sort(compareOrdersByNumber).map((order) => order.number)).toEqual([
      "10014",
      "10039",
      "10042",
    ]);
  });

  it("usa a chegada mais antiga como desempate", () => {
    const orders = [
      { number: "10014", createdAt: "2026-11-06T12:02:00Z" },
      { number: "10014", createdAt: "2026-11-06T12:01:00Z" },
    ];

    expect(orders.sort(compareOrdersByNumber)[0].createdAt).toBe(
      "2026-11-06T12:01:00Z",
    );
  });
});
