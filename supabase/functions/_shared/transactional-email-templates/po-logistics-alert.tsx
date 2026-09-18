/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.tsx'

interface PoLogisticsAlertProps {
  poNumber?: string
  designerName?: string
  designerEmail?: string | null
  acknowledgedAt?: string
  totalCost?: string
  fulfillmentStatus?: string
}

const PoLogisticsAlertEmail = ({
  poNumber = '—',
  designerName = 'Designer',
  designerEmail,
  acknowledgedAt,
  totalCost = '—',
  fulfillmentStatus = 'PO Acknowledged by Designer',
}: PoLogisticsAlertProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>PO {poNumber} acknowledged by {designerName} — ready for freight setup</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={{ textAlign: 'center' as const, padding: '8px 0 4px' }}>
          <Img
            src="https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/affluency-email-wordmark.jpg"
            alt="Affluency — Unique by Design"
            width="420"
            style={{ margin: '0 auto', maxWidth: '100%' }}
          />
        </Section>
        <Hr style={divider} />

        <Heading style={h1}>📦 Designer PO Acknowledged</Heading>
        <Text style={text}>
          Designer has explicitly confirmed receipt of PO. Logistics team can now safely coordinate
          freight pick-up timelines.
        </Text>

        <Section style={box}>
          <table width="100%" cellPadding="0" cellSpacing="0" style={{ borderCollapse: 'collapse' as const }}>
            <tbody>
              <tr><td style={label}>PO Number</td><td style={value}>{poNumber}</td></tr>
              <tr><td style={label}>Designer</td><td style={value}>{designerName}</td></tr>
              {designerEmail ? <tr><td style={label}>Designer email</td><td style={value}>{designerEmail}</td></tr> : null}
              <tr><td style={label}>Total Wholesale Value</td><td style={value}>{totalCost}</td></tr>
              <tr><td style={label}>Fulfillment Status</td><td style={value}>{fulfillmentStatus}</td></tr>
              {acknowledgedAt ? <tr><td style={label}>Acknowledged at</td><td style={value}>{acknowledgedAt}</td></tr> : null}
            </tbody>
          </table>
        </Section>

        <Hr style={divider} />
        <Text style={muted}>Maison Affluency · Trade Procurement · Logistics Alert</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PoLogisticsAlertEmail,
  subject: (data: Record<string, any>) =>
    `[LOGISTICS ALERT] PO Acknowledged - Ready for Freight Setup: ${data?.poNumber ?? ''}`.trim(),
  displayName: 'Logistics alert — PO acknowledged',
  previewData: {
    poNumber: 'PO-2026-0918-001',
    designerName: 'Robicara',
    designerEmail: 'studio@robicara.com',
    acknowledgedAt: 'Fri, 18 Sep 2026 04:00:00 GMT',
    totalCost: 'EUR 8,400.00',
    fulfillmentStatus: 'PO Acknowledged by Designer',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Georgia, Times, serif' }
const container = { padding: '24px 28px', maxWidth: '620px' }
const divider = { borderColor: '#e2e0da', margin: '20px 0' }
const h1 = { fontSize: '20px', fontWeight: 400 as const, color: '#1a1a1a', margin: '0 0 12px' }
const text = { fontSize: '15px', lineHeight: '24px', color: '#2a2a2a', margin: '0 0 16px' }
const box = { backgroundColor: '#f7f6f3', padding: '16px 18px', margin: '0 0 18px' }
const label = {
  fontSize: '10px', letterSpacing: '1.4px', textTransform: 'uppercase' as const,
  color: '#6e6e6e', padding: '6px 0', fontFamily: 'Arial, sans-serif',
}
const value = { fontSize: '14px', color: '#1a1a1a', padding: '6px 0', textAlign: 'right' as const }
const muted = { fontSize: '11px', color: '#6e6e6e', margin: '10px 0 0', fontFamily: 'Arial, sans-serif' }
