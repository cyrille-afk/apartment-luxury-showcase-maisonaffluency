/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.tsx'

interface Piece {
  name: string
  reason?: string
}

interface Props {
  invitedName?: string
  viewingRequested?: boolean
  projectSummary?: string
  aesthetic?: string
  budgetBand?: string
  sentiment?: string
  piecesOfInterest?: Piece[]
  contactEmail?: string
  contactPhone?: string
  briefId?: string
}

const Email = ({
  invitedName = 'Anonymous VIP',
  viewingRequested = false,
  projectSummary,
  aesthetic,
  budgetBand,
  sentiment,
  piecesOfInterest = [],
  contactEmail,
  contactPhone,
  briefId,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      {viewingRequested
        ? `Viewing requested — ${invitedName}`
        : `Mandarin concierge brief — ${invitedName}`}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={eyebrow}>MAISON AFFLUENCY · GREATER CHINA DESK</Text>
          <Heading as="h1" style={h1}>
            {viewingRequested ? 'Viewing requested — action required' : 'New director brief'}
          </Heading>
          <Text style={subhead}>{invitedName}</Text>
        </Section>

        <Hr style={hr} />

        <Section>
          {projectSummary ? (
            <>
              <Text style={label}>Project</Text>
              <Text style={paragraph}>{projectSummary}</Text>
            </>
          ) : null}

          {aesthetic ? (
            <>
              <Text style={label}>Aesthetic</Text>
              <Text style={paragraph}>{aesthetic}</Text>
            </>
          ) : null}

          <Section style={metaRow}>
            {budgetBand ? (
              <Text style={metaCell}>
                <span style={metaLabel}>Budget</span>
                <br />
                {budgetBand}
              </Text>
            ) : null}
            {sentiment ? (
              <Text style={metaCell}>
                <span style={metaLabel}>Sentiment</span>
                <br />
                {sentiment}
              </Text>
            ) : null}
          </Section>

          {piecesOfInterest.length ? (
            <>
              <Text style={label}>Pieces of interest</Text>
              {piecesOfInterest.slice(0, 8).map((p, i) => (
                <Text key={i} style={pieceRow}>
                  · <strong>{p.name}</strong>
                  {p.reason ? ` — ${p.reason}` : ''}
                </Text>
              ))}
            </>
          ) : null}

          {contactEmail || contactPhone ? (
            <>
              <Hr style={hr} />
              <Text style={label}>Contact</Text>
              {contactEmail ? <Text style={paragraph}>{contactEmail}</Text> : null}
              {contactPhone ? <Text style={paragraph}>{contactPhone}</Text> : null}
            </>
          ) : null}

          {briefId ? (
            <Text style={footerNote}>
              Brief ref · {briefId.slice(0, 8).toUpperCase()}
            </Text>
          ) : null}
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    data?.viewingRequested
      ? `Viewing requested — ${data?.invitedName || 'VIP'} · Maison Affluency`
      : `Director brief — ${data?.invitedName || 'VIP'} · Maison Affluency`,
  displayName: 'CN Director Brief',
  previewData: {
    invitedName: 'Mr. Chen',
    viewingRequested: true,
    projectSummary: 'Duplex penthouse, Central. 320 sqm. Wants a hero dining piece + statement lighting.',
    aesthetic: 'Warm minimalism, sculptural wood, patinated brass',
    budgetBand: '500k–2M SGD',
    sentiment: 'committed',
    piecesOfInterest: [
      { name: 'Andrée Putman — Console', reason: 'Fits the entry wall' },
      { name: 'Hervé van der Straeten — Chandelier', reason: 'Dining' },
    ],
    contactEmail: 'chen@example.com',
    briefId: '00000000-1111-2222-3333-444455556666',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Georgia, serif', color: '#1a1a1a' }
const container = { padding: '32px 28px', maxWidth: '600px' }
const header = { paddingBottom: '8px' }
const eyebrow = {
  fontSize: '11px',
  letterSpacing: '0.18em',
  color: '#556661',
  fontFamily: 'Arial, sans-serif',
  margin: '0 0 12px',
}
const h1 = { fontSize: '22px', margin: '0 0 6px', color: '#0f2a24' }
const subhead = { fontSize: '15px', color: '#1a1a1a', margin: '0' }
const hr = { borderColor: '#e6e0d4', margin: '20px 0' }
const label = {
  fontSize: '10px',
  letterSpacing: '0.16em',
  textTransform: 'uppercase' as const,
  color: '#556661',
  margin: '14px 0 4px',
  fontFamily: 'Arial, sans-serif',
}
const paragraph = { fontSize: '14px', lineHeight: '22px', margin: '0 0 8px', color: '#1a1a1a' }
const metaRow = { margin: '10px 0' }
const metaCell = {
  fontSize: '13px',
  color: '#1a1a1a',
  margin: '0 24px 0 0',
  display: 'inline-block' as const,
}
const metaLabel = { fontSize: '10px', letterSpacing: '0.14em', color: '#556661' }
const pieceRow = { fontSize: '13px', margin: '2px 0', color: '#1a1a1a' }
const footerNote = { fontSize: '11px', color: '#8a8577', marginTop: '16px' }
