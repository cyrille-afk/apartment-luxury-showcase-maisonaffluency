/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Img, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.tsx'

const SITE_NAME = "Maison Affluency"

interface Props {
  name?: string
}

const Email = ({ name }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>An update on your Private Collector application</Preview>
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
          Thank you for your interest in becoming a Private Collector of {SITE_NAME} and for the time taken with your application.
        </Text>
        <Text style={introText}>
          After careful review, we are unable to extend Private Collector access at this time. This decision reflects the confidential nature of our circle and is in no way a judgement of your appreciation for design.
        </Text>
        <Text style={text}>
          Our public collection remains open to you at{' '}
          <a href="https://maisonaffluency.com" style={link}>maisonaffluency.com</a>,
          and we would be glad to reconsider a future application should your circumstances evolve.
        </Text>
        <Text style={text}>
          If you are a design professional, our Trade Program may be a more suitable path — you are welcome to apply at{' '}
          <a href="https://maisonaffluency.com/trade/register" style={link}>maisonaffluency.com/trade/register</a>.
        </Text>
        <Text style={footer}>
          With appreciation,<br />
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
  subject: 'An update on your Maison Affluency application',
  displayName: 'Collector Application Declined',
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
const link = { color: '#1a1a1a', textDecoration: 'underline' }
const footer = { color: '#333333', lineHeight: '1.8', marginTop: '32px', fontSize: '15px' }
const footerSmall = { color: '#888888', fontSize: '12px', lineHeight: '1.6', margin: '0' as const, fontFamily: "Georgia, 'Playfair Display', serif" }
