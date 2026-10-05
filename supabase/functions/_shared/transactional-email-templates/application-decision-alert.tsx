/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Text, Img, Hr, Section } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.tsx'

interface Props {
  decision?: 'approved' | 'rejected'
  applicantName?: string
  companyName?: string
  applicantEmail?: string
  subjectSent?: string
  reviewerEmail?: string
  sentAt?: string
}

const label = (d?: string) => (d === 'rejected' ? 'Decline' : 'Approval')

const ApplicationDecisionAlert = ({ decision, applicantName, companyName, applicantEmail, subjectSent, reviewerEmail, sentAt }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`Internal: ${label(decision)} notice sent to ${companyName || applicantEmail || 'an applicant'}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <Img src="https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/affluency-email-wordmark.jpg" alt="Affluency - Unique by Design" width="420" style={{ margin: '0 auto', maxWidth: '100%', height: 'auto' }} />
        </Section>
        <Hr style={divider} />
        <Heading style={heading}>{label(decision)} notice sent</Heading>
        <Text style={text}>A Trade Program {decision === 'rejected' ? 'decline' : 'approval'} notification has just been queued for the applicant below.</Text>
        <Text style={row}><strong>Practice:</strong> {companyName || '—'}</Text>
        <Text style={row}><strong>Contact:</strong> {applicantName || '—'}</Text>
        <Text style={row}><strong>Recipient:</strong> {applicantEmail || '—'}</Text>
        <Text style={row}><strong>Subject sent:</strong> {subjectSent || 'Default template subject'}</Text>
        <Text style={row}><strong>Reviewed by:</strong> {reviewerEmail || '—'}</Text>
        <Text style={row}><strong>Sent:</strong> {sentAt || '—'}</Text>
        <Hr style={divider} />
        <Text style={small}>Internal notice for the Maison Affluency team only.</Text>
      </Container>
    </Body>
  </Html>
)

const base = {
  component: ApplicationDecisionAlert,
  subject: (d: Record<string, unknown>) => `Internal: ${label(d.decision as string)} sent to ${(d.companyName as string) || (d.applicantEmail as string) || 'applicant'}`,
  previewData: { decision: 'approved', applicantName: 'Jane Smith', companyName: 'Atelier Design Co.', applicantEmail: 'jane@example.com', subjectSent: 'Welcome to the Maison Affluency Trade Program', reviewerEmail: 'cyrille@maisonaffluency.com', sentAt: '6 Oct 2026, 00:24 SGT' },
}

export const conciergeTemplate = { ...base, to: 'concierge@maisonaffluency.com', displayName: 'Application decision alert (Concierge)' } satisfies TemplateEntry
export const cyrilleTemplate = { ...base, to: 'cyrille@maisonaffluency.com', displayName: 'Application decision alert (Cyrille)' } satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "Georgia, 'Playfair Display', serif" }
const container = { padding: '40px 20px', maxWidth: '600px', margin: '0 auto', backgroundColor: '#faf9f7' }
const logoSection = { textAlign: 'center' as const, marginBottom: '32px', paddingBottom: '24px' }
const divider = { border: 'none', borderTop: '1px solid #e8e4de', margin: '0 0 24px' }
const heading = { color: '#1a1a1a', fontSize: '22px', marginBottom: '20px' }
const text = { color: '#333333', lineHeight: '1.8', marginBottom: '16px', fontSize: '15px' }
const row = { color: '#333333', lineHeight: '1.6', margin: '0 0 6px', fontSize: '14px' }
const small = { color: '#888888', fontSize: '12px', lineHeight: '1.6' }
