/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Img, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.tsx'

const SITE_NAME = "Maison Affluency"

interface Props {
  name?: string
}

const Email = ({ name }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Private Collector application has been approved</Preview>
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
          {name ? `Dear ${name},` : 'Dear Collector,'}
        </Heading>
        <Text style={text}>
          We are delighted to welcome you as a Private Collector of {SITE_NAME}. Your application has been reviewed and approved.
        </Text>
        <Text style={introText}>
          You now have access to full pricing, complete provenance records, and certificates of authenticity across the collection — reserved for a discreet circle of collectors and trade professionals.
        </Text>

        <table width="100%" cellPadding="0" cellSpacing="0" style={benefitsTable}>
          <tbody>
            <tr>
              <td style={iconCell}>◆</td>
              <td style={textCell}>
                <Text style={itemTitle}>Full pricing visibility</Text>
                <Text style={itemText}>Retail pricing revealed across editions, commissions, and one-of-a-kind pieces.</Text>
              </td>
            </tr>
            <tr>
              <td style={iconCell}>◆</td>
              <td style={textCell}>
                <Text style={itemTitle}>Complete provenance</Text>
                <Text style={itemText}>Historical records, exhibitions, publications, and edition details for each piece.</Text>
              </td>
            </tr>
            <tr>
              <td style={iconCell}>◆</td>
              <td style={textCell}>
                <Text style={itemTitle}>Certificates of authenticity</Text>
                <Text style={itemText}>Expanded certificates including appreciation notes and comparable references.</Text>
              </td>
            </tr>
          </tbody>
        </table>

        <Section style={buttonSection}>
          <Button style={button} href="https://maisonaffluency.com/designers">
            Explore the Collection
          </Button>
        </Section>
        <Text style={text}>
          Should you wish to be introduced to a specific designer, commission a bespoke piece, or arrange a private viewing, please reply to this message.
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
  component: Email,
  subject: 'Welcome to Maison Affluency — Private Collector Access',
  displayName: 'Collector Application Approved',
  previewData: { name: 'Jane Smith' },
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
const iconCell = { verticalAlign: 'top' as const, width: '28px', paddingTop: '2px', paddingBottom: '18px', color: '#1a1a1a', fontSize: '14px', fontFamily: "Georgia, 'Playfair Display', serif" }
const textCell = { verticalAlign: 'top' as const, paddingBottom: '18px' }
const itemTitle = { color: '#1a1a1a', fontSize: '15px', fontWeight: 'bold' as const, margin: '0 0 4px', lineHeight: '1.4', fontFamily: "Georgia, 'Playfair Display', serif" }
const itemText = { color: '#333333', fontSize: '14px', lineHeight: '1.6', margin: '0', fontFamily: "Georgia, 'Playfair Display', serif" }
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
