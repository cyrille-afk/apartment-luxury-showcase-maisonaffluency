/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Img, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.tsx'

const SITE_NAME = 'Maison Affluency'

interface LineItem {
  name: string
  quantity: number
  msrpFormatted: string
}

interface CommissionStatementProps {
  designerName?: string
  studioName?: string | null
  quoteNumber?: string
  endClientName?: string | null
  deliveredOn?: string
  currency?: string
  subtotalFormatted?: string
  commissionPct?: number
  commissionFormatted?: string
  payoutMethod?: string | null
  payoutCurrency?: string | null
  commissionPayoutFormatted?: string | null
  fxRate?: number | null
  fxSource?: string | null
  expectedWireOn?: string
  items?: LineItem[]
}

const CommissionStatementEmail = ({
  designerName,
  studioName,
  quoteNumber,
  endClientName,
  deliveredOn,
  currency = 'USD',
  subtotalFormatted = '—',
  commissionPct = 0,
  commissionFormatted = '—',
  payoutMethod,
  payoutCurrency,
  commissionPayoutFormatted,
  fxRate,
  fxSource,
  expectedWireOn,
  items = [],
}: CommissionStatementProps) => {
  const showFx = !!(payoutCurrency && payoutCurrency.toUpperCase() !== currency.toUpperCase() && fxRate && commissionPayoutFormatted)
  return (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Commission statement for order {quoteNumber} — {commissionFormatted} {currency}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <Img
            src="https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/affluency-email-wordmark.jpg"
            alt="Affluency — Unique by Design"
            width="420"
            style={logo}
          />
        </Section>
        <Hr style={divider} />

        <Heading style={h1}>
          {designerName ? `Dear ${designerName},` : 'Dear Trade Partner,'}
        </Heading>

        <Text style={text}>
          Your order <strong>{quoteNumber}</strong>
          {endClientName ? <> for <strong>{endClientName}</strong></> : null} was marked
          delivered on <strong>{deliveredOn}</strong>. Please find your commission
          statement below.
        </Text>

        <Section style={statementBox}>
          <table width="100%" cellPadding="0" cellSpacing="0" style={{ borderCollapse: 'collapse' as const }}>
            <tbody>
              {items.map((item, i) => (
                <tr key={i}>
                  <td style={lineCell}>
                    <Text style={lineName}>{item.name}</Text>
                    <Text style={lineQty}>Qty {item.quantity}</Text>
                  </td>
                  <td style={lineAmount}>{item.msrpFormatted}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={2}><Hr style={dividerSubtle} /></td>
              </tr>
              <tr>
                <td style={totalLabel}>Subtotal MSRP</td>
                <td style={totalAmount}>{subtotalFormatted} {currency}</td>
              </tr>
              <tr>
                <td style={totalLabel}>Commission rate</td>
                <td style={totalAmount}>{commissionPct.toFixed(1)}%</td>
              </tr>
              <tr>
                <td colSpan={2}><Hr style={dividerSubtle} /></td>
              </tr>
              <tr>
                <td style={grandLabel}>Commission due</td>
                <td style={grandAmount}>{commissionFormatted} {currency}</td>
              </tr>
              {showFx ? (
                <>
                  <tr>
                    <td style={totalLabel}>FX rate ({currency} → {payoutCurrency})</td>
                    <td style={totalAmount}>{Number(fxRate).toFixed(4)}</td>
                  </tr>
                  <tr>
                    <td style={totalLabel}>Source</td>
                    <td style={totalAmount}>{fxSource}</td>
                  </tr>
                  <tr>
                    <td style={grandLabel}>Wired amount</td>
                    <td style={grandAmount}>{commissionPayoutFormatted} {payoutCurrency}</td>
                  </tr>
                </>
              ) : null}
            </tbody>
          </table>
        </Section>

        <Text style={text}>
          {payoutMethod
            ? <>The wire will route to <strong>{payoutMethod}</strong>{expectedWireOn ? <>, expected to clear on <strong>{expectedWireOn}</strong></> : null}.{showFx ? <> The exchange rate above was locked on delivery; the wired amount is final and not subject to further FX adjustment.</> : null}</>
            : <>Add a verified payout account in your Studio settings to receive the wire.</>}
        </Text>

        <Section style={buttonSection}>
          <Button style={button} href={`https://maisonaffluency.com/trade/orders`}>
            View Order Timeline
          </Button>
        </Section>

        <Text style={footer}>
          With thanks,<br />
          <strong>The {SITE_NAME} Trade Desk</strong>
        </Text>

        <Hr style={divider} />
        <table width="100%" cellPadding="0" cellSpacing="0" style={{ borderCollapse: 'collapse' as const }}>
          <tbody>
            <tr>
              <td align="right" style={{ verticalAlign: 'middle', paddingRight: '8px' }}>
                <p style={footerSmall}>
                  {SITE_NAME} Singapore<br />
                  <em>Unique by Design</em>
                </p>
              </td>
              <td align="right" style={{ verticalAlign: 'middle', width: '48px' }}>
                <img
                  src="https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/affluency-email-logo.jpg"
                  alt="Affluency"
                  width="40"
                  height="40"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </Container>
    </Body>
  </Html>
  )
}

export const template = {
  component: CommissionStatementEmail,
  subject: (data: Record<string, any>) =>
    `Commission statement — ${data?.quoteNumber ?? 'Order'} delivered`,
  displayName: 'Trade Commission Statement',
  previewData: {
    designerName: 'Jane Smith',
    studioName: 'Atelier Design Co.',
    quoteNumber: 'QU-1042',
    endClientName: 'Mr & Mrs Laurent',
    deliveredOn: '13 Jun 2026',
    currency: 'USD',
    subtotalFormatted: '48,250.00',
    commissionPct: 15,
    commissionFormatted: '7,237.50',
    payoutMethod: 'Crédit Mutuel · EUR · ••4421',
    expectedWireOn: '18 Jun 2026',
    items: [
      { name: 'Salvagni — Sesta low table', quantity: 1, msrpFormatted: '12,400.00' },
      { name: 'Pouenat — Calliope sconce', quantity: 4, msrpFormatted: '35,850.00' },
    ],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "Georgia, 'Playfair Display', serif" }
const container = { padding: '40px 20px', maxWidth: '600px', margin: '0 auto', backgroundColor: '#faf9f7' }
const logoSection = { textAlign: 'center' as const, marginBottom: '32px', paddingBottom: '24px' }
const logo = { margin: '0 auto' }
const divider = { border: 'none', borderTop: '1px solid #e8e4de', margin: '0 0 24px' }
const dividerSubtle = { border: 'none', borderTop: '1px solid #ece8e1', margin: '8px 0' }
const h1 = { color: '#1a1a1a', fontSize: '24px', marginBottom: '24px', fontFamily: "Georgia, 'Playfair Display', serif" }
const text = { color: '#333333', lineHeight: '1.8', marginBottom: '20px', fontSize: '15px' }
const statementBox = {
  backgroundColor: '#ffffff',
  border: '1px solid #e8e4de',
  borderRadius: '6px',
  padding: '20px 24px',
  margin: '24px 0',
}
const lineCell = { padding: '8px 0', verticalAlign: 'top' as const }
const lineName = { color: '#1a1a1a', fontSize: '14px', margin: '0', fontWeight: 600 }
const lineQty = { color: '#888888', fontSize: '12px', margin: '2px 0 0', fontFamily: 'Arial, sans-serif' }
const lineAmount = { color: '#1a1a1a', fontSize: '14px', textAlign: 'right' as const, verticalAlign: 'top' as const, padding: '8px 0', fontFamily: 'Arial, sans-serif' }
const totalLabel = { color: '#555555', fontSize: '13px', padding: '6px 0', fontFamily: 'Arial, sans-serif' }
const totalAmount = { color: '#1a1a1a', fontSize: '13px', textAlign: 'right' as const, padding: '6px 0', fontFamily: 'Arial, sans-serif' }
const grandLabel = { color: '#1a1a1a', fontSize: '15px', padding: '10px 0', fontWeight: 700 }
const grandAmount = { color: '#1a1a1a', fontSize: '17px', textAlign: 'right' as const, padding: '10px 0', fontWeight: 700, fontFamily: 'Arial, sans-serif' }
const buttonSection = { textAlign: 'center' as const, margin: '32px 0' }
const button = {
  display: 'inline-block',
  padding: '14px 32px',
  backgroundColor: '#1a1a1a',
  color: '#ffffff',
  textDecoration: 'none',
  fontSize: '13px',
  letterSpacing: '0.15em',
  textTransform: 'uppercase' as const,
  borderRadius: '24px',
}
const footer = { color: '#333333', lineHeight: '1.8', marginTop: '32px', fontSize: '15px' }
const footerSmall = { color: '#888888', fontSize: '12px', lineHeight: '1.6', margin: '0' as const, fontFamily: "Georgia, 'Playfair Display', serif" }
