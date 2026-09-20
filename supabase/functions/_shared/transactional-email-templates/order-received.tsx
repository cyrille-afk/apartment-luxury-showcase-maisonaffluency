/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Img, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.tsx'
import { formatCurrency } from './currency.ts'

const SITE_NAME = 'Maison Affluency'

interface OrderItem {
  title: string
  designerName?: string | null
  configuration?: string | null
  quantity?: number
  priceFormatted: string
}

interface OrderReceivedProps {
  recipientName?: string
  orderRef?: string
  firstItemTitle?: string
  items?: OrderItem[]
  subtotalFormatted?: string
  shippingFormatted?: string | null
  taxLineFormatted?: string
  /** Destination-aware tax row label, e.g. "VAT (20%)" or "GST (9%)". */
  taxLabel?: string
  /** Invoice-grade statement, e.g. UK reverse-charge wording. */
  taxStatement?: string | null
  destination?: string | null
  deliveryTerm?: 'DDP' | 'DDU' | null
  customsStatement?: string | null
  importChargesFormatted?: string | null
  deferredImportFormatted?: string | null
  totalFormatted?: string
  currency?: string
}

const OrderReceivedEmail = ({
  recipientName,
  orderRef,
  firstItemTitle,
  items = [],
  subtotalFormatted = '—',
  shippingFormatted,
  taxLineFormatted,
  taxLabel = 'Taxes',
  taxStatement,
  destination,
  deliveryTerm,
  customsStatement,
  importChargesFormatted,
  deferredImportFormatted,
  totalFormatted = '—',
  currency = 'EUR',
}: OrderReceivedProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      Your order {firstItemTitle ? `— ${firstItemTitle} ` : ''}has been received and is under review by our Paris logistics team
    </Preview>
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
          {recipientName ? `Dear ${recipientName},` : 'Dear Client,'}
        </Heading>

        <Text style={text}>
          Thank you for commissioning your latest design pieces through {SITE_NAME}. We are
          delighted to confirm that your order has been securely received and is now being
          personally processed by our concierge desk.
        </Text>

        <Text style={text}>
          Below is a summary of your requested pieces and absolute transactional breakdown:
        </Text>

        <Text style={sectionLabel}>Your Selection</Text>
        <Section style={statementBox}>
          <table width="100%" cellPadding="0" cellSpacing="0" style={{ borderCollapse: 'collapse' as const }}>
            <tbody>
              {items.map((item, idx) => (
                <React.Fragment key={idx}>
                  <tr>
                    <td style={itemTitle}>
                      {item.title}
                      {item.designerName ? (
                        <span style={itemDesigner}> by {item.designerName}</span>
                      ) : null}
                    </td>
                  </tr>
                  {item.configuration ? (
                    <tr>
                      <td style={itemMeta}>Configuration: {item.configuration}</td>
                    </tr>
                  ) : null}
                  <tr>
                    <td style={itemMeta}>Price: {formatCurrency(item.priceFormatted, currency)}</td>
                  </tr>
                  <tr>
                    <td style={{ ...itemMeta, paddingBottom: '12px' }}>
                      Quantity: {item.quantity ?? 1}
                    </td>
                  </tr>
                  {idx < items.length - 1 ? (
                    <tr>
                      <td><Hr style={dividerSubtle} /></td>
                    </tr>
                  ) : null}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </Section>

        <Text style={sectionLabel}>Financial Summary</Text>
        <Section style={statementBox}>
          <table width="100%" cellPadding="0" cellSpacing="0" style={{ borderCollapse: 'collapse' as const }}>
            <tbody>
              <tr>
                <td style={totalLabel}>Subtotal</td>
                <td style={totalAmount}>{formatCurrency(subtotalFormatted, currency)}</td>
              </tr>
              {shippingFormatted ? (
                <tr>
                  <td style={totalLabel}>Front Door Premium Delivery (Deposit)</td>
                  <td style={totalAmount}>{formatCurrency(shippingFormatted, currency)}</td>
                </tr>
              ) : null}
              <tr>
                <td style={totalLabel}>{taxLabel}</td>
                <td style={totalAmount}>
                  {taxLineFormatted ? formatCurrency(taxLineFormatted, currency) : '—'}
                </td>
              </tr>
              {taxStatement ? (
                <tr>
                  <td colSpan={2} style={{ ...totalLabel, fontSize: '12px', opacity: 0.75 }}>
                    {taxStatement}
                  </td>
                </tr>
              ) : null}
              {deliveryTerm ? (
                <tr>
                  <td style={totalLabel}>Delivery term{destination ? ` · ${destination}` : ''}</td>
                  <td style={totalAmount}>{deliveryTerm}</td>
                </tr>
              ) : null}
              {importChargesFormatted ? (
                <tr>
                  <td style={totalLabel}>Prepaid import &amp; customs charges</td>
                  <td style={totalAmount}>{formatCurrency(importChargesFormatted, currency)}</td>
                </tr>
              ) : null}
              {deferredImportFormatted ? (
                <tr>
                  <td style={totalLabel}>Estimated charges payable at border</td>
                  <td style={totalAmount}>{formatCurrency(deferredImportFormatted, currency)}</td>
                </tr>
              ) : null}
              {customsStatement ? (
                <tr>
                  <td colSpan={2} style={{ ...totalLabel, fontSize: '12px', opacity: 0.75 }}>
                    {customsStatement}
                  </td>
                </tr>
              ) : null}
              <tr>
                <td colSpan={2}><Hr style={dividerSubtle} /></td>
              </tr>
              <tr>
                <td style={grandLabel}>Total Amount Authorized</td>
                <td style={grandAmount}>{formatCurrency(totalFormatted, currency)}</td>
              </tr>
            </tbody>
          </table>
        </Section>

        {orderRef ? (
          <Text style={footerSmall}>Order reference: {orderRef}</Text>
        ) : null}

        <Text style={text}>
          Our logistics team personally reviews every order within 24 hours. Your advisor will
          confirm production lead times and the delivery arrangements recorded above shortly.
        </Text>

        <Text style={footer}>
          With thanks,<br />
          <strong>The {SITE_NAME} Concierge Desk</strong>
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

export const template = {
  component: OrderReceivedEmail,
  subject: (data: Record<string, any>) =>
    `Your Order with Maison Affluency: ${data?.firstItemTitle ?? 'Order Received'} — Under Review by Paris Logistics`,
  displayName: 'Order Received — Under Review',
  previewData: {
    recipientName: 'Mr Laurent',
    orderRef: 'MA-2026-10243',
    firstItemTitle: 'Koumac Armchair',
    currency: 'EUR',
    items: [
      {
        title: 'Koumac Armchair',
        designerName: 'Thierry Lemaire',
        configuration: 'Swivel Base / Upholstery: Sheepskin / Plinth: Polished Brass',
        priceFormatted: '€11,100.00',
        quantity: 1,
      },
      {
        title: 'Lantern Table Lamp',
        designerName: 'Apparatus Studio',
        configuration: 'Tarnished Silver [Lacquered] / Slip-Cast Porcelain',
        priceFormatted: '€5,355.00',
        quantity: 1,
      },
    ],
    subtotalFormatted: '€16,455.00',
    shippingFormatted: '€2,468.25',
    taxLineFormatted: '€0.00',
    taxLabel: 'VAT (0%)',
    taxStatement: 'Zero-rated export. Import VAT and duty are assessed at the destination border.',
    destination: 'United Kingdom',
    deliveryTerm: 'DDU',
    deferredImportFormatted: '£3,500.00',
    customsStatement: 'Delivered Duty Unpaid (DDU) for delivery to United Kingdom. Estimated border charges are excluded from the order total.',
    totalFormatted: '€18,923.25',
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
const sectionLabel = {
  color: '#1a1a1a',
  fontSize: '11px',
  letterSpacing: '0.22em',
  textTransform: 'uppercase' as const,
  fontFamily: 'Arial, sans-serif',
  margin: '28px 0 8px',
}
const statementBox = {
  backgroundColor: '#ffffff',
  border: '1px solid #e8e4de',
  borderRadius: '6px',
  padding: '20px 24px',
  margin: '8px 0 24px',
}
const itemTitle = { color: '#1a1a1a', fontSize: '14px', fontWeight: 700, padding: '6px 0 2px', fontFamily: "Georgia, 'Playfair Display', serif" }
const itemDesigner = { fontWeight: 400, fontStyle: 'italic' as const, color: '#555555' }
const itemMeta = { color: '#555555', fontSize: '13px', padding: '2px 0', fontFamily: 'Arial, sans-serif' }
const totalLabel = { color: '#555555', fontSize: '13px', padding: '6px 0', fontFamily: 'Arial, sans-serif' }
const totalAmount = { color: '#1a1a1a', fontSize: '13px', textAlign: 'right' as const, padding: '6px 0', fontFamily: 'Arial, sans-serif' }
const grandLabel = { color: '#1a1a1a', fontSize: '15px', padding: '10px 0', fontWeight: 700 }
const grandAmount = { color: '#1a1a1a', fontSize: '17px', textAlign: 'right' as const, padding: '10px 0', fontWeight: 700, fontFamily: 'Arial, sans-serif' }
const footer = { color: '#333333', lineHeight: '1.8', marginTop: '32px', fontSize: '15px' }
const footerSmall = { color: '#888888', fontSize: '12px', lineHeight: '1.6', margin: '0' as const, fontFamily: "Georgia, 'Playfair Display', serif" }
