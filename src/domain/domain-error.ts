export type DomainErrorCode =
  | "DADOS_INVALIDOS"
  | "RECURSO_NAO_ENCONTRADO"
  | "CONFLITO"
  | "NAO_AUTENTICADO"
  | "ACESSO_NEGADO"
  | "LIMITE_EXCEDIDO";

const statusByCode: Record<DomainErrorCode, number> = {
  DADOS_INVALIDOS: 400,
  RECURSO_NAO_ENCONTRADO: 404,
  CONFLITO: 409,
  NAO_AUTENTICADO: 401,
  ACESSO_NEGADO: 403,
  LIMITE_EXCEDIDO: 429,
};

export class DomainError extends Error {
  readonly status: number;

  constructor(
    readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
    this.status = statusByCode[code];
  }
}
