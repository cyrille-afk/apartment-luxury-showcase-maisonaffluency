/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.tsx'

interface Props {
  name?: string
  company?: string
  email?: string
  phone?: string
  message?: string
  subject?: string
}

const Row = ({ label, value }: { label: string; value?: string }) => (
  <tr>
    <td style={cellLabel}><strong>{label}</strong></td>
    <td style={cellValue}>{value || 'Not provided'}</td>
  </tr>
)

const InquiryNotificationEmail = ({ name, company, email, phone, message }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New inquiry from {name || 'a visitor'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h2}>New Inquiry</Heading>

        <table width="100%" cellPadding="0" cellSpacing="0" style={{ borderCollapse: 'collapse' as const, marginBottom: '24px' }}>
          <tbody>
            <Row label="Name" value={name} />
            <Row label="Firm / Studio" value={company} />
            <Row label="Email" value={email} />
            <Row label="Phone" value={phone} />
          </tbody>
        </table>

        <Text style={msgLabel}>Message</Text>
        <Section style={quoteBox}>
          <Text style={quoteBody}>{message || ''}</Text>
        </Section>

        <Hr style={divider} />
        <Text style={footerSmall}>
          Maison Affluency Singapore — <em>Unique by Design</em>
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: InquiryNotificationEmail,
  subject: (data: Record<string, any>) => {
    const n = data?.name || 'visitor'
    const c = data?.company ? ` — ${data.company}` : ''
    return data?.subject || `New Inquiry from ${n}${c}`
  },
  to: 'concierge@myaffluency.com',
  displayName: 'Inquiry Notification (Internal)',
  previewData: {
    name: 'Alexandra Chen',
    company: 'Studio Chen',
    email: 'alexandra@studiochen.com',
    phone: '+65 9123 4567',
    message: 'I would love to learn more about the Garnier & Linker Orion pendant for a residential project in Singapore.',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "Georgia, 'Playfair Display', serif" }
const container = { padding: '40px 20px', maxWidth: '600px', margin: '0 auto', backgroundColor: '#faf9f7' }
const h2 = { color: '#1a1a1a', fontSize: '20px', marginBottom: '24px', borderBottom: '2px solid #C9A962', paddingBottom: '12px' }
const cellLabel = { padding: '12px 0', borderBottom: '1px solid #e8e4de', color: '#666666', width: '140px', fontSize: '14px' }
const cellValue = { padding: '12px 0', borderBottom: '1px solid #e8e4de', color: '#1a1a1a', fontSize: '14px' }
const msgLabel = { color: '#1a1a1a', fontSize: '16px', marginBottom: '12px' }
const quoteBox = { backgroundColor: '#ffffff', borderLeft: '3px solid #C9A962', padding: '16px 20px', margin: '0 0 24px' }
const quoteBody = { color: '#333333', lineHeight: '1.7', fontSize: '14px', margin: '0', whiteSpace: 'pre-wrap' as const }
const divider = { border: 'none', borderTop: '1px solid #e8e4de', margin: '32px 0 16px' }
const footerSmall = { color: '#888888', fontSize: '12px', lineHeight: '1.6', textAlign: 'center' as const }
