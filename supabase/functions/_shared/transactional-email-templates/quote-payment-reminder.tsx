/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Img, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.tsx'

const SITE_NAME = 'Maison Affluency'

interface Props {
  recipientName?: string | null
  quoteRef?: string
  currency?: string
  amountFormatted?: string
  label?: string
  payUrl?: string | null
  secondReminder?: boolean
}

const QuotePaymentReminderEmail = ({
  recipientName,
  quoteRef = '—',
  currency = 'EUR',
  amountFormatted = '—',
  label = 'Deposit due',
  payUrl,
  secondReminder = false,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your quotation {quoteRef} awaits settlement</Preview>
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

        <Heading style={h1}>{recipientName ? `Dear ${recipientName},` : 'Dear Client,'}</Heading>

        <Text style={text}>
          {secondReminder
            ? `A courteous final reminder regarding quotation ${quoteRef}. Production slots are allocated upon settlement, and we should be glad to secure yours.`
            : `We are following up on quotation ${quoteRef}, which remains open. Settlement may be completed securely by card — no account or sign-in is required.`}
        </Text>

        <Section style={statementBox}>
          <table width="100%" cellPadding="0" cellSpacing="0" style={{ borderCollapse: 'collapse' as const }}>
            <tbody>
              <tr>
                <td style={totalLabel}>Reference</td>
                <td style={totalAmount}>{quoteRef}</td>
              </tr>
              <tr>
                <td style={grandLabel}>{label}</td>
                <td style={grandAmount}>{amountFormatted} {currency}</td>
              </tr>
            </tbody>
          </table>
        </Section>

        {payUrl ? (
          <Section style={buttonSection}>
            <Button style={button} href={payUrl}>Pay now — {amountFormatted} {currency}</Button>
          </Section>
        ) : null}

        <Text style={smallText}>
          Should any detail require revision — quantity, finish, delivery address or terms — simply
          reply to this message and we shall reissue the quotation.
        </Text>

        <Text style={footer}>
          With thanks,<br />
          <strong>The {SITE_NAME} Trade Desk</strong>
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: QuotePaymentReminderEmail,
  subject: (data: Record<string, any>) =>
    `Quotation ${data?.quoteRef ?? ''} — awaiting settlement`,
  displayName: 'Quotation Payment Reminder',
  previewData: {
    recipientName: 'Agni HK',
    quoteRef: 'QU-F05C2A',
    currency: 'HKD',
    amountFormatted: '11,040.00',
    label: 'Deposit due',
    payUrl: 'https://www.maisonaffluency.com/pay/example',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "Georgia, 'Playfair Display', serif" }
const container = { padding: '40px 20px', maxWidth: '600px', margin: '0 auto', backgroundColor: '#faf9f7' }
const logoSection = { textAlign: 'center' as const, marginBottom: '32px', paddingBottom: '24px' }
const logo = { margin: '0 auto' }
const divider = { border: 'none', borderTop: '1px solid #e8e4de', margin: '0 0 24px' }
const h1 = { color: '#1a1a1a', fontSize: '24px', marginBottom: '24px', fontFamily: "Georgia, 'Playfair Display', serif" }
const text = { color: '#333333', lineHeight: '1.8', marginBottom: '20px', fontSize: '15px' }
const smallText = { color: '#666666', lineHeight: '1.7', marginBottom: '20px', fontSize: '13px' }
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
