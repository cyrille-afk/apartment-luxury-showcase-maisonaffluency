// Evidence breakdown for AI Critical Radar rankings.
// The radar returns one holistic score; this explains which recorded signals
// support it. Missing or inaccessible evidence is always "neutral" — never a penalty.

export type EvidenceEffect = "supports" | "neutral" | "missing";
export type EvidenceRow = { label: string; effect: EvidenceEffect; detail: string };

const FREE_MAIL = /^(gmail|yahoo|hotmail|outlook|icloud|qq|163|live|aol|proton(mail)?)\./i;
const PROJECT_TERMS = /\b(project|projects|credit|credits|villa|villas|residence|residences|hotel|hotels|yacht|yachts|built|portfolio|award|press)\b/i;

export function radarEvidence(a: {
  email: string;
  business_reg_number: string | null;
  website_or_ig: string | null;
  radar_status: string | null;
  radar_flag: string | null;
  dnaStatus?: string | null;
}): EvidenceRow[] {
  const flag = a.radar_flag ?? "";
  const scored = a.radar_status === "scored";
  const projects = scored && PROJECT_TERMS.test(flag);
  const domain = a.email.split("@")[1] ?? "";
  const isIg = !!a.website_or_ig && (/instagram\.com/i.test(a.website_or_ig) || !/\./.test(a.website_or_ig.replace(/^@/, "")));
  const rows: EvidenceRow[] = [
    {
      label: "Project credits",
      effect: projects ? "supports" : "missing",
      detail: projects ? "Named built work cited — the main driver of the score." : "No project credits recorded yet.",
    },
  ];
  if (isIg) {
    const verified = a.dnaStatus === "complete" || a.dnaStatus === "completed";
    rows.push({
      label: "Instagram",
      effect: verified ? "supports" : "neutral",
      detail: verified ? "Profile read and analysed." : "Unverified — not counted against the studio.",
    });
  } else if (a.website_or_ig) {
    rows.push({ label: "Website", effect: projects ? "supports" : "neutral", detail: projects ? "Portfolio evidence retrieved." : "Listed; sparse sites are not penalised." });
  }
  rows.push({
    label: "Business registration",
    effect: a.business_reg_number ? "supports" : "neutral",
    detail: a.business_reg_number ? `Provided (${a.business_reg_number}); not yet externally verified.` : "Not provided — not penalised.",
  });
  rows.push({
    label: "Email domain",
    effect: FREE_MAIL.test(domain) || !domain ? "neutral" : "supports",
    detail: FREE_MAIL.test(domain) ? "Free webmail — not negative evidence." : `Corporate domain (${domain}).`,
  });
  return rows;
}
