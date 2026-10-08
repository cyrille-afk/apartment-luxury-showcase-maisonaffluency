import type { TemplateEntry } from './registry.tsx'
import { template as tradeApproval } from './trade-approval.tsx'
import { template as tradeRejection } from './trade-rejection.tsx'

// Exact copies of the applicant's letter for each admin mailbox (one fixed recipient per send).
const copy = (t: TemplateEntry, to: string, label: string) => ({ ...t, to, displayName: `${label} (copy to ${to})` }) satisfies TemplateEntry

export const approvalCopyConcierge = copy(tradeApproval, 'concierge@maisonaffluency.com', 'Trade approval')
export const approvalCopyCyrille = copy(tradeApproval, 'cyrille@maisonaffluency.com', 'Trade approval')
export const approvalCopyGregoire = copy(tradeApproval, 'gregoire@maisonaffluency.com', 'Trade approval')
export const rejectionCopyConcierge = copy(tradeRejection, 'concierge@maisonaffluency.com', 'Trade decline')
export const rejectionCopyCyrille = copy(tradeRejection, 'cyrille@maisonaffluency.com', 'Trade decline')
export const rejectionCopyGregoire = copy(tradeRejection, 'gregoire@maisonaffluency.com', 'Trade decline')
