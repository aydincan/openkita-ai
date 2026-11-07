import { C, rect, ellipse, arrow, text, icon, img, slide } from "./lib.mjs";

const I = (n) => `fa6:${n}`;
const TOTAL = 13;
const DARK_CORAL = "A8412A"; // white text on it: >= 6:1
const AMBER = "8A5A00";
export const REPO = "github.com/aydincan/openkita-ai";
const STATUS = "Status: v0.1 in progress — foundation built (app shell, health checks, Ollama connection test); AI features in development.";

// --- shared pieces ---
const title = (t, color = C.teal) => text(96, 52, 1728, 120, t, { size: 76, font: "head", bold: true, color, valign: "middle" });
const footer = (n, dark = false) => [
  text(96, 1040, 1100, 30, "OpenKita AI · product pitch · illustrative mock-up · fictional data", { size: 20, color: dark ? C.sage : C.muted }),
  text(1624, 1040, 200, 30, `${n} / ${TOTAL}`, { size: 20, color: dark ? C.sage : C.muted, align: "right" }),
];
const card = (x, y, w, h, fill = C.white, o = {}) =>
  rect(x, y, w, h, { fill, radius: 32, shadow: fill === C.white ? { y: 10, blur: 32, opacity: 0.1 } : undefined, ...o });
const badge = (x, y, w, h, label, fill, color, size = 24) => [
  rect(x, y, w, h, { fill, radius: h / 2 }),
  text(x, y, w, h, label, { size, bold: true, color, align: "center", valign: "middle", letter: 1 }),
];
const circ = (x, y, d, fill, ic, icColor = "FFFFFF", frac = 0.5) => [
  ellipse(x, y, d, d, { fill }),
  icon(I(ic), x + (d * (1 - frac)) / 2, y + (d * (1 - frac)) / 2, d * frac, icColor),
];
const NB = "\u00a0";

export function buildSlides(narr, assets = {}) {
  const S = [];

  // 1 ─ Title
  S.push(
    slide(C.teal, [
      ellipse(1130, 190, 660, 660, { fill: "2A6560" }),
      ...circ(1290, 130, 320, C.sun, "FaChildReaching", C.teal, 0.5),
      ...circ(1470, 450, 300, C.coral, "FaEnvelopeOpenText", "FFFFFF", 0.46),
      ...circ(1160, 560, 320, C.sage, "FaShieldHalved", C.teal, 0.46),
      ellipse(1690, 270, 90, 90, { fill: C.sun, transparency: 25 }),
      ellipse(1130, 860, 60, 60, { fill: C.coral, transparency: 20 }),
      ...badge(96, 96, 820, 60, "OPEN SOURCE · SELF-HOSTED · FOR GERMAN KITAS", "2A6560", C.sun, 24),
      text(96, 200, 1000, 190, "OpenKita AI", { size: 150, font: "head", bold: true, color: C.white, valign: "middle" }),
      text(96, 430, 1000, 290, ["Less paperwork.", "Better communication.", { runs: [{ t: "More time for children.", color: C.sun }] }], { size: 64, font: "head", color: C.white, after: 8 }),
      text(96, 740, 920, 120, "An open-source, self-hosted AI assistant for German Kitas and childcare providers (Träger)", { size: 34, color: "CFE6D6", lh: 1.25 }),
      rect(96, 890, 1000, 128, { fill: "2A6560", radius: 28 }),
      text(124, 890, 944, 128, [
        { runs: [{ t: STATUS, bold: true, color: C.white }] },
        { runs: [{ t: "Idea not yet validated · illustrative mock-up, fictional data only", color: C.sage }] },
      ], { size: 24, valign: "middle", after: 8, lh: 1.2 }),
    ], narr[0])
  );

  // 2 ─ Problem
  {
    const rows = [
      ["FaEnvelopeOpenText", C.teal, "Parent letters & newsletters", "Announcements and invitations, often in several languages"],
      ["FaClipboardList", C.coral, "Meeting minutes & task lists", "From rough notes to something shareable"],
      ["FaListCheck", C.tealMid, "Checklists & agendas", "Prepared again and again"],
      ["FaCircleQuestion", C.plum, "The same questions, again and again", "Opening hours, policies, procedures"],
    ];
    const els = [title("Paperwork takes time from children")];
    rows.forEach((r, i) => {
      const y = 215 + i * 178;
      els.push(card(96, y, 1040, 150));
      els.push(...circ(132, y + 27, 96, r[1], r[0], "FFFFFF", 0.5));
      els.push(text(262, y + 22, 840, 54, r[2], { size: 38, bold: true, color: C.ink, valign: "middle" }));
      els.push(text(262, y + 80, 840, 50, r[3], { size: 28, color: C.muted, valign: "top" }));
    });
    els.push(card(1184, 215, 640, 684, C.teal));
    els.push(text(1236, 265, 536, 400, [[{ t: "Every hour at the desk is an hour " }, { t: "away from the children.", color: C.sun }]], { size: 56, font: "head", bold: true, color: C.white, lh: 1.25 }));
    els.push(...circ(1236, 700, 150, C.sun, "FaChildReaching", C.teal, 0.5));
    els.push(text(1410, 715, 380, 120, "That is the time OpenKita AI wants to give back.", { size: 28, color: "CFE6D6", valign: "middle" }));
    els.push(...footer(2));
    S.push(slide(C.bg, els, narr[1]));
  }

  // 3 ─ Is / isn't
  {
    const els = [title("An assistant, not another system")];
    const isRows = [
      "Makes existing Kita administration easier",
      "Completely open source and self-hosted",
      "Built to integrate with open-source Kita software",
      "Human in control: AI drafts, people decide",
    ];
    const notRows = [
      "Another Kita management system",
      "A competitor to existing tools such as KitaLux",
      "A service that needs a cloud AI API",
      "A tool that profiles or assesses children",
    ];
    els.push(card(96, 215, 840, 665, C.tealTint));
    els.push(card(984, 215, 840, 665, C.coralTint));
    els.push(text(144, 245, 740, 70, "OpenKita AI is …", { size: 44, font: "head", bold: true, color: C.teal, valign: "middle" }));
    els.push(text(1032, 245, 740, 70, "… and is not", { size: 44, font: "head", bold: true, color: DARK_CORAL, valign: "middle" }));
    isRows.forEach((t, i) => {
      const y = 340 + i * 130;
      els.push(...circ(144, y + 14, 72, C.tealMid, "FaCheck", "FFFFFF", 0.5));
      els.push(text(244, y, 650, 100, t, { size: 32, color: C.ink, valign: "middle" }));
    });
    notRows.forEach((t, i) => {
      const y = 340 + i * 130;
      els.push(...circ(1032, y + 14, 72, C.coral, "FaXmark", "FFFFFF", 0.5));
      els.push(text(1132, y, 650, 100, t, { size: 32, color: C.ink, valign: "middle" }));
    });
    els.push(rect(96, 906, 1728, 96, { fill: C.sunTint, radius: 28 }));
    els.push(...circ(124, 922, 64, C.sun, "FaHandshake", C.teal, 0.5));
    els.push(text(216, 906, 1580, 96, [[{ t: "Integrate, don't compete: ", bold: true }, { t: "designed to work alongside existing open-source Kita software." }]], { size: 30, color: C.ink, valign: "middle" }));
    els.push(...footer(3));
    S.push(slide(C.bg, els, narr[2]));
  }

  // 4 ─ Capabilities
  {
    const caps = [
      { ic: "FaEnvelopeOpenText", col: C.teal, icc: "FFFFFF", name: "Parent Communication Assistant", ver: "v0.1 · in development", pts: ["Newsletters, announcements, event invitations", "Editable German and English drafts, PDF / DOCX export", "TR / AR: experimental — native review required"] },
      { ic: "FaClipboardList", col: C.coral, icc: "FFFFFF", name: "Administration Assistant", ver: "v0.1 · in development", pts: ["Rough notes → meeting minutes", "Task lists and checklists", "Agendas"] },
      { ic: "FaBookOpen", col: C.sun, icc: C.teal, name: "Kita Knowledge Assistant", ver: "v0.2 · planned", pts: ["Answers from your Kita's own policies, opening hours and procedures", "Shows source references", "Says so when the answer isn't in the documents"] },
    ];
    const els = [title("Three planned capabilities")];
    caps.forEach((c, i) => {
      const x = 96 + i * 588;
      els.push(card(x, 215, 552, 770));
      els.push(...circ(x + 48, 263, 112, c.col, c.ic, c.icc, 0.48));
      els.push(...badge(x + 552 - 36 - 300, 288, 300, 52, c.ver, i === 2 ? C.tealTint : C.sunTint, i === 2 ? C.teal : AMBER, 22));
      els.push(text(x + 48, 408, 456, 170, c.name, { size: 40, font: "head", bold: true, color: C.teal, lh: 1.15 }));
      els.push(text(x + 48, 600, 456, 360, c.pts.map((p, k) => ({ runs: [{ t: p, bold: i === 0 && k === 2, color: i === 0 && k === 2 ? DARK_CORAL : undefined }], bullet: true })), { size: 31, color: C.ink, after: 18, lh: 1.2 }));
    });
    els.push(...footer(4));
    S.push(slide(C.bg, els, narr[3]));
  }

  // 5 ─ Mock-up demo
  {
    const els = [
      title("Mock-up: summer party"),
      ...badge(1124, 78, 700, 60, "ILLUSTRATIVE MOCK-UP · FICTIONAL DATA", C.sunTint, AMBER, 24),
    ];
    els.push(card(96, 215, 650, 400, C.tealTint));
    els.push(text(144, 243, 560, 50, "1 · The manager's request", { size: 30, bold: true, color: C.teal, valign: "middle" }));
    els.push(rect(144, 313, 554, 262, { fill: C.white, radius: 28 }));
    els.push(text(176, 333, 490, 224, "“Summer party on 20 June, from 14:00 to 17:00. Please write a friendly announcement for parents and ask for buffet contributions.”", { size: 30, color: C.ink, lh: 1.3, valign: "middle", italic: true }));
    els.push(card(96, 645, 650, 340));
    const steps = [
      [C.tealMid, "Local AI drafts German text (planned)"],
      [C.sun, "Translations: EN · TR · AR (experimental)"],
      [C.coral, "A person edits and approves"],
    ];
    steps.forEach((s, i) => {
      const y = 683 + i * 100;
      els.push(ellipse(138, y, 64, 64, { fill: s[0] }));
      els.push(text(138, y, 64, 64, String(i + 2), { size: 32, bold: true, color: i === 1 ? C.teal : "FFFFFF", align: "center", valign: "middle" }));
      els.push(text(226, y - 8, 490, 80, s[1], { size: 30, color: C.ink, valign: "middle", lh: 1.15 }));
    });
    els.push(card(800, 215, 1024, 770));
    els.push(text(848, 247, 600, 56, "Elternbrief · Sommerfest", { size: 36, font: "head", bold: true, color: C.teal, valign: "middle" }));
    els.push(...badge(1450, 249, 326, 52, "AI DRAFT · MOCK-UP", C.coralTint, DARK_CORAL, 24));
    els.push(rect(848, 328, 928, 2, { fill: C.line }));
    els.push(
      text(848, 356, 928, 460, [
        "Liebe Eltern,",
        `wir freuen uns, Sie herzlich zu unserem Sommerfest am 20.${NB}Juni von 14:00 bis 17:00${NB}Uhr einzuladen!`,
        "Damit unser Buffet bunt und vielfältig wird, freuen wir uns über Ihre Unterstützung. Bitte geben Sie uns kurz Bescheid, was Sie gerne mitbringen möchten.",
        "Herzliche Grüße\nIhr Kita-Team",
      ], { size: 34, color: C.ink, after: 24, lh: 1.25, lang: "de-DE" })
    );
    els.push(rect(848, 846, 240, 76, { fill: C.white, radius: 38, line: { color: C.teal, w: 3 } }));
    els.push(text(848, 846, 240, 76, "Edit", { size: 30, bold: true, color: C.teal, align: "center", valign: "middle" }));
    els.push(rect(1112, 846, 664, 76, { fill: C.teal, radius: 38 }));
    els.push(text(1112, 846, 664, 76, "Approve & export (PDF / DOCX)", { size: 30, bold: true, color: C.white, align: "center", valign: "middle" }));
    els.push(...footer(5));
    S.push(slide(C.bg, els, narr[4]));
  }

  // 6 ─ Translations + approval
  {
    const els = [title("One draft, four languages")];
    const langs = [
      ["DE", "Deutsch", "de-DE", false, `Liebe Eltern, wir freuen uns, Sie herzlich zu unserem Sommerfest am 20.${NB}Juni von 14:00 bis 17:00${NB}Uhr einzuladen! Damit unser Buffet bunt und vielfältig wird, freuen wir uns über Ihre Unterstützung. Bitte geben Sie uns kurz Bescheid, was Sie gerne mitbringen möchten.`],
      ["EN", "English", "en-US", false, "Dear parents, we warmly invite you to our summer party on 20 June from 2:00 to 5:00 pm! To make our buffet colourful and varied, we would be grateful for your support. Please let us know briefly what you would like to bring."],
      ["TR", "Türkçe", "tr-TR", false, "Sevgili veliler, sizi 20 Haziran’da saat 14:00–17:00 arasında yapılacak yaz şenliğimize davet etmekten mutluluk duyarız! Büfemizin renkli ve çeşitli olması için desteğinize ihtiyacımız var. Lütfen getirmek istediğiniz şeyi bize kısaca bildirin."],
      ["AR", "العربية", "ar-SA", true, `أولياء الأمور الأعزاء، يسعدنا أن ندعوكم إلى حفلنا الصيفي يوم 20${NB}حزيران/يونيو من الساعة 2:00 إلى 5:00${NB}مساءً! ولكي يكون البوفيه متنوعًا وغنيًا بالألوان، نأمل أن تساهموا معنا. يرجى إعلامنا بما ترغبون في إحضاره.`],
    ];
    langs.forEach((l, i) => {
      const x = 96 + (i % 2) * 672;
      const y = 215 + Math.floor(i / 2) * 370;
      els.push(card(x, y, 640, 350));
      els.push(...badge(x + 32, y + 22, 86, 48, l[0], C.teal, C.white, 26));
      els.push(text(x + 134, y + 22, 170, 48, l[1], { size: 28, bold: true, color: C.muted, valign: "middle" }));
      if (i >= 2) els.push(...badge(x + 640 - 32 - 250, y + 22, 250, 48, "EXPERIMENTAL", C.coralTint, DARK_CORAL, 22));
      els.push(text(x + 36, y + 86, 568, 250, l[4], { size: 28, color: C.ink, lh: 1.2, rtl: l[3], align: l[3] ? "right" : "left", lang: l[2] }));
    });
    els.push(text(96, 958, 1328, 60, [[{ t: "TR / AR: experimental — native review required. ", bold: true, color: DARK_CORAL }, { t: "Illustrative mock-up translations." }]], { size: 24, color: C.muted, lh: 1.2, valign: "middle" }));
    els.push(card(1488, 215, 336, 720, C.teal));
    els.push(text(1520, 243, 272, 110, ["Human", "in the loop"], { size: 38, font: "head", bold: true, color: C.white, valign: "middle", lh: 1.15 }));
    const st = [["Draft", "by local AI"], ["Review", "edit text, check translations"], ["Approve", "a person decides"], ["Export", "PDF or DOCX"]];
    st.forEach((s, i) => {
      const y = 380 + i * 104;
      els.push(ellipse(1520, y + 8, 64, 64, { fill: i === 2 ? C.sun : "2A6560" }));
      els.push(text(1520, y + 8, 64, 64, String(i + 1), { size: 32, bold: true, color: i === 2 ? C.teal : C.white, align: "center", valign: "middle" }));
      els.push(text(1604, y - 8, 200, 96, [[{ t: s[0], bold: true, color: C.white, size: 30 }], [{ t: s[1], color: "D8EBDF", size: 22 }]], { size: 26, valign: "middle", lh: 1.12 }));
    });
    els.push(rect(1520, 806, 272, 106, { fill: DARK_CORAL, radius: 28 }));
    els.push(text(1520, 806, 272, 106, [[{ t: "AI DRAFT", bold: true, size: 28 }], [{ t: "Not sent until approved", size: 22 }]], { color: C.white, align: "center", valign: "middle", lh: 1.15 }));
    els.push(...footer(6));
    S.push(slide(C.bg, els, narr[5]));
  }

  // 7 ─ Privacy
  {
    const els = [title("Privacy-first by design")];
    const box = (x, y, w, h, t1, t2, o = {}) => [
      rect(x, y, w, h, { fill: o.fill, radius: 26, line: o.line }),
      text(x + 12, y, w - 24, h, [[{ t: t1, bold: true, size: 32, color: o.c1 ?? C.white }], [{ t: t2, size: o.s2 ?? 26, color: o.c2 ?? "D8EBDF" }]], { valign: "middle", align: "center", lh: 1.2 }),
    ];
    els.push(...badge(96, 200, 900, 48, "v0.1 DESIGN · LOCAL-ONLY · EXTERNAL AI DISABLED, FAIL-CLOSED", C.tealMid, C.white, 21));
    els.push(...box(96, 266, 440, 124, "Kita staff", "web browser", { fill: C.teal }));
    els.push(arrow(566, 302, 144, 52, { fill: C.tealMid }));
    els.push(...box(740, 266, 440, 124, "OpenKita app", "Next.js · FastAPI · PostgreSQL", { fill: C.teal }));
    els.push(arrow(1210, 302, 144, 52, { fill: C.tealMid }));
    els.push(...box(1384, 266, 440, 124, "Local AI: Ollama", "(llama.cpp possible later)", { fill: C.teal, s2: 24 }));
    els.push(...badge(96, 424, 900, 48, "PLANNED · v0.3 · PRIVACY GATEWAY, ONLY AFTER PRIVACY TESTS", C.sun, C.teal, 21));
    els.push(...box(96, 490, 440, 124, "OpenKita app", "request to external AI", { fill: C.tealTint, line: { color: C.tealMid, w: 3, dash: true }, c1: C.teal, c2: C.muted }));
    els.push(arrow(566, 526, 144, 52, { fill: C.sun }));
    els.push(...box(740, 490, 440, 124, "Privacy Gateway", "Detect → Minimise → Verify", { fill: C.sunTint, line: { color: C.sun, w: 4, dash: true }, c1: C.teal, c2: C.ink }));
    els.push(arrow(1210, 526, 144, 52, { fill: C.sun }));
    els.push(...box(1384, 490, 440, 124, "Optional external AI", "disabled by default", { fill: C.coralTint, line: { color: C.coral, w: 3, dash: true }, c1: DARK_CORAL, c2: C.muted }));
    // today vs planned cards
    els.push(card(96, 644, 840, 244, C.tealTint));
    els.push(text(138, 658, 756, 218, [
      { runs: [{ t: "v0.1 design", bold: true, size: 30, color: C.teal }] },
      { runs: [{ t: "No child profiles, no automated child assessments" }], bullet: true },
      { runs: [{ t: "Human approval before anything is sent or saved as final" }], bullet: true },
      { runs: [{ t: "No mandatory cloud AI API; external AI off" }], bullet: true },
    ], { size: 26, color: C.ink, after: 8, lh: 1.2, valign: "middle" }));
    els.push(card(984, 644, 840, 244, C.sunTint));
    els.push(text(1026, 658, 756, 218, [
      { runs: [{ t: "Planned · v0.3", bold: true, size: 30, color: AMBER }] },
      { runs: [{ t: "Audit logs" }], bullet: true },
      { runs: [{ t: "Gateway: Presidio + spaCy German + rules" }], bullet: true },
      { runs: [{ t: "Health, disability and safeguarding data never sent externally" }], bullet: true },
    ], { size: 26, color: C.ink, after: 8, lh: 1.2, valign: "middle" }));
    els.push(rect(96, 908, 1728, 104, { fill: C.coralTint, radius: 28 }));
    els.push(text(130, 908, 1660, 104, [[{ t: "Honest caveat: ", bold: true, color: DARK_CORAL }, { t: "detection isn't perfect and pseudonymised data is still personal data. This is risk reduction, not GDPR compliance on its own and no replacement for a legal assessment / DPIA." }]], { size: 26, color: C.ink, valign: "middle", lh: 1.2 }));
    els.push(...footer(7));
    S.push(slide(C.bg, els, narr[6]));
  }

  // 8 ─ Open source + stack
  {
    const els = [title("Fully open source"), ...badge(1124, 78, 700, 60, "LICENSED UNDER APACHE 2.0", C.sunTint, AMBER, 24)];
    const rows = ["Frontend and backend code", "Prompts and workflows", "Database schema and API", "Connectors", "Docker Compose deployment", "No proprietary edition"];
    els.push(card(96, 215, 800, 770, C.tealTint));
    rows.forEach((t, i) => {
      const y = 250 + i * 118;
      els.push(...circ(144, y + 8, 64, C.tealMid, "FaCheck", "FFFFFF", 0.5));
      els.push(text(236, y, 620, 80, t, { size: 36, bold: i === 5, color: C.ink, valign: "middle" }));
    });
    els.push(text(952, 215, 872, 60, "Tech stack", { size: 44, font: "head", bold: true, color: C.teal, valign: "middle" }));
    const tiles = [
      ["Next.js", "Frontend", "FaCode", C.teal],
      ["Python / FastAPI", "Backend and API", "FaGears", C.coral],
      ["PostgreSQL + pgvector", "Data and search", "FaServer", C.tealMid],
      ["Ollama / llama.cpp", "Local AI models", "FaMicrochip", C.plum],
      ["Docker Compose", "Self-hosted deployment", "FaBoxOpen", C.sun],
    ];
    tiles.forEach((t, i) => {
      const x = 952 + (i % 2) * 444;
      const y = 300 + Math.floor(i / 2) * 176;
      els.push(card(x, y, 428, 152));
      els.push(...circ(x + 20, y + 44, 64, t[3], t[2], t[3] === C.sun ? C.teal : "FFFFFF", 0.5));
      els.push(text(x + 98, y + 18, 320, 116, [[{ t: t[0], bold: true, size: 28, color: C.ink }], [{ t: t[1], size: 26, color: C.muted }]], { valign: "middle", lh: 1.15 }));
    });
    els.push(rect(1396, 652, 428, 152, { fill: C.sunTint, radius: 32 }));
    els.push(text(1424, 652, 376, 152, "Model weights have their own licences, documented separately.", { size: 28, bold: true, color: AMBER, valign: "middle", lh: 1.2 }));
    els.push(text(952, 840, 872, 140, "Code, prompts and deployment are open; AI model weights are a separate matter with their own terms.", { size: 28, color: C.muted, lh: 1.25 }));
    els.push(...footer(8));
    S.push(slide(C.bg, els, narr[7]));
  }

  // 9 ─ Business model
  {
    const els = [title("Free software, paid services")];
    els.push(card(96, 215, 500, 770, C.teal));
    els.push(text(144, 255, 404, 50, "THE SOFTWARE", { size: 26, bold: true, color: C.sage, letter: 2 }));
    els.push(text(144, 320, 404, 170, "Free", { size: 130, font: "head", bold: true, color: C.sun, valign: "middle" }));
    els.push(text(144, 520, 404, 200, "Open source and self-hosted. No licence fees, no proprietary edition.", { size: 32, color: C.white, lh: 1.25 }));
    els.push(...circ(144, 790, 140, C.sun, "FaHandHoldingHeart", C.teal, 0.5));
    const svc = [
      ["Installation", "FaServer", C.teal],
      ["Configuration", "FaGears", C.coral],
      ["Integration", "FaPlug", C.tealMid],
      ["Training", "FaChalkboardUser", C.plum],
      ["Support and maintenance", "FaHeadset", C.coral],
      ["Migration", "FaRightLeft", C.teal],
    ];
    els.push(text(648, 205, 1176, 50, "Revenue comes from services", { size: 36, font: "head", bold: true, color: C.teal, valign: "middle" }));
    svc.forEach((s, i) => {
      const x = 648 + (i % 3) * 400;
      const y = 280 + Math.floor(i / 3) * 196;
      els.push(card(x, y, 376, 172));
      els.push(...circ(x + 28, y + 36, 100, s[2], s[1], "FFFFFF", 0.5));
      els.push(text(x + 144, y + 20, 214, 132, s[0], { size: 30, bold: true, color: C.ink, valign: "middle", lh: 1.15 }));
    });
    els.push(rect(648, 690, 1176, 295, { fill: C.sunTint, radius: 32, line: { color: C.sun, w: 4, dash: true } }));
    els.push(...badge(692, 718, 420, 48, "HYPOTHESIS TO VALIDATE", C.sun, C.teal, 22));
    els.push(text(692, 786, 1090, 70, "Test installation package: €1,000–€3,000", { size: 48, font: "head", bold: true, color: C.teal, valign: "middle" }));
    els.push(text(692, 862, 1090, 44, "plus optional annual support", { size: 32, color: C.ink, valign: "middle" }));
    els.push(text(692, 914, 1090, 50, "A price hypothesis, not a market rate. It has not been tested with customers.", { size: 26, color: C.muted, valign: "middle" }));
    els.push(...footer(9));
    S.push(slide(C.bg, els, narr[8]));
  }

  // 10 ─ OpenKita Box
  {
    const els = [title("OpenKita Box: private AI")];
    const tiers = [
      { name: "Starter", who: "One small Kita", pts: ["16–32 GB RAM", "~500 GB SSD", "Small quantised model"], price: "~€799–€1,099", col: C.tealMid },
      { name: "Pro", who: "Larger Kita", pts: ["64 GB RAM", "1–2 TB SSD", "Ryzen 7-class"], price: "~€1,499–€2,499", col: C.teal },
      { name: "Träger Server", who: "Multi-facility", pts: ["Central administration", "Several facilities", "Built for providers"], price: "from ~€3,000", col: C.coral },
    ];
    tiers.forEach((t, i) => {
      const x = 96 + i * 588;
      els.push(card(x, 215, 552, 560));
      els.push(...circ(x + 40, 247, 100, t.col, "FaServer", "FFFFFF", 0.46));
      els.push(text(x + 164, 247, 350, 100, [[{ t: t.name, size: 40, font: "head", bold: true, color: C.teal }], [{ t: t.who, size: 28, color: C.muted }]], { valign: "middle", lh: 1.15 }));
      els.push(text(x + 40, 376, 472, 200, t.pts.map((p) => ({ runs: [{ t: p }], bullet: true })), { size: 32, color: C.ink, after: 16 }));
      els.push(rect(x + 32, 612, 488, 134, { fill: C.sunTint, radius: 26 }));
      els.push(text(x + 32, 612, 488, 134, [[{ t: t.price, size: 40, font: "head", bold: true, color: C.teal }], [{ t: "price hypothesis", size: 24, color: AMBER }]], { align: "center", valign: "middle", lh: 1.2 }));
    });
    els.push(...badge(1224, 78, 600, 60, "PRICE HYPOTHESES · TO VALIDATE", C.sunTint, AMBER, 22));
    const notes = [
      ["FaHouse", C.tealMid, "Installed on premises; sold to Träger first"],
      ["FaTriangleExclamation", C.coral, "CE / WEEE / warranty obligations still need investigation"],
      ["FaMicrochip", C.plum, "No promise of good LLM speed on cheap N100-class machines"],
    ];
    els.push(rect(96, 806, 1728, 184, { fill: C.white, radius: 32, line: { color: C.line, w: 3 } }));
    notes.forEach((n, i) => {
      const x = 130 + i * 580;
      els.push(...circ(x, 855, 84, n[1], n[0], "FFFFFF", 0.5));
      els.push(text(x + 108, 826, 428, 144, n[2], { size: 28, color: C.ink, valign: "middle", lh: 1.2 }));
    });
    els.push(...footer(10));
    S.push(slide(C.bg, els, narr[9]));
  }

  // 11 ─ Validation
  {
    const els = [title("Honest status: not yet validated")];
    els.push(card(96, 215, 820, 480, C.tealTint));
    els.push(text(144, 240, 724, 60, "Our validation plan", { size: 40, font: "head", bold: true, color: C.teal, valign: "middle" }));
    const stats = [["5", "Kita managers", C.teal], ["2", "Träger (providers)", DARK_CORAL], ["2", "educators", C.tealMid]];
    stats.forEach((s, i) => {
      const y = 325 + i * 118;
      els.push(ellipse(144, y, 100, 100, { fill: s[2] }));
      els.push(text(144, y, 100, 100, s[0], { size: 60, font: "head", bold: true, color: C.white, align: "center", valign: "middle" }));
      els.push(text(276, y, 590, 100, s[1], { size: 40, bold: true, color: C.ink, valign: "middle" }));
    });
    els.push(card(96, 725, 820, 270, C.coralTint));
    els.push(text(138, 745, 736, 232, [
      { runs: [{ t: "Open risks", bold: true, size: 30, color: DARK_CORAL }] },
      { runs: [{ t: "Prices are hypotheses, not market rates" }], bullet: true },
      { runs: [{ t: "Hardware obligations (CE / WEEE / warranty)" }], bullet: true },
      { runs: [{ t: "Detection limits; legal assessment / DPIA" }], bullet: true },
    ], { size: 28, color: C.ink, after: 8, valign: "middle", lh: 1.2 }));
    els.push(card(980, 215, 844, 780));
    els.push(text(1028, 240, 748, 60, "Key questions", { size: 40, font: "head", bold: true, color: C.teal, valign: "middle" }));
    const qs = [
      [C.teal, "Independent assistant that integrates with existing software, or an AI module inside existing platforms?", 170],
      [DARK_CORAL, "Would they adopt it?", 90],
      [C.tealMid, "What builds trust?", 90],
    ];
    let y = 335;
    qs.forEach((q, i) => {
      els.push(ellipse(1028, y + 6, 72, 72, { fill: q[0] }));
      els.push(text(1028, y + 6, 72, 72, String(i + 1), { size: 36, bold: true, color: C.white, align: "center", valign: "middle" }));
      els.push(text(1128, y, 650, q[2] - 20, q[1], { size: i === 0 ? 34 : 36, bold: true, color: C.ink, valign: "top", lh: 1.2 }));
      y += q[2] + 20;
    });
    els.push(rect(1028, 760, 748, 200, { fill: C.sunTint, radius: 28 }));
    els.push(text(1060, 760, 684, 200, [
      { runs: [{ t: "Project status", bold: true, size: 26, color: AMBER }] },
      { runs: [{ t: "v0.1 in progress — foundation built (app shell, health checks, Ollama connection test); AI features in development.", bold: true }] },
    ], { size: 28, color: C.ink, valign: "middle", lh: 1.2, after: 6 }));
    els.push(...footer(11));
    S.push(slide(C.bg, els, narr[10]));
  }

  // 12 ─ Roadmap
  {
    const els = [title("Roadmap: from hackathon MVP to v1.0")];
    const steps = [
      { v: "v0.1", name: "Hackathon MVP", st: "IN PROGRESS", desc: "Auth, dashboard, Parent Communication and Administration assistants, local AI via Ollama, basic export", box: "Local-only; external AI disabled, fail-closed", boxFill: C.tealTint, boxCol: C.teal },
      { v: "v0.2", name: "Knowledge Assistant", st: "PLANNED", desc: "Upload, processing, RAG with source citations" },
      { v: "v0.3", name: "Production readiness", st: "PLANNED", desc: "Permissions, security review, audit logging, backups/restore, install docs", box: "Privacy Gateway (planned): protected optional external AI, only after privacy tests", boxFill: C.sunTint, boxCol: AMBER },
      { v: "v0.4", name: "Integrations", st: "PLANNED", desc: "Open-source Kita software, import/export, calendar, more formats" },
      { v: "v1.0", name: "Production release", st: "PLANNED", desc: "Multi-facility, advanced admin, configurable workflows, improved multilingual, deployment and maintenance tooling" },
    ];
    els.push(rect(96, 292, 1728, 8, { fill: C.tealTint, radius: 4 }));
    steps.forEach((s, i) => {
      const x = 96 + i * 350;
      const cur = i === 0;
      els.push(text(x, 200, 328, 70, s.v, { size: 56, font: "head", bold: true, color: C.teal, valign: "middle" }));
      els.push(ellipse(x, 268, 56, 56, { fill: cur ? C.sun : C.white, line: { color: cur ? C.sun : C.tealMid, w: 5 } }));
      els.push(card(x, 350, 328, 530, C.white, { line: cur ? { color: C.sun, w: 5 } : undefined }));
      els.push(...badge(x + 24, 372, cur ? 190 : 140, 40, s.st, cur ? C.sunTint : C.tealTint, cur ? AMBER : C.teal, 20));
      els.push(text(x + 24, 428, 280, 84, s.name, { size: 32, font: "head", bold: true, color: C.teal, lh: 1.12 }));
      els.push(text(x + 24, 524, 280, 190, s.desc, { size: 26, color: C.ink, lh: 1.2 }));
      if (s.box) {
        els.push(rect(x + 20, 704, 288, 160, { fill: s.boxFill, radius: 22 }));
        els.push(text(x + 34, 704, 260, 160, s.box, { size: 24, bold: true, color: s.boxCol, valign: "middle", lh: 1.18 }));
      }
    });
    els.push(text(96, 908, 1728, 60, [[{ t: "Expansion: ", bold: true, color: C.teal }, { t: "Austria · Switzerland · wider Europe", color: C.ink }]], { size: 34, valign: "middle" }));
    els.push(...footer(12));
    S.push(slide(C.bg, els, narr[11]));
  }

  // 13 ─ Closing / call to action
  {
    const els = [
      ellipse(1500, -160, 560, 560, { fill: "2A6560" }),
      ellipse(-120, 800, 360, 360, { fill: "2A6560" }),
      text(96, 52, 1300, 120, "Help us validate OpenKita AI", { size: 76, font: "head", bold: true, color: C.white, valign: "middle" }),
      card(96, 215, 1120, 330, C.sun, { shadow: undefined }),
      text(144, 245, 1030, 270, [
        { runs: [{ t: "Kita managers and Träger:", bold: true, size: 40 }] },
        { runs: [{ t: "join a 30-minute interview to help us validate OpenKita AI.", bold: true, font: "head", size: 54 }] },
      ], { color: C.teal, valign: "middle", after: 14, lh: 1.18 }),
      rect(96, 575, 1120, 150, { fill: "2A6560", radius: 32 }),
      ...circ(132, 606, 88, C.sage, "FaGithub", C.teal, 0.56),
      text(250, 575, 940, 150, [[{ t: "Code and updates", size: 26, color: C.sage }], [{ t: REPO, size: 44, bold: true, color: C.white }]], { valign: "middle", lh: 1.2 }),
      card(1330, 215, 494, 570, C.white, { shadow: undefined }),
      img(assets.qr ?? "", 1366, 251, 422, 422, "QR code linking to " + REPO),
      text(1330, 688, 494, 80, "Scan for the repository", { size: 28, bold: true, color: C.teal, align: "center", valign: "middle" }),
      text(96, 770, 1728, 120, [[{ t: "Less paperwork. Better communication. ", color: C.white }, { t: "More time for children.", color: C.sun }]], { size: 52, font: "head", bold: true, valign: "middle", align: "center", lh: 1.2 }),
      text(96, 905, 1728, 70, [
        { runs: [{ t: STATUS, color: "D8EBDF" }] },
        { runs: [{ t: "Prices and hardware are hypotheses · the idea is not yet validated · Icons: Font Awesome Free, CC BY 4.0", color: C.sage }] },
      ], { size: 22, align: "center", lh: 1.2, after: 4 }),
      ...footer(13, true),
    ];
    S.push(slide(C.teal, els, narr[12]));
  }
  return S;
}
