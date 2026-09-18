import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const required = ["dist/manifest.json", "dist/background.js", "dist/popup.html", "dist/library.html", "dist/options.html", "dist/icons/icon-128.png"];
for (const file of required) await access(resolve(root, file));
const manifest = JSON.parse(await readFile(resolve(root, "dist/manifest.json"), "utf8"));
if (manifest.manifest_version !== 3) throw new Error("Expected Manifest V3.");
if (manifest.background?.service_worker !== "background.js") throw new Error("Background worker is not packaged correctly.");
console.log(`Verified ${required.length} packaged extension files (v${manifest.version}).`);
