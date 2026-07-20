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

function isAppAsset(name) {
  return /^private-kitchen-.+\.webp$/i.test(name);
}

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

for (const name of await fsp.readdir(to)) {
  const dest = path.join(to, name);
  const stat = await fsp.stat(dest);
  if (stat.isFile()) await fsp.unlink(dest);
}

const expectedThumbs = new Set();
let copiedAssets = 0;
let thumbed = 0;
let skippedThumbs = 0;

for (const name of await fsp.readdir(from)) {
  if (name.startsWith(".")) continue;

  const src = path.join(from, name);
  const stat = await fsp.stat(src);
  if (!stat.isFile()) continue;

  if (isAppAsset(name)) {
    const dest = path.join(to, name);
    await fsp.copyFile(src, dest);
    copiedAssets++;
    continue;
  }

  if (!imageExt.test(name)) continue;

  const thumbDest = path.join(thumbs, `${stripExt(name)}.webp`);
  expectedThumbs.add(path.basename(thumbDest));
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

for (const name of await fsp.readdir(thumbs)) {
  if (!expectedThumbs.has(name)) {
    await fsp.unlink(path.join(thumbs, name));
  }
}

console.log(
  `[copy-images] copied ${copiedAssets} app asset(s), generated ${thumbed} thumbnail(s), reused ${skippedThumbs}.`,
);
