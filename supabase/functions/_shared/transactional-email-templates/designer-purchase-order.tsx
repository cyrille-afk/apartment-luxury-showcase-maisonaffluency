/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.tsx'

interface DesignerPurchaseOrderProps {
  designerName?: string
  poNumber?: string
  issuedAt?: string | null
  lineCount?: number
  totalCost?: string | null
  downloadUrl?: string | null
  acknowledgeUrl?: string | null
}

const DesignerPurchaseOrderEmail = ({
  designerName = 'Partner',
  poNumber = '—',
  issuedAt,
  lineCount = 1,
  totalCost,
  downloadUrl,
  acknowledgeUrl,
}: DesignerPurchaseOrderProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New purchase order {poNumber} from Maison Affluency</Preview>
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

        <Heading style={h1}>Dear {designerName},</Heading>

        <Text style={text}>
          Maison Affluency has confirmed a new purchase order placement under reference ID{' '}
          <strong>{poNumber}</strong>. Please find the wholesale procurement details attached.
          Maison Affluency is your direct billing client for this transaction.
        </Text>

        <Section style={box}>
          <table width="100%" cellPadding="0" cellSpacing="0" style={{ borderCollapse: 'collapse' as const }}>
            <tbody>
              <tr><td style={label}>Purchase order</td><td style={value}>{poNumber}</td></tr>
              {issuedAt ? <tr><td style={label}>Issued</td><td style={value}>{issuedAt}</td></tr> : null}
              <tr><td style={label}>Lines</td><td style={value}>{lineCount}</td></tr>
              {totalCost ? <tr><td style={label}>Wholesale total</td><td style={value}>{totalCost}</td></tr> : null}
            </tbody>
          </table>
        </Section>

        {downloadUrl ? (
          <Section style={{ textAlign: 'center' as const, padding: '8px 0 4px' }}>
            <Button href={downloadUrl} style={button}>Download purchase order (PDF)</Button>
            <Text style={muted}>This secure link remains valid for 30 days.</Text>
          </Section>
        ) : null}

        {acknowledgeUrl ? (
          <Section style={{ textAlign: 'center' as const, padding: '4px 0 8px' }}>
            <Button href={acknowledgeUrl} style={ackButton}>Click Here to Acknowledge Receipt &amp; Confirm Production Allocation</Button>
            <Text style={muted}>One click — no login required.</Text>
          </Section>
        ) : null}

        <Text style={text}>
          Kindly acknowledge receipt and issue your invoice quoting this purchase order reference so our
          accounts team can match and settle it.
        </Text>

        <Hr style={divider} />
        <Text style={muted}>Maison Affluency · Affluency Etc Pte Ltd · Trade Procurement</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: DesignerPurchaseOrderEmail,
  subject: (data: Record<string, any>) =>
    `New Purchase Order ${data?.poNumber ?? ''} — Maison Affluency`.trim(),
  displayName: 'Purchase order dispatch (designer)',
  previewData: {
    designerName: 'Robicara',
    poNumber: 'PO-2026-0918-001',
    issuedAt: '18 Sep 2026',
    lineCount: 2,
    totalCost: 'EUR 8,400.00',
    downloadUrl: 'https://example.com/po.pdf',
    acknowledgeUrl: 'https://example.com/ack',
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
const button = {
  backgroundColor: '#12352c', color: '#ffffff', fontSize: '13px', letterSpacing: '1.2px',
  textTransform: 'uppercase' as const, padding: '13px 26px', textDecoration: 'none',
  fontFamily: 'Arial, sans-serif', display: 'inline-block',
}
const ackButton = {
  backgroundColor: '#ffffff', color: '#12352c', fontSize: '12px', letterSpacing: '1.2px',
  textTransform: 'uppercase' as const, padding: '12px 24px', textDecoration: 'none',
  fontFamily: 'Arial, sans-serif', display: 'inline-block', border: '1px solid #12352c',
}
const muted = { fontSize: '11px', color: '#6e6e6e', margin: '10px 0 0', fontFamily: 'Arial, sans-serif' }
