/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.tsx'

interface PurchaseOrderDispatchProps {
  supplierName?: string
  poNumber?: string
  projectName?: string | null
  productName?: string
  brandName?: string
  quantity?: number
  requiredBy?: string | null
  leadTime?: string | null
  downloadUrl?: string | null
}

const PurchaseOrderDispatchEmail = ({
  supplierName = 'Supplier',
  poNumber = '—',
  projectName,
  productName = '—',
  brandName = '—',
  quantity = 1,
  requiredBy,
  leadTime,
  downloadUrl,
}: PurchaseOrderDispatchProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Approved purchase order {poNumber}</Preview>
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

        <Heading style={h1}>Dear {supplierName},</Heading>

        <Text style={text}>
          Please find attached approved Purchase Order <strong>{poNumber}</strong> for project processing.
        </Text>

        <Section style={box}>
          <table width="100%" cellPadding="0" cellSpacing="0" style={{ borderCollapse: 'collapse' as const }}>
            <tbody>
              <tr><td style={label}>Purchase order</td><td style={value}>{poNumber}</td></tr>
              {projectName ? <tr><td style={label}>Project</td><td style={value}>{projectName}</td></tr> : null}
              <tr><td style={label}>Item</td><td style={value}>{productName}</td></tr>
              <tr><td style={label}>Brand</td><td style={value}>{brandName}</td></tr>
              <tr><td style={label}>Quantity</td><td style={value}>{quantity}</td></tr>
              {requiredBy ? <tr><td style={label}>Required by</td><td style={value}>{requiredBy}</td></tr> : null}
              {leadTime ? <tr><td style={label}>Lead time</td><td style={value}>{leadTime}</td></tr> : null}
            </tbody>
          </table>
        </Section>

        {downloadUrl ? (
          <Section style={{ textAlign: 'center' as const, padding: '8px 0 4px' }}>
            <Button href={downloadUrl} style={button}>Download purchase order (PDF)</Button>
            <Text style={muted}>This secure link remains valid for 30 days.</Text>
          </Section>
        ) : null}

        <Text style={text}>
          Kindly confirm receipt, ex-works readiness and lead time within five business days, quoting this purchase
          order reference on all correspondence and invoices.
        </Text>

        <Hr style={divider} />
        <Text style={muted}>Maison Affluency · Trade Procurement</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PurchaseOrderDispatchEmail,
  subject: (data: Record<string, any>) => `Approved Purchase Order ${data?.poNumber ?? ''}`.trim(),
  displayName: 'Purchase order dispatch (supplier)',
  previewData: {
    supplierName: 'Felix Agostini',
    poNumber: 'QU-9A0EBA-001',
    projectName: 'Prewar Co-op',
    productName: 'Socle Table Lamp',
    brandName: 'Felix Agostini',
    quantity: 1,
    requiredBy: '10 Sept 2026',
    leadTime: '20-25 weeks',
    downloadUrl: 'https://example.com/po.pdf',
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
const muted = { fontSize: '11px', color: '#6e6e6e', margin: '10px 0 0', fontFamily: 'Arial, sans-serif' }
