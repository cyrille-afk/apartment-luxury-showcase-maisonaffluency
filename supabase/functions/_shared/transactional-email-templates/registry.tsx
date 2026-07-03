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
import { template as welcomeRegistration } from './welcome-registration.tsx'
import { template as featuredMagazineUpdate } from './featured-magazine-update.tsx'
import { template as scrapeFailureAlert } from './scrape-failure-alert.tsx'
import { template as inquiryConfirmation } from './inquiry-confirmation.tsx'
import { template as inquiryNotification } from './inquiry-notification.tsx'
import { template as commissionStatement } from './commission-statement.tsx'
import { template as manualShippingQuoteRequest } from './manual-shipping-quote-request.tsx'
import { template as tradeVerificationChecklist } from './trade-verification-checklist.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'trade-approval': tradeApproval,
  'welcome-registration': welcomeRegistration,
  'featured-magazine-update': featuredMagazineUpdate,
  'scrape-failure-alert': scrapeFailureAlert,
  'inquiry-confirmation': inquiryConfirmation,
  'inquiry-notification': inquiryNotification,
  'commission-statement': commissionStatement,
  'manual-shipping-quote-request': manualShippingQuoteRequest,
  'trade-verification-checklist': tradeVerificationChecklist,
}
