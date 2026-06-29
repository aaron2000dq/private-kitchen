import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const from = path.join(root, "images");
const to = path.join(root, "public", "images");
const thumbs = path.join(to, "thumbs");
const imageExt = /\.(jpe?g|png|webp)$/i;
const thumbWidth = 720;
const thumbHeight = 540;

function stripExt(name) {
  return name.replace(/\.[^.]+$/, "");
}

async function isFresh(src, out) {
  try {
    const [srcStat, outStat] = await Promise.all([fsp.stat(src), fsp.stat(out)]);
    return outStat.mtimeMs >= srcStat.mtimeMs;
  } catch {
    return false;
  }
}

if (!fs.existsSync(from)) {
  console.warn("[copy-images] ./images not found, skip.");
  process.exit(0);
}

await fsp.mkdir(to, { recursive: true });
await fsp.mkdir(thumbs, { recursive: true });

let copied = 0;
let thumbed = 0;
let skippedThumbs = 0;

for (const name of await fsp.readdir(from)) {
  if (name.startsWith(".")) continue;

  const src = path.join(from, name);
  const stat = await fsp.stat(src);
  if (!stat.isFile()) continue;

  const dest = path.join(to, name);
  await fsp.copyFile(src, dest);
  copied++;

  if (!imageExt.test(name)) continue;

  const thumbDest = path.join(thumbs, `${stripExt(name)}.webp`);
  if (await isFresh(src, thumbDest)) {
    skippedThumbs++;
    continue;
  }

  await sharp(src)
    .rotate()
    .resize({
      width: thumbWidth,
      height: thumbHeight,
      fit: "cover",
      withoutEnlargement: true,
    })
    .webp({ quality: 76, effort: 4 })
    .toFile(thumbDest);
  thumbed++;
}

console.log(
  `[copy-images] copied ${copied} file(s), generated ${thumbed} thumbnail(s), reused ${skippedThumbs}.`,
);
