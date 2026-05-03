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
  fr: {
    formal: { label: "Formel", description: "Soigné, professionnel, phrases complètes." },
    luxury: { label: "Luxe", description: "Voix éditoriale, évocatrice, atelier." },
    concise: { label: "Concis", description: "Bref, lisible, sans fioritures." },
    designer: { label: "Style designer", description: "Langage d'atelier, entre pairs." },
  },
  it: {
    formal: { label: "Formale", description: "Curato, professionale, frasi complete." },
    luxury: { label: "Lusso", description: "Voce editoriale, evocativa, da atelier." },
    concise: { label: "Conciso", description: "Breve, scorrevole, senza fronzoli." },
    designer: { label: "Stile designer", description: "Linguaggio da studio, tra pari." },
  },
  es: {
    formal: { label: "Formal", description: "Pulido, profesional, frases completas." },
    luxury: { label: "Lujo", description: "Voz editorial, evocadora, de atelier." },
    concise: { label: "Conciso", description: "Breve, claro, sin adornos." },
    designer: { label: "Estilo diseñador", description: "Lenguaje de estudio, entre pares." },
  },
  de: {
    formal: { label: "Formell", description: "Gepflegt, professionell, ganze Sätze." },
    luxury: { label: "Luxus", description: "Editorial, evokativ, Atelier-Stimme." },
    concise: { label: "Knapp", description: "Kurz, übersichtlich, ohne Schnörkel." },
    designer: { label: "Designer-Stil", description: "Studio-Sprache, auf Augenhöhe." },
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
const FR: LangPack = {
  luxury: {
    mood: "Permettez-moi d'affiner ce mood board avec vous — je propose des pièces complémentaires en cohérence avec ce qui est déjà épinglé (palette, échelle, matérialité) et j'explique chaque choix. Indiquez la direction à donner et je l'affinerai.",
    tearsheet: "Permettez-moi de façonner ce tearsheet avec vous — ajouter des pièces complémentaires, proposer des alternatives, ou composer un nouveau brouillon à partir d'un brief. Dites-moi ce que vous souhaitez ajuster.",
    quote: "Permettez-moi d'affiner ce devis avec vous — clarifier les prix trade, délais et acomptes, ou proposer des alternatives lorsque c'est pertinent. Que souhaitez-vous revoir ?",
    order: "Permettez-moi de suivre cette commande avec vous — calendriers de production, jalons logistiques et mises à jour de statut. Que souhaitez-vous vérifier ?",
    project: "Permettez-moi de faire avancer ce projet avec vous — construire des tearsheets, rédiger des devis ou rassembler des références face au brief. Par où commençons-nous ?",
    discover: "Permettez-moi de vous guider dans le catalogue — pièces, designers ou références alignées avec votre brief. Dites-moi ce que vous cherchez et je vous oriente.",
  },
  formal: {
    mood: "Permettez-moi de vous assister dans l'affinement de ce mood board. Je proposerai des pièces complémentaires fondées sur les éléments déjà épinglés — palette, échelle, matérialité — en justifiant chaque suggestion.",
    tearsheet: "Permettez-moi de vous assister dans l'élaboration de ce tearsheet. Je peux ajouter des pièces complémentaires, suggérer des alternatives ou composer un nouveau brouillon à partir d'un brief.",
    quote: "Permettez-moi de vous assister dans la revue de ce devis. Je peux clarifier les prix trade, délais et acomptes, et proposer des alternatives le cas échéant.",
    order: "Permettez-moi de vous assister dans le suivi de cette commande. Je peux détailler les calendriers de production, les jalons logistiques et le statut actuel.",
    project: "Permettez-moi de vous assister dans l'avancement de ce projet. Je peux construire des tearsheets, rédiger des devis ou rassembler des références face au brief.",
    discover: "Permettez-moi de vous assister dans l'exploration du catalogue. Décrivez ce que vous cherchez et je vous guiderai vers les pièces et designers les plus pertinents.",
  },
  concise: {
    mood: "Mode mood board. Je propose des complémentaires (palette, échelle, matérialité). Indiquez la direction.",
    tearsheet: "Mode tearsheet. J'ajoute, je remplace, je rédige à partir d'un brief. Que faut-il ?",
    quote: "Mode devis. Prix, délais, acomptes, alternatives. Que revoir ?",
    order: "Mode commande. Production, expédition, statut. Que vérifier ?",
    project: "Mode projet. Tearsheets, devis, références. Par où commencer ?",
    discover: "Mode découverte. Dites-moi ce que vous cherchez — pièce, designer ou référence.",
  },
  designer: {
    mood: "On peaufine ce board. Je rebondis sur ce qui est épinglé (palette, échelle, matérialité) et je sors des pièces qui matchent. Donne-moi la direction (plus chaud, plus sculptural, plus léger…) et j'envoie.",
    tearsheet: "On façonne ce tearsheet. Je peux glisser des complémentaires, virer ce qui sort du brief, ou repartir d'un draft. Quelle direction ?",
    quote: "On bosse ce devis. Je peux décortiquer prix, délais et acomptes, ou proposer des swaps. On regarde quoi ?",
    order: "On suit cette commande. Production, expédition, statut — qu'est-ce que tu veux savoir ?",
    project: "On pousse ce projet. Tearsheets, devis, références — par où on attaque ?",
    discover: "On trouve ce qu'il te faut. Donne-moi le brief — pièce, designer, vibe — et je sors les références.",
  },
};

const IT: LangPack = {
  luxury: {
    mood: "Mi permetta di rifinire questa mood board con lei — propongo pezzi complementari coerenti con quanto già fissato (palette, scala, materia) e spiego perché ognuno funziona. Mi dica la direzione e affinerò.",
    tearsheet: "Mi permetta di dare forma a questo tearsheet — aggiungere pezzi complementari, suggerire alternative o comporre una nuova bozza da un brief. Mi dica cosa desidera regolare.",
    quote: "Mi permetta di rifinire questo preventivo — chiarire prezzi trade, tempi di consegna e acconti, o proporre alternative dove ha senso. Cosa desidera rivedere?",
    order: "Mi permetta di seguire questo ordine — tempi di produzione, tappe di spedizione e aggiornamenti di stato. Cosa desidera verificare?",
    project: "Mi permetta di far avanzare questo progetto — costruire tearsheet, redigere preventivi o raccogliere riferimenti rispetto al brief. Da dove cominciamo?",
    discover: "Mi permetta di guidarla nel catalogo — pezzi, designer o riferimenti allineati al suo brief. Mi dica cosa cerca e la orienterò.",
  },
};

const ES: LangPack = {
  luxury: {
    mood: "Permítame afinar este mood board con usted — propongo piezas complementarias coherentes con lo ya fijado (paleta, escala, materialidad) y explico por qué cada una encaja. Indíqueme la dirección y la afinaré.",
    tearsheet: "Permítame dar forma a este tearsheet — añadir piezas complementarias, sugerir alternativas o componer un nuevo borrador a partir de un brief. Dígame qué desea ajustar.",
    quote: "Permítame afinar este presupuesto — aclarar precios trade, plazos y depósitos, o proponer alternativas cuando tenga sentido. ¿Qué desea revisar?",
    order: "Permítame seguir este pedido — plazos de producción, hitos de envío y actualizaciones de estado. ¿Qué desea consultar?",
    project: "Permítame avanzar este proyecto — construir tearsheets, redactar presupuestos o reunir referencias frente al brief. ¿Por dónde empezamos?",
    discover: "Permítame guiarle por el catálogo — piezas, diseñadores o referencias alineadas con su brief. Dígame qué busca y le orientaré.",
  },
};

const DE: LangPack = {
  luxury: {
    mood: "Gestatten Sie, dass ich dieses Mood Board mit Ihnen verfeinere — ich schlage komplementäre Stücke vor, die sich an dem bereits Gepinnten orientieren (Palette, Maßstab, Materialität), und begründe jede Auswahl. Sagen Sie mir die Richtung, und ich verfeinere.",
    tearsheet: "Gestatten Sie, dass ich dieses Tearsheet mit Ihnen forme — komplementäre Stücke ergänzen, Alternativen vorschlagen oder einen neuen Entwurf aus einem Brief erstellen. Sagen Sie mir, was Sie anpassen möchten.",
    quote: "Gestatten Sie, dass ich dieses Angebot mit Ihnen verfeinere — Trade-Preise, Lieferzeiten und Anzahlungen klären oder Alternativen vorschlagen, wo es sinnvoll ist. Was möchten Sie prüfen?",
    order: "Gestatten Sie, dass ich diesen Auftrag mit Ihnen verfolge — Produktionszeiten, Versandstationen und Statusaktualisierungen. Was möchten Sie prüfen?",
    project: "Gestatten Sie, dass ich dieses Projekt mit Ihnen voranbringe — Tearsheets erstellen, Angebote entwerfen oder Referenzen zum Brief zusammenstellen. Wo beginnen wir?",
    discover: "Gestatten Sie, dass ich Sie durch den Katalog führe — Stücke, Designer oder Referenzen passend zu Ihrem Brief. Sagen Sie mir, was Sie suchen, und ich leite Sie.",
  },
};

const PACKS: Record<Lang, LangPack> = { en: EN as LangPack, fr: FR, it: IT, es: ES, de: DE };

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
  fr: "French",
  it: "Italian",
  es: "Spanish",
  de: "German",
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
