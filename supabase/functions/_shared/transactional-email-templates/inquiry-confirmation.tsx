/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Section, Img,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.tsx'

const SITE_NAME = "Maison Affluency"

interface Props {
  name?: string
  message?: string
}

const InquiryConfirmationEmail = ({ name, message }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>We have received your inquiry — {SITE_NAME}</Preview>
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
          {name ? `Dear ${name},` : 'Dear visitor,'}
        </Heading>

        <Text style={text}>
          Thank you for reaching out to {SITE_NAME}. We have received your message and a
          dedicated Client Advisor will be in touch with you within the next 48 hours.
        </Text>

        {message ? (
          <Section style={quoteBox}>
            <Text style={quoteLabel}>Your message</Text>
            <Text style={quoteBody}>{message}</Text>
          </Section>
        ) : null}

        <Text style={text}>
          In the meantime, should you have any urgent questions, please write to us at{' '}
          <a href="mailto:concierge@myaffluency.com" style={link}>concierge@myaffluency.com</a>.
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

export const template = {
  component: InquiryConfirmationEmail,
  subject: `We have received your inquiry — ${SITE_NAME}`,
  displayName: 'Inquiry Confirmation (Visitor)',
  previewData: { name: 'Alexandra', message: 'I would love to learn more about the Garnier & Linker Orion pendant.' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "Georgia, 'Playfair Display', serif" }
const container = { padding: '40px 20px', maxWidth: '600px', margin: '0 auto', backgroundColor: '#faf9f7' }
const logoSection = { textAlign: 'center' as const, marginBottom: '32px', paddingBottom: '24px' }
const logo = { margin: '0 auto' }
const divider = { border: 'none', borderTop: '1px solid #e8e4de', margin: '0 0 24px' }
const h1 = { color: '#1a1a1a', fontSize: '24px', marginBottom: '24px', fontFamily: "Georgia, 'Playfair Display', serif" }
const text = { color: '#333333', lineHeight: '1.8', marginBottom: '20px', fontSize: '15px' }
const quoteBox = { backgroundColor: '#ffffff', borderLeft: '3px solid #C9A962', padding: '16px 20px', margin: '20px 0' }
const quoteLabel = { color: '#888888', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, margin: '0 0 6px' }
const quoteBody = { color: '#333333', lineHeight: '1.7', fontSize: '14px', margin: '0', whiteSpace: 'pre-wrap' as const }
const link = { color: '#1a1a1a', textDecoration: 'underline' }
const footer = { color: '#333333', lineHeight: '1.8', marginTop: '32px', fontSize: '15px' }
const footerSmall = { color: '#888888', fontSize: '12px', lineHeight: '1.6', margin: '0' as const, fontFamily: "Georgia, 'Playfair Display', serif" }
