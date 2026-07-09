import { cpSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pdfjsDist = dirname(require.resolve("pdfjs-dist/package.json"));
const src = join(pdfjsDist, "build", "pdf.worker.min.mjs");
const dest = join(process.cwd(), "public", "pdf.worker.min.mjs");

cpSync(src, dest);
console.log("✓ pdf.worker.min.mjs copied to public/");
