/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.tsx'

interface Props {
  headline?: string
  reasons?: string[]
  bootOk?: boolean
  databaseOk?: boolean
  pending?: number
  oldestPendingMinutes?: number
  lastSuccessAt?: string | null
  consecutiveFailures?: number
  errorMessage?: string | null
  timestamp?: string
  adminUrl?: string
  slackStatus?: string
}

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <Text style={row}><span style={key}>{label}</span> {value}</Text>
)

const WebhookWorkerUnhealthyEmail = ({
  headline = 'Webhook worker is unhealthy',
  reasons = [],
  bootOk = true,
  databaseOk = true,
  pending = 0,
  oldestPendingMinutes = 0,
  lastSuccessAt = null,
  consecutiveFailures = 0,
  errorMessage = null,
  timestamp = new Date().toISOString(),
  adminUrl = 'https://www.maisonaffluency.com/trade/admin/queue',
  slackStatus = 'not_configured',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{headline}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>⚠️ {headline}</Heading>
        <Text style={text}>
          The asynchronous payment queue worker failed its scheduled health check. Paid orders may
          be sitting unprocessed (no confirmations, no supplier purchase orders).
        </Text>

        <Section style={card}>
          <Row label="Startup check" value={bootOk ? 'OK' : 'FAILED'} />
          <Row label="Database" value={databaseOk ? 'OK' : 'FAILED'} />
          <Row label="Pending events" value={pending} />
          <Row label="Oldest pending" value={`${oldestPendingMinutes} min`} />
          <Row label="Last successful run" value={lastSuccessAt ?? 'never recorded'} />
          <Row label="Consecutive failures" value={consecutiveFailures} />
          <Row label="Checked at" value={timestamp} />
          <Row label="Slack alert" value={slackStatus} />
        </Section>

        {reasons.length ? (
          <>
            <Text style={label}>Reasons</Text>
            <pre style={pre}>{reasons.join('\n')}</pre>
          </>
        ) : null}

        {errorMessage ? (
          <>
            <Text style={label}>Error</Text>
            <pre style={pre}>{errorMessage}</pre>
          </>
        ) : null}

        <Button style={button} href={adminUrl}>Open the queue control centre</Button>

        <Hr style={divider} />
        <Text style={muted}>Sent automatically by monitor-webhook-worker.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WebhookWorkerUnhealthyEmail,
  subject: (data) => `⚠️ QUEUE WORKER UNHEALTHY — ${data.headline ?? 'health check failed'}`,
  displayName: 'Webhook Worker Unhealthy (ops alert)',
  to: 'cyrille@maisonaffluency.com',
  previewData: {
    headline: 'Worker startup check failed',
    reasons: ['Startup check failed: Stripe startup check failed: no usable secret key'],
    bootOk: false,
    databaseOk: true,
    pending: 4,
    oldestPendingMinutes: 42,
    lastSuccessAt: new Date(Date.now() - 3600_000).toISOString(),
    consecutiveFailures: 3,
    errorMessage: 'Stripe startup check failed: no usable secret key',
    timestamp: new Date().toISOString(),
    adminUrl: 'https://www.maisonaffluency.com/trade/admin/queue',
    slackStatus: 'not_configured',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }
const container = { padding: '32px 24px', maxWidth: '640px', margin: '0 auto' }
const h1 = { color: '#b45309', fontSize: '20px', marginBottom: '16px' }
const text = { color: '#1a1a1a', lineHeight: '1.6', fontSize: '14px', marginBottom: '16px' }
const card = { backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '12px 14px', marginBottom: '16px' }
const row = { color: '#1a1a1a', fontSize: '13px', margin: '0 0 6px' }
const key = { color: '#92400e', display: 'inline-block' as const, minWidth: '150px' }
const label = { color: '#92400e', fontSize: '12px', margin: '0 0 6px', textTransform: 'uppercase' as const }
const pre = { fontSize: '11px', color: '#1a1a1a', whiteSpace: 'pre-wrap' as const, wordBreak: 'break-all' as const, backgroundColor: '#f3f4f6', padding: '10px', borderRadius: '4px', fontFamily: 'inherit' }
const button = { backgroundColor: '#b45309', color: '#ffffff', padding: '11px 20px', borderRadius: '4px', fontSize: '13px', textDecoration: 'none', display: 'inline-block' as const, marginTop: '8px' }
const divider = { border: 'none', borderTop: '1px solid #e5e7eb', margin: '20px 0' }
const muted = { color: '#666', fontSize: '12px' }
