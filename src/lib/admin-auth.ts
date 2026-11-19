import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { query } from "./db";
import { ApiError } from "./api";

const derive = promisify(scrypt);
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const sessionCookie = "mhs-admin-session";
export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  priority: "high" as const,
};
export type AdminSession = {
  userId: string;
  tenantId: string;
  slug: string;
  email: string;
  role: "OPERATOR" | "VIEWER";
};

export function requireAdminEnabled() {
  if (process.env.ADMIN_ENABLED !== "true")
    throw new ApiError(503, "Acesso administrativo desabilitado.");
}
export function requireSameOrigin(request: Request) {
  const expected =
    process.env.APP_ORIGIN ||
    (process.env.NODE_ENV !== "production" ? new URL(request.url).origin : "");
  if (
    !expected ||
    request.headers.get("origin") !== expected ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new ApiError(403, "Origem da solicitação não permitida.");
}
export async function getAdminSession(): Promise<AdminSession | null> {
  if (process.env.ADMIN_ENABLED !== "true") return null;
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const result = await query<AdminSession>(
    `SELECT u.id AS "userId", u.tenant_id AS "tenantId", t.slug, u.email, u.role
     FROM admin_sessions s JOIN admin_users u ON u.id=s.user_id JOIN tenants t ON t.id=u.tenant_id
     WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active`,
    [hashToken(token)],
  );
  return result.rows[0] ?? null;
}
export async function requireAdmin(write = false) {
  requireAdminEnabled();
  const session = await getAdminSession();
  if (!session) throw new ApiError(401, "Entre no painel para continuar.");
  if (write && session.role !== "OPERATOR")
    throw new ApiError(403, "Seu perfil permite somente consulta.");
  return session;
}

type LoginLimitRow = { attempts: number; resets_at: Date };

function trustedClientAddress(request: Request) {
  if (process.env.TRUST_PROXY !== "true") return null;
  const candidate =
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0].trim();
  return candidate && isIP(candidate) ? candidate : null;
}

async function consumeLoginLimit(key: string, maximum: number) {
  const result = await query<LoginLimitRow>(
    `INSERT INTO admin_login_limits(key_hash,attempts,resets_at)
     VALUES($1,1,now()+interval '15 minutes')
     ON CONFLICT(key_hash) DO UPDATE SET
       attempts=CASE WHEN admin_login_limits.resets_at<=now() THEN 1 ELSE admin_login_limits.attempts+1 END,
       resets_at=CASE WHEN admin_login_limits.resets_at<=now() THEN now()+interval '15 minutes' ELSE admin_login_limits.resets_at END
     RETURNING attempts,resets_at`,
    [hashToken(key)],
  );
  const limit = result.rows[0];
  if (limit.attempts > maximum) {
    const retryAfter = Math.max(
      1,
      Math.ceil((limit.resets_at.getTime() - Date.now()) / 1000),
    );
    throw new ApiError(429, "Muitas tentativas. Aguarde alguns minutos.", {
      "Retry-After": String(retryAfter),
    });
  }
}

export async function loginAdmin(
  slug: string,
  email: string,
  password: string,
  request: Request,
) {
  requireAdminEnabled();
  // Persisted in PostgreSQL so restarts and additional app instances do not reset it.
  // There is no system-wide key: an attack against one store cannot lock every tenant.
  const accountLimitKey = `account:${slug}:${email}`;
  await consumeLoginLimit(accountLimitKey, 10);
  const address = trustedClientAddress(request);
  const addressLimitKey = address ? `address:${address}` : null;
  if (addressLimitKey) await consumeLoginLimit(addressLimitKey, 100);
  const result = await query<{ id: string; password_hash: string }>(
    `SELECT u.id,u.password_hash FROM admin_users u JOIN tenants t ON t.id=u.tenant_id WHERE t.slug=$1 AND u.email=$2 AND u.active`,
    [slug, email],
  );
  const user = result.rows[0];
  const [salt, stored] = (
    user?.password_hash ?? `${"0".repeat(32)}:${"0".repeat(128)}`
  ).split(":");
  const derived = (await derive(password, salt, 64)) as Buffer;
  const expected = Buffer.from(stored, "hex");
  if (
    !user ||
    expected.length !== derived.length ||
    !timingSafeEqual(expected, derived)
  )
    throw new ApiError(401, "Loja, e-mail ou senha inválidos.");
  // Successful authentication must not consume any failure budget.
  for (const key of [accountLimitKey, addressLimitKey]) {
    if (key)
      await query("DELETE FROM admin_login_limits WHERE key_hash=$1", [
        hashToken(key),
      ]);
  }
  const jar = await cookies();
  const previous = jar.get(sessionCookie)?.value;
  if (previous)
    await query("DELETE FROM admin_sessions WHERE token_hash=$1", [
      hashToken(previous),
    ]);
  const token = randomBytes(32).toString("hex");
  await query(
    "INSERT INTO admin_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '8 hours')",
    [hashToken(token), user.id],
  );
  jar.set(sessionCookie, token, { ...cookieOptions, maxAge: 8 * 60 * 60 });
}
export async function logoutAdmin() {
  const jar = await cookies();
  const token = jar.get(sessionCookie)?.value;
  if (token)
    await query("DELETE FROM admin_sessions WHERE token_hash=$1", [
      hashToken(token),
    ]);
  jar.set(sessionCookie, "", { ...cookieOptions, maxAge: 0 });
}
