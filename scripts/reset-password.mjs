// Reset the Ledgerly password and remove passkeys.
// Docker: docker compose exec ledgerly node scripts/reset-password.mjs 'new password here'
import crypto from "node:crypto";
import path from "node:path";
import { createRequire } from "node:module";

const password = process.argv[2] ?? "";
if (password.length < 10) {
  console.error("Usage: node scripts/reset-password.mjs '<new password, 10+ characters>'");
  process.exit(1);
}
const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
process.env.DATABASE_URL ??= `file:${path.join(dataDir, "ledgerly.db")}`;
const { PrismaClient } = createRequire(import.meta.url)("@prisma/client");
const prisma = new PrismaClient();

// Same format as src/lib/auth.ts hashPassword().
const salt = crypto.randomBytes(16);
const hash = crypto.scryptSync(password, salt, 64);
const passwordHash = `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;

const user = await prisma.user.findFirst();
if (!user) {
  console.error("No account yet. Open Ledgerly to set one up.");
  process.exit(1);
}
await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
const { count } = await prisma.passkey.deleteMany();
console.log(`Password reset for ${user.email}. Removed ${count} passkey(s).`);
await prisma.$disconnect();
