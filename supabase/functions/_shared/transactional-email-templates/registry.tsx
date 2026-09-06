/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as tradeApproval } from './trade-approval.tsx'
import { template as tradeWelcomeAuto } from './trade-welcome-auto.tsx'
import { template as tradeWelcomeFounder } from './trade-welcome-founder.tsx'
import { template as welcomeRegistration } from './welcome-registration.tsx'
import { template as featuredMagazineUpdate } from './featured-magazine-update.tsx'
import { template as scrapeFailureAlert } from './scrape-failure-alert.tsx'
import { template as inquiryConfirmation } from './inquiry-confirmation.tsx'
import { template as inquiryNotification } from './inquiry-notification.tsx'
import { template as commissionStatement } from './commission-statement.tsx'
import { template as manualShippingQuoteRequest } from './manual-shipping-quote-request.tsx'
import { template as tradeVerificationChecklist } from './trade-verification-checklist.tsx'
import { template as collectorApproval } from './collector-approval.tsx'
import { template as collectorRejection } from './collector-rejection.tsx'
import { template as cnDirectorBrief } from './cn-director-brief.tsx'
import { template as proformaInvoice } from './proforma-invoice.tsx'
import { template as orderPaymentConfirmed } from './order-payment-confirmed.tsx'
import { template as tradeProgramInvitation } from './trade-program-invitation.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'trade-approval': tradeApproval,
  'trade-welcome-auto': tradeWelcomeAuto,
  'trade-welcome-founder': tradeWelcomeFounder,
  'welcome-registration': welcomeRegistration,
  'featured-magazine-update': featuredMagazineUpdate,
  'scrape-failure-alert': scrapeFailureAlert,
  'inquiry-confirmation': inquiryConfirmation,
  'inquiry-notification': inquiryNotification,
  'commission-statement': commissionStatement,
  'manual-shipping-quote-request': manualShippingQuoteRequest,
  'trade-verification-checklist': tradeVerificationChecklist,
  'collector-approval': collectorApproval,
  'collector-rejection': collectorRejection,
  'cn-director-brief': cnDirectorBrief,
  'proforma-invoice': proformaInvoice,
  'order-payment-confirmed': orderPaymentConfirmed,
  'trade-program-invitation': tradeProgramInvitation,
}
