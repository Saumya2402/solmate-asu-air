import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "public");
const output = path.join(root, "dist");
const motionPackage = path.join(root, "node_modules", "motion");
const lucidePackage = path.join(root, "node_modules", "lucide");
const apiBaseUrl = validateApiBaseUrl(process.env.SOLMATE_API_BASE_URL);

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(source, output, { recursive: true });
await mkdir(path.join(output, "vendor"), { recursive: true });
await cp(path.join(motionPackage, "dist", "motion.js"), path.join(output, "vendor", "motion.js"));
await cp(path.join(motionPackage, "LICENSE.md"), path.join(output, "vendor", "motion.LICENSE.md"));
await cp(path.join(lucidePackage, "dist", "umd", "lucide.min.js"), path.join(output, "vendor", "lucide.js"));
await cp(path.join(lucidePackage, "LICENSE"), path.join(output, "vendor", "lucide.LICENSE"));
await writeFile(path.join(output, "config.js"), `window.SOLMATE_CONFIG = Object.freeze(${JSON.stringify({ apiBaseUrl }, null, 2)});\n`, "utf8");
await writeFile(path.join(output, ".nojekyll"), "", "utf8");

console.log(`GitHub Pages bundle created in ${output}.`);
console.log(apiBaseUrl ? `AIR API endpoint: ${apiBaseUrl}` : "AIR API endpoint: not configured (interface-only deployment).");

function validateApiBaseUrl(value) {
  const candidate = String(value || "").trim().replace(/\/$/, "");
  if (!candidate) return "";
  const url = new URL(candidate);
  if (url.protocol !== "https:") throw new Error("SOLMATE_API_BASE_URL must use HTTPS for a deployed Pages build.");
  if (url.origin + url.pathname.replace(/\/$/, "") !== candidate) throw new Error("SOLMATE_API_BASE_URL must not include query parameters or fragments.");
  return candidate;
}
