/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Section, Img, Link,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.tsx'

const SITE_NAME = 'Maison Affluency'

interface Props {
  firstName?: string
  name?: string
  email?: string
  companyName?: string
}

const Email = ({ firstName, name }: Props) => {
  const resolvedFirstName = firstName?.trim() || name?.trim().split(/\s+/)[0] || 'Design Professional'

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>We have received your Maison Affluency Trade Program application</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoSection}>
            <Img
              src="https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/affluency-email-wordmark.jpg"
              alt="Maison Affluency — Unique by Design"
              width="420"
              style={logo}
            />
          </Section>
          <Hr style={divider} />

          <Heading style={heading}>Dear {resolvedFirstName},</Heading>

          <Text style={paragraph}>
            Thank you for your interest in the Maison Affluency Trade Program. We have successfully received the application details for your studio.
          </Text>

          <Text style={paragraph}>
            We are currently completing a specialized fine-tuning phase for our advanced Trade suite, design tools, and custom AI curatorial assistant. This expanded system is scheduled to fully deploy alongside our exhibition calendar for Design Miami Paris from October 20–25, 2026.
          </Text>

          <Text style={paragraph}>
            While direct system credentials conclude, your firm has been assigned priority tier status. For any immediate projects requiring trade quotes, high-resolution visual assets, or logistical curation, please reply directly to this thread or reach our desk at{' '}
            <Link href="mailto:concierge@maisonaffluency.com" style={link}>concierge@maisonaffluency.com</Link>.
          </Text>

          <Text style={signature}>
            Warm regards,<br />
            <strong>The Concierge Team</strong>
          </Text>

          <Hr style={divider} />
          <table width="100%" cellPadding="0" cellSpacing="0" style={{ borderCollapse: 'collapse' as const }}>
            <tbody>
              <tr>
                <td align="right" style={{ verticalAlign: 'middle', paddingRight: '8px' }}>
                  <p style={footerSmall}>
                    {SITE_NAME} Singapore<br />
                    <em>Unique by Design</em>
                  </p>
                </td>
                <td align="right" style={{ verticalAlign: 'middle', width: '48px' }}>
                  <Img
                    src="https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/affluency-email-logo.jpg"
                    alt="Maison Affluency"
                    width="40"
                    height="40"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: 'Maison Affluency Trade Program — Application Received',
  displayName: 'Trade Program Application Received',
  previewData: { firstName: 'Alexandra', email: 'studio@example.com', companyName: 'Studio Example' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Georgia, "Times New Roman", serif' }
const container = { padding: '40px 20px', maxWidth: '600px', margin: '0 auto', backgroundColor: '#faf9f7' }
const logoSection = { textAlign: 'center' as const, marginBottom: '32px', paddingBottom: '24px' }
const logo = { margin: '0 auto' }
const divider = { border: 'none', borderTop: '1px solid #e8e4de', margin: '0 0 24px' }
const heading = { color: '#1a1a1a', fontSize: '24px', marginBottom: '24px', fontFamily: 'Georgia, "Times New Roman", serif' }
const paragraph = { color: '#333333', lineHeight: '1.8', marginBottom: '20px', fontSize: '15px' }
const link = { color: '#1a1a1a', textDecoration: 'underline' }
const signature = { color: '#333333', lineHeight: '1.8', marginTop: '32px', fontSize: '15px' }
const footerSmall = { color: '#888888', fontSize: '12px', lineHeight: '1.6', margin: '0' as const, fontFamily: 'Georgia, "Times New Roman", serif' }
