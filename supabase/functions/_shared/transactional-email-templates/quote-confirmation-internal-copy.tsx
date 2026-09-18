/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Link, Img, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.tsx'

const SITE_NAME = 'Maison Affluency'

interface Props {
  clientEmail?: string
  productName?: string
  finish?: string | null
  leadTime?: string | null
  paymentLink?: string | null
  maisonRef?: string
  amount?: string
  currency?: string
  paymentKind?: string
  testMode?: boolean
}

const QuoteConfirmationInternalCopyEmail = ({
  clientEmail = '—',
  productName = 'Selected piece',
  finish,
  leadTime,
  paymentLink,
  maisonRef = '—',
  amount = '—',
  currency = '',
  paymentKind = 'Full settlement',
  testMode = false,
}: Props) => {
  const displayFinish = finish ? ` — ${finish}` : ''

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Internal copy: quote confirmation sent to {clientEmail}</Preview>
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

          <Heading style={h1}>Internal copy — quote confirmation sent</Heading>

          <Text style={text}>
            The following quote confirmation and payment link has just been sent to{' '}
            <strong>{clientEmail}</strong>.
          </Text>

          <Section style={statementBox}>
            <table width="100%" cellPadding="0" cellSpacing="0" style={{ borderCollapse: 'collapse' as const }}>
              <tbody>
                <tr>
                  <td style={totalLabel}>Client</td>
                  <td style={totalAmount}>{clientEmail}</td>
                </tr>
                <tr>
                  <td style={totalLabel}>Product</td>
                  <td style={totalAmount}>{productName}{displayFinish}</td>
                </tr>
                <tr>
                  <td style={totalLabel}>Reference</td>
                  <td style={totalAmount}>{maisonRef}</td>
                </tr>
                <tr>
                  <td style={totalLabel}>Lead time</td>
                  <td style={totalAmount}>{leadTime || 'To be confirmed'}</td>
                </tr>
                <tr>
                  <td style={totalLabel}>Settlement type</td>
                  <td style={totalAmount}>{paymentKind}</td>
                </tr>
                <tr>
                  <td style={totalLabel}>Amount</td>
                  <td style={totalAmount}>{amount} {currency}</td>
                </tr>
                <tr>
                  <td style={totalLabel}>Mode</td>
                  <td style={totalAmount}>{testMode ? 'TEST / Stripe test mode' : 'LIVE / Stripe production'}</td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Text style={text}>
            Secure Payment Link:{' '}
            {paymentLink ? (
              <Link href={paymentLink} style={link}>{paymentLink}</Link>
            ) : (
              <em>[No link generated]</em>
            )}
          </Text>

          <Text style={footer}>
            This is an internal copy only. Do not forward to the client.
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
}

export const template = {
  component: QuoteConfirmationInternalCopyEmail,
  subject: (data: Record<string, any>) =>
    `Internal copy: quote confirmation sent — ${data?.productName ?? 'Client selection'}`,
  to: 'cyrille@maisonaffluency.com',
  displayName: 'Quote Confirmation — Internal Copy',
  previewData: {
    clientEmail: 'info@agnihk.com',
    productName: 'Erato Wall Light',
    finish: 'Bronze / Silk',
    leadTime: '14–16 weeks',
    paymentLink: 'https://www.maisonaffluency.com/pay/example',
    maisonRef: 'QU-F05C2A',
    amount: 'HK$ 100.00',
    currency: 'HKD',
    paymentKind: 'Full settlement',
    testMode: false,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "Georgia, 'Playfair Display', serif" }
const container = { padding: '40px 20px', maxWidth: '600px', margin: '0 auto', backgroundColor: '#faf9f7' }
const logoSection = { textAlign: 'center' as const, marginBottom: '32px', paddingBottom: '24px' }
const logo = { margin: '0 auto' }
const divider = { border: 'none', borderTop: '1px solid #e8e4de', margin: '0 0 24px' }
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
const link = { color: '#1a1a1a', textDecoration: 'underline', fontSize: '15px', wordBreak: 'break-all' as const }
const footer = { color: '#333333', lineHeight: '1.8', marginTop: '32px', fontSize: '15px' }
const footerSmall = { color: '#888888', fontSize: '12px', lineHeight: '1.6', margin: '0' as const, fontFamily: "Georgia, 'Playfair Display', serif" }
