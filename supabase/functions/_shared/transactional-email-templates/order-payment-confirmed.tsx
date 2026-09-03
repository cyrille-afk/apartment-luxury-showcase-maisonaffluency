/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Img, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.tsx'

const SITE_NAME = 'Maison Affluency'

interface PaymentConfirmedProps {
  recipientName?: string
  orderRef?: string
  currency?: string
  totalFormatted?: string
  receivedOn?: string
  leadTimeNote?: string | null
}

const PaymentConfirmedEmail = ({
  recipientName,
  orderRef = '—',
  currency = 'USD',
  totalFormatted = '—',
  receivedOn,
  leadTimeNote,
}: PaymentConfirmedProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Payment received for {orderRef} — your order is in production</Preview>
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

        <Heading style={h1}>
          {recipientName ? `Dear ${recipientName},` : 'Dear Client,'}
        </Heading>

        <Text style={text}>
          We are pleased to confirm that your payment has cleared
          {receivedOn ? <> on <strong>{receivedOn}</strong></> : null}. Your order is now confirmed
          and has entered production with the atelier.
        </Text>

        <Section style={statementBox}>
          <table width="100%" cellPadding="0" cellSpacing="0" style={{ borderCollapse: 'collapse' as const }}>
            <tbody>
              <tr>
                <td style={totalLabel}>Order ID</td>
                <td style={totalAmount}>{orderRef}</td>
              </tr>
              <tr>
                <td colSpan={2}><Hr style={dividerSubtle} /></td>
              </tr>
              <tr>
                <td style={grandLabel}>Amount received</td>
                <td style={grandAmount}>{totalFormatted} {currency}</td>
              </tr>
            </tbody>
          </table>
        </Section>

        <Text style={text}>
          {leadTimeNote
            ? leadTimeNote
            : 'Your advisor will share the production schedule and shipping arrangements shortly. A final commercial invoice is issued on dispatch.'}
        </Text>

        <Section style={buttonSection}>
          <Button style={button} href="https://maisonaffluency.com/trade/orders">
            View Order Status
          </Button>
        </Section>

        <Text style={footer}>
          With thanks,<br />
          <strong>The {SITE_NAME} Trade Desk</strong>
        </Text>

        <Hr style={divider} />
        <table width="100%" cellPadding="0" cellSpacing="0" style={{ borderCollapse: 'collapse' as const }}>
          <tbody>
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
          </tbody>
        </table>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PaymentConfirmedEmail,
  subject: (data: Record<string, any>) => `Payment received — order ${data?.orderRef ?? ''} confirmed`,
  displayName: 'Order Payment Confirmed',
  previewData: {
    recipientName: 'Mr Laurent',
    orderRef: 'MA-2026-10243',
    currency: 'SGD',
    totalFormatted: '42,180.00',
    receivedOn: '18 Jun 2026',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "Georgia, 'Playfair Display', serif" }
const container = { padding: '40px 20px', maxWidth: '600px', margin: '0 auto', backgroundColor: '#faf9f7' }
const logoSection = { textAlign: 'center' as const, marginBottom: '32px', paddingBottom: '24px' }
const logo = { margin: '0 auto' }
const divider = { border: 'none', borderTop: '1px solid #e8e4de', margin: '0 0 24px' }
const dividerSubtle = { border: 'none', borderTop: '1px solid #ece8e1', margin: '8px 0' }
const h1 = { color: '#1a1a1a', fontSize: '24px', marginBottom: '24px', fontFamily: "Georgia, 'Playfair Display', serif" }
const text = { color: '#333333', lineHeight: '1.8', marginBottom: '20px', fontSize: '15px' }
const statementBox = {
  backgroundColor: '#ffffff',
  border: '1px solid #e8e4de',
  borderRadius: '6px',
  padding: '20px 24px',
  margin: '24px 0',
}
const totalLabel = { color: '#555555', fontSize: '13px', padding: '6px 0', fontFamily: 'Arial, sans-serif' }
const totalAmount = { color: '#1a1a1a', fontSize: '13px', textAlign: 'right' as const, padding: '6px 0', fontFamily: 'Arial, sans-serif' }
const grandLabel = { color: '#1a1a1a', fontSize: '15px', padding: '10px 0', fontWeight: 700 }
const grandAmount = { color: '#1a1a1a', fontSize: '17px', textAlign: 'right' as const, padding: '10px 0', fontWeight: 700, fontFamily: 'Arial, sans-serif' }
const buttonSection = { textAlign: 'center' as const, margin: '32px 0' }
const button = {
  display: 'inline-block',
  padding: '14px 32px',
  backgroundColor: '#1a1a1a',
  color: '#ffffff',
  textDecoration: 'none',
  fontSize: '13px',
  letterSpacing: '0.15em',
  textTransform: 'uppercase' as const,
  borderRadius: '24px',
}
const footer = { color: '#333333', lineHeight: '1.8', marginTop: '32px', fontSize: '15px' }
const footerSmall = { color: '#888888', fontSize: '12px', lineHeight: '1.6', margin: '0' as const, fontFamily: "Georgia, 'Playfair Display', serif" }
