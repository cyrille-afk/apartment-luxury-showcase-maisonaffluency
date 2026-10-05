export type NotificationDraft = { subject: string; body: string };
export const APPROVAL_SUBJECT = 'Welcome to the Maison Affluency Trade Program';
export const REJECTION_SUBJECT = 'Maison Affluency Trade Program — Application Update';
export const APPROVAL_BENEFITS = [
  {
    "title": "Trade pricing & bespoke quotations",
    "description": "Preferential trade discount applied across the catalogue, plus tailored quotations for larger scopes.",
    "details": []
  },
  {
    "title": "Dedicated Client Advisor",
    "description": "A single point of contact for sourcing, lead times, logistics, and white-glove project support.",
    "details": []
  },
  {
    "title": "Custom & bespoke requests",
    "description": "Commission modifications or entirely bespoke pieces directly with our ateliers and designers.",
    "details": []
  },
  {
    "title": "Curated product library",
    "description": "Access to European, Japanese and American ateliers, collectible design, and material archives.",
    "details": []
  },
  {
    "title": "CAD & 3D Files",
    "description": "Trade-only technical downloads where the maker supplies them: DWG, DXF, 3DS, SKP, RFA, OBJ, FBX, STEP, IGES. Requires sign-in and appears only on eligible product pages.",
    "details": []
  },
  {
    "title": "Samples & swatches",
    "description": "Request finish and fabric samples shipped to your studio for client presentations.",
    "details": []
  },
  {
    "title": "Consolidated, fully insured shipping",
    "description": "Worldwide DDP or DAP, with one landed quote covering freight, customs, and duties.",
    "details": []
  },
  {
    "title": "Branded quote & tearsheet builder",
    "description": "Export white-labelled PDFs and share tearsheets under your studio's identity.",
    "details": []
  },
  {
    "title": "White-label client boards",
    "description": "Private shareable boards for your clients under your logo and studio name.",
    "details": []
  },
  {
    "title": "Project folders & mood board studio",
    "description": "Organise sourcing by project and build mood boards with AI assistance.",
    "details": []
  },
  {
    "title": "3D Studio",
    "description": "Turn architectural drawings into furnished 3D visualisations to present to clients.",
    "details": []
  },
  {
    "title": "AI Concierge",
    "description": "An in-app assistant trained exclusively on our catalogue for instant recommendations.",
    "details": []
  },
  {
    "title": "Trade payouts",
    "description": "Choose how your studio gets paid on every quote.",
    "details": [
      "Agent commission (EU / Asia default): your client pays full MSRP and you receive a commission payout after delivery.",
      "Net buy (US / CA / MX default): your firm pays MSRP minus your tier discount on a white-label invoice.",
      "Country-aware defaults: US / Canada / Mexico default to net buy; the rest of the world defaults to agent commission.",
      "Per-quote override: flip billing mode on any individual quote when the project calls for it.",
      "Resale certificates: upload state-issued US resale certificates to unlock net-buy shipments to those states.",
      "Stripe Connect: agent commissions paid directly to your linked studio payout account."
    ]
  }
] as const;
export function createApplicationDraft(status: 'approved' | 'rejected', name?: string | null, company?: string | null): NotificationDraft {
  const greeting = name ? `Dear ${name},` : 'Dear Applicant,';
  if (status === 'rejected') return { subject: REJECTION_SUBJECT, body: [greeting,
    `Thank you for your interest in the Maison Affluency Trade Program${company ? ` on behalf of ${company}` : ''}, and for taking the time to introduce your practice to us.`,
    'Following careful consideration, we regret that we are unable to welcome your practice into the Trade Program at this stage. Our membership is subject to highly selective tier requirements and strict onboarding limitations, which guide the number and scope of practices we can support.',
    'We appreciate the care behind your application and your interest in our ateliers and designers. Thank you for considering Maison Affluency as a partner for your projects.',
    'Warm regards,\nThe Maison Affluency Team'].join('\n\n') };
  return { subject: APPROVAL_SUBJECT, body: [greeting,
    `We are pleased to inform you that your application${company ? ` for ${company}` : ''} to the Maison Affluency Trade Program has been approved.`,
    "Your account is now active. As a member of the Trade Program, your studio enters a refined ecosystem of sourcing, tooling, and commercial infrastructure designed for the world's most discerning design firms.",
    ...APPROVAL_BENEFITS.map(b => `◆ ${b.title}\n${b.description}${b.details.length ? '\n' + b.details.map(d => `• ${d}`).join('\n') : ''}`),
    'A dedicated Client Advisor will reach out to you shortly to introduce themselves and discuss how we can best support your projects.',
    'Warm regards,\nThe Maison Affluency Team'].join('\n\n') };
}
export function parseDraftBody(body: string) {
  return body.split(/\n\s*\n/).filter(b => b.trim()).map((block, index) => {
    const lines = block.split('\n');
    return { kind: block.startsWith('◆ ') ? 'benefit' : index === 0 ? 'greeting' : index === 2 ? 'intro' : 'paragraph',
      text: block, title: lines[0].replace(/^◆ /, ''), description: lines[1] || '', details: lines.slice(2).map(l => l.replace(/^• /, '')) };
  });
}
