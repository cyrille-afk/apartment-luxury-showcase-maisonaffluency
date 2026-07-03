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
        <Text style={introText}>
          Your account is now active. As a member of the Trade Program, your studio enters a refined ecosystem of sourcing, tooling, and commercial infrastructure designed for the world's most discerning design firms.
        </Text>

        <table width="100%" cellPadding="0" cellSpacing="0" style={benefitsTable}>
          <tbody>
            <BenefitRow
              title="Trade pricing & bespoke quotations"
              description="Preferential trade discount applied across the catalogue, plus tailored quotations for larger scopes."
            />
            <BenefitRow
              title="Dedicated Client Advisor"
              description="A single point of contact for sourcing, lead times, logistics, and white-glove project support."
            />
            <BenefitRow
              title="Custom & bespoke requests"
              description="Commission modifications or entirely bespoke pieces directly with our ateliers and designers."
            />
            <BenefitRow
              title="Curated product library"
              description="Access to European, Japanese and American ateliers, collectible design, and material archives."
            />
            <BenefitRow
              title="CAD &amp; 3D Files"
              description="Trade-only technical downloads where the maker supplies them: DWG, DXF, 3DS, SKP, RFA, OBJ, FBX, STEP, IGES. Requires sign-in and appears only on eligible product pages."
            />
            <BenefitRow
              title="Samples & swatches"
              description="Request finish and fabric samples shipped to your studio for client presentations."
            />
            <BenefitRow
              title="Consolidated, fully insured shipping"
              description="Worldwide DDP or DAP, with one landed quote covering freight, customs, and duties."
            />
            <BenefitRow
              title="Branded quote & tearsheet builder"
              description="Export white-labelled PDFs and share tearsheets under your studio's identity."
            />
            <BenefitRow
              title="White-label client boards"
              description="Private shareable boards for your clients under your logo and studio name."
            />
            <BenefitRow
              title="Project folders & mood board studio"
              description="Organise sourcing by project and build mood boards with AI assistance."
            />
            <BenefitRow
              title="3D Studio"
              description="Turn architectural drawings into furnished 3D visualisations to present to clients."
            />
            <BenefitRow
              title="AI Concierge"
              description="An in-app assistant trained exclusively on our catalogue for instant recommendations."
            />
            <BenefitRow
              title="Trade payouts"
              description="Choose how your studio gets paid on every quote."
              details={[
                'Agent commission (EU / Asia default): your client pays full MSRP and you receive a commission payout after delivery.',
                'Net buy (US / CA / MX default): your firm pays MSRP minus your tier discount on a white-label invoice.',
                'Country-aware defaults: US / Canada / Mexico default to net buy; the rest of the world defaults to agent commission.',
                'Per-quote override: flip billing mode on any individual quote when the project calls for it.',
                'Resale certificates: upload state-issued US resale certificates to unlock net-buy shipments to those states.',
                'Stripe Connect: agent commissions paid directly to your linked studio payout account.',
              ]}
            />
          </tbody>
        </table>

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

interface BenefitRowProps {
  title: string
  description: string
  details?: string[]
}

const BenefitRow = ({ title, description, details }: BenefitRowProps) => (
  <tr>
    <td style={benefitIconCell}>◆</td>
    <td style={benefitTextCell}>
      <Text style={benefitTitle}>{title}</Text>
      <Text style={benefitText}>{description}</Text>
      {details && details.length > 0 && (
        <ul style={detailList}>
          {details.map((detail, index) => (
            <li key={index} style={detailItem}>{detail}</li>
          ))}
        </ul>
      )}
    </td>
  </tr>
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
const introText = { color: '#333333', lineHeight: '1.8', marginBottom: '28px', fontSize: '15px', fontStyle: 'italic' as const }
const benefitsTable = { borderCollapse: 'collapse' as const, width: '100%', marginBottom: '28px' }
const benefitIconCell = { verticalAlign: 'top' as const, width: '28px', paddingTop: '2px', paddingBottom: '18px', color: '#1a1a1a', fontSize: '14px', fontFamily: "Georgia, 'Playfair Display', serif" }
const benefitTextCell = { verticalAlign: 'top' as const, paddingBottom: '18px' }
const benefitTitle = { color: '#1a1a1a', fontSize: '15px', fontWeight: 'bold' as const, margin: '0 0 4px', lineHeight: '1.4', fontFamily: "Georgia, 'Playfair Display', serif" }
const benefitText = { color: '#333333', fontSize: '14px', lineHeight: '1.6', margin: '0', fontFamily: "Georgia, 'Playfair Display', serif" }
const detailList = { color: '#333333', fontSize: '13px', lineHeight: '1.6', margin: '8px 0 0 18px', paddingLeft: '14px', fontFamily: "Georgia, 'Playfair Display', serif" }
const detailItem = { marginBottom: '4px' }
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
