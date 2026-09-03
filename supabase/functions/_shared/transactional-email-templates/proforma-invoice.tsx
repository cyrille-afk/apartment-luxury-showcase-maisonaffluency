/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Img, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.tsx'

const SITE_NAME = 'Maison Affluency'

interface ProformaInvoiceProps {
  recipientName?: string
  orderRef?: string
  currency?: string
  totalFormatted?: string
  channelLabel?: string
  downloadUrl?: string | null
}

const ProformaInvoiceEmail = ({
  recipientName,
  orderRef = '—',
  currency = 'USD',
  totalFormatted = '—',
  channelLabel = 'Bank transfer',
  downloadUrl,
}: ProformaInvoiceProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Pro-forma invoice {orderRef} — {totalFormatted} {currency}</Preview>
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
          Thank you for your order. Your pro-forma invoice is ready and your pieces are held
          pending settlement by <strong>{channelLabel}</strong>.
        </Text>

        <Section style={statementBox}>
          <table width="100%" cellPadding="0" cellSpacing="0" style={{ borderCollapse: 'collapse' as const }}>
            <tbody>
              <tr>
                <td style={totalLabel}>Order ID</td>
                <td style={totalAmount}>{orderRef}</td>
              </tr>
              <tr>
                <td style={totalLabel}>Settlement</td>
                <td style={totalAmount}>{channelLabel}</td>
              </tr>
              <tr>
                <td colSpan={2}><Hr style={dividerSubtle} /></td>
              </tr>
              <tr>
                <td style={grandLabel}>Total due</td>
                <td style={grandAmount}>{totalFormatted} {currency}</td>
              </tr>
            </tbody>
          </table>
        </Section>

        <Text style={text}>
          Please quote <strong>{orderRef}</strong> as the reference on your transfer. Payments
          received without this reference may be delayed in reconciliation.
        </Text>

        {downloadUrl ? (
          <Section style={buttonSection}>
            <Button style={button} href={downloadUrl}>
              Download Pro-forma Invoice
            </Button>
          </Section>
        ) : null}

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
  component: ProformaInvoiceEmail,
  subject: (data: Record<string, any>) => `Pro-forma invoice ${data?.orderRef ?? ''} — Maison Affluency`,
  displayName: 'Pro-forma Invoice',
  previewData: {
    recipientName: 'Mr Laurent',
    orderRef: 'MA-2026-10243',
    currency: 'SGD',
    totalFormatted: '42,180.00',
    channelLabel: 'Corporate PayNow',
    downloadUrl: 'https://maisonaffluency.com',
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
