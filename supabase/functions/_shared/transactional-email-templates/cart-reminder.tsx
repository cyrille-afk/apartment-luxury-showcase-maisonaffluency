/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Img, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.tsx'

const SITE_NAME = 'Maison Affluency'

interface Line {
  title?: string | null
  designerName?: string | null
  finishLabel?: string | null
  quantity?: number
}

interface Props {
  recipientName?: string | null
  lines?: Line[]
  cartUrl?: string
  secondReminder?: boolean
}

const CartReminderEmail = ({
  recipientName,
  lines = [],
  cartUrl = 'https://www.maisonaffluency.com/cart',
  secondReminder = false,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your selection is still reserved at {SITE_NAME}</Preview>
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

        <Heading style={h1}>{recipientName ? `Dear ${recipientName},` : 'Dear Collector,'}</Heading>

        <Text style={text}>
          {secondReminder
            ? 'A final note regarding the pieces you set aside with us. They remain available, though several are made to order with limited atelier capacity.'
            : 'You recently set aside the following pieces with us. Your selection has been kept, should you wish to continue.'}
        </Text>

        {lines.length > 0 ? (
          <Section style={statementBox}>
            <table width="100%" cellPadding="0" cellSpacing="0" style={{ borderCollapse: 'collapse' as const }}>
              <tbody>
                {lines.map((line, i) => (
                  <tr key={i}>
                    <td style={totalLabel}>
                      {line.title ?? 'Piece'}
                      {line.designerName ? ` — ${line.designerName}` : ''}
                      {line.finishLabel ? ` (${line.finishLabel})` : ''}
                    </td>
                    <td style={totalAmount}>× {line.quantity ?? 1}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        ) : null}

        <Section style={buttonSection}>
          <Button style={button} href={cartUrl}>Resume your selection</Button>
        </Section>

        <Text style={smallText}>
          Should you prefer a bespoke configuration, a different finish or delivery guidance, simply
          reply to this message and our trade desk will assist you personally.
        </Text>

        <Text style={footer}>
          With thanks,<br />
          <strong>The {SITE_NAME} Trade Desk</strong>
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: CartReminderEmail,
  subject: 'Your selection is still reserved — Maison Affluency',
  displayName: 'Abandoned Basket Reminder',
  previewData: {
    recipientName: 'Madame Dupont',
    lines: [{ title: 'Console Cheval', designerName: 'Félix Agostini', quantity: 1 }],
    cartUrl: 'https://www.maisonaffluency.com/cart',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "Georgia, 'Playfair Display', serif" }
const container = { padding: '40px 20px', maxWidth: '600px', margin: '0 auto', backgroundColor: '#faf9f7' }
const logoSection = { textAlign: 'center' as const, marginBottom: '32px', paddingBottom: '24px' }
const logo = { margin: '0 auto' }
const divider = { border: 'none', borderTop: '1px solid #e8e4de', margin: '0 0 24px' }
const h1 = { color: '#1a1a1a', fontSize: '24px', marginBottom: '24px', fontFamily: "Georgia, 'Playfair Display', serif" }
const text = { color: '#333333', lineHeight: '1.8', marginBottom: '20px', fontSize: '15px' }
const smallText = { color: '#666666', lineHeight: '1.7', marginBottom: '20px', fontSize: '13px' }
const statementBox = {
  backgroundColor: '#ffffff',
  border: '1px solid #e8e4de',
  borderRadius: '6px',
  padding: '20px 24px',
  margin: '24px 0',
}
const totalLabel = { color: '#555555', fontSize: '13px', padding: '6px 0', fontFamily: 'Arial, sans-serif' }
const totalAmount = { color: '#1a1a1a', fontSize: '13px', textAlign: 'right' as const, padding: '6px 0', fontFamily: 'Arial, sans-serif' }
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
