import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { getSecrets } from "./secrets";

export const SESSION_COOKIE = "ledgerly_session";
const SESSION_DAYS = 365; // long-lived session per PRD "Tech stack"

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64url");
  const actual = crypto.scryptSync(password, Buffer.from(saltB64, "base64url"), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSecrets().sessionSecret).update(payload).digest("base64url");
}

/** Signed value "payload.signature"; payload is base64url JSON. */
export function signValue(data: object): string {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readSigned<T>(value: string | undefined): T | null {
  if (!value) return null;
  const [payload, sig] = value.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()) as T;
  } catch {
    return null;
  }
}

type Session = { uid: number; exp: number };

export function verifySessionValue(value: string | undefined): Session | null {
  const s = readSigned<Session>(value);
  if (!s || s.exp < Date.now()) return null;
  return s;
}

export async function startSession(uid: number) {
  const exp = Date.now() + SESSION_DAYS * 86_400_000;
  const jar = await cookies();
  jar.set(SESSION_COOKIE, signValue({ uid, exp }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** The single user, or a redirect to /login (or /setup when no account exists yet). */
export async function requireUser() {
  const jar = await cookies();
  const session = verifySessionValue(jar.get(SESSION_COOKIE)?.value);
  if (session) {
    const user = await prisma.user.findUnique({ where: { id: session.uid } });
    if (user) return user;
  }
  const count = await prisma.user.count();
  redirect(count === 0 ? "/setup" : "/login");
}

export async function getUserOrNull() {
  const jar = await cookies();
  const session = verifySessionValue(jar.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  return prisma.user.findUnique({ where: { id: session.uid } });
}

/** Bearer token for Shortcuts. Stored as SHA-256 only (PRD: tokens stored hashed). */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function newToken(): string {
  return `ldg_${crypto.randomBytes(24).toString("base64url")}`;
}

export async function verifyBearer(header: string | null) {
  const token = header?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return null;
  const row = await prisma.apiToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.revoked) return null;
  await prisma.apiToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } });
  return row;
}
