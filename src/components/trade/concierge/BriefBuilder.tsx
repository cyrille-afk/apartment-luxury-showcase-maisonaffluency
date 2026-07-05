import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
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

function parseBrief(text: string): { values: BriefValues; prefix: string; suffix: string } {
  const headerRegex = /^Block\s+\d+\s*—\s*.*?\s*$/gim;
  const headers: { text: string; index: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = headerRegex.exec(text)) !== null) {
    headers.push({ text: m[0], index: m.index });
  }

  if (headers.length === 0 || !/^Block\s+1\b/i.test(headers[0].text)) {
    return { values: DEFAULT_VALUES, prefix: text, suffix: "" };
  }

  const prefix = text.slice(0, headers[0].index).trim();
  const blockBodies: Record<string, string> = {};
  for (let i = 0; i < headers.length; i++) {
    const start = headers[i].index + headers[i].text.length;
    const end = i + 1 < headers.length ? headers[i + 1].index : text.length;
    blockBodies[headers[i].text] = text.slice(start, end).trim();
  }

  const values: BriefValues = JSON.parse(JSON.stringify(DEFAULT_VALUES));

  for (const header of headers) {
    const body = blockBodies[header.text] || "";
    if (/^Block\s+1\b/i.test(header.text)) {
      values.block1.projectProfile = extractField(body, "PROJECT PROFILE") || DEFAULT_VALUES.block1.projectProfile;
      values.block1.zone = extractField(body, "ZONE") || DEFAULT_VALUES.block1.zone;
      values.block1.environment = extractField(body, "ENVIRONMENT") || DEFAULT_VALUES.block1.environment;
      values.block1.timeline = extractField(body, "TIMELINE") || DEFAULT_VALUES.block1.timeline;
    } else if (/^Block\s+2\b/i.test(header.text)) {
      values.block2.typology = extractField(body, "TYPOLOGY") || DEFAULT_VALUES.block2.typology;
      values.block2.maxFootprint = extractField(body, "MAX FOOTPRINT") || DEFAULT_VALUES.block2.maxFootprint;
      values.block2.clearance = extractField(body, "CLEARANCE") || DEFAULT_VALUES.block2.clearance;
      values.block2.materials = extractField(body, "MATERIALS") || DEFAULT_VALUES.block2.materials;
    } else if (/^Block\s+3\b/i.test(header.text)) {
      values.block3.vibe = extractField(body, "VIBE") || DEFAULT_VALUES.block3.vibe;
      values.block3.references = extractField(body, "REFERENCES") || DEFAULT_VALUES.block3.references;
      values.block3.palette = extractField(body, "PALETTE") || DEFAULT_VALUES.block3.palette;
    } else if (/^Block\s+4\b/i.test(header.text)) {
      values.block4 = body || DEFAULT_VALUES.block4;
    }
  }

  const lastHeader = headers[headers.length - 1];
  const suffix = text.slice(lastHeader.index + lastHeader.text.length + blockBodies[lastHeader.text].length).trim();

  return { values, prefix, suffix };
}

function extractField(body: string, label: string): string | null {
  const regex = new RegExp(`^${label}\\s*:\\s*(.*)$`, "im");
  const match = body.match(regex);
  if (match && match[1] !== undefined) {
    return match[1].trim();
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

  // Restore draft on mount (once), overriding whatever the parent seeded.
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
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
  }, [onChange]);

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
          <div className="font-heading text-[12px] font-semibold text-accent mb-2">
            {UI_BLOCK_LABELS.block1}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
          <div className="font-heading text-[12px] font-semibold text-accent mb-2">
            {UI_BLOCK_LABELS.block2}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
          <div className="font-heading text-[12px] font-semibold text-accent mb-2">
            {UI_BLOCK_LABELS.block3}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
