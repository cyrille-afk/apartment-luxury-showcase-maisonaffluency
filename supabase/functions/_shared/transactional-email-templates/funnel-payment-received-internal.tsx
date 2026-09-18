/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.tsx'

interface Props {
  label?: string
  amountFormatted?: string
  currency?: string
  payerEmail?: string | null
  quoteRef?: string | null
  cardStage?: string | null
  sessionId?: string
  paidAt?: string
  funnelUrl?: string
}

const FunnelPaymentReceivedInternalEmail = ({
  label = 'Maison Affluency payment',
  amountFormatted = '—',
  currency = 'USD',
  payerEmail = null,
  quoteRef = null,
  cardStage = null,
  sessionId = '—',
  paidAt = new Date().toISOString(),
  funnelUrl = 'https://www.maisonaffluency.com/trade/admin/sales-funnel',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Payment received — {label} ({amountFormatted} {currency})</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Payment received via Stripe</Heading>
        <Text style={text}>
          A Stripe checkout payment has cleared. The corresponding card in the Sales Funnel
          has been moved to <strong>Awaiting Settlement</strong> or <strong>Conversions</strong>.
        </Text>

        <Section style={box}>
          <table width="100%" cellPadding="0" cellSpacing="0" style={{ borderCollapse: 'collapse' as const }}>
            <tbody>
              <tr>
                <td style={cell}>Description</td>
                <td style={cellRight}><strong>{label}</strong></td>
              </tr>
              <tr>
                <td style={cell}>Amount received</td>
                <td style={cellRight}>{amountFormatted} {currency}</td>
              </tr>
              {payerEmail ? (
                <tr>
                  <td style={cell}>Payer email</td>
                  <td style={cellRight}>{payerEmail}</td>
                </tr>
              ) : null}
              {quoteRef ? (
                <tr>
                  <td style={cell}>Quote reference</td>
                  <td style={cellRight}>{quoteRef}</td>
                </tr>
              ) : null}
              {cardStage ? (
                <tr>
                  <td style={cell}>Pipeline stage</td>
                  <td style={cellRight}>{cardStage}</td>
                </tr>
              ) : null}
              <tr>
                <td style={cell}>Stripe session</td>
                <td style={cellRight}><code style={code}>{sessionId}</code></td>
              </tr>
              <tr>
                <td style={cell}>Paid at</td>
                <td style={cellRight}>{paidAt}</td>
              </tr>
            </tbody>
          </table>
        </Section>

        <Section style={buttonSection}>
          <Button style={button} href={funnelUrl}>Open Sales Funnel</Button>
        </Section>

        <Hr style={divider} />
        <Text style={smallText}>Internal notification — Maison Affluency Trade Desk.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: FunnelPaymentReceivedInternalEmail,
  subject: (data: Record<string, any>) =>
    `Payment received — ${data?.label ?? 'Sales Funnel card'} (${data?.amountFormatted ?? '—'} ${data?.currency ?? ''})`,
  displayName: 'Sales Funnel Payment Received (internal)',
  previewData: {
    label: 'Erato Wall Light — Agni HK',
    amountFormatted: '185,407.19',
    currency: 'HKD',
    payerEmail: 'info@agnihk.com',
    quoteRef: 'MA-Q-2026-0918-001',
    cardStage: 'Awaiting Settlement',
    sessionId: 'cs_live_...',
    paidAt: '18 Sep 2026, 15:13 SGT',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '32px 24px', maxWidth: '620px', margin: '0 auto', backgroundColor: '#faf9f7' }
const h1 = { color: '#1a1a1a', fontSize: '20px', marginBottom: '16px' }
const text = { color: '#333333', lineHeight: '1.7', fontSize: '14px', marginBottom: '16px' }
const smallText = { color: '#888888', fontSize: '12px' }
const box = { backgroundColor: '#ffffff', border: '1px solid #e8e4de', borderRadius: '6px', padding: '16px 20px' }
const cell = { color: '#555555', fontSize: '13px', padding: '6px 8px 6px 0', borderBottom: '1px solid #f0ece6', fontFamily: 'Arial, sans-serif' }
const cellRight = { color: '#1a1a1a', fontSize: '13px', padding: '6px 0', textAlign: 'right' as const, borderBottom: '1px solid #f0ece6', fontFamily: 'Arial, sans-serif' }
const code = { fontFamily: 'monospace', fontSize: '11px', color: '#555555' }
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
