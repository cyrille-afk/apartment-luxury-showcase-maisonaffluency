/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Img, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.tsx'

const SITE_NAME = "Maison Affluency"

interface TradeApprovalProps {
  name?: string
  companyName?: string
}

const TradeApprovalEmail = ({ name, companyName }: TradeApprovalProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Trade Program application has been approved</Preview>
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
          We are pleased to inform you that your application
          {companyName ? <> for <strong>{companyName}</strong></> : ''} to the {SITE_NAME} Trade Program has been approved.
        </Text>
        <Text style={text}>
          Your account is now active. Here is everything unlocked for your studio:
        </Text>
        <ul style={list}>
          <li style={listItem}><strong>Trade pricing &amp; bespoke quotations</strong> — trade discount applied across the catalogue, plus tailored quotes for larger scopes.</li>
          <li style={listItem}><strong>Dedicated Client Advisor</strong> — a single point of contact for sourcing, lead times and logistics.</li>
          <li style={listItem}><strong>Custom &amp; bespoke requests</strong> — commission modifications or entirely bespoke pieces directly with our ateliers and designers.</li>
          <li style={listItem}><strong>Curated product library</strong> — access to European ateliers, collectible design and material archives, with technical CAD / 3D downloads on eligible pieces.</li>
          <li style={listItem}><strong>Samples &amp; swatches</strong> — request finish and fabric samples shipped to your studio.</li>
          <li style={listItem}><strong>Consolidated, fully insured shipping</strong> — worldwide DDP or DAP, with one landed quote covering freight, customs and duties.</li>
          <li style={listItem}><strong>Branded quote &amp; tearsheet builder</strong> — export white-labelled PDFs and share tearsheets under your studio's identity.</li>
          <li style={listItem}><strong>White-label client boards</strong> — private shareable boards for your clients under your logo and studio name.</li>
          <li style={listItem}><strong>Project folders &amp; mood board studio</strong> — organise sourcing by project and build mood boards with AI assistance.</li>
          <li style={listItem}><strong>3D Studio</strong> — turn architectural drawings into furnished 3D visualisations to present to clients.</li>
          <li style={listItem}><strong>AI Concierge</strong> — an in-app assistant trained exclusively on our catalogue for instant recommendations.</li>
          <li style={listItem}>
            <strong>Trade payouts</strong> — choose how your studio gets paid on every quote:
            <ul style={nestedList}>
              <li style={nestedListItem}><strong>Agent commission</strong> (EU/Asia default): your client pays full MSRP and you receive a commission payout after delivery.</li>
              <li style={nestedListItem}><strong>Net buy</strong> (US/CA/MX default): your firm pays MSRP minus your tier discount on a white-label invoice.</li>
              <li style={nestedListItem}><strong>Country-aware defaults</strong> — US/Canada/Mexico default to net buy; the rest of the world defaults to agent commission.</li>
              <li style={nestedListItem}><strong>Per-quote override</strong> — flip billing mode on any individual quote when the project calls for it.</li>
              <li style={nestedListItem}><strong>Resale certificates</strong> — upload state-issued US resale certificates to unlock net-buy shipments to those states.</li>
              <li style={nestedListItem}><strong>Stripe Connect</strong> — agent commissions paid directly to your linked studio payout account.</li>
            </ul>
          </li>
        </ul>
        <Section style={buttonSection}>
          <Button style={button} href="https://maisonaffluency.com/trade/login">
            Access Your Trade Portal
          </Button>
        </Section>
        <Text style={text}>
          A dedicated Client Advisor will reach out to you shortly to introduce themselves and discuss how we can best support your projects.
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
  component: TradeApprovalEmail,
  subject: 'Welcome to the Maison Affluency Trade Program',
  displayName: 'Trade Program Approval',
  previewData: { name: 'Jane Smith', companyName: 'Atelier Design Co.' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "Georgia, 'Playfair Display', serif" }
const container = { padding: '40px 20px', maxWidth: '600px', margin: '0 auto', backgroundColor: '#faf9f7' }
const logoSection = { textAlign: 'center' as const, marginBottom: '32px', paddingBottom: '24px' }
const logo = { margin: '0 auto' }
const divider = { border: 'none', borderTop: '1px solid #e8e4de', margin: '0 0 24px' }
const h1 = { color: '#1a1a1a', fontSize: '24px', marginBottom: '24px', fontFamily: "Georgia, 'Playfair Display', serif" }
const text = { color: '#333333', lineHeight: '1.8', marginBottom: '20px', fontSize: '15px' }
const list = { color: '#333333', lineHeight: '1.7', margin: '0 0 24px 20px', fontSize: '14px', paddingLeft: '20px' }
const listItem = { marginBottom: '10px' }
const nestedList = { color: '#333333', lineHeight: '1.7', margin: '8px 0 0 0', fontSize: '13px', paddingLeft: '18px', listStyleType: 'circle' as const }
const nestedListItem = { marginBottom: '6px' }
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
