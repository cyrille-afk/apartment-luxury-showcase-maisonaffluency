/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Img, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.tsx'

const SITE_NAME = "Maison Affluency"

interface ProductionRenderRequestProps {
  userName?: string
  userEmail?: string
  renderTitle?: string
  engine?: string
  projectName?: string
  imageUrl?: string
}

const ProductionRenderRequestEmail = ({
  userName,
  userEmail,
  renderTitle,
  engine,
  projectName,
  imageUrl,
}: ProductionRenderRequestProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New production render request: {renderTitle || 'Untitled'} — {engine || 'TBD'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <Img
            src="https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/affluency-email-wordmark.jpg"
            alt="Affluency - Unique by Design"
            width="420"
            style={logo}
          />
        </Section>
        <Hr style={divider} />
        <Heading style={h1}>New Production Render Request</Heading>
        <Text style={text}>
          A trade member has requested a production render. Details below:
        </Text>

        <Section style={detailBox}>
          <Text style={detailRow}><strong>Render:</strong> {renderTitle || 'Untitled'}</Text>
          <Text style={detailRow}><strong>Engine:</strong> {engine || 'Not specified'}</Text>
          {projectName && <Text style={detailRow}><strong>Project:</strong> {projectName}</Text>}
          <Text style={detailRow}><strong>Requested by:</strong> {userName || 'Unknown'} ({userEmail || '—'})</Text>
        </Section>

        {imageUrl && (
          <Section style={{ textAlign: 'center' as const, margin: '24px 0' }}>
            <Img src={imageUrl} alt={renderTitle || 'Render preview'} width="500" style={{ borderRadius: '8px', maxWidth: '100%' }} />
          </Section>
        )}

        <Section style={buttonSection}>
          <Button style={button} href="https://maisonaffluency.com/trade/admin">
            View in Admin Portal
          </Button>
        </Section>

        <Text style={footer}>
          This is an automated notification from the {SITE_NAME} Trade Portal.
        </Text>
        <Hr style={divider} />
        <table width="100%" cellPadding="0" cellSpacing="0" style={{ borderCollapse: 'collapse' as const }}>
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
        </table>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ProductionRenderRequestEmail,
  subject: (data: Record<string, any>) => `Production Render Request: ${data.renderTitle || 'New request'} — ${data.engine || 'TBD'}`,
  displayName: 'Production Render Request (Admin)',
  to: 'concierge@myaffluency.com',
  previewData: {
    userName: 'Jane Smith',
    userEmail: 'jane@atelierdesign.com',
    renderTitle: 'Villa Sentosa — Living Room View A',
    engine: 'V-Ray',
    projectName: 'Villa Sentosa',
    imageUrl: 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/placeholder.jpg',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "Georgia, 'Playfair Display', serif" }
const container = { padding: '40px 20px', maxWidth: '600px', margin: '0 auto', backgroundColor: '#faf9f7' }
const logoSection = { textAlign: 'center' as const, marginBottom: '32px', paddingBottom: '24px' }
const logo = { margin: '0 auto' }
const divider = { border: 'none', borderTop: '1px solid #e8e4de', margin: '0 0 24px' }
const h1 = { color: '#1a1a1a', fontSize: '24px', marginBottom: '24px', fontFamily: "Georgia, 'Playfair Display', serif" }
const text = { color: '#333333', lineHeight: '1.8', marginBottom: '20px', fontSize: '15px' }
const detailBox = { backgroundColor: '#f3f1ed', borderRadius: '8px', padding: '16px 20px', margin: '16px 0 24px' }
const detailRow = { color: '#333333', fontSize: '14px', lineHeight: '1.6', margin: '4px 0' }
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
const footer = { color: '#888888', lineHeight: '1.8', marginTop: '32px', fontSize: '13px', fontStyle: 'italic' as const }
const footerSmall = { color: '#888888', fontSize: '12px', lineHeight: '1.6', margin: '0' as const, fontFamily: "Georgia, 'Playfair Display', serif" }
