/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.tsx'

interface Row {
  stage?: string
  label?: string
  age?: string
  url?: string
}

interface Props {
  rows?: Row[]
  funnelUrl?: string
}

const FunnelStallAlertEmail = ({ rows = [], funnelUrl = 'https://www.maisonaffluency.com/trade/admin/sales-funnel' }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{rows.length} item(s) stalled in the sales funnel</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Sales funnel — stalled items</Heading>
        <Text style={text}>
          The following items have not progressed and require attention from the trade desk.
        </Text>

        <Section style={box}>
          <table width="100%" cellPadding="0" cellSpacing="0" style={{ borderCollapse: 'collapse' as const }}>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td style={cell}>{r.stage}</td>
                  <td style={cell}>{r.label}</td>
                  <td style={cellRight}>{r.age}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section style={buttonSection}>
          <Button style={button} href={funnelUrl}>Open the funnel</Button>
        </Section>

        <Hr style={divider} />
        <Text style={smallText}>Automatic daily sweep — Maison Affluency Trade Desk.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: FunnelStallAlertEmail,
  subject: (data: Record<string, any>) =>
    `Sales funnel — ${Array.isArray(data?.rows) ? data.rows.length : 0} stalled item(s)`,
  displayName: 'Sales Funnel Stall Alert (internal)',
  previewData: {
    rows: [
      { stage: 'Quote never sent', label: 'Agni HK — Erato Wall Light', age: '4 days' },
      { stage: 'Request not quoted', label: 'Private client — Console Cheval', age: '3 days' },
    ],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '32px 24px', maxWidth: '620px', margin: '0 auto', backgroundColor: '#faf9f7' }
const h1 = { color: '#1a1a1a', fontSize: '20px', marginBottom: '16px' }
const text = { color: '#333333', lineHeight: '1.7', fontSize: '14px', marginBottom: '16px' }
const smallText = { color: '#888888', fontSize: '12px' }
const box = { backgroundColor: '#ffffff', border: '1px solid #e8e4de', borderRadius: '6px', padding: '16px 20px' }
const cell = { color: '#333333', fontSize: '13px', padding: '6px 8px 6px 0', borderBottom: '1px solid #f0ece6' }
const cellRight = { color: '#777777', fontSize: '13px', padding: '6px 0', textAlign: 'right' as const, borderBottom: '1px solid #f0ece6' }
const buttonSection = { textAlign: 'center' as const, margin: '28px 0' }
const button = {
  display: 'inline-block',
  padding: '12px 28px',
  backgroundColor: '#1a1a1a',
  color: '#ffffff',
  textDecoration: 'none',
  fontSize: '12px',
  letterSpacing: '0.15em',
  textTransform: 'uppercase' as const,
  borderRadius: '24px',
}
const divider = { border: 'none', borderTop: '1px solid #e8e4de', margin: '24px 0 12px' }
