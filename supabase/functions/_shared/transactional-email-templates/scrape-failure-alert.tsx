/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.tsx'

interface Failure {
  status_code: number | null
  body: string
  created: string
}

interface Props {
  failures?: Failure[]
  windowMinutes?: number
}

const ScrapeFailureAlertEmail = ({ failures = [], windowMinutes = 60 }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>scrape-products returned {failures.length} failure(s) in the last {windowMinutes}m</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>⚠️ scrape-products failure</Heading>
        <Text style={text}>
          The daily <code style={code}>scrape-products</code> cron job returned <strong>{failures.length}</strong> non-2xx response(s) in the last {windowMinutes} minute(s).
        </Text>

        {failures.map((f, i) => (
          <Section key={i} style={card}>
            <Text style={meta}>
              <strong>HTTP {f.status_code ?? 'timeout'}</strong> &middot; {new Date(f.created).toUTCString()}
            </Text>
            <pre style={pre}>{f.body || '(empty body)'}</pre>
          </Section>
        ))}

        <Hr style={divider} />
        <Text style={textMuted}>
          Check the edge function logs and verify <code style={code}>CRON_SECRET</code> matches the value embedded in the pg_cron job headers.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ScrapeFailureAlertEmail,
  subject: (data) => `⚠️ scrape-products failed (${data.failures?.length ?? 0}× in ${data.windowMinutes ?? 60}m)`,
  displayName: 'Scrape Failure Alert',
  to: 'cyrille@maisonaffluency.com',
  previewData: {
    windowMinutes: 60,
    failures: [
      { status_code: 401, body: '{"error":"Unauthorized"}', created: new Date().toISOString() },
    ],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }
const container = { padding: '32px 24px', maxWidth: '640px', margin: '0 auto' }
const h1 = { color: '#b91c1c', fontSize: '20px', marginBottom: '16px' }
const text = { color: '#1a1a1a', lineHeight: '1.6', fontSize: '14px', marginBottom: '16px' }
const textMuted = { color: '#666', lineHeight: '1.6', fontSize: '12px', marginTop: '16px' }
const card = { backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '12px 14px', marginBottom: '12px' }
const meta = { color: '#7f1d1d', fontSize: '12px', margin: '0 0 6px' }
const pre = { fontSize: '11px', color: '#1a1a1a', whiteSpace: 'pre-wrap' as const, wordBreak: 'break-all' as const, margin: '0', fontFamily: 'inherit' }
const code = { backgroundColor: '#f3f4f6', padding: '1px 5px', borderRadius: '3px', fontSize: '12px' }
const divider = { border: 'none', borderTop: '1px solid #e5e7eb', margin: '20px 0' }
