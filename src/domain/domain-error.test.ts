import { describe, expect, it } from "vitest";
import { DomainError } from "./domain-error";

describe("DomainError", () => {
  it("traduz códigos estáveis para status HTTP", () => {
    expect(new DomainError("DADOS_INVALIDOS", "inválido").status).toBe(400);
    expect(new DomainError("CONFLITO", "conflito").status).toBe(409);
    expect(new DomainError("LIMITE_EXCEDIDO", "limite").status).toBe(429);
  });
});
