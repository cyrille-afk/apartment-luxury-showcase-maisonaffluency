/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.tsx'

interface PoAcknowledgedInternalProps {
  designerName?: string
  designerEmail?: string | null
  poNumber?: string
  acknowledgedAt?: string | null
  totalCost?: string | null
  lineCount?: number
}

const PoAcknowledgedInternalEmail = ({
  designerName = 'Designer',
  designerEmail,
  poNumber = '—',
  acknowledgedAt,
  totalCost,
  lineCount = 1,
}: PoAcknowledgedInternalProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{designerName} acknowledged purchase order {poNumber}</Preview>
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

        <Heading style={h1}>PO acknowledged by designer</Heading>

        <Text style={text}>
          <strong>{designerName}</strong> has confirmed receipt of purchase order{' '}
          <strong>{poNumber}</strong>. Production scheduling can proceed; await their invoice
          quoting this reference for matching and settlement.
        </Text>

        <Section style={box}>
          <table width="100%" cellPadding="0" cellSpacing="0" style={{ borderCollapse: 'collapse' as const }}>
            <tbody>
              <tr><td style={label}>Purchase order</td><td style={value}>{poNumber}</td></tr>
              <tr><td style={label}>Designer</td><td style={value}>{designerName}</td></tr>
              {designerEmail ? <tr><td style={label}>Fulfilment desk</td><td style={value}>{designerEmail}</td></tr> : null}
              {acknowledgedAt ? <tr><td style={label}>Acknowledged</td><td style={value}>{acknowledgedAt}</td></tr> : null}
              <tr><td style={label}>Lines</td><td style={value}>{lineCount}</td></tr>
              {totalCost ? <tr><td style={label}>Wholesale total</td><td style={value}>{totalCost}</td></tr> : null}
            </tbody>
          </table>
        </Section>

        <Text style={text}>
          The ledger entry remains at <em>Pending invoice match</em> until the designer's invoice
          is received and reconciled in the Wholesale Procurement Ledger.
        </Text>

        <Hr style={divider} />
        <Text style={muted}>Maison Affluency · Internal logistics notification</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PoAcknowledgedInternalEmail,
  subject: (data: Record<string, any>) =>
    `PO acknowledged: ${data?.poNumber ?? ''} — ${data?.designerName ?? 'Designer'}`.trim(),
  displayName: 'PO acknowledgement alert (internal)',
  previewData: {
    designerName: 'Robicara',
    designerEmail: 'fulfilment@robicara.com',
    poNumber: 'PO-2026-0918-001',
    acknowledgedAt: 'Fri, 18 Sep 2026 09:30:00 GMT',
    totalCost: 'EUR 8,400.00',
    lineCount: 2,
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
