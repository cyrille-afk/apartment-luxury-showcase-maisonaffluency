/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.tsx'

interface Props {
  quoteNumber?: string
  productName?: string
  brandName?: string
  sku?: string
  quantity?: number | string
  origin?: string
  destination?: string
  requesterName?: string
  requesterEmail?: string
  requesterCompany?: string
  message?: string
}

const Row = ({ label, value }: { label: string; value?: string | number }) => (
  <tr>
    <td style={cellLabel}><strong>{label}</strong></td>
    <td style={cellValue}>{value !== undefined && value !== null && value !== '' ? String(value) : '—'}</td>
  </tr>
)

const Email = ({
  quoteNumber, productName, brandName, sku, quantity, origin, destination,
  requesterName, requesterEmail, requesterCompany, message,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Manual shipping quote request — {productName || 'item'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h2}>Manual Shipping Quote Request</Heading>

        <Text style={sectionLabel}>Line</Text>
        <table width="100%" cellPadding="0" cellSpacing="0" style={{ borderCollapse: 'collapse' as const, marginBottom: '24px' }}>
          <tbody>
            <Row label="Quote" value={quoteNumber} />
            <Row label="Product" value={productName} />
            <Row label="Brand" value={brandName} />
            <Row label="SKU" value={sku} />
            <Row label="Qty" value={quantity} />
            <Row label="Origin" value={origin} />
            <Row label="Destination" value={destination} />
          </tbody>
        </table>

        <Text style={sectionLabel}>Requester</Text>
        <table width="100%" cellPadding="0" cellSpacing="0" style={{ borderCollapse: 'collapse' as const, marginBottom: '24px' }}>
          <tbody>
            <Row label="Name" value={requesterName} />
            <Row label="Email" value={requesterEmail} />
            <Row label="Firm / Studio" value={requesterCompany} />
          </tbody>
        </table>

        {message ? (
          <>
            <Text style={sectionLabel}>Message</Text>
            <Section style={quoteBox}>
              <Text style={quoteBody}>{message}</Text>
            </Section>
          </>
        ) : null}

        <Hr style={divider} />
        <Text style={footerSmall}>
          Maison Affluency Singapore — <em>Unique by Design</em>
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Manual shipping quote: ${data?.productName || 'Item'} (${data?.quoteNumber || '—'})`,
  to: 'concierge@myaffluency.com',
  displayName: 'Manual Shipping Quote Request (Internal)',
  previewData: {
    quoteNumber: 'Q-2026-0042',
    productName: 'Orion Pendant',
    brandName: 'Garnier & Linker',
    sku: 'GL-ORN-01',
    quantity: 2,
    origin: 'France',
    destination: 'Singapore',
    requesterName: 'Alexandra Chen',
    requesterEmail: 'alexandra@studiochen.com',
    requesterCompany: 'Studio Chen',
    message: 'Please advise on freight + duties to Singapore.',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "Georgia, 'Playfair Display', serif" }
const container = { padding: '40px 20px', maxWidth: '600px', margin: '0 auto', backgroundColor: '#faf9f7' }
const h2 = { color: '#1a1a1a', fontSize: '20px', marginBottom: '24px', borderBottom: '2px solid #C9A962', paddingBottom: '12px' }
const sectionLabel = { color: '#1a1a1a', fontSize: '14px', marginBottom: '8px', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }
const cellLabel = { padding: '10px 0', borderBottom: '1px solid #e8e4de', color: '#666666', width: '140px', fontSize: '14px' }
const cellValue = { padding: '10px 0', borderBottom: '1px solid #e8e4de', color: '#1a1a1a', fontSize: '14px' }
const quoteBox = { backgroundColor: '#ffffff', borderLeft: '3px solid #C9A962', padding: '16px 20px', margin: '0 0 24px' }
const quoteBody = { color: '#333333', lineHeight: '1.7', fontSize: '14px', margin: '0', whiteSpace: 'pre-wrap' as const }
const divider = { border: 'none', borderTop: '1px solid #e8e4de', margin: '32px 0 16px' }
const footerSmall = { color: '#888888', fontSize: '12px', lineHeight: '1.6', textAlign: 'center' as const }
