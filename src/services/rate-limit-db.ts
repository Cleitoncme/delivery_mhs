import { createHash } from "node:crypto";
import { DomainError } from "@/domain/domain-error";
import { query } from "@/lib/db";

type RateLimitRow = { attempts: number; resets_at: Date };

function clientAddress(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || forwarded || "local";
}

export async function enforcePublicOrderRateLimit(
  tenantSlug: string,
  request: Request,
) {
  await consume(`orders:tenant:${tenantSlug}`, 600);
  await consume(`orders:client:${tenantSlug}:${clientAddress(request)}`, 60);
}

async function consume(key: string, maximum: number) {
  const keyHash = createHash("sha256").update(key).digest("hex");
  const result = await query<RateLimitRow>(
    `INSERT INTO api_rate_limits(key_hash,attempts,resets_at)
     VALUES($1,1,now()+interval '5 minutes')
     ON CONFLICT(key_hash) DO UPDATE SET
       attempts=CASE WHEN api_rate_limits.resets_at<=now() THEN 1 ELSE api_rate_limits.attempts+1 END,
       resets_at=CASE WHEN api_rate_limits.resets_at<=now() THEN now()+interval '5 minutes' ELSE api_rate_limits.resets_at END
     RETURNING attempts,resets_at`,
    [keyHash],
  );
  if (result.rows[0].attempts > maximum)
    throw new DomainError(
      "LIMITE_EXCEDIDO",
      "Muitas tentativas de pedido. Aguarde alguns minutos.",
    );
}
