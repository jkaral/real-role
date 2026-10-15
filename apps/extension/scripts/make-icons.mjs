// Renders the Real Role logo to the PNG sizes Chrome needs (public/icon/*.png) and the
// Web Store small promo tile (store/promo-440x280.png). Run: node scripts/make-icons.mjs
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const logo = (
  size,
) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">
  <rect width="24" height="24" rx="5.5" fill="#1d6b52"/>
  <path d="M6.6 12.6l3.5 3.5L17.6 8.4" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
mkdirSync("public/icon", { recursive: true });
for (const size of [16, 32, 48, 128]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${logo(size)}</body></html>`,
  );
  await page.screenshot({ path: `public/icon/${size}.png`, omitBackground: true });
}
await page.setViewportSize({ width: 440, height: 280 });
await page.setContent(`<html><body style="margin:0;width:440px;height:280px;display:flex;align-items:center;justify-content:center;gap:18px;background:#f6f8f7;font-family:system-ui,'Segoe UI',sans-serif">
  ${logo(84)}<div><div style="font-size:38px;font-weight:700;color:#0f1f1a">Real Role</div>
  <div style="font-size:17px;color:#3c5249;margin-top:4px">Is this job still hiring?</div></div></body></html>`);
await page.screenshot({ path: "store/promo-440x280.png" });
await browser.close();
console.log("Icons written.");
