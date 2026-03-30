import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Img, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

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
            width="280"
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
          You now have full access to exclusive trade pricing, our curated product library, branded quote builder, and dedicated concierge support.
        </Text>
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
        <Text style={footerSmall}>
          {SITE_NAME} Singapore<br />
          <em>Unique by Design</em>
        </Text>
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
const footerSmall = { color: '#888888', fontSize: '12px', lineHeight: '1.6', textAlign: 'center' as const }
