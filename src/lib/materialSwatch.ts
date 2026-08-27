/**
 * Derives a representative visual "texture" for a finish/material option label
 * so the product page can render circular swatches instead of a text dropdown.
 *
 * There is no swatch photography for axis-based options (those that DO have
 * photography are already handled by <FinishSelector />), so we approximate the
 * material with a subtle CSS gradient keyed off well-known material vocabulary.
 * These are physical material colours — deliberately literal, not theme tokens.
 */

type Tone = { css: string; dark?: boolean };

const TONES: Array<{ test: RegExp; tone: Tone }> = [
  // Stone
  { test: /nero|marquina|black marble|noir/i, tone: { css: "linear-gradient(135deg,#2b2b2b 0%,#3d3d3d 45%,#1e1e1e 60%,#454545 100%)", dark: true } },
  { test: /calacatta|carrara|statuario|white marble|bianco/i, tone: { css: "linear-gradient(135deg,#f6f4f0 0%,#e6e3dc 45%,#fbfaf7 60%,#dcd8cf 100%)" } },
  { test: /travertine|limestone|onyx beige|cream/i, tone: { css: "linear-gradient(135deg,#e8ddc9 0%,#d6c7ac 60%,#efe7d8 100%)" } },
  { test: /verde|green marble|malachite/i, tone: { css: "linear-gradient(135deg,#2f4f42 0%,#4a6f5c 50%,#22382f 100%)", dark: true } },
  { test: /rosso|rouge|red marble/i, tone: { css: "linear-gradient(135deg,#6d2b28 0%,#8f3f39 55%,#4c1d1b 100%)", dark: true } },
  { test: /marble|stone|quartz|granite/i, tone: { css: "linear-gradient(135deg,#e4e1db 0%,#cbc6bd 55%,#f1efea 100%)" } },
  // Metals
  { test: /brass|brushed gold|gold/i, tone: { css: "linear-gradient(135deg,#c9a227 0%,#e8d08a 45%,#a8801d 100%)" } },
  { test: /bronze|antique copper|copper/i, tone: { css: "linear-gradient(135deg,#7b4b28 0%,#b07a45 50%,#5c3519 100%)", dark: true } },
  { test: /nickel|chrome|steel|aluminum|aluminium|silver/i, tone: { css: "linear-gradient(135deg,#b9bcc0 0%,#e6e8ea 45%,#8f9295 100%)" } },
  { test: /blackened|gunmetal|graphite|anthracite/i, tone: { css: "linear-gradient(135deg,#2a2c2f 0%,#45484c 50%,#1c1e20 100%)", dark: true } },
  // Woods
  { test: /walnut/i, tone: { css: "linear-gradient(135deg,#5b3a24 0%,#7d5334 55%,#432a19 100%)", dark: true } },
  { test: /ebony|wenge|smoked oak|dark oak/i, tone: { css: "linear-gradient(135deg,#2d221b 0%,#463830 55%,#1d1512 100%)", dark: true } },
  
  { test: /oak|ash|maple|birch|beech/i, tone: { css: "linear-gradient(135deg,#d9bb8c 0%,#c8a271 55%,#e7d2ad 100%)" } },
  { test: /teak|cherry|mahogany|rosewood/i, tone: { css: "linear-gradient(135deg,#8a4a29 0%,#a9663c 55%,#6b361d 100%)", dark: true } },
  // Textiles & leather
  { test: /leather|hide|saddle|tan\b/i, tone: { css: "linear-gradient(135deg,#8b5e3c 0%,#a97a53 55%,#6d452b 100%)", dark: true } },
  { test: /boucl|wool|linen|cotton|mohair|velvet|fabric|upholster/i, tone: { css: "linear-gradient(135deg,#ded7cb 0%,#c7bdae 55%,#efeae1 100%)" } },
  // Glass / lacquer / colour words
  { test: /clear glass|glass|crystal/i, tone: { css: "linear-gradient(135deg,#dbe6ea 0%,#f2f7f9 45%,#c3d3d9 100%)" } },
  { test: /smoked|bronze glass/i, tone: { css: "linear-gradient(135deg,#5c5148 0%,#7d7167 55%,#403830 100%)", dark: true } },
  { test: /\bwhite\b|ivory|alabaster|chalk/i, tone: { css: "linear-gradient(135deg,#fbfaf7 0%,#eceae4 100%)" } },
  { test: /\bblack\b|onyx|jet/i, tone: { css: "linear-gradient(135deg,#1b1b1b 0%,#333 100%)", dark: true } },
  { test: /\bnavy\b|midnight|indigo/i, tone: { css: "linear-gradient(135deg,#1e2a44 0%,#33456b 100%)", dark: true } },
  { test: /taupe|greige|sand|stone grey|grey|gray/i, tone: { css: "linear-gradient(135deg,#c2bbb1 0%,#a49b90 100%)" } },
];

const FALLBACK: Tone = { css: "linear-gradient(135deg,#d8d3ca 0%,#b9b2a7 100%)" };

export function materialSwatchTone(label: string): Tone {
  const l = (label || "").trim();
  for (const { test, tone } of TONES) {
    if (test.test(l)) return tone;
  }
  return FALLBACK;
}

/**
 * True when the label maps to a real material/colour tone.
 * Non-material axes (e.g. "Shape A" / "Shape B", "Model 2") would otherwise
 * render as identical blank beige circles, which reads as broken UI — those
 * axes must fall back to the text picker instead of the swatch row.
 */
export function hasKnownMaterialTone(label: string): boolean {
  const l = (label || "").trim();
  return TONES.some(({ test }) => test.test(l));
}


/** Short display name for a swatch caption: drops any "Prefix:" and trims. */
export function shortFinishLabel(label: string): string {
  const raw = (label || "").trim();
  const colon = raw.indexOf(":");
  const body = colon > -1 && colon < 40 ? raw.slice(colon + 1) : raw;
  return body.replace(/^\s*[-–]\s*/, "").trim();
}
