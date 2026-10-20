// Resolve "@/x" and extensionless relative imports to .ts/.tsx under the repo's src/.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");
export async function resolve(spec, ctx, next) {
  let target = null;
  if (spec.startsWith("@/")) target = path.join(SRC, spec.slice(2));
  else if ((spec.startsWith("./") || spec.startsWith("../")) && ctx.parentURL?.startsWith("file:")) target = path.resolve(path.dirname(fileURLToPath(ctx.parentURL)), spec);
  if (target && !path.extname(target)) for (const ext of [".ts", ".tsx"]) if (existsSync(target + ext)) return next(pathToFileURL(target + ext).href, ctx);
  if (target && existsSync(target)) return next(pathToFileURL(target).href, ctx);
  return next(spec, ctx);
}
