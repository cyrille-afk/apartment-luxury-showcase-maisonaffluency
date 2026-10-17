/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Section, Img,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.tsx'

const SITE_NAME = "Maison Affluency"

interface Item { name?: string; brand?: string; quantity?: number }
interface Props {
  name?: string
  quoteNumber?: string
  items?: Item[]
}

const QuoteReceivedEmail = ({ name, quoteNumber, items }: Props) => {
  const list = Array.isArray(items) ? items.slice(0, 20) : []
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your quote request {quoteNumber || ''} has been received — {SITE_NAME}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoSection}>
            <Img
              src="https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/affluency-email-wordmark.jpg"
              alt="Affluency — Unique by Design"
              width="420"
              style={logo}
            />
          </Section>
          <Hr style={divider} />

          <Heading style={h1}>{name ? `Dear ${name},` : 'Dear client,'}</Heading>

          <Text style={text}>
            Thank you for your quote request{quoteNumber ? ` ${quoteNumber}` : ''}. We have
            received it and your Client Advisor is now reviewing each piece, including
            availability, lead times and delivery to your address.
          </Text>
          <Text style={text}>
            You will receive your detailed quote within 1 business day.
          </Text>

          {list.length > 0 ? (
            <Section style={quoteBox}>
              <Text style={quoteLabel}>Pieces requested</Text>
              {list.map((it, i) => (
                <Text key={i} style={itemLine}>
                  {it.name || 'Item'}{it.brand ? ` — ${it.brand}` : ''}{it.quantity && it.quantity > 1 ? ` × ${it.quantity}` : ''}
                </Text>
              ))}
            </Section>
          ) : null}

          <Text style={text}>
            Should you have any questions in the meantime, please write to us at{' '}
            <a href="mailto:concierge@maisonaffluency.com" style={link}>concierge@maisonaffluency.com</a>.
          </Text>

          <Text style={footer}>
            Warm regards,<br />
            <strong>The {SITE_NAME} Team</strong>
          </Text>

          <Hr style={divider} />
          <table width="100%" cellPadding="0" cellSpacing="0" style={{ borderCollapse: 'collapse' as const }}>
            <tr>
              <td align="right" style={{ verticalAlign: 'middle', paddingRight: '8px' }}>
                <p style={footerSmall}>
                  {SITE_NAME} Singapore<br />
                  <em>Unique by Design</em>
                </p>
              </td>
              <td align="right" style={{ verticalAlign: 'middle', width: '48px' }}>
                <img
                  src="https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/affluency-email-logo.jpg"
                  alt="Affluency"
                  width="40"
                  height="40"
                />
              </td>
            </tr>
          </table>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: QuoteReceivedEmail,
  subject: (data: Record<string, any>) =>
    `We have received your quote request${data?.quoteNumber ? ` ${data.quoteNumber}` : ''} — ${SITE_NAME}`,
  displayName: 'Quote Received (Client)',
  previewData: {
    name: 'Pollyanna Baker',
    quoteNumber: 'QU-BEC8AF',
    items: [{ name: 'Venus Floor Lamp', brand: 'Felix Agostini', quantity: 1 }],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "Georgia, 'Playfair Display', serif" }
const container = { padding: '40px 20px', maxWidth: '600px', margin: '0 auto', backgroundColor: '#faf9f7' }
const logoSection = { textAlign: 'center' as const, marginBottom: '32px', paddingBottom: '24px' }
const logo = { margin: '0 auto' }
const divider = { border: 'none', borderTop: '1px solid #e8e4de', margin: '0 0 24px' }
const h1 = { color: '#1a1a1a', fontSize: '24px', marginBottom: '24px', fontFamily: "Georgia, 'Playfair Display', serif" }
const text = { color: '#333333', lineHeight: '1.8', marginBottom: '20px', fontSize: '15px' }
const quoteBox = { backgroundColor: '#ffffff', borderLeft: '3px solid #C9A962', padding: '16px 20px', margin: '20px 0' }
const quoteLabel = { color: '#888888', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, margin: '0 0 8px' }
const itemLine = { color: '#333333', lineHeight: '1.6', fontSize: '14px', margin: '0 0 4px' }
const link = { color: '#1a1a1a', textDecoration: 'underline' }
const footer = { color: '#333333', lineHeight: '1.8', marginTop: '32px', fontSize: '15px' }
const footerSmall = { color: '#888888', fontSize: '12px', lineHeight: '1.6', margin: '0' as const, fontFamily: "Georgia, 'Playfair Display', serif" }
