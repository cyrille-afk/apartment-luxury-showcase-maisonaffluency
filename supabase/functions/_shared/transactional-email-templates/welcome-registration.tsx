import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Img, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Maison Affluency"

interface WelcomeRegistrationProps {
  firstName?: string
}

const WelcomeRegistrationEmail = ({ firstName }: WelcomeRegistrationProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to {SITE_NAME} — Unique by Design</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <Img
            src="https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/affluency-email-logo.jpeg"
            alt="Affluency - Unique by Design"
            width="280"
            style={logo}
          />
        </Section>
        <Hr style={divider} />

        <Heading style={h1}>
          {firstName ? `Welcome, ${firstName}.` : 'Welcome.'}
        </Heading>

        <Text style={text}>
          Thank you for creating your account with {SITE_NAME}. You now have access to our curated world of collectible design — from rare ateliers to contemporary masters.
        </Text>

        <Text style={text}>
          As a registered member, you can browse curators' picks, save your favourites, download spec sheets, and request quotes directly from our platform.
        </Text>

        <Section style={buttonSection}>
          <Button style={button} href="https://maisonaffluency.com/designers">
            Explore Designers & Ateliers
          </Button>
        </Section>

        <Text style={text}>
          Stay tuned for regular updates on new collections, designer editorials, and exclusive event announcements.
        </Text>

        <Text style={textMuted}>
          If you are an architect, interior designer, or hospitality professional, consider applying to our{' '}
          <a href="https://maisonaffluency.com/trade/register" style={link}>Trade Program</a>{' '}
          for exclusive trade pricing and dedicated concierge support.
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
  component: WelcomeRegistrationEmail,
  subject: `Welcome to ${SITE_NAME} — Unique by Design`,
  displayName: 'Welcome Registration',
  previewData: { firstName: 'Alexandra' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "Georgia, 'Playfair Display', serif" }
const container = { padding: '40px 20px', maxWidth: '600px', margin: '0 auto', backgroundColor: '#faf9f7' }
const logoSection = { textAlign: 'center' as const, marginBottom: '32px', paddingBottom: '24px' }
const logo = { margin: '0 auto' }
const divider = { border: 'none', borderTop: '1px solid #e8e4de', margin: '0 0 24px' }
const h1 = { color: '#1a1a1a', fontSize: '24px', marginBottom: '24px', fontFamily: "Georgia, 'Playfair Display', serif" }
const text = { color: '#333333', lineHeight: '1.8', marginBottom: '20px', fontSize: '15px' }
const textMuted = { color: '#666666', lineHeight: '1.8', marginBottom: '20px', fontSize: '14px', fontStyle: 'italic' as const }
const link = { color: '#1a1a1a', textDecoration: 'underline' }
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
