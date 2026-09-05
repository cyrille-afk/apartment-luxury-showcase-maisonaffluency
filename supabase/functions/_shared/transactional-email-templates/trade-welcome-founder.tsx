/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Img, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.tsx'

const SITE_NAME = "Maison Affluency"
const DEFAULT_FOUNDER = "Cyrille Delval"

interface TradeWelcomeFounderProps {
  name?: string
  companyName?: string
  founderName?: string
}

const TradeWelcomeFounderEmail = ({ name, companyName, founderName }: TradeWelcomeFounderProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>A personal welcome to the {SITE_NAME} Trade Program</Preview>
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
        <Text style={text}>
          I personally reviewed your studio's portfolio today and wanted to welcome you to the
          {' '}{SITE_NAME} global trade program. The caliber of work coming out of
          {' '}{companyName || 'your studio'} is exceptional, and it is a privilege to partner with you.
        </Text>
        <Text style={text}>
          Your trade status has been finalized. Net professional pricing is now unlocked globally
          across our portfolio of 170+ master designers.
        </Text>
        <Text style={text}>
          As a designer myself, I built {SITE_NAME} to solve the friction of elite sourcing. I
          highly recommend utilizing our integrated AI Curatorial Guide for your current mood
          boards. I have trained the engine with deep design syntax, allowing it to interpret
          complex architectural context and track down highly specific collector pieces across
          global supply chains in seconds.
        </Text>
        <Text style={text}>
          Your profile is also cleared for international tax-exempt invoicing based on your
          submitted credentials.
        </Text>
        <Text style={text}>
          Should you or your team ever need direct concierge support for a high-net-worth
          residential or commercial commission, simply reply directly to this message.
        </Text>
        <Text style={text}>Welcome to the collection.</Text>
        <Text style={footer}>
          Sincerely,<br />
          <strong>{founderName || DEFAULT_FOUNDER}</strong><br />
          Founder, {SITE_NAME}<br />
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
  component: TradeWelcomeFounderEmail,
  subject: 'Personal Welcome to the Maison Affluency Trade Program',
  displayName: 'Trade Welcome (Founder, Manual Approval)',
  previewData: { name: 'Jane Smith', companyName: 'Atelier Design Co.', founderName: DEFAULT_FOUNDER },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "Georgia, 'Playfair Display', serif" }
const container = { padding: '40px 20px', maxWidth: '600px', margin: '0 auto', backgroundColor: '#faf9f7' }
const logoSection = { textAlign: 'center' as const, marginBottom: '32px', paddingBottom: '24px' }
const logo = { margin: '0 auto' }
const divider = { border: 'none', borderTop: '1px solid #e8e4de', margin: '0 0 24px' }
const h1 = { color: '#1a1a1a', fontSize: '24px', marginBottom: '24px', fontFamily: "Georgia, 'Playfair Display', serif" }
const text = { color: '#333333', lineHeight: '1.8', marginBottom: '20px', fontSize: '15px' }
const footer = { color: '#333333', lineHeight: '1.8', marginTop: '32px', fontSize: '15px' }
const footerSmall = { color: '#888888', fontSize: '12px', lineHeight: '1.6', margin: '0' as const, fontFamily: "Georgia, 'Playfair Display', serif" }
