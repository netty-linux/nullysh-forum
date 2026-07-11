import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = path.join(root, "public", "brand", "logo.jpg");

/** ~22% radius ≈ iOS-style rounded square */
async function roundIcon(size, outRel, radiusRatio = 0.22) {
  const r = Math.round(size * radiusRatio);
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#fff"/></svg>`
  );
  const out = path.join(root, outRel);
  await sharp(src)
    .resize(size, size, { fit: "cover" })
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toFile(out);
  console.log("wrote", outRel, `${size}x${size} rx=${r}`);
}

await roundIcon(32, "public/favicon.png");
await roundIcon(32, "public/favicon-32.png");
await roundIcon(48, "public/favicon-48.png");
await roundIcon(180, "public/apple-touch-icon.png");
await roundIcon(192, "public/icon-192.png");
await roundIcon(32, "src/app/icon.png");
await roundIcon(180, "src/app/apple-icon.png");

console.log("done");
