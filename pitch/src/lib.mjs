// Tiny layout DSL: one slide spec -> HTML (for PNG rendering) AND native PPTX shapes.
// Coordinate system: 1920 x 1080 "px" canvas.  PPTX: 144 px = 1 inch, 2 px = 1 pt.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import React from "react";
import ReactDOMServer from "react-dom/server";
import sharp from "sharp";

export const W = 1920, H = 1080;
export const PX_IN = 144;
const inch = (px) => px / PX_IN;
const pt = (px) => px / 2;

export const C = {
  ink: "23303A", muted: "55656E", white: "FFFFFF", bg: "FFFBF5",
  teal: "1F4E4A", tealMid: "2F7F76", tealTint: "E3F1EC",
  sun: "F5B83D", sunTint: "FDF0D5", coral: "E56B4F", coralTint: "FBE4DC",
  sage: "A9CFB4", line: "E7DFD2", plum: "6B4C7A",
};
export const FONT_HEAD = "Georgia";
export const FONT_BODY = "Arial";

// ---------- element constructors ----------
export const rect = (x, y, w, h, o = {}) => ({ k: "rect", x, y, w, h, ...o });
export const ellipse = (x, y, w, h, o = {}) => ({ k: "ellipse", x, y, w, h, ...o });
export const arrow = (x, y, w, h, o = {}) => ({ k: "arrow", x, y, w, h, ...o });
export const text = (x, y, w, h, paras, o = {}) => ({ k: "text", x, y, w, h, paras, ...o });
export const icon = (name, x, y, size, color = "FFFFFF") => ({ k: "icon", x, y, w: size, h: size, name, color });
export const img = (file, x, y, w, h, alt = "image") => ({ k: "img", x, y, w, h, file, alt });
export const slide = (bg, els, notes = "") => ({ bg, els, notes });

// ---------- icons (react-icons -> PNG) ----------
const iconCache = new Map();
export async function renderIcon(name, color, outDir) {
  const key = `${name}-${color}`;
  if (iconCache.has(key)) return iconCache.get(key);
  const [setName, comp] = name.split(":");
  const mod = await import(`react-icons/${setName}`);
  const Comp = mod[comp];
  if (!Comp) throw new Error("icon not found " + name);
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(Comp, { color: "#" + color, size: 512 })
  );
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `${comp}-${color}.png`);
  await sharp(Buffer.from(svg)).resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(file);
  iconCache.set(key, file);
  return file;
}

// ---------- helpers ----------
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const normParas = (paras) => {
  const arr = Array.isArray(paras) ? paras : [paras];
  return arr.map((p) => {
    if (typeof p === "string") return { runs: [{ t: p }] };
    if (Array.isArray(p)) return { runs: p.map((r) => (typeof r === "string" ? { t: r } : r)) };
    if (p.runs) return p;
    return { runs: [p] };
  });
};

// ---------- HTML renderer ----------
export function slideToHtml(s, iconFiles) {
  const out = [];
  for (const e of s.els) {
    const pos = `left:${e.x}px;top:${e.y}px;width:${e.w}px;height:${e.h}px;`;
    const shadow = e.shadow
      ? `box-shadow:0 ${e.shadow.y ?? 8}px ${e.shadow.blur ?? 28}px rgba(${hexRgb(e.shadow.color ?? "000000")},${e.shadow.opacity ?? 0.12});`
      : "";
    const op = e.transparency != null ? `opacity:${1 - e.transparency / 100};` : "";
    if (e.k === "rect" || e.k === "ellipse") {
      const radius = e.k === "ellipse" ? "50%" : `${e.radius ?? 0}px`;
      const border = e.line ? `border:${e.line.w ?? 2}px ${e.line.dash ? "dashed" : "solid"} #${e.line.color};box-sizing:border-box;` : "";
      const bg = e.fill ? `background:#${e.fill};` : "";
      out.push(`<div class="el" style="${pos}${bg}border-radius:${radius};${border}${shadow}${op}"></div>`);
    } else if (e.k === "arrow") {
      const hl = Math.min(e.w, e.h) * 0.5;
      const sh = e.h * 0.28;
      const pts = `0 ${sh}px, ${e.w - hl}px ${sh}px, ${e.w - hl}px 0, ${e.w}px ${e.h / 2}px, ${e.w - hl}px ${e.h}px, ${e.w - hl}px ${e.h - sh}px, 0 ${e.h - sh}px`;
      out.push(`<div class="el" style="${pos}background:#${e.fill};clip-path:polygon(${pts});${op}"></div>`);
    } else if (e.k === "icon") {
      out.push(`<img class="el" style="${pos}" src="${iconFiles.get(e.name + "-" + e.color)}">`);
    } else if (e.k === "img") {
      out.push(`<img class="el" style="${pos}" src="${pathToFileURL(e.file).href}">`);
    } else if (e.k === "text") {
      const size = e.size ?? 32;
      const font = e.font === "head" ? FONT_HEAD : FONT_BODY;
      const lh = e.lh ?? 1.2;
      const ps = normParas(e.paras)
        .map((p) => {
          const po = p;
          const bullet = po.bullet ?? e.bullet;
          const color0 = po.color ?? e.color ?? C.ink;
          const runs = p.runs
            .map((r) => {
              const st = [
                `color:#${r.color ?? color0}`,
                r.size ? `font-size:${r.size}px` : "",
                r.bold ?? e.bold ? "font-weight:700" : "font-weight:400",
                r.italic ?? e.italic ? "font-style:italic" : "",
                r.font ? `font-family:${r.font === "head" ? FONT_HEAD : FONT_BODY}` : "",
              ].filter(Boolean).join(";");
              return `<span style="${st}">${esc(r.t).replace(/\n/g, "<br>")}</span>`;
            })
            .join("");
          const sa = po.after ?? e.after ?? 0;
          const bul = bullet
            ? `padding-left:${Math.round(size * 0.9)}px;position:relative;`
            : "";
          const dot = bullet
            ? `<span style="position:absolute;left:0;top:${Math.round(size * 0.12)}px;color:#${color0}">&#8226;</span>`
            : "";
          return `<p style="margin:0 0 ${sa}px 0;${bul}">${dot}${runs}</p>`;
        })
        .join("");
      const va = { top: "flex-start", middle: "center", bottom: "flex-end" }[e.valign ?? "top"];
      const dir = e.rtl ? "direction:rtl;" : "";
      out.push(
        `<div class="el txt"${e.lang ? ` lang="${e.lang}"` : ""} style="${pos}font-family:${font};font-size:${size}px;line-height:${lh};text-align:${e.align ?? "left"};justify-content:${va};${dir}${e.letter ? `letter-spacing:${e.letter}px;` : ""}">${ps}</div>`
      );
    }
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;background:#fff}
.slide{position:relative;width:${W}px;height:${H}px;overflow:hidden;background:#${s.bg}}
.el{position:absolute;box-sizing:border-box}
.txt{display:flex;flex-direction:column;-webkit-font-smoothing:antialiased}
</style></head><body><div class="slide">${out.join("\n")}</div></body></html>`;
}
const hexRgb = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(",");

// ---------- PPTX renderer ----------
export function slideToPptx(pres, s, iconFiles) {
  const sl = pres.addSlide();
  sl.background = { color: s.bg };
  const sh = (e) =>
    e.shadow
      ? { type: "outer", color: e.shadow.color ?? "000000", blur: pt(e.shadow.blur ?? 28), offset: pt(e.shadow.y ?? 8), angle: 90, opacity: e.shadow.opacity ?? 0.12 }
      : undefined;
  for (const e of s.els) {
    const base = { x: inch(e.x), y: inch(e.y), w: inch(e.w), h: inch(e.h) };
    if (e.k === "rect" || e.k === "ellipse") {
      const o = { ...base };
      if (e.fill) o.fill = { color: e.fill, transparency: e.transparency ?? 0 };
      else o.fill = { type: "none" };
      if (e.line) o.line = { color: e.line.color, width: pt(e.line.w ?? 2), dashType: e.line.dash ? "dash" : "solid" };
      else o.line = { type: "none" };
      const s2 = sh(e);
      if (s2) o.shadow = s2;
      let shape = pres.ShapeType.rect;
      if (e.k === "ellipse") shape = pres.ShapeType.ellipse;
      else if (e.radius) {
        shape = pres.ShapeType.roundRect;
        o.rectRadius = Math.min(inch(e.radius), Math.min(base.w, base.h) / 2);
      }
      sl.addShape(shape, o);
    } else if (e.k === "arrow") {
      sl.addShape(pres.ShapeType.rightArrow, { ...base, fill: { color: e.fill, transparency: e.transparency ?? 0 }, line: { type: "none" }, rectRadius: 0 });
    } else if (e.k === "icon") {
      sl.addImage({ path: iconFiles.get(e.name + "-" + e.color), ...base, altText: "decorative icon" });
    } else if (e.k === "img") {
      sl.addImage({ path: e.file, ...base, altText: e.alt });
    } else if (e.k === "text") {
      const size = e.size ?? 32;
      const items = [];
      const paras = normParas(e.paras);
      paras.forEach((p, pi) => {
        const bullet = p.bullet ?? e.bullet;
        const color0 = p.color ?? e.color ?? C.ink;
        p.runs.forEach((r, ri) => {
          const last = ri === p.runs.length - 1;
          const o = {
            fontFace: (r.font ?? e.font) === "head" || r.font === "head" ? FONT_HEAD : FONT_BODY,
            fontSize: pt(r.size ?? size),
            color: r.color ?? color0,
            bold: !!(r.bold ?? e.bold),
            italic: !!(r.italic ?? e.italic),
            paraSpaceAfter: pt(p.after ?? e.after ?? 0),
            lineSpacingMultiple: (e.lh ?? 1.2) / 1.2,
            align: e.align ?? "left",
          };
          if (e.rtl) o.rtlMode = true;
          if (r.lang ?? e.lang) o.lang = r.lang ?? e.lang;
          if (e.letter) o.charSpacing = pt(e.letter);
          if (ri === 0 && bullet) o.bullet = { indent: pt(Math.round(size * 0.9)) };
          if (last && pi < paras.length - 1) o.breakLine = true;
          items.push({ text: r.t, options: o });
        });
      });
      sl.addText(items, {
        ...base,
        isTextBox: true,
        margin: 0,
        valign: e.valign ?? "top",
        autoFit: false,
        wrap: true,
        fit: "none",
      });
    }
  }
  if (s.notes) sl.addNotes(s.notes);
  return sl;
}

export function collectIcons(slides) {
  const set = new Map();
  for (const s of slides) for (const e of s.els) if (e.k === "icon") set.set(e.name + "-" + e.color, [e.name, e.color]);
  return set;
}
