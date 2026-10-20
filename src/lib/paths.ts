import path from "node:path";

// /app/data in Docker (see compose.yaml); ./data in development.
export const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
export const BACKUP_DIR = process.env.BACKUP_DIR ?? path.join(process.cwd(), "backups");
export const RECEIPT_DIR = path.join(DATA_DIR, "receipts");
export const DB_FILE = path.join(DATA_DIR, "ledgerly.db");
