/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Img, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.tsx'

const SITE_NAME = "Maison Affluency"

interface TradeWelcomeAutoProps {
  name?: string
  companyName?: string
  country?: string
}

const TradeWelcomeAutoEmail = ({ name, companyName, country }: TradeWelcomeAutoProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your global trade profile is now fully active</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <Img
            src="https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/affluency-email-wordmark.jpg"
            alt="Affluency - Unique by Design"
            width="420"
            style={logo}
          />
        </Section>
        <Hr style={divider} />
        <Heading style={h1}>
          {name ? `Dear ${name},` : 'Dear Applicant,'}
        </Heading>
        <Text style={text}>Welcome to {SITE_NAME}.</Text>
        <Text style={text}>
          Your credentials have been verified, and your global trade profile is now fully active.
          When logged into your account at maisonaffluency.com, your exclusive trade pricing and net
          rates will automatically apply across our entire catalog of over 170 exceptional
          international designers.
        </Text>
        <Text style={text}>
          To streamline your active commissions, you now have unrestricted access to our proprietary
          AI Curatorial Guide. Powered by deep semantic search and tailored design intelligence,
          this tool is engineered to act as your digital sourcing partner—instantly
          cross-referencing materials, historical aesthetics, and complex specifications to match
          your project mood boards.
        </Text>

        <Section style={detailsBox}>
          <Text style={detailsTitle}>Your Account Details:</Text>
          <Text style={detailLine}>• Registered Studio: {companyName || '—'}</Text>
          <Text style={detailLine}>• Verified Region: {country || '—'}</Text>
          <Text style={detailLine}>• Tax/VAT Status: Exempt/Validated</Text>
        </Section>

        <Text style={text}>
          If your studio requires custom logistics, white-glove international freight handling, or
          bespoke material alterations for an upcoming project, you can coordinate directly through
          your dashboard trade portal.
        </Text>
        <Text style={text}>We look forward to supporting your upcoming spaces.</Text>
        <Text style={footer}>
          Warm regards,<br />
          <strong>The {SITE_NAME} Trade Team</strong><br />
          www.maisonaffluency.com
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
  component: TradeWelcomeAutoEmail,
  subject: 'Account Activated: Global Trade Program Access',
  displayName: 'Trade Welcome (Auto-Approved)',
  previewData: { name: 'Jane Smith', companyName: 'Atelier Design Co.', country: 'Singapore' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "Georgia, 'Playfair Display', serif" }
const container = { padding: '40px 20px', maxWidth: '600px', margin: '0 auto', backgroundColor: '#faf9f7' }
const logoSection = { textAlign: 'center' as const, marginBottom: '32px', paddingBottom: '24px' }
const logo = { margin: '0 auto' }
const divider = { border: 'none', borderTop: '1px solid #e8e4de', margin: '0 0 24px' }
const h1 = { color: '#1a1a1a', fontSize: '24px', marginBottom: '24px', fontFamily: "Georgia, 'Playfair Display', serif" }
const text = { color: '#333333', lineHeight: '1.8', marginBottom: '20px', fontSize: '15px' }
const detailsBox = {
  borderLeft: '2px solid #1a1a1a',
  paddingLeft: '16px',
  margin: '8px 0 28px',
}
const detailsTitle = { color: '#1a1a1a', fontSize: '14px', fontWeight: 'bold' as const, margin: '0 0 8px' }
const detailLine = { color: '#333333', fontSize: '14px', lineHeight: '1.7', margin: '0 0 2px' }
const footer = { color: '#333333', lineHeight: '1.8', marginTop: '32px', fontSize: '15px' }
const footerSmall = { color: '#888888', fontSize: '12px', lineHeight: '1.6', margin: '0' as const, fontFamily: "Georgia, 'Playfair Display', serif" }
