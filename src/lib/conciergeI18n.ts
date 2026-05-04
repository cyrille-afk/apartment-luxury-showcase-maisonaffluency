import type { Lang } from "@/components/trade/conciergeGreeting";
import { supabase } from "@/integrations/supabase/client";

export type LocalizableAction = { label: string; prompt: string; primary?: boolean };

// In-memory + localStorage cache for translated welcome messages.
// Key: `${lang}::${sourceContent}` → translated text.
const translationCache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

const CACHE_KEY = "concierge:welcome_translations:v1";
try {
  const raw = typeof localStorage !== "undefined" ? localStorage.getItem(CACHE_KEY) : null;
  if (raw) {
    const obj = JSON.parse(raw) as Record<string, string>;
    Object.entries(obj).forEach(([k, v]) => translationCache.set(k, v));
  }
} catch {}

const persistCache = () => {
  try {
    const obj: Record<string, string> = {};
    translationCache.forEach((v, k) => { obj[k] = v; });
    localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
  } catch {}
};

export const getCachedTranslation = (sourceContent: string, lang: Lang): string | undefined => {
  if (lang === "en") return sourceContent;
  return translationCache.get(`${lang}::${sourceContent}`);
};

export const translateWelcomeMessage = async (sourceContent: string, lang: Lang): Promise<string> => {
  if (lang === "en") return sourceContent;
  const key = `${lang}::${sourceContent}`;
  const cached = translationCache.get(key);
  if (cached) return cached;
  const existing = inflight.get(key);
  if (existing) return existing;
  const p = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke("translate-text", {
        body: { text: sourceContent, lang },
      });
      if (error) throw error;
      const translated = (data as { translated?: string })?.translated?.trim();
      if (!translated) throw new Error("empty translation");
      translationCache.set(key, translated);
      persistCache();
      return translated;
    } catch (e) {
      console.error("[concierge] translate failed", e);
      return sourceContent; // fall back to source
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
};

export const isOnboardingActionPrompt = (prompt: string) =>
  prompt === "__concierge:start_tour__" ||
  prompt === "__concierge:start_brief__" ||
  prompt === "__concierge:rename__";

const firstNamePart = (firstName?: string | null) => {
  const clean = firstName?.trim();
  return clean ? `, ${clean}` : "";
};

export const localizedWelcomeTemplate = (template: string, lang: Lang): string => {
  if (lang === "en") return template;
  const normalized = template.replace(/\r\n/g, "\n");
  const isCurrentWelcome =
    normalized.includes("Welcome to Maison Affluency{first_name_comma}") &&
    normalized.includes("your AI Trade Concierge") &&
    normalized.includes("quick tour of the platform") &&
    normalized.includes("start from a brief");
  const isLegacyWelcome =
    normalized.includes("Welcome to Maison Affluency{first_name_comma}") &&
    normalized.includes("Want a quick tour") &&
    normalized.includes("start from a brief");

  if (!isCurrentWelcome && !isLegacyWelcome) return template;

  const copy: Record<Exclude<Lang, "en">, string> = {
    id:
      "Selamat datang di Maison Affluency{first_name_comma} — saya {concierge_name}, AI Trade Concierge Anda. Apakah Anda ingin tur singkat platform terlebih dahulu, atau kita mulai dari brief?\n\n_Tip: Anda dapat mengganti nama saya kapan saja — saya di sini untuk membantu dan memandu Anda di setiap langkah, seaktif atau seringan yang Anda inginkan._",
    th:
      "ยินดีต้อนรับสู่ Maison Affluency{first_name_comma} — ฉันคือ {concierge_name} AI Trade Concierge ของคุณ ต้องการให้ฉันพาทัวร์แพลตฟอร์มแบบรวดเร็วก่อน หรือเริ่มจากบรีฟเลยดีไหม?\n\n_เคล็ดลับ: คุณเปลี่ยนชื่อฉันได้ทุกเมื่อ — ฉันพร้อมช่วยและนำทางคุณในทุกขั้นตอน จะให้ช่วยมากหรือน้อยแค่ไหนก็ได้ตามที่คุณต้องการ_",
    zh:
      "欢迎来到 Maison Affluency{first_name_comma} — 我是 {concierge_name}，您的 AI Trade Concierge。您想先快速浏览平台，还是从 brief 开始？\n\n_提示：您可以随时为我改名 — 我会在每一步协助和引导您，也可以按您的需要保持主动或低调。_",
  };
  return copy[lang];
};

const parseWelcomeNames = (content: string) => {
  const normalized = content.replace(/\r\n/g, "\n");
  const match = normalized.match(/^Welcome to Maison Affluency(?:,\s*([^—]+?))?\s*—\s*I'm\s+(.+?)(?:,\s+your AI Trade Concierge)?\.\s+/s);
  return {
    firstName: match?.[1]?.trim() || "",
    conciergeName: match?.[2]?.trim() || "Concierge",
  };
};

export const localizeOnboardingMessage = (sourceContent: string, lang: Lang): string => {
  if (lang === "en") return sourceContent;
  const { firstName, conciergeName } = parseWelcomeNames(sourceContent);
  const template = localizedWelcomeTemplate(
    "Welcome to Maison Affluency{first_name_comma} — I'm {concierge_name}, your AI Trade Concierge. Would you like me to give you a quick tour of the platform to start with, or shall we start from a brief?\n\n_Tip: you can rename me at any time — I'm here to help you and guide at any step of the way and can be as hands on or off as you want me to be._",
    lang,
  );
  return template
    .replace(/\{first_name_comma\}/g, firstNamePart(firstName))
    .replace(/\{first_name\}/g, firstName)
    .replace(/\{concierge_name\}/g, conciergeName);
};

export const localizeOnboardingActions = (
  actions: LocalizableAction[] | undefined,
  lang: Lang,
  conciergeName: string,
): LocalizableAction[] | undefined => {
  if (!actions) return undefined;
  if (lang === "en") return actions;
  const labels: Record<Lang, Record<string, string>> = {
    en: {
      "__concierge:start_tour__": "Start Quick Tour",
      "__concierge:start_brief__": "Start from a brief",
      "__concierge:rename__": `Rename ${conciergeName}`,
    },
    id: {
      "__concierge:start_tour__": "Mulai Tur Singkat",
      "__concierge:start_brief__": "Mulai dari brief",
      "__concierge:rename__": `Ganti nama ${conciergeName}`,
    },
    th: {
      "__concierge:start_tour__": "เริ่มทัวร์แบบรวดเร็ว",
      "__concierge:start_brief__": "เริ่มจากบรีฟ",
      "__concierge:rename__": `เปลี่ยนชื่อ ${conciergeName}`,
    },
    zh: {
      "__concierge:start_tour__": "开始快速导览",
      "__concierge:start_brief__": "从 brief 开始",
      "__concierge:rename__": `重命名 ${conciergeName}`,
    },
  };

  return actions.map((action) => ({
    ...action,
    label: labels[lang][action.prompt] ?? action.label,
  }));
};

export const conciergeCopy = (lang: Lang) => ({
  nameDialogTitle: {
    en: "Name your concierge",
    id: "Beri nama concierge Anda",
    th: "ตั้งชื่อคอนเซียร์จของคุณ",
    zh: "为您的 concierge 命名",
  }[lang],
  nameHint: {
    en: "Up to 32 characters · syncs to your account",
    id: "Maksimal 32 karakter · tersinkron ke akun Anda",
    th: "สูงสุด 32 ตัวอักษร · ซิงก์กับบัญชีของคุณ",
    zh: "最多 32 个字符 · 与您的账户同步",
  }[lang],
  reset: { en: "Reset", id: "Reset", th: "รีเซ็ต", zh: "重置" }[lang],
  cancel: { en: "Cancel", id: "Batal", th: "ยกเลิก", zh: "取消" }[lang],
  save: { en: "Save", id: "Simpan", th: "บันทึก", zh: "保存" }[lang],
  tone: { en: "Concierge tone", id: "Nada concierge", th: "โทนของคอนเซียร์จ", zh: "Concierge 语气" }[lang],
  language: { en: "Language", id: "Bahasa", th: "ภาษา", zh: "语言" }[lang],
  stage: { en: "Stage", id: "Tahap", th: "ขั้นตอน", zh: "阶段" }[lang],
  ask: { en: "Ask me anything…", id: "Tanyakan apa saja…", th: "ถามฉันได้ทุกเรื่อง…", zh: "随时向我提问…" }[lang],
  footer: {
    en: "AI-powered · Tearsheet drafts require your approval",
    id: "Didukung AI · Draf tearsheet memerlukan persetujuan Anda",
    th: "ขับเคลื่อนด้วย AI · ร่างทีอร์ชีตต้องได้รับการอนุมัติจากคุณ",
    zh: "AI 驱动 · Tearsheet 草稿需经您确认",
  }[lang],
});

export const conciergeStatusCopy = (kind: "tour" | "brief", lang: Lang) => {
  const copy = {
    tour: {
      en: "Starting your guided tour — I'll walk you through the Showroom, Designers & Ateliers, brief setup, and your specification toolkit. You can skip at any time.",
      id: "Memulai tur terpandu — saya akan memandu Anda melalui Showroom, Designers & Ateliers, pengaturan brief, dan toolkit spesifikasi Anda. Anda dapat melewati kapan saja.",
      th: "กำลังเริ่มทัวร์แบบมีไกด์ — ฉันจะพาคุณผ่าน Showroom, Designers & Ateliers, การตั้งค่าบรีฟ และชุดเครื่องมือสเปก คุณสามารถข้ามได้ทุกเมื่อ",
      zh: "正在开始导览 — 我会带您浏览 Showroom、Designers & Ateliers、brief 设置以及规格工具包。您可以随时跳过。",
    },
    brief: {
      en: "Let's scope your project — five quick questions and I'll create your starting brief.",
      id: "Mari kita tentukan ruang lingkup proyek Anda — lima pertanyaan singkat, lalu saya akan membuat brief awal Anda.",
      th: "มาวางขอบเขตโปรเจกต์ของคุณกัน — ตอบคำถามสั้น ๆ ห้าข้อ แล้วฉันจะสร้างบรีฟเริ่มต้นให้คุณ",
      zh: "我们来梳理您的项目 — 五个简短问题后，我会为您创建起始 brief。",
    },
  };
  return copy[kind][lang];
};

export const localizeTourStep = <T extends { id: string; title: string; body: string; ctaLabel: string }>(step: T, lang: Lang): T => {
  if (lang === "en") return step;
  const localized: Record<string, Partial<Record<Exclude<Lang, "en">, Pick<T, "title" | "body" | "ctaLabel">>>> = {
    showroom: {
      id: {
        title: "1. Jelajahi Showroom",
        body: "Mulai di sini untuk mengeksplorasi ruang kurasi secara in situ. Klik hotspot pada foto untuk membuka detail karya, melihat spesifikasi, harga trade, dan menambahkannya ke tearsheet.",
        ctaLabel: "Berikutnya: Designers",
      } as Pick<T, "title" | "body" | "ctaLabel">,
      th: {
        title: "1. สำรวจ Showroom",
        body: "เริ่มที่นี่เพื่อสำรวจห้องที่คัดสรรในบริบทจริง คลิกฮอตสปอตบนภาพเพื่อเปิดชิ้นงาน ดูสเปก ราคา trade และเพิ่มลงในทีอร์ชีต",
        ctaLabel: "ถัดไป: Designers",
      } as Pick<T, "title" | "body" | "ctaLabel">,
      zh: {
        title: "1. 浏览 Showroom",
        body: "从这里开始探索实景策展空间。点击照片中的热点即可打开作品，查看规格、trade pricing，并添加到 tearsheet。",
        ctaLabel: "下一步：Designers",
      } as Pick<T, "title" | "body" | "ctaLabel">,
    },
    designers: {
      id: {
        title: "2. Temukan Designers & Ateliers",
        body: "Dari dashboard, buka tile Designers & Ateliers Library yang disorot untuk memfilter 274 desainer dari 32 atelier berdasarkan kategori, negara, atau material — lalu jelajahi karya mereka.",
        ctaLabel: "Berikutnya: Brief",
      } as Pick<T, "title" | "body" | "ctaLabel">,
      th: {
        title: "2. ค้นพบ Designers & Ateliers",
        body: "จากแดชบอร์ด เปิดไทล์ Designers & Ateliers Library ที่ถูกไฮไลต์ เพื่อกรองดีไซเนอร์ 274 รายจาก 32 อเตอลิเย่ร์ตามหมวดหมู่ ประเทศ หรือวัสดุ — แล้วเลือกชมผลงานของพวกเขา",
        ctaLabel: "ถัดไป: บรีฟ",
      } as Pick<T, "title" | "body" | "ctaLabel">,
      zh: {
        title: "2. 探索 Designers & Ateliers",
        body: "从 dashboard 打开高亮的 Designers & Ateliers Library 卡片，可按类别、国家或材质筛选 32 个 atelier 的 274 位设计师，并浏览他们的作品。",
        ctaLabel: "下一步：Brief 设置",
      } as Pick<T, "title" | "body" | "ctaLabel">,
    },
    brief: {
      id: {
        title: "3. Susun brief",
        body: "Buat tearsheet atau quote untuk klien Anda. Anda juga dapat meminta AI Concierge memulai dari brief — ia akan memetakan kebutuhan proyek dan mengusulkan karya secara otomatis.",
        ctaLabel: "Berikutnya: Tools",
      } as Pick<T, "title" | "body" | "ctaLabel">,
      th: {
        title: "3. ตั้งค่าบรีฟ",
        body: "สร้างทีอร์ชีตหรือใบเสนอราคาสำหรับลูกค้าของคุณ คุณยังสามารถขอให้ AI Concierge เริ่มจากบรีฟ — ระบบจะช่วยกำหนดขอบเขตโปรเจกต์และเสนอชิ้นงานโดยอัตโนมัติ",
        ctaLabel: "ถัดไป: Tools",
      } as Pick<T, "title" | "body" | "ctaLabel">,
      zh: {
        title: "3. 设置 brief",
        body: "为客户创建 tearsheet 或 quote。您也可以让 AI Concierge 从 brief 开始 — 它会梳理项目范围并自动建议作品。",
        ctaLabel: "下一步：Tools",
      } as Pick<T, "title" | "body" | "ctaLabel">,
    },
    tools: {
      id: {
        title: "4. Toolkit spesifikasi Anda",
        body: "Semua yang Anda butuhkan untuk membawa quote dari ide hingga pengiriman ada di sini: Mood Board untuk presentasi klien, Tearsheet Builder untuk spesifikasi cetak, Markup & Annotation untuk gambar kerja, FF&E Schedule, Product Comparator, Floor Plan → FF&E, dan lainnya. Tandai halaman ini — Anda akan sering kembali.",
        ctaLabel: "Selesaikan tur",
      } as Pick<T, "title" | "body" | "ctaLabel">,
      th: {
        title: "4. ชุดเครื่องมือสเปกของคุณ",
        body: "ทุกสิ่งที่ต้องใช้เพื่อนำ quote จากไอเดียสู่การส่งมอบอยู่ที่นี่: Mood Board สำหรับพรีเซนต์ลูกค้า, Tearsheet Builder สำหรับสเปกแบบพิมพ์, Markup & Annotation สำหรับแบบ, FF&E Schedule, Product Comparator, Floor Plan → FF&E และอื่น ๆ บุ๊กมาร์กหน้านี้ไว้ — คุณจะได้กลับมาใช้บ่อย",
        ctaLabel: "จบทัวร์",
      } as Pick<T, "title" | "body" | "ctaLabel">,
      zh: {
        title: "4. 您的规格工具包",
        body: "从概念到交付所需的一切都在这里：用于客户提案的 Mood Board、可打印规格的 Tearsheet Builder、图纸 Markup & Annotation、FF&E Schedule、Product Comparator、Floor Plan → FF&E 等。请收藏此页 — 您会经常回来使用。",
        ctaLabel: "完成导览",
      } as Pick<T, "title" | "body" | "ctaLabel">,
    },
  };
  const next = localized[step.id]?.[lang as Exclude<Lang, "en">];
  return next ? { ...step, ...next } : step;
};

export const tourChromeCopy = (lang: Lang) => ({
  stepOf: (current: number, total: number) => ({
    en: `Step ${current} of ${total}`,
    id: `Langkah ${current} dari ${total}`,
    th: `ขั้นตอน ${current} จาก ${total}`,
    zh: `第 ${current} 步，共 ${total} 步`,
  })[lang],
  skip: { en: "Skip", id: "Lewati", th: "ข้าม", zh: "跳过" }[lang],
  back: { en: "Back", id: "Kembali", th: "กลับ", zh: "返回" }[lang],
  next: { en: "Next", id: "Berikutnya", th: "ถัดไป", zh: "下一步" }[lang],
  finish: { en: "Finish", id: "Selesai", th: "เสร็จสิ้น", zh: "完成" }[lang],
  skipTour: { en: "Skip tour", id: "Lewati tur", th: "ข้ามทัวร์", zh: "跳过导览" }[lang],
  progress: (current: number, total: number) => ({
    en: `Tour progress: step ${current} of ${total}`,
    id: `Progres tur: langkah ${current} dari ${total}`,
    th: `ความคืบหน้าทัวร์: ขั้นตอน ${current} จาก ${total}`,
    zh: `导览进度：第 ${current} 步，共 ${total} 步`,
  })[lang],
});