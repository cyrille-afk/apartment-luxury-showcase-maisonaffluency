export type Stage = "Discover" | "Tearsheet" | "Quote" | "Order" | "Project";

export type Tone = "formal" | "luxury" | "concise" | "designer";

export type Lang = "en" | "id" | "th" | "zh";

export const LANGUAGES: { id: Lang; label: string; native: string }[] = [
  { id: "en", label: "English", native: "English" },
  { id: "id", label: "Indonesian", native: "Bahasa Indonesia" },
  { id: "th", label: "Thai", native: "ไทย" },
  { id: "zh", label: "Chinese (Simplified)", native: "简体中文" },
];

export const DEFAULT_LANG: Lang = "en";

const LANG_STORAGE_KEY = "concierge:lang";

export const loadLang = (): Lang => {
  try {
    const raw = localStorage.getItem(LANG_STORAGE_KEY);
    if (raw && LANGUAGES.some((l) => l.id === raw)) return raw as Lang;
  } catch {}
  // Auto-detect from browser as a soft default
  const nav = (typeof navigator !== "undefined" && navigator.language) || "";
  const code = nav.slice(0, 2).toLowerCase();
  if (LANGUAGES.some((l) => l.id === code)) return code as Lang;
  return DEFAULT_LANG;
};

export const saveLang = (lang: Lang) => {
  try { localStorage.setItem(LANG_STORAGE_KEY, lang); } catch {}
};

// Tone label translations for the picker UI
const TONE_LABELS: Record<Lang, Record<Tone, { label: string; description: string }>> = {
  en: {
    formal: { label: "Formal", description: "Polished, professional, full sentences." },
    luxury: { label: "Luxury", description: "Editorial, evocative, atelier voice." },
    concise: { label: "Concise", description: "Brief, scannable, no flourish." },
    designer: { label: "Designer-friendly", description: "Studio shorthand, peer-to-peer." },
  },
  id: {
    formal: { label: "Formal", description: "Tertata, profesional, kalimat lengkap." },
    luxury: { label: "Mewah", description: "Suara editorial, evokatif, ala atelier." },
    concise: { label: "Ringkas", description: "Singkat, mudah dibaca, tanpa hiasan." },
    designer: { label: "Gaya desainer", description: "Bahasa studio, antar rekan." },
  },
  th: {
    formal: { label: "ทางการ", description: "สุภาพ มืออาชีพ ประโยคสมบูรณ์" },
    luxury: { label: "หรูหรา", description: "น้ำเสียงเชิงบรรณาธิการ ชวนจินตนาการ แบบอตอลีเย่" },
    concise: { label: "กระชับ", description: "สั้น อ่านง่าย ไม่ฟุ่มเฟือย" },
    designer: { label: "สไตล์ดีไซเนอร์", description: "ภาษาสตูดิโอ คุยกันแบบเพื่อนร่วมวงการ" },
  },
  zh: {
    formal: { label: "正式", description: "考究、专业、完整句式。" },
    luxury: { label: "奢华", description: "编辑式、富有意境、工坊语调。" },
    concise: { label: "简洁", description: "简短、易读、毫无赘述。" },
    designer: { label: "设计师口吻", description: "工作室行话，平等对话。" },
  },
};

export const tonesFor = (lang: Lang): { id: Tone; label: string; description: string }[] => {
  const map = TONE_LABELS[lang] ?? TONE_LABELS[DEFAULT_LANG];
  return (Object.keys(map) as Tone[]).map((id) => ({ id, ...map[id] }));
};

// Back-compat for callers that imported TONES (English labels)
export const TONES = tonesFor(DEFAULT_LANG);

export const DEFAULT_TONE: Tone = "luxury";

const TONE_STORAGE_KEY = "concierge:tone";

export const loadTone = (): Tone => {
  try {
    const raw = localStorage.getItem(TONE_STORAGE_KEY);
    if (raw && TONES.some((t) => t.id === raw)) return raw as Tone;
  } catch {}
  return DEFAULT_TONE;
};

export const saveTone = (tone: Tone) => {
  try { localStorage.setItem(TONE_STORAGE_KEY, tone); } catch {}
};

export const stageFromPath = (pathname: string): Stage => {
  if (pathname.startsWith("/trade/quotes") || pathname.includes("/quote/")) return "Quote";
  if (
    pathname.startsWith("/trade/boards") ||
    pathname.startsWith("/trade/tearsheets") ||
    pathname.startsWith("/trade/mood-boards")
  )
    return "Tearsheet";
  if (pathname.startsWith("/trade/orders") || pathname.startsWith("/trade/order")) return "Order";
  if (pathname.startsWith("/trade/projects")) return "Project";
  return "Discover";
};

// ---- Intent map (route/stage -> shared meaning) ----
type Intent = "mood" | "tearsheet" | "quote" | "order" | "project" | "discover";

export const intentFor = (stage: Stage, pathname: string): Intent => {
  if (pathname.startsWith("/trade/mood-boards")) return "mood";
  if (pathname.startsWith("/trade/tearsheets") || pathname.startsWith("/trade/boards")) return "tearsheet";
  if (stage === "Quote") return "quote";
  if (stage === "Order") return "order";
  if (stage === "Project") return "project";
  return "discover";
};

// ---- Greetings: same intent, different voice & language ----
type ToneMap = Record<Intent, string>;
type LangPack = Partial<Record<Tone, Partial<ToneMap>>>;

const EN: Record<Tone, ToneMap> = {
  formal: {
    mood: "Allow me to assist you in refining this mood board. I will propose complementary pieces grounded in what is already pinned — palette, scale, materiality — and explain the reasoning behind each suggestion.",
    tearsheet: "Allow me to assist you in shaping this tearsheet. I can add complementary pieces, suggest alternatives, or assemble a new draft from a brief — please indicate the direction.",
    quote: "Allow me to assist you in reviewing this quote. I can clarify trade pricing, lead times and deposits, and propose alternatives where appropriate.",
    order: "Allow me to assist you in following this order. I can outline production timelines, shipping milestones, and current status.",
    project: "Allow me to assist you in advancing this project. I can build tearsheets, draft quotes, or pull references against the brief.",
    discover: "Allow me to assist you in exploring the catalogue. Please describe what you are looking for and I will guide you to the most relevant pieces and designers.",
  },
  luxury: {
    mood: "Allow me to help you fine-tune your mood board — suggesting complementary pieces grounded in what's already pinned (palette, scale, materiality) and explaining why each fits. Tell me the direction you'd like to push and I'll refine.",
    tearsheet: "Allow me to help you shape this tearsheet — adding complementary pieces, swapping items for alternatives, or assembling a new draft from a brief. Tell me what you'd like to adjust and I'll propose options.",
    quote: "Allow me to help you refine this quote — clarifying trade pricing, lead times, and deposits, or proposing alternatives where it makes sense. Tell me what you'd like to review.",
    order: "Allow me to help you follow this order — production timelines, shipping milestones, and status updates. Tell me what you'd like to check.",
    project: "Allow me to help you advance this project — building tearsheets, drafting quotes, or pulling references against the brief. Tell me where you'd like to start.",
    discover: "Allow me to help you discover the catalogue — surfacing pieces, designers, or references aligned with the brief you have in mind. Tell me what you're looking for and I'll guide you.",
  },
  concise: {
    mood: "Mood board mode. I'll suggest complements based on palette, scale and materiality. Tell me the direction.",
    tearsheet: "Tearsheet mode. I can add, swap, or draft from a brief. What's needed?",
    quote: "Quote mode. Pricing, lead times, deposits, alternatives. What to review?",
    order: "Order mode. Production, shipping, status. What to check?",
    project: "Project mode. Tearsheets, quotes, references. Where to start?",
    discover: "Discovery mode. Tell me what you're after — piece, designer, or reference.",
  },
  designer: {
    mood: "Let's tune this board. I'll riff on what's pinned — palette, scale, materiality — and flag pieces that work. Tell me the move (warmer, more sculptural, lighter…) and I'll pull options.",
    tearsheet: "Let's shape this tearsheet. I can drop in complements, swap out anything off-brief, or build a fresh draft from your prompt. What direction?",
    quote: "Let's work this quote. I can break down pricing, lead times and deposits, or propose swaps. What do you want to look at?",
    order: "Let's track this order. Production, shipping milestones, status — what do you need to know?",
    project: "Let's push this project forward. Tearsheets, quotes, references — where do we start?",
    discover: "Let's find what you need. Tell me the brief — piece, designer, vibe — and I'll pull references.",
  },
};

// Non-EN packs translate the default tone (luxury) fully and each other
// tone where natural. Missing entries fall back to the EN equivalent.
const ID: LangPack = {
  luxury: {
    mood: "Izinkan saya menyempurnakan mood board ini bersama Anda — saya menyarankan elemen pelengkap yang selaras dengan yang sudah dipasang (palet, skala, materialitas) dan menjelaskan setiap pilihan. Beri tahu arah yang Anda inginkan.",
    tearsheet: "Izinkan saya membentuk tearsheet ini bersama Anda — menambah pelengkap, menukar item, atau menyusun draf baru dari brief. Beri tahu apa yang ingin Anda sesuaikan.",
    quote: "Izinkan saya menyempurnakan penawaran ini bersama Anda — memperjelas harga trade, lead time, dan deposit, atau mengusulkan alternatif bila perlu. Apa yang ingin ditinjau?",
    order: "Izinkan saya memantau pesanan ini bersama Anda — jadwal produksi, tahapan pengiriman, dan pembaruan status. Apa yang ingin diperiksa?",
    project: "Izinkan saya memajukan proyek ini bersama Anda — menyusun tearsheet, membuat penawaran, atau mengumpulkan referensi sesuai brief. Mulai dari mana?",
    discover: "Izinkan saya memandu Anda menelusuri katalog — karya, desainer, atau referensi yang selaras dengan brief Anda. Beri tahu apa yang Anda cari.",
  },
};

const TH: LangPack = {
  luxury: {
    mood: "อนุญาตให้ดิฉัน/ผมช่วยปรับมู้ดบอร์ดนี้กับคุณ — เสนอชิ้นที่เข้ากันบนพื้นฐานของสิ่งที่ปักไว้แล้ว (พาเล็ตต์ สเกล วัสดุ) พร้อมอธิบายเหตุผลทุกชิ้น บอกทิศทางที่ต้องการได้เลย",
    tearsheet: "อนุญาตให้ช่วยจัดทีอร์ชีตนี้กับคุณ — เพิ่มชิ้นที่เข้ากัน เปลี่ยนทางเลือก หรือร่างใหม่จากบรีฟ บอกได้เลยว่าต้องการปรับอะไร",
    quote: "อนุญาตให้ช่วยปรับใบเสนอราคานี้ — ชี้แจงราคา trade ลีดไทม์และมัดจำ หรือเสนอทางเลือกตามความเหมาะสม ต้องการตรวจสอบส่วนใด",
    order: "อนุญาตให้ช่วยติดตามคำสั่งซื้อนี้ — กำหนดการผลิต ระยะการจัดส่ง และอัปเดตสถานะ ต้องการตรวจสอบอะไร",
    project: "อนุญาตให้ช่วยขับเคลื่อนโปรเจกต์นี้ — สร้างทีอร์ชีต ร่างใบเสนอราคา หรือรวบรวมเรเฟอเรนซ์ตามบรีฟ จะเริ่มตรงไหนดี",
    discover: "อนุญาตให้ช่วยพาคุณสำรวจแคตตาล็อก — ชิ้นงาน ดีไซเนอร์ หรือเรเฟอเรนซ์ที่ตรงกับบรีฟของคุณ บอกได้เลยว่ากำลังมองหาอะไร",
  },
};

const ZH: LangPack = {
  luxury: {
    mood: "请允许我与您一同打磨这块情绪板——基于已固定的元素（色调、比例、材质）提出互补的作品，并解释每一项选择的理由。请告诉我您想推进的方向。",
    tearsheet: "请允许我与您一同梳理这份 tearsheet——补充呼应作品、替换不合适的项目，或根据 brief 起草新版本。请告诉我您想调整的方向。",
    quote: "请允许我与您一同细化此报价——厘清贸易价、交期与定金，或在合适处提出替代方案。您想先查看哪一部分？",
    order: "请允许我与您一同跟进此订单——生产排程、物流节点与状态更新。您希望先确认什么？",
    project: "请允许我与您一同推进此项目——构建 tearsheet、起草报价或按 brief 收集参考。我们从哪里开始？",
    discover: "请允许我引领您浏览品类——按您的 brief 找出相符的作品、设计师与参考。请告诉我您正在寻找什么。",
  },
};

const PACKS: Record<Lang, LangPack> = { en: EN as LangPack, id: ID, th: TH, zh: ZH };

export const greetingForContext = (
  stage: Stage,
  pathname: string,
  tone: Tone = DEFAULT_TONE,
  lang: Lang = DEFAULT_LANG,
): string => {
  const intent = intentFor(stage, pathname);
  // Resolution chain: lang+tone → lang+luxury → en+tone → en+luxury
  return (
    PACKS[lang]?.[tone]?.[intent]
    ?? PACKS[lang]?.[DEFAULT_TONE]?.[intent]
    ?? EN[tone][intent]
    ?? EN[DEFAULT_TONE][intent]
  );
};

export const DEFAULT_GREETING = greetingForContext("Discover", "/trade", DEFAULT_TONE, DEFAULT_LANG);

const LANG_NAMES: Record<Lang, string> = {
  en: "English",
  id: "Bahasa Indonesia",
  th: "Thai",
  zh: "Simplified Chinese",
};

// Style + language guidance appended to model context so streamed answers
// match the user's selected tone AND language (not just the opener).
// Custom concierge name — trade users can personalise how they address the
// assistant (e.g. "Margaux", "Atelier"). Persisted per-device in localStorage.
export const DEFAULT_NAME = "Concierge";
const NAME_KEY = "concierge:name";
const MAX_NAME_LEN = 32;

export const sanitizeName = (raw: string): string => {
  // Strip control chars + collapse whitespace, cap length.
  const cleaned = (raw || "").replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim();
  return cleaned.slice(0, MAX_NAME_LEN);
};

export const loadName = (): string => {
  try {
    const raw = localStorage.getItem(NAME_KEY);
    const v = raw ? sanitizeName(raw) : "";
    return v || DEFAULT_NAME;
  } catch {
    return DEFAULT_NAME;
  }
};

export const saveName = (name: string): string => {
  const v = sanitizeName(name) || DEFAULT_NAME;
  try { localStorage.setItem(NAME_KEY, v); } catch {}
  return v;
};

export const nameSystemNote = (name: string): string => {
  const safe = sanitizeName(name) || DEFAULT_NAME;
  if (safe === DEFAULT_NAME) return "";
  return `[Assistant identity] The user has named you "${safe}". When you introduce yourself, sign off, or the user addresses you, use this name. Do not mention that the name was user-chosen.`;
};

export const toneSystemNote = (tone: Tone, lang: Lang = DEFAULT_LANG): string => {
  const langLine = `[Language] Reply in ${LANG_NAMES[lang]} regardless of the language the user writes in, unless the user explicitly asks for another language.`;
  let style: string;
  switch (tone) {
    case "formal":
      style = "[Style] Respond in a formal, polished register. Full sentences, precise vocabulary, no slang or emoji.";
      break;
    case "concise":
      style = "[Style] Respond concisely. Prefer short sentences and tight bullets. No filler, no flourish, no emoji.";
      break;
    case "designer":
      style = "[Style] Respond in a peer-to-peer designer voice — warm, fluent in studio shorthand (palette, scale, materiality, brief). Direct but never curt.";
      break;
    case "luxury":
    default:
      style = "[Style] Respond in an editorial, atelier voice — evocative yet specific. Avoid clichés and avoid emoji.";
  }
  return `${langLine}\n${style}`;
};
