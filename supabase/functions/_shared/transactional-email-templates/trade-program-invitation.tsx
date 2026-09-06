/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.tsx'

const SITE_NAME = 'Maison Affluency'
const SITE_URL = 'https://www.maisonaffluency.com'

interface Props {
  email?: string
  companyName?: string
  websiteUrl?: string
}

const Email = ({ email, companyName }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Maison Affluency Trade Program invitation</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={eyebrow}>MAISON AFFLUENCY — EST. 2017</Text>
        <Heading style={heading}>Your Trade Program Invitation</Heading>

        <Text style={paragraph}>
          {companyName ? `Dear ${companyName},` : 'Dear Design Professional,'}
        </Text>

        <Text style={paragraph}>
          Thank you for your interest in the Maison Affluency Trade Program. Your
          registration{email ? ` for ${email}` : ''} has been received and our team will
          review your credentials shortly.
        </Text>

        <Text style={paragraph}>
          To complete your enrolment and unlock trade pricing, bespoke quotations,
          project folders and our full library of ateliers and collectible design,
          continue your application below.
        </Text>

        <Section style={{ margin: '28px 0' }}>
          <Button href={`${SITE_URL}/trade/apply`} style={button}>
            Complete Your Application
          </Button>
        </Section>

        <Hr style={hr} />

        <Text style={footnote}>
          Once approved you will receive your trade credentials and a dedicated client
          advisor. Questions? Simply reply to this email.
        </Text>
        <Text style={footnote}>{SITE_NAME} · Singapore · Paris</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Your Maison Affluency Trade Program invitation',
  displayName: 'Trade Program Invitation',
  previewData: { email: 'studio@example.com', companyName: 'Studio Example' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Georgia, "Times New Roman", serif' }
const container = { padding: '40px 32px', maxWidth: '600px' }
const eyebrow = {
  fontFamily: 'Arial, sans-serif',
  fontSize: '10px',
  letterSpacing: '0.22em',
  color: '#8a8a80',
  margin: '0 0 18px',
}
const heading = { fontSize: '26px', lineHeight: '1.25', color: '#1f2a26', margin: '0 0 22px', fontWeight: 400 }
const paragraph = { fontSize: '15px', lineHeight: '1.7', color: '#3c443f', margin: '0 0 16px' }
const button = {
  backgroundColor: '#1f2a26',
  color: '#ffffff',
  fontFamily: 'Arial, sans-serif',
  fontSize: '11px',
  letterSpacing: '0.2em',
  textTransform: 'uppercase' as const,
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block',
}
const hr = { borderColor: '#e6e4de', margin: '28px 0' }
const footnote = { fontFamily: 'Arial, sans-serif', fontSize: '11px', lineHeight: '1.6', color: '#8a8a80', margin: '0 0 6px' }
