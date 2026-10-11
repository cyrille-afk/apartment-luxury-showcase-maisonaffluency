/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.tsx'

interface Failure {
  template: string
  recipient: string
  status: string
  error?: string | null
  at: string
}

interface Props {
  count?: number
  failures?: Failure[]
  adminUrl?: string
  slackStatus?: string
}

const ConciergeDeliveryAlertEmail = ({
  count = 0,
  failures = [],
  adminUrl = 'https://www.maisonaffluency.com/trade/admin/email-log',
  slackStatus = 'not_configured',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`${count} concierge email${count === 1 ? '' : 's'} failed to deliver`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>⚠️ {count} concierge email{count === 1 ? '' : 's'} not delivered</Heading>
        <Text style={text}>
          These inquiry or quote emails did not reach their recipient. Clients or the concierge
          inbox may be missing messages — follow up manually.
        </Text>
        {failures.slice(0, 25).map((f, i) => (
          <Section key={i} style={card}>
            <Text style={row}><span style={key}>Email</span> {f.template}</Text>
            <Text style={row}><span style={key}>To</span> {f.recipient}</Text>
            <Text style={row}><span style={key}>Status</span> {f.status}</Text>
            <Text style={row}><span style={key}>When</span> {f.at}</Text>
            {f.error ? <Text style={row}><span style={key}>Error</span> {f.error}</Text> : null}
          </Section>
        ))}
        <Button style={button} href={adminUrl}>Open admin</Button>
        <Hr style={divider} />
        <Text style={muted}>Sent automatically by monitor-concierge-email. Slack: {slackStatus}.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ConciergeDeliveryAlertEmail,
  subject: (data) => `⚠️ ${data.count ?? 0} concierge email(s) failed to deliver`,
  displayName: 'Concierge Delivery Failure (ops alert)',
  previewData: {
    count: 1,
    failures: [{ template: 'inquiry-notification', recipient: 'concierge@maisonaffluency.com', status: 'suppressed', error: 'Recipient on suppression list (bounce)', at: new Date().toISOString() }],
    slackStatus: 'not_configured',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }
const container = { padding: '32px 24px', maxWidth: '640px', margin: '0 auto' }
const h1 = { color: '#b45309', fontSize: '20px', marginBottom: '16px' }
const text = { color: '#1a1a1a', lineHeight: '1.6', fontSize: '14px', marginBottom: '16px' }
const card = { backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '10px 14px', marginBottom: '10px' }
const row = { color: '#1a1a1a', fontSize: '13px', margin: '0 0 4px' }
const key = { color: '#92400e', display: 'inline-block' as const, minWidth: '70px' }
const button = { backgroundColor: '#b45309', color: '#ffffff', padding: '11px 20px', borderRadius: '4px', fontSize: '13px', textDecoration: 'none', display: 'inline-block' as const, marginTop: '8px' }
const divider = { border: 'none', borderTop: '1px solid #e5e7eb', margin: '20px 0' }
const muted = { color: '#666', fontSize: '12px' }
