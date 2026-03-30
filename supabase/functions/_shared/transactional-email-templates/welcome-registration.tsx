import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Img, Hr, Section, Row, Column,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Maison Affluency"

// Curated showcase images — diverse pieces from the collection
const SHOWCASE_IMAGES = [
  {
    src: 'https://res.cloudinary.com/dif1oamtj/image/upload/w_600,h_600,c_fill,q_auto,f_auto/v1772106126/Screen_Shot_2026-02-22_at_2.36.04_PM_ivwy5t.png',
    alt: 'Portal by Jeff Zimmerman',
  },
  {
    src: 'https://res.cloudinary.com/dif1oamtj/image/upload/w_600,h_600,c_fill,q_auto,f_auto/v1774869657/Screen_Shot_2026-03-30_at_7.20.35_PM_hmegqy.png',
    alt: 'Ouranos I by Christopher Boots',
  },
  {
    src: 'https://res.cloudinary.com/dif1oamtj/image/upload/w_600,h_600,c_fill,q_auto,f_auto/v1773292459/Screen_Shot_2026-03-12_at_12.50.53_PM_wp4tbm.png',
    alt: 'Firefly Chandelier by Rosie Li',
  },
  {
    src: 'https://res.cloudinary.com/dif1oamtj/image/upload/w_600,h_600,c_fill,q_auto,f_auto/v1774225373/Arbor-Desk_04_alexander-lamont_cprwfe.jpg',
    alt: 'Arbor Desk by Alexander Lamont',
  },
]

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

        {/* 2×2 image showcase grid */}
        <Section style={imageGrid}>
          <Row>
            <Column style={imageCol}>
              <Img src={SHOWCASE_IMAGES[0].src} alt={SHOWCASE_IMAGES[0].alt} width="265" height="265" style={gridImage} />
            </Column>
            <Column style={imageColRight}>
              <Img src={SHOWCASE_IMAGES[1].src} alt={SHOWCASE_IMAGES[1].alt} width="265" height="265" style={gridImage} />
            </Column>
          </Row>
          <Row>
            <Column style={imageCol}>
              <Img src={SHOWCASE_IMAGES[2].src} alt={SHOWCASE_IMAGES[2].alt} width="265" height="265" style={gridImage} />
            </Column>
            <Column style={imageColRight}>
              <Img src={SHOWCASE_IMAGES[3].src} alt={SHOWCASE_IMAGES[3].alt} width="265" height="265" style={gridImage} />
            </Column>
          </Row>
        </Section>

        <Text style={captionText}>
          A glimpse of our curators' picks — from Jeff Zimmerman and Christopher Boots to Rosie Li and Alexander Lamont.
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
const captionText = { color: '#888888', lineHeight: '1.6', marginBottom: '24px', fontSize: '13px', fontStyle: 'italic' as const, textAlign: 'center' as const }
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
const imageGrid = { margin: '8px 0 16px', width: '100%' }
const imageCol = { width: '50%', paddingRight: '4px', paddingBottom: '8px', verticalAlign: 'top' as const }
const imageColRight = { width: '50%', paddingLeft: '4px', paddingBottom: '8px', verticalAlign: 'top' as const }
const gridImage = { display: 'block', width: '100%', height: 'auto', borderRadius: '4px', objectFit: 'cover' as const }
const footer = { color: '#333333', lineHeight: '1.8', marginTop: '32px', fontSize: '15px' }
const footerSmall = { color: '#888888', fontSize: '12px', lineHeight: '1.6', textAlign: 'center' as const }
