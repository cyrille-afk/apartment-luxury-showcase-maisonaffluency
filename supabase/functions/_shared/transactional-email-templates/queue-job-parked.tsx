/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.tsx'

interface Props {
  reference?: string
  clientName?: string
  clientEmail?: string | null
  failedService?: string
  errorMessage?: string
  eventId?: string
  eventType?: string
  attempts?: number
  maxAttempts?: number
  timestamp?: string
  adminUrl?: string
  slackStatus?: string
}

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <Text style={row}><span style={key}>{label}</span> {value}</Text>
)

const QueueJobParkedEmail = ({
  reference = '—', clientName = 'Unknown client', clientEmail = null,
  failedService = 'Queue Worker', errorMessage = '(no error message)',
  eventId = '—', eventType = '—', attempts = 0, maxAttempts = 0,
  timestamp = new Date().toISOString(), adminUrl = 'https://www.maisonaffluency.com/trade/admin/sales-funnel',
  slackStatus = 'not_configured',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Parked job — {failedService} failed for {reference}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>🛑 Parked job — manual review required</Heading>
        <Text style={text}>
          A background job exhausted its full retry schedule (up to 2 hours of backoff) and has been
          parked. The order below is <strong>not fully processed</strong> and needs a human.
        </Text>

        <Section style={card}>
          <Row label="Order / Quote" value={reference} />
          <Row label="Client" value={clientName} />
          {clientEmail ? <Row label="Client email" value={clientEmail} /> : null}
          <Row label="Failed service" value={<strong>{failedService}</strong>} />
          <Row label="Event" value={`${eventType} · ${eventId}`} />
          <Row label="Attempts" value={`${attempts} of ${maxAttempts} (exhausted)`} />
          <Row label="Timestamp" value={timestamp} />
          <Row label="Slack alert" value={slackStatus} />
        </Section>

        <Text style={label}>Error</Text>
        <pre style={pre}>{errorMessage}</pre>

        <Button style={button} href={adminUrl}>Open in admin dashboard</Button>

        <Hr style={divider} />
        <Text style={muted}>
          Sent automatically by the asynchronous queue worker (process-webhook-events).
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: QueueJobParkedEmail,
  subject: (data) =>
    `🛑 PARKED JOB — ${data.failedService ?? 'queue worker'} failed (${data.reference ?? 'unknown'})`,
  displayName: 'Queue Job Parked (ops alert)',
  to: 'cyrille@maisonaffluency.com',
  previewData: {
    reference: 'f05c2a2d-527f-41af-b7ae-efe2e820ce6e',
    clientName: 'Agni Studio',
    clientEmail: 'info@agnihk.com',
    failedService: 'Supplier PO Dispatch',
    errorMessage: 'PDF generation failed: font embedding error (WinAnsi cannot encode "é")',
    eventId: 'evt_1Q2w3e4r',
    eventType: 'checkout.session.completed',
    attempts: 5,
    maxAttempts: 5,
    timestamp: new Date().toISOString(),
    adminUrl: 'https://www.maisonaffluency.com/trade/admin/sales-funnel',
    slackStatus: 'failed',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }
const container = { padding: '32px 24px', maxWidth: '640px', margin: '0 auto' }
const h1 = { color: '#b91c1c', fontSize: '20px', marginBottom: '16px' }
const text = { color: '#1a1a1a', lineHeight: '1.6', fontSize: '14px', marginBottom: '16px' }
const card = { backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '12px 14px', marginBottom: '16px' }
const row = { color: '#1a1a1a', fontSize: '13px', margin: '0 0 6px' }
const key = { color: '#7f1d1d', display: 'inline-block' as const, minWidth: '130px' }
const label = { color: '#7f1d1d', fontSize: '12px', margin: '0 0 6px', textTransform: 'uppercase' as const }
const pre = { fontSize: '11px', color: '#1a1a1a', whiteSpace: 'pre-wrap' as const, wordBreak: 'break-all' as const, backgroundColor: '#f3f4f6', padding: '10px', borderRadius: '4px', fontFamily: 'inherit' }
const button = { backgroundColor: '#b91c1c', color: '#ffffff', padding: '11px 20px', borderRadius: '4px', fontSize: '13px', textDecoration: 'none', display: 'inline-block' as const, marginTop: '8px' }
const divider = { border: 'none', borderTop: '1px solid #e5e7eb', margin: '20px 0' }
const muted = { color: '#666', fontSize: '12px' }
