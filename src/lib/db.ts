import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { DATA_DIR, DB_FILE } from "./paths";

fs.mkdirSync(DATA_DIR, { recursive: true });
process.env.DATABASE_URL ??= `file:${DB_FILE}`;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();
globalForPrisma.prisma = prisma;
