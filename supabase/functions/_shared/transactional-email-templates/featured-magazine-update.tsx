/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Img, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.tsx'

const SITE_NAME = "Maison Affluency"

interface FeaturedMagazineUpdateProps {
  firstName?: string
  issueTitle?: string
  brandName?: string
  coverImageUrl?: string | null
  ctaUrl?: string
}

const FeaturedMagazineUpdateEmail = ({
  firstName,
  issueTitle,
  brandName,
  coverImageUrl,
  ctaUrl,
}: FeaturedMagazineUpdateProps) => {
  const link = ctaUrl || 'https://maisonaffluency.com/trade/landing'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{issueTitle ? `New Featured Issue: ${issueTitle}` : 'A new featured issue is available'}</Preview>
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
            {firstName ? `Dear ${firstName},` : 'Dear Member,'}
          </Heading>

          <Text style={text}>
            A new featured issue has just been added to your Trade reading room — complimentary to download for our members.
          </Text>

          {coverImageUrl ? (
            <Section style={{ textAlign: 'center' as const, margin: '24px 0' }}>
              <Img
                src={coverImageUrl}
                alt={issueTitle || 'Featured issue'}
                width="320"
                style={{ display: 'block', margin: '0 auto', borderRadius: '4px', maxWidth: '100%', height: 'auto' }}
              />
            </Section>
          ) : null}

          {issueTitle ? (
            <Text style={issueTitleStyle}>
              {issueTitle}
              {brandName ? <span style={{ display: 'block', color: '#888', fontSize: '13px', fontStyle: 'italic' as const, marginTop: '4px' }}>{brandName}</span> : null}
            </Text>
          ) : null}

          <Section style={buttonSection}>
            <Button style={button} href={link}>
              Download This Issue
            </Button>
          </Section>

          <Text style={textMuted}>
            Featured issues rotate regularly. Visit your Trade Lounge anytime to discover the latest editorial selections curated for our community.
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
}

export const template = {
  component: FeaturedMagazineUpdateEmail,
  subject: (data: Record<string, any>) =>
    data?.issueTitle
      ? `New Featured Issue: ${data.issueTitle}`
      : `A new featured issue is now available — ${SITE_NAME}`,
  displayName: 'Featured Magazine Update',
  previewData: {
    firstName: 'Alexandra',
    issueTitle: 'Architectural Digest US — May 2026',
    brandName: 'Architectural Digest',
    coverImageUrl: 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/affluency-email-wordmark.jpg',
    ctaUrl: 'https://maisonaffluency.com/trade/landing',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "Georgia, 'Playfair Display', serif" }
const container = { padding: '40px 20px', maxWidth: '600px', margin: '0 auto', backgroundColor: '#faf9f7' }
const logoSection = { textAlign: 'center' as const, marginBottom: '32px', paddingBottom: '24px' }
const logo = { margin: '0 auto' }
const divider = { border: 'none', borderTop: '1px solid #e8e4de', margin: '0 0 24px' }
const h1 = { color: '#1a1a1a', fontSize: '22px', marginBottom: '20px', fontFamily: "Georgia, 'Playfair Display', serif" }
const text = { color: '#333333', lineHeight: '1.8', marginBottom: '20px', fontSize: '15px' }
const textMuted = { color: '#666666', lineHeight: '1.8', marginBottom: '20px', fontSize: '13px', fontStyle: 'italic' as const }
const issueTitleStyle = { color: '#1a1a1a', fontSize: '17px', textAlign: 'center' as const, margin: '8px 0 16px', fontFamily: "Georgia, 'Playfair Display', serif" }
const buttonSection = { textAlign: 'center' as const, margin: '24px 0 32px' }
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
