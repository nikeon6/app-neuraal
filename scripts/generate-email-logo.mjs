import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const svgPath = path.join(root, "public/branding/lockups/Neuraal_Negro_Logotipo.svg");
const outPath = path.join(root, "public/branding/lockups/Neuraal_Negro_Logotipo.png");

const W = 420;
const H = 360;
const R = 48;
const PAD_X = 52;
const PAD_Y = 44;

const bgSvg = Buffer.from(
  `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${W}" height="${H}" rx="${R}" ry="${R}" fill="#ffffff"/>
  </svg>`,
);

const logoW = W - PAD_X * 2;
const logoH = H - PAD_Y * 2;

const logoBuffer = await sharp(svgPath)
  .resize(logoW, logoH, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toBuffer();

await sharp(bgSvg)
  .png()
  .composite([{ input: logoBuffer, gravity: "center" }])
  .toFile(outPath);

const meta = await sharp(outPath).metadata();
console.log(`Generated: ${outPath} (${meta.width}x${meta.height})`);
