/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Img, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.tsx'

const SITE_NAME = 'Maison Affluency'

interface Props {
  recipientName?: string
  productName?: string
  finish?: string | null
  leadTime?: string | null
  paymentLink?: string | null
  maisonRef?: string
  senderName?: string
  senderTitle?: string
}

const QuoteConfirmationPaymentLinkEmail = ({
  recipientName,
  productName = 'your selected piece',
  finish,
  leadTime,
  paymentLink,
  maisonRef = '—',
  senderName = 'Cyrille',
  senderTitle = 'Trade Relations | Affluency Etc Pte Ltd',
}: Props) => {
  const displayFinish = finish ? ` finished in ${finish}` : ''
  const displayLeadTime = leadTime ? `Lead Time: ${leadTime}` : 'Lead time confirmed at order confirmation'

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Quote Confirmation & Payment Link — {productName}</Preview>
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
            Thank you for your inquiry on the {SITE_NAME} platform regarding the{' '}
            <strong>{productName}</strong>
            {displayFinish}.
          </Text>

          <Text style={text}>
            We have reviewed your request and generated your secure procurement portal link below.
            This checkout link automatically applies the finalized project pricing and routes securely
            through our integrated Stripe gateway:
          </Text>

          {paymentLink ? (
            <Section style={buttonSection}>
              <Button style={button} href={paymentLink}>
                Secure Payment Link
              </Button>
            </Section>
          ) : (
            <Section style={statementBox}>
              <Text style={{ ...text, margin: 0 }}>
                Secure Payment Link: <em>[PASTE STRIPE LINK HERE]</em>
              </Text>
            </Section>
          )}

          <Section style={statementBox}>
            <table width="100%" cellPadding="0" cellSpacing="0" style={{ borderCollapse: 'collapse' as const }}>
              <tbody>
                <tr>
                  <td style={totalLabel}>Item</td>
                  <td style={totalAmount}>{productName}</td>
                </tr>
                <tr>
                  <td style={totalLabel}>Specification</td>
                  <td style={totalAmount}>{finish || 'As specified'}</td>
                </tr>
                <tr>
                  <td style={totalLabel}>{displayLeadTime.split(':')[0]}</td>
                  <td style={totalAmount}>{displayLeadTime.includes(':') ? displayLeadTime.split(':')[1].trim() : displayLeadTime}</td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Text style={text}>
            Please note that production scheduling will commence immediately upon settlement confirmation.
            If your procurement team requires a traditional PDF copy of this invoice for your records,
            please let us know.
          </Text>

          <Text style={footer}>
            Sincerely,
            <br />
            <strong>{senderName}</strong>
            <br />
            {senderTitle}
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
  component: QuoteConfirmationPaymentLinkEmail,
  subject: (data: Record<string, any>) =>
    `Quote Confirmation & Payment Link: ${data?.productName ?? 'Your Selection'} (${data?.maisonRef ?? SITE_NAME} Ref)`,
  displayName: 'Quote Confirmation & Payment Link',
  previewData: {
    recipientName: 'Agni HK Team',
    productName: 'Erato Wall Light',
    finish: 'Bronze / Silk',
    leadTime: '14–16 weeks',
    paymentLink: 'https://www.maisonaffluency.com/pay/example',
    maisonRef: 'QU-F05C2A',
    senderName: 'Cyrille',
    senderTitle: 'Trade Relations | Affluency Etc Pte Ltd',
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
