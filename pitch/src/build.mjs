// Build: slides spec -> HTML -> PNG (1920x1080, via system Chrome) + native PPTX.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import pptxgen from "pptxgenjs";
import { chromium } from "playwright-core";
import { W, H, collectIcons, renderIcon, slideToHtml, slideToPptx } from "./lib.mjs";
import QRCode from "qrcode";
import { buildSlides, REPO } from "./slides.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = { html: path.join(ROOT, "build/html"), icons: path.join(ROOT, "build/icons"), png: path.join(ROOT, "slides/png") };
for (const d of Object.values(OUT)) fs.mkdirSync(d, { recursive: true });
for (const f of fs.readdirSync(OUT.png)) fs.rmSync(path.join(OUT.png, f));

const narr = fs
  .readdirSync(path.join(ROOT, "narration"))
  .filter((f) => /^slide-\d+\.txt$/.test(f))
  .sort()
  .map((f) => fs.readFileSync(path.join(ROOT, "narration", f), "utf8").trim());

// QR code (generated locally) pointing at the repository
fs.mkdirSync(path.join(ROOT, "build"), { recursive: true });
const qrFile = path.join(ROOT, "build/repo-qr.png");
await QRCode.toFile(qrFile, `https://${REPO}`, { width: 640, margin: 1, errorCorrectionLevel: "M", color: { dark: "#1F4E4A", light: "#FFFFFF" } });

const slides = buildSlides(narr, { qr: qrFile });

// icons
const iconFiles = new Map();
for (const [key, [name, color]] of collectIcons(slides)) iconFiles.set(key, await renderIcon(name, color, OUT.icons));

// Chrome/Chromium: override with CHROME_PATH
function chromePath() {
  const cands = [process.env.CHROME_PATH, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
  const found = cands.find((c) => c && fs.existsSync(c));
  if (!found) throw new Error("Chrome not found — set CHROME_PATH");
  return found;
}

// HTML
slides.forEach((s, i) => {
  const html = slideToHtml(s, new Map([...iconFiles].map(([k, v]) => [k, pathToFileURL(v).href])));
  fs.writeFileSync(path.join(OUT.html, `slide-${String(i + 1).padStart(2, "0")}.html`), html);
});

// PNG + overflow report
const browser = await chromium.launch({ executablePath: chromePath(), headless: true });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
let problems = 0;
for (let i = 0; i < slides.length; i++) {
  const n = String(i + 1).padStart(2, "0");
  await page.goto(pathToFileURL(path.join(OUT.html, `slide-${n}.html`)).href);
  await page.evaluate(() => document.fonts.ready);
  const over = await page.evaluate(() =>
    [...document.querySelectorAll(".txt")].flatMap((el) => {
      const r = el.getBoundingClientRect();
      const bad = el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
      return bad ? [`${el.textContent.slice(0, 50)}… box ${Math.round(r.width)}x${Math.round(r.height)} content ${el.scrollWidth}x${el.scrollHeight}`] : [];
    })
  );
  over.forEach((o) => { problems++; console.log(`slide ${n} OVERFLOW: ${o}`); });
  await page.screenshot({ path: path.join(OUT.png, `slide-${n}.png`) });
}
await browser.close();
console.log(`PNGs written (${slides.length}), overflow warnings: ${problems}`);

// PPTX
const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5 in == 1920x1080 @144 px/in
pres.title = "OpenKita AI — product pitch";
pres.author = "OpenKita AI";
pres.company = "OpenKita AI";
pres.subject = "Open-source, self-hosted AI assistant for German Kitas (illustrative prototype, fictional data)";
slides.forEach((s) => slideToPptx(pres, s, iconFiles));
await pres.writeFile({ fileName: path.join(ROOT, "slides/openkita-ai-pitch.pptx") });
console.log("PPTX written");
