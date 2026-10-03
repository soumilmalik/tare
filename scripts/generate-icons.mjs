// Regenerates PWA icons from assets/icon.svg: `node scripts/generate-icons.mjs`
import { readFileSync, copyFileSync } from "node:fs";
import sharp from "sharp";

const svg = readFileSync("assets/icon.svg");
const out = [
  ["public/icons/icon-192.png", 192],
  ["public/icons/icon-512.png", 512],
  ["app/apple-icon.png", 180],
];

for (const [file, size] of out) {
  await sharp(svg).resize(size, size).png().toFile(file);
}
copyFileSync("assets/icon.svg", "app/icon.svg");
console.log("Icons generated");
