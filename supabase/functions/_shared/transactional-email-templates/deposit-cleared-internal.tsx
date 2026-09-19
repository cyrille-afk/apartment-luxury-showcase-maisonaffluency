/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.tsx'
import { formatCurrency } from './currency.ts'

interface Props {
  headline?: string
  clientName?: string
  quoteRef?: string
  amountFormatted?: string
  currency?: string
  itemsSummary?: string
  payerEmail?: string | null
  paymentKind?: string
  isLive?: boolean
  paidAt?: string
  funnelUrl?: string
}

const DepositClearedInternalEmail = ({
  headline = 'NEW DEPOSIT CLEARED',
  clientName = 'Client',
  quoteRef = '—',
  amountFormatted = '—',
  currency = 'USD',
  itemsSummary = '—',
  payerEmail = null,
  paymentKind = 'deposit',
  isLive = true,
  paidAt = new Date().toISOString(),
  funnelUrl = 'https://www.maisonaffluency.com/trade/admin/sales-funnel',
}: Props) => (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>
        {isLive ? '' : '[TEST ALERT] '}Deposit cleared — Quote {quoteRef} · {clientName} ({formatCurrency(amountFormatted, currency)})
      </Preview>
      <Body style={main}>
      <Container style={container}>
        {!isLive ? <Text style={testTag}>[TEST ALERT] — triggered from a Stripe test-mode transaction</Text> : null}
        <Heading style={h1}>🚨 {headline}</Heading>
        <Text style={text}>
          Quote <strong>{quoteRef}</strong> for <strong>{clientName}</strong> has successfully paid{' '}
          <strong>{formatCurrency(amountFormatted, currency)}</strong> via Stripe
          {paymentKind === 'balance' ? ' (final balance)' : ' (deposit)'}.
        </Text>

        <Section style={box}>
          <table width="100%" cellPadding="0" cellSpacing="0" style={{ borderCollapse: 'collapse' as const }}>
            <tbody>
              <tr>
                <td style={cell}>Items</td>
                <td style={cellRight}><strong>{itemsSummary}</strong></td>
              </tr>
              <tr>
                <td style={cell}>Quote</td>
                <td style={cellRight}>{quoteRef}</td>
              </tr>
              <tr>
                <td style={cell}>Client</td>
                <td style={cellRight}>{clientName}</td>
              </tr>
              {payerEmail ? (
                <tr>
                  <td style={cell}>Payer email</td>
                  <td style={cellRight}>{payerEmail}</td>
                </tr>
              ) : null}
              <tr>
                <td style={cell}>Amount cleared</td>
                <td style={cellRight}>{formatCurrency(amountFormatted, currency)}</td>
              </tr>
              <tr>
                <td style={cell}>Payment type</td>
                <td style={cellRight}>{paymentKind === 'balance' ? 'Final balance' : 'Deposit'}</td>
              </tr>
              <tr>
                <td style={cell}>Mode</td>
                <td style={cellRight}>{isLive ? 'LIVE' : 'TEST'}</td>
              </tr>
              <tr>
                <td style={cell}>Paid at</td>
                <td style={cellRight}>{paidAt}</td>
              </tr>
            </tbody>
          </table>
        </Section>

        <Section style={buttonSection}>
          <Button style={button} href={funnelUrl}>Open Sales Funnel Dashboard</Button>
        </Section>

        <Hr style={divider} />
        <Text style={smallText}>Internal notification — Maison Affluency Trade Desk · Fulfillment & Logistics.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: DepositClearedInternalEmail,
  subject: (data: Record<string, any>) =>
    `${data?.isLive === false ? '[TEST ALERT] ' : ''}🚨 NEW DEPOSIT CLEARED — Quote ${data?.quoteRef ?? '—'} · ${data?.clientName ?? 'Client'} (${formatCurrency(data?.amountFormatted, data?.currency)})`,
  displayName: 'Deposit Cleared (internal team alert)',
  previewData: {
    headline: 'NEW DEPOSIT CLEARED',
    clientName: 'AGNI Limited',
    quoteRef: 'f05c2a2d',
    amountFormatted: '185,407.19',
    currency: 'HKD',
    itemsSummary: '4 × Felix Agostini Erato Wall Lights',
    payerEmail: 'info@agnihk.com',
    paymentKind: 'deposit',
    isLive: true,
    paidAt: '19 Sep 2026, 12:07 SGT',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '32px 24px', maxWidth: '620px', margin: '0 auto', backgroundColor: '#faf9f7' }
const h1 = { color: '#1a1a1a', fontSize: '20px', marginBottom: '16px' }
const text = { color: '#333333', lineHeight: '1.7', fontSize: '14px', marginBottom: '16px' }
const smallText = { color: '#888888', fontSize: '12px' }
const testTag = {
  color: '#92400e',
  backgroundColor: '#fef3c7',
  border: '1px solid #f59e0b',
  borderRadius: '4px',
  padding: '8px 12px',
  fontSize: '12px',
  fontWeight: 'bold' as const,
  letterSpacing: '0.05em',
  marginBottom: '12px',
}
const box = { backgroundColor: '#ffffff', border: '1px solid #e8e4de', borderRadius: '6px', padding: '16px 20px' }
const cell = { color: '#555555', fontSize: '13px', padding: '6px 8px 6px 0', borderBottom: '1px solid #f0ece6', fontFamily: 'Arial, sans-serif' }
const cellRight = { color: '#1a1a1a', fontSize: '13px', padding: '6px 0', textAlign: 'right' as const, borderBottom: '1px solid #f0ece6', fontFamily: 'Arial, sans-serif' }
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
