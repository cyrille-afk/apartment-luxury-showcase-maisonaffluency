import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, ClipboardPaste, X } from "lucide-react";
import { BrandPicker } from "@/components/trade/concierge/BrandPicker";

export type BriefValues = {
  block1: {
    projectProfile: string;
    zone: string;
    environment: string;
    timeline: string;
  };
  block2: {
    typology: string;
    maxFootprint: string;
    clearance: string;
    materials: string;
  };
  block3: {
    vibe: string;
    references: string;
    palette: string;
  };
  block4: string;
};

const DEFAULT_VALUES: BriefValues = {
  block1: {
    projectProfile: "[typology, city/area]",
    zone: "[room, ceiling height]",
    environment: "[humidity, sun exposure, glazing]",
    timeline: "Handover in [N] weeks (max lead time [N] weeks).",
  },
  block2: {
    typology: "[e.g. sectional + accent chairs]",
    maxFootprint: "length ≤ [mm], depth ≤ [mm]",
    clearance: "min [mm] perimeter pathway",
    materials: "[performance criteria, exclusions]",
  },
  block3: {
    vibe: "[e.g. Japandi-Luxe, Italian Minimalism]",
    references: "Man of Parts (Sandy Cove / Bond Street / Rua Leblon) / Collection Particulière / De La Espada / Leo Sentou",
    palette: "[materials + finishes]",
  },
  block4:
    "Return 3 layout configurations. For every piece, output a strict Architectural Specification Schedule:\nProduct Name · Designer · Exact mm Dimensions · Verified Finish Options · Lead Time · Cloudinary image URL · Supabase CAD/BIM URL.\nNo conversational intro.",
};

// Header labels used in the formatted brief sent to Felix. Do NOT change the
// "Block N —" prefixes; parseBrief() relies on them.
const BLOCK_LABELS: Record<string, string> = {
  block1: "Block 1 — Spatial & Project Context",
  block2: "Block 2 — Hard Technical Parameters",
  block3: "Block 3 — Aesthetic & Visual DNA",
  block4: "Block 4 — Output Execution Protocol",
};

// UI-only labels — the visible section headings in the builder. Kept short so
// the user isn't distracted by "Block 1/2/3" numbering.
const UI_BLOCK_LABELS: Record<string, string> = {
  block1: "Spatial & Project Context",
  block2: "Hard Technical Parameters",
  block3: "Aesthetic & Visual DNA",
};

const FIELD_LABELS: { key: keyof BriefValues["block1"] | keyof BriefValues["block2"] | keyof BriefValues["block3"]; label: string }[] = [
  { key: "projectProfile", label: "PROJECT PROFILE" },
  { key: "zone", label: "ZONE" },
  { key: "environment", label: "ENVIRONMENT" },
  { key: "timeline", label: "TIMELINE" },
  { key: "typology", label: "TYPOLOGY" },
  { key: "maxFootprint", label: "MAX FOOTPRINT" },
  { key: "clearance", label: "CLEARANCE" },
  { key: "materials", label: "MATERIALS" },
  { key: "vibe", label: "VIBE" },
  { key: "references", label: "REFERENCES" },
  { key: "palette", label: "PALETTE" },
];

function formatBrief(values: BriefValues): string {
  return [
    `${BLOCK_LABELS.block1}\nPROJECT PROFILE: ${values.block1.projectProfile}\nZONE: ${values.block1.zone}\nENVIRONMENT: ${values.block1.environment}\nTIMELINE: ${values.block1.timeline}`,
    `${BLOCK_LABELS.block2}\nTYPOLOGY: ${values.block2.typology}\nMAX FOOTPRINT: ${values.block2.maxFootprint}\nCLEARANCE: ${values.block2.clearance}\nMATERIALS: ${values.block2.materials}`,
    `${BLOCK_LABELS.block3}\nVIBE: ${values.block3.vibe}\nREFERENCES: ${values.block3.references}\nPALETTE: ${values.block3.palette}`,
    `${BLOCK_LABELS.block4}\n${values.block4}`,
  ].join("\n\n");
}

// Alternative section headers we recognize when a brief isn't using the
// canonical "Block N —" prefixes (e.g. templates written with markdown ###
// headings like "### PROJECT CONTEXT").
const ALT_BLOCK_HEADERS: { pattern: RegExp; block: "block1" | "block2" | "block3" | "block4" }[] = [
  { pattern: /project\s*context|spatial\s*&?\s*project/i, block: "block1" },
  { pattern: /hard\s*(technical\s*)?parameters|sql\s*constraints/i, block: "block2" },
  { pattern: /aesthetic\s*(dna|&?\s*visual)|vector\s*match/i, block: "block3" },
  { pattern: /execution\s*(directive|protocol)|output\s*execution/i, block: "block4" },
];

// Field label aliases → canonical field key per block. Order matters: the
// first matching alias wins, so put more specific labels first.
const FIELD_ALIASES: Record<"block1" | "block2" | "block3", Record<string, string[]>> = {
  block1: {
    projectProfile: ["PROJECT PROFILE", "PROJECT TYPE"],
    zone: ["ZONE"],
    environment: ["ENVIRONMENT"],
    timeline: ["TIMELINE", "LOGISTICS DEADLINE", "DEADLINE", "LEAD TIME"],
  },
  block2: {
    typology: ["TYPOLOGY"],
    maxFootprint: ["MAX FOOTPRINT", "TABLE DIMENSIONS", "DIMENSIONS", "FOOTPRINT"],
    clearance: ["CLEARANCE", "CHAIR CLEARANCE"],
    materials: ["MATERIALS", "MATERIAL PERFORMANCE", "MATERIAL"],
  },
  block3: {
    vibe: ["VIBE", "DESIGN PROFILE", "STYLE"],
    references: ["REFERENCES", "DESIGN BRAND/STYLES", "DESIGN BRANDS", "BRAND REFERENCES"],
    palette: ["PALETTE", "PALETTE & TEXTURES", "PALETTE AND TEXTURES"],
  },
};

function classifyHeader(text: string): "block1" | "block2" | "block3" | "block4" | null {
  const m = text.match(/^Block\s+(\d)\b/i);
  if (m) {
    const n = m[1];
    if (n === "1") return "block1";
    if (n === "2") return "block2";
    if (n === "3") return "block3";
    if (n === "4") return "block4";
  }
  for (const { pattern, block } of ALT_BLOCK_HEADERS) {
    if (pattern.test(text)) return block;
  }
  return null;
}

function parseBrief(text: string): { values: BriefValues; prefix: string; suffix: string } {
  // Match either canonical "Block N — ..." headers OR markdown-style
  // "### <SECTION NAME>" / "## <SECTION NAME>" headers so pasted templates
  // that use "### PROJECT CONTEXT" still auto-fill the builder.
  const headerRegex = /^(?:Block\s+\d+\s*—\s*.*?|#{1,6}\s+.+?)\s*$/gim;
  const rawHeaders: { text: string; index: number; block: "block1" | "block2" | "block3" | "block4" }[] = [];
  let m: RegExpExecArray | null;
  while ((m = headerRegex.exec(text)) !== null) {
    const block = classifyHeader(m[0]);
    if (block) rawHeaders.push({ text: m[0], index: m.index, block });
  }

  if (rawHeaders.length === 0 || rawHeaders[0].block !== "block1") {
    return { values: DEFAULT_VALUES, prefix: text, suffix: "" };
  }

  const prefix = text.slice(0, rawHeaders[0].index).trim();
  const blockBodies: Record<string, string> = {};
  for (let i = 0; i < rawHeaders.length; i++) {
    const start = rawHeaders[i].index + rawHeaders[i].text.length;
    const end = i + 1 < rawHeaders.length ? rawHeaders[i + 1].index : text.length;
    blockBodies[rawHeaders[i].text] = text.slice(start, end).trim();
  }

  const values: BriefValues = JSON.parse(JSON.stringify(DEFAULT_VALUES));

  for (const header of rawHeaders) {
    const body = blockBodies[header.text] || "";
    if (header.block === "block1") {
      for (const [key, aliases] of Object.entries(FIELD_ALIASES.block1)) {
        const v = extractFirstField(body, aliases);
        if (v) (values.block1 as Record<string, string>)[key] = v;
      }
    } else if (header.block === "block2") {
      for (const [key, aliases] of Object.entries(FIELD_ALIASES.block2)) {
        const v = extractFirstField(body, aliases);
        if (v) (values.block2 as Record<string, string>)[key] = v;
      }
    } else if (header.block === "block3") {
      for (const [key, aliases] of Object.entries(FIELD_ALIASES.block3)) {
        const v = extractFirstField(body, aliases);
        if (v) (values.block3 as Record<string, string>)[key] = v;
      }
    } else if (header.block === "block4") {
      values.block4 = body || DEFAULT_VALUES.block4;
    }
  }

  const lastHeader = rawHeaders[rawHeaders.length - 1];
  const suffix = text.slice(lastHeader.index + lastHeader.text.length + blockBodies[lastHeader.text].length).trim();

  return { values, prefix, suffix };
}

// Escape a label for use inside a RegExp — labels may contain "&", "/", etc.
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractField(body: string, label: string): string | null {
  // Allow an optional leading bullet ("- ", "* ", "• ") and optional bold
  // markers ("**LABEL**:") so lines like "- ZONE: ..." are recognized.
  const regex = new RegExp(
    `^\\s*(?:[-*•]\\s+)?\\*{0,2}${escapeRe(label)}\\*{0,2}\\s*:\\s*(.*)$`,
    "im"
  );
  const match = body.match(regex);
  if (match && match[1] !== undefined) {
    const value = match[1].trim();
    return value ? value : null;
  }
  return null;
}

function extractFirstField(body: string, labels: string[]): string | null {
  for (const label of labels) {
    const v = extractField(body, label);
    if (v) return v;
  }
  return null;
}


type ObjectBlock = "block1" | "block2" | "block3";

function updateBlockField<B extends ObjectBlock>(
  values: BriefValues,
  block: B,
  field: keyof BriefValues[B],
  value: string
): BriefValues {
  const target = values[block] as Record<string, string>;
  return {
    ...values,
    [block]: {
      ...target,
      [field]: value,
    },
  };
}

const DRAFT_STORAGE_KEY = "concierge:briefBuilder:draft";

type BriefDraft = {
  values: BriefValues;
  prefix: string;
  suffix: string;
};

function loadDraft(): BriefDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BriefDraft>;
    if (!parsed || typeof parsed !== "object" || !parsed.values) return null;
    const v = parsed.values as Partial<BriefValues>;
    const merged: BriefValues = {
      block1: { ...DEFAULT_VALUES.block1, ...(v.block1 || {}) },
      block2: { ...DEFAULT_VALUES.block2, ...(v.block2 || {}) },
      block3: { ...DEFAULT_VALUES.block3, ...(v.block3 || {}) },
      block4: typeof v.block4 === "string" ? v.block4 : DEFAULT_VALUES.block4,
    };
    return {
      values: merged,
      prefix: typeof parsed.prefix === "string" ? parsed.prefix : "",
      suffix: typeof parsed.suffix === "string" ? parsed.suffix : "",
    };
  } catch {
    return null;
  }
}

function saveDraft(draft: BriefDraft) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // ignore quota / serialization errors
  }
}

const EXPANDED_STORAGE_PREFIX = "concierge:briefBuilder:expanded";
// Legacy global key — read once as fallback so existing users keep their layout
// the first time they open the builder after this change.
const LEGACY_EXPANDED_STORAGE_KEY = "concierge:briefBuilder:expanded";

type ExpandedSections = Record<ObjectBlock, boolean>;

const DEFAULT_EXPANDED: ExpandedSections = {
  block1: true,
  block2: true,
  block3: true,
};

// Scope the expanded/collapsed layout per active trade project so switching
// projects restores that project's preferred section layout. Falls back to a
// shared "global" bucket when no project is active.
function getProjectScope(): string {
  if (typeof window === "undefined") return "global";
  try {
    const id = window.sessionStorage.getItem("trade:lastProjectFilter");
    return id && id.trim() ? id : "global";
  } catch {
    return "global";
  }
}

function expandedStorageKey(scope: string): string {
  return `${EXPANDED_STORAGE_PREFIX}:${scope}`;
}

function coerceExpanded(parsed: unknown): ExpandedSections | null {
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Record<string, unknown>;
  return {
    block1: !!p.block1,
    block2: !!p.block2,
    block3: !!p.block3,
  };
}

function loadExpanded(scope: string): ExpandedSections {
  if (typeof window === "undefined") return DEFAULT_EXPANDED;
  try {
    const raw = window.localStorage.getItem(expandedStorageKey(scope));
    if (raw) {
      const parsed = coerceExpanded(JSON.parse(raw));
      if (parsed) return parsed;
    }
    // First open in this scope: seed from legacy global key if present.
    const legacy = window.localStorage.getItem(LEGACY_EXPANDED_STORAGE_KEY);
    if (legacy) {
      const parsed = coerceExpanded(JSON.parse(legacy));
      if (parsed) return parsed;
    }
    return DEFAULT_EXPANDED;
  } catch {
    return DEFAULT_EXPANDED;
  }
}

function saveExpanded(scope: string, state: ExpandedSections) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(expandedStorageKey(scope), JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

export function BriefBuilder({
  value,
  onChange,
  onClose,
}: {
  value: string;
  onChange: (next: string) => void;
  onClose: () => void;
}) {
  const [values, setValues] = useState<BriefValues>(DEFAULT_VALUES);
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");
  const lastEmitted = useRef<string>("");
  const restoredRef = useRef(false);
  const scopeRef = useRef<string>(getProjectScope());
  const [expanded, setExpanded] = useState<ExpandedSections>(() => loadExpanded(scopeRef.current));

  // Re-read the scope + its saved layout whenever the active project changes
  // while the builder is mounted (e.g. user switches project filter).
  useEffect(() => {
    const sync = () => {
      const next = getProjectScope();
      if (next === scopeRef.current) return;
      scopeRef.current = next;
      setExpanded(loadExpanded(next));
    };
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  // On mount: if the composer already contains a recognizable brief (e.g. the
  // user pasted a template before opening the builder), parse THAT and skip
  // draft restore — otherwise the saved draft would wipe the paste. Only fall
  // back to the saved draft when the composer has nothing parseable.
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const parsedFromValue = value ? parseBrief(value) : null;
    const hasParsedContent =
      !!parsedFromValue &&
      JSON.stringify(parsedFromValue.values) !== JSON.stringify(DEFAULT_VALUES);

    if (hasParsedContent && parsedFromValue) {
      setValues(parsedFromValue.values);
      setPrefix(parsedFromValue.prefix);
      setSuffix(parsedFromValue.suffix);
      const formatted = formatBrief(parsedFromValue.values);
      const parts = [parsedFromValue.prefix, formatted, parsedFromValue.suffix].filter(Boolean);
      const nextText = parts.join("\n\n");
      lastEmitted.current = nextText;
      saveDraft({
        values: parsedFromValue.values,
        prefix: parsedFromValue.prefix,
        suffix: parsedFromValue.suffix,
      });
      onChange(nextText);
      return;
    }

    const draft = loadDraft();
    if (!draft) return;
    setValues(draft.values);
    setPrefix(draft.prefix);
    setSuffix(draft.suffix);
    const formatted = formatBrief(draft.values);
    const parts = [draft.prefix, formatted, draft.suffix].filter(Boolean);
    const nextText = parts.join("\n\n");
    lastEmitted.current = nextText;
    onChange(nextText);
  }, [onChange, value]);

  useEffect(() => {
    if (!restoredRef.current) return;
    const formatted = formatBrief(values);
    const current = prefix + (prefix ? "\n\n" : "") + formatted + (suffix ? "\n\n" : "") + suffix;
    if (value === current || value === lastEmitted.current) return;

    const parsed = parseBrief(value);
    setValues(parsed.values);
    setPrefix(parsed.prefix);
    setSuffix(parsed.suffix);
  }, [value]);

  const emit = (nextValues: BriefValues, nextPrefix: string, nextSuffix: string) => {
    const formatted = formatBrief(nextValues);
    const parts = [nextPrefix, formatted, nextSuffix].filter(Boolean);
    const nextText = parts.join("\n\n");
    lastEmitted.current = nextText;
    saveDraft({ values: nextValues, prefix: nextPrefix, suffix: nextSuffix });
    onChange(nextText);
  };

  const setBlockField = <B extends ObjectBlock>(
    block: B,
    field: keyof BriefValues[B],
    nextValue: string
  ) => {
    const nextValues = updateBlockField(values, block, field, nextValue);
    setValues(nextValues);
    emit(nextValues, prefix, suffix);
  };

  const setBlock4 = (next: string) => {
    const nextValues = { ...values, block4: next };
    setValues(nextValues);
    emit(nextValues, prefix, suffix);
  };

  const toggleSection = (block: ObjectBlock) => {
    const next = { ...expanded, [block]: !expanded[block] };
    setExpanded(next);
    saveExpanded(scopeRef.current, next);
  };

  // Merge a pasted brief into the current builder state without wiping
  // fields the user already filled in. Only fields the paste actually
  // supplied (i.e. differ from DEFAULT_VALUES) overwrite the current values.
  const [pasteStatus, setPasteStatus] = useState<null | "ok" | "empty" | "denied">(null);
  const handlePasteBrief = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        setPasteStatus("empty");
        setTimeout(() => setPasteStatus(null), 2000);
        return;
      }
      const parsed = parseBrief(text);
      const merged: BriefValues = {
        block1: { ...values.block1 },
        block2: { ...values.block2 },
        block3: { ...values.block3 },
        block4: values.block4,
      };
      let filled = 0;
      (Object.keys(parsed.values.block1) as (keyof BriefValues["block1"])[]).forEach((k) => {
        if (parsed.values.block1[k] !== DEFAULT_VALUES.block1[k]) {
          merged.block1[k] = parsed.values.block1[k];
          filled++;
        }
      });
      (Object.keys(parsed.values.block2) as (keyof BriefValues["block2"])[]).forEach((k) => {
        if (parsed.values.block2[k] !== DEFAULT_VALUES.block2[k]) {
          merged.block2[k] = parsed.values.block2[k];
          filled++;
        }
      });
      (Object.keys(parsed.values.block3) as (keyof BriefValues["block3"])[]).forEach((k) => {
        if (parsed.values.block3[k] !== DEFAULT_VALUES.block3[k]) {
          merged.block3[k] = parsed.values.block3[k];
          filled++;
        }
      });
      if (parsed.values.block4 !== DEFAULT_VALUES.block4) {
        merged.block4 = parsed.values.block4;
        filled++;
      }

      const nextPrefix = parsed.prefix || prefix;
      const nextSuffix = parsed.suffix || suffix;
      setValues(merged);
      setPrefix(nextPrefix);
      setSuffix(nextSuffix);
      emit(merged, nextPrefix, nextSuffix);
      setPasteStatus(filled > 0 ? "ok" : "empty");
      setTimeout(() => setPasteStatus(null), 2000);
    } catch {
      setPasteStatus("denied");
      setTimeout(() => setPasteStatus(null), 2500);
    }
  };

  const SectionHeader = ({
    title,
    open,
    onToggle,
  }: {
    title: string;
    open: boolean;
    onToggle: () => void;
  }) => (
    <button
      type="button"
      onClick={onToggle}
      className="mb-2 flex w-full items-center justify-between font-heading text-[12px] font-semibold text-accent"
      aria-expanded={open}
      aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
    >
      <span>{title}</span>
      {open ? (
        <ChevronDown className="h-3.5 w-3.5" />
      ) : (
        <ChevronRight className="h-3.5 w-3.5" />
      )}
    </button>
  );


  const Field = ({
    label,
    value,
    onChange,
    placeholder,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
  }) => (
    <label className="block">
      <span className="font-body text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 block w-full rounded-lg border border-border bg-background px-2.5 py-1.5 font-body text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
      />
    </label>
  );

  return (
    <div className="mb-2 rounded-xl border border-accent/40 bg-muted/30 p-3 max-h-[38vh] overflow-y-auto overscroll-contain">
      <div className="flex items-center justify-between mb-3">
        <span className="font-body text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          Brief Builder
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-foreground/10"
          aria-label="Close brief builder"
          title="Close brief builder"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-4">
        <section>
          <SectionHeader
            title={UI_BLOCK_LABELS.block1}
            open={expanded.block1}
            onToggle={() => toggleSection("block1")}
          />
          <div className={expanded.block1 ? "grid grid-cols-1 sm:grid-cols-2 gap-2.5" : "hidden"}>
            <Field
              label="Project Profile"
              value={values.block1.projectProfile}
              placeholder="[typology, city/area]"
              onChange={(v) => setBlockField("block1", "projectProfile", v)}
            />
            <Field
              label="Zone"
              value={values.block1.zone}
              placeholder="[room, ceiling height]"
              onChange={(v) => setBlockField("block1", "zone", v)}
            />
            <Field
              label="Environment"
              value={values.block1.environment}
              placeholder="[humidity, sun exposure, glazing]"
              onChange={(v) => setBlockField("block1", "environment", v)}
            />
            <Field
              label="Timeline"
              value={values.block1.timeline}
              placeholder="Handover in [N] weeks (max lead time [N] weeks)."
              onChange={(v) => setBlockField("block1", "timeline", v)}
            />
          </div>
        </section>

        <section>
          <SectionHeader
            title={UI_BLOCK_LABELS.block2}
            open={expanded.block2}
            onToggle={() => toggleSection("block2")}
          />
          <div className={expanded.block2 ? "grid grid-cols-1 sm:grid-cols-2 gap-2.5" : "hidden"}>
            <Field
              label="Typology"
              value={values.block2.typology}
              placeholder="[e.g. sectional + accent chairs]"
              onChange={(v) => setBlockField("block2", "typology", v)}
            />
            <Field
              label="Max Footprint"
              value={values.block2.maxFootprint}
              placeholder="length ≤ [mm], depth ≤ [mm]"
              onChange={(v) => setBlockField("block2", "maxFootprint", v)}
            />
            <Field
              label="Clearance"
              value={values.block2.clearance}
              placeholder="min [mm] perimeter pathway"
              onChange={(v) => setBlockField("block2", "clearance", v)}
            />
            <Field
              label="Materials"
              value={values.block2.materials}
              placeholder="[performance criteria, exclusions]"
              onChange={(v) => setBlockField("block2", "materials", v)}
            />
          </div>
        </section>

        <section>
          <SectionHeader
            title={UI_BLOCK_LABELS.block3}
            open={expanded.block3}
            onToggle={() => toggleSection("block3")}
          />
          <div className={expanded.block3 ? "grid grid-cols-1 sm:grid-cols-2 gap-2.5" : "hidden"}>
            <Field
              label="Vibe"
              value={values.block3.vibe}
              placeholder="[e.g. Japandi-Luxe, Italian Minimalism]"
              onChange={(v) => setBlockField("block3", "vibe", v)}
            />
            <BrandPicker
              value={values.block3.references}
              onChange={(v) => setBlockField("block3", "references", v)}
            />
            <Field
              label="Palette"
              value={values.block3.palette}
              placeholder="[materials + finishes]"
              onChange={(v) => setBlockField("block3", "palette", v)}
            />
          </div>
        </section>

        {/* Block 4 (Output Execution Protocol) is intentionally hidden from
            the user — it's a fixed internal directive that ships with every
            brief. The value is still preserved via `values.block4` and emitted
            through formatBrief so the model always receives it. */}

      </div>
    </div>
  );
}
