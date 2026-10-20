import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import webpush from "web-push";
import { DATA_DIR } from "./paths";

type Secrets = { sessionSecret: string; vapidPublicKey: string; vapidPrivateKey: string };

let cached: Secrets | null = null;

// Generated on first start and kept in the data volume, so no setup is needed.
export function getSecrets(): Secrets {
  if (cached) return cached;
  const file = path.join(DATA_DIR, "secrets.json");
  if (fs.existsSync(file)) {
    cached = JSON.parse(fs.readFileSync(file, "utf8")) as Secrets;
    return cached;
  }
  const vapid = webpush.generateVAPIDKeys();
  cached = {
    sessionSecret: crypto.randomBytes(32).toString("base64url"),
    vapidPublicKey: vapid.publicKey,
    vapidPrivateKey: vapid.privateKey,
  };
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(cached, null, 2), { mode: 0o600 });
  return cached;
}
