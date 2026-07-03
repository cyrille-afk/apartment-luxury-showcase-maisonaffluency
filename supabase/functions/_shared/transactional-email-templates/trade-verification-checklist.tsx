/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Img, Hr, Section, Link,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.tsx'

const SITE_NAME = "Maison Affluency"
const REPLY_TO = "concierge@myaffluency.com"

interface Props {
  firstName?: string
  items?: string[]
  editUrl?: string
}

const TradeVerificationChecklistEmail = ({ firstName, items = [], editUrl }: Props) => (

const TradeVerificationChecklistEmail = ({ firstName, items = [] }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Completing your Maison Affluency trade verification</Preview>
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
          {firstName ? `Hello ${firstName},` : 'Hello,'}
        </Heading>
        <Text style={text}>
          Thank you for applying to {SITE_NAME} Trade. To finish verifying you
          as a professional, could you send us the following:
        </Text>
        {items.length > 0 && (
          <ul style={list}>
            {items.map((item, i) => (
              <li key={i} style={listItem}>{item}</li>
            ))}
          </ul>
        )}
        {editUrl && (
          <Section style={{ textAlign: 'center' as const, margin: '28px 0' }}>
            <Link href={editUrl} style={ctaButton}>
              Complete your application
            </Link>
            <Text style={ctaHint}>
              This secure link lets you update your details in your existing application —
              no need to re-apply. It expires in 14 days.
            </Text>
          </Section>
        )}
        <Text style={text}>
          Once we have this we can activate your trade access. Prefer email? Just reply to
          this message or write to{' '}
          <Link href={`mailto:${REPLY_TO}`} style={link}>{REPLY_TO}</Link>.
        </Text>
        <Text style={footer}>
          With thanks,<br />
          <strong>{SITE_NAME} Trade Team</strong>
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
  component: TradeVerificationChecklistEmail,
  subject: 'Maison Affluency — completing your trade verification',
  displayName: 'Trade Verification Checklist',
  previewData: {
    firstName: 'Julie',
    items: [
      "A corporate email address on your firm's domain (not gmail/yahoo/etc.).",
      "A link to your firm's website or an online portfolio (Instagram / Houzz / Behance are fine).",
      "A specific job title describing your role (e.g. Interior Designer, Principal, Studio Director).",
    ],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "Georgia, 'Playfair Display', serif" }
const container = { padding: '40px 20px', maxWidth: '600px', margin: '0 auto', backgroundColor: '#faf9f7' }
const logoSection = { textAlign: 'center' as const, marginBottom: '32px', paddingBottom: '24px' }
const logo = { margin: '0 auto' }
const divider = { border: 'none', borderTop: '1px solid #e8e4de', margin: '0 0 24px' }
const h1 = { color: '#1a1a1a', fontSize: '22px', marginBottom: '20px', fontFamily: "Georgia, 'Playfair Display', serif" }
const text = { color: '#333333', lineHeight: '1.8', marginBottom: '18px', fontSize: '15px' }
const list = { color: '#333333', lineHeight: '1.8', margin: '0 0 20px 20px', fontSize: '15px', paddingLeft: '20px' }
const listItem = { marginBottom: '8px' }
const link = { color: '#2f5148', textDecoration: 'underline' }
const footer = { color: '#333333', lineHeight: '1.8', marginTop: '32px', fontSize: '15px' }
const footerSmall = { color: '#888888', fontSize: '12px', lineHeight: '1.6', margin: '0' as const, fontFamily: "Georgia, 'Playfair Display', serif" }
