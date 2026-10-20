// Transparent AI Critical Radar rubric. The total score is ALWAYS the sum of
// these category points. Unearned points are "not yet evidenced", never deductions.

export type RadarCategory = { key: string; label: string; points: number; max: number; basis: string }

export const RUBRIC_MAX = { project_credits: 60, practice_footprint: 20, registration: 10, email_domain: 10 } as const

const FREE_MAIL = /^(gmail|yahoo|hotmail|outlook|icloud|qq|163|live|aol|proton(mail)?)\./i
const clamp = (n: unknown, max: number) => Math.max(0, Math.min(max, Math.round(Number(n) || 0)))

export function buildRadarBreakdown(input: {
  email: string; regNumber: string; hasDocument: boolean
  projectPoints: unknown; projectBasis: string; footprintPoints: unknown; footprintBasis: string
}): { score: number; breakdown: RadarCategory[] } {
  const domain = input.email.split('@')[1] ?? ''
  const reg = (input.regNumber.trim() ? 5 : 0) + (input.hasDocument ? 5 : 0)
  const corp = !!domain && !FREE_MAIL.test(domain)
  const breakdown: RadarCategory[] = [
    { key: 'project_credits', label: 'Project credits', max: RUBRIC_MAX.project_credits, points: clamp(input.projectPoints, 60), basis: input.projectBasis.slice(0, 200) || 'No named built projects evidenced yet.' },
    { key: 'practice_footprint', label: 'Practice footprint', max: RUBRIC_MAX.practice_footprint, points: clamp(input.footprintPoints, 20), basis: input.footprintBasis.slice(0, 200) || 'No press, awards, team or tenure evidenced yet.' },
    { key: 'registration', label: 'Registration & credentials', max: 10, points: reg, basis: `Registration no. ${input.regNumber.trim() ? 'provided (+5)' : 'not provided (+0)'}; credential document ${input.hasDocument ? 'uploaded (+5)' : 'not uploaded (+0)'}. Not externally verified.` },
    { key: 'email_domain', label: 'Email domain', max: 10, points: corp ? 10 : 0, basis: corp ? `Corporate domain ${domain} (+10).` : 'Free webmail (+0) — not a deduction.' },
  ]
  return { score: breakdown.reduce((s, c) => s + c.points, 0), breakdown }
}
