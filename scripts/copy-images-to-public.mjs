import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const from = path.join(root, "images");
const to = path.join(root, "public", "images");

if (!fs.existsSync(from)) {
  console.warn("[copy-images] ./images not found, skip.");
  process.exit(0);
}

fs.mkdirSync(to, { recursive: true });
let n = 0;
for (const name of fs.readdirSync(from)) {
  const src = path.join(from, name);
  if (!fs.statSync(src).isFile()) continue;
  fs.copyFileSync(src, path.join(to, name));
  n++;
}
console.log(`[copy-images] copied ${n} file(s) to public/images`);
