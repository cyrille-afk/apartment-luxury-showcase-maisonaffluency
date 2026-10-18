/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Text, Button, Img, Hr, Section } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.tsx'

interface Props {
  recipientName?: string
  orderRef?: string
  previousTotalFormatted?: string
  taxLabel?: string | null
  taxFormatted?: string | null
  buyerTaxId?: string | null
  totalFormatted?: string
  receivedFormatted?: string | null
  amountDueFormatted?: string
  viewUrl?: string
}

const TaxUpdatedEmail = ({
  recipientName, orderRef = '—', previousTotalFormatted, taxLabel, taxFormatted, buyerTaxId,
  totalFormatted = '—', receivedFormatted, amountDueFormatted = '—', viewUrl,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Updated amount due for {orderRef}: {amountDueFormatted}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <Img src="https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/affluency-email-wordmark.jpg" alt="Affluency — Unique by Design" width="420" style={logo} />
        </Section>
        <Hr style={divider} />
        <Heading style={h1}>{recipientName ? `Dear ${recipientName},` : 'Dear Client,'}</Heading>
        <Text style={text}>
          We have reviewed the tax on your bank transfer order and updated it. Your account details and
          payment reference are unchanged — please transfer the revised amount due below.
        </Text>
        <Section style={statementBox}>
          <table width="100%" cellPadding="0" cellSpacing="0" style={{ borderCollapse: 'collapse' as const }}>
            <tbody>
              <tr><td style={label}>Order reference</td><td style={amount}>{orderRef}</td></tr>
              {buyerTaxId ? <tr><td style={label}>VAT number</td><td style={amount}>{buyerTaxId}</td></tr> : null}
              <tr><td style={label}>{taxLabel || 'Tax'}</td><td style={amount}>{taxFormatted || 'None'}</td></tr>
              {previousTotalFormatted ? <tr><td style={label}>Previous total</td><td style={{ ...amount, textDecoration: 'line-through', color: '#888888' }}>{previousTotalFormatted}</td></tr> : null}
              <tr><td style={label}>Revised total</td><td style={amount}>{totalFormatted}</td></tr>
              {receivedFormatted ? <tr><td style={label}>Already received</td><td style={amount}>−{receivedFormatted}</td></tr> : null}
              <tr><td style={grandLabel}>Amount due</td><td style={grandAmount}>{amountDueFormatted}</td></tr>
            </tbody>
          </table>
        </Section>
        {viewUrl ? <Section style={buttonSection}><Button href={viewUrl} style={button}>View transfer instructions</Button></Section> : null}
        <Text style={footer}>If you have any questions, simply reply to this email.<br />With warm regards,<br />Maison Affluency</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: TaxUpdatedEmail,
  subject: (d: Record<string, any>) => `Updated amount due for your order ${d?.orderRef ?? ''}`.trim(),
  displayName: 'Instant transfer tax updated',
  previewData: {
    recipientName: 'Jane', orderRef: 'MA-1234', previousTotalFormatted: '£20,880.00', taxLabel: 'Reverse charge',
    taxFormatted: null, buyerTaxId: 'GB123456789', totalFormatted: '£17,400.00', receivedFormatted: null,
    amountDueFormatted: '£17,400.00', viewUrl: 'https://www.maisonaffluency.com/order-confirmation?ref=MA-1234&status=bank_transfer',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "Georgia, 'Playfair Display', serif" }
const container = { padding: '40px 20px', maxWidth: '600px', margin: '0 auto', backgroundColor: '#faf9f7' }
const logoSection = { textAlign: 'center' as const, marginBottom: '32px', paddingBottom: '24px' }
const logo = { margin: '0 auto' }
const divider = { border: 'none', borderTop: '1px solid #e8e4de', margin: '0 0 24px' }
const h1 = { color: '#1a1a1a', fontSize: '24px', marginBottom: '24px', fontFamily: "Georgia, 'Playfair Display', serif" }
const text = { color: '#333333', lineHeight: '1.8', marginBottom: '20px', fontSize: '15px' }
const statementBox = { backgroundColor: '#ffffff', border: '1px solid #e8e4de', borderRadius: '6px', padding: '20px 24px', margin: '24px 0' }
const label = { color: '#555555', fontSize: '13px', padding: '6px 0', fontFamily: 'Arial, sans-serif' }
const amount = { color: '#1a1a1a', fontSize: '13px', textAlign: 'right' as const, padding: '6px 0', fontFamily: 'Arial, sans-serif' }
const grandLabel = { color: '#1a1a1a', fontSize: '15px', padding: '10px 0', fontWeight: 700 }
const grandAmount = { color: '#1a1a1a', fontSize: '17px', textAlign: 'right' as const, padding: '10px 0', fontWeight: 700, fontFamily: 'Arial, sans-serif' }
const buttonSection = { textAlign: 'center' as const, margin: '32px 0' }
const button = { display: 'inline-block', padding: '14px 32px', backgroundColor: '#1a1a1a', color: '#ffffff', textDecoration: 'none', fontSize: '13px', letterSpacing: '0.15em', textTransform: 'uppercase' as const, borderRadius: '24px' }
const footer = { color: '#333333', lineHeight: '1.8', marginTop: '32px', fontSize: '15px' }
