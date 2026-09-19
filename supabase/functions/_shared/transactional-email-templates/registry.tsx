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
import { template as orderReceived } from './order-received.tsx'
import { template as tradeProgramInvitation } from './trade-program-invitation.tsx'
import { template as purchaseOrderDispatch } from './purchase-order-dispatch.tsx'
import { template as designerPurchaseOrder } from './designer-purchase-order.tsx'
import { template as clientQuotePayment } from './client-quote-payment.tsx'
import { template as cartReminder } from './cart-reminder.tsx'
import { template as quotePaymentReminder } from './quote-payment-reminder.tsx'
import { template as quoteConfirmationPaymentLink } from './quote-confirmation-payment-link.tsx'
import { template as quoteConfirmationInternalCopy } from './quote-confirmation-internal-copy.tsx'
import { template as funnelStallAlert } from './funnel-stall-alert.tsx'
import { template as poAcknowledgedInternal } from './po-acknowledged-internal.tsx'
import { template as poLogisticsAlert } from './po-logistics-alert.tsx'
import { template as funnelPaymentReceivedInternal } from './funnel-payment-received-internal.tsx'
import { template as depositClearedInternal } from './deposit-cleared-internal.tsx'
import { template as queueJobParked } from './queue-job-parked.tsx'


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
  'order-received': orderReceived,
  'trade-program-invitation': tradeProgramInvitation,
  'purchase-order-dispatch': purchaseOrderDispatch,
  'designer-purchase-order': designerPurchaseOrder,
  'client-quote-payment': clientQuotePayment,
  'cart-reminder': cartReminder,
  'quote-payment-reminder': quotePaymentReminder,
  'quote-confirmation-payment-link': quoteConfirmationPaymentLink,
  'quote-confirmation-internal-copy': quoteConfirmationInternalCopy,
  'funnel-stall-alert': funnelStallAlert,
  'po-acknowledged-internal': poAcknowledgedInternal,
  'po-logistics-alert': poLogisticsAlert,
  'funnel-payment-received-internal': funnelPaymentReceivedInternal,
  'deposit-cleared-internal': depositClearedInternal,
  'queue-job-parked': queueJobParked,
}
