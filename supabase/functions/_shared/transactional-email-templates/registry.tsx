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
import { template as productionRenderRequest } from './production-render-request.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'trade-approval': tradeApproval,
  'welcome-registration': welcomeRegistration,
  'production-render-request': productionRenderRequest,
}
