/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text, Hr, Section, Img,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.tsx'

interface Props {
  studioName?: string
  studioLogoUrl?: string | null
  hideMaisonBranding?: boolean
  projectName?: string
  boardTitle?: string
  role?: 'client' | 'contractor'
  link?: string
}

const Email = ({ studioName = 'Your designer', studioLogoUrl = null, hideMaisonBranding = true, projectName = 'Project portfolio', boardTitle = 'Curated selection', role = 'client', link = '#' }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{studioName} has shared {boardTitle} with you</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={{ textAlign: 'center' as const, marginBottom: '32px' }}>
          {hideMaisonBranding ? (
            studioLogoUrl ? <Img src={studioLogoUrl} alt={studioName} width="220" style={{ margin: '0 auto', maxHeight: '72px', objectFit: 'contain' as const }} /> : <Text style={studioWordmark}>{studioName}</Text>
          ) : (
            <Img src="https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/affluency-email-wordmark.jpg" alt="Maison Affluency — Unique by Design" width="420" style={{ margin: '0 auto' }} />
          )}
        </Section>
        <Hr style={divider} />
        <Heading style={heading}>{projectName}</Heading>
        <Text style={selection}>{boardTitle}</Text>
        <Text style={paragraph}>
          {studioName} has invited you to {role === 'contractor'
            ? 'collaborate on this project board as an external contractor.'
            : 'review this curated selection. You can approve pieces and leave comments directly on the board.'}
        </Text>
        <Section style={{ textAlign: 'center' as const, margin: '32px 0' }}>
          <Button href={link} style={button}>Open the board</Button>
        </Section>
        <Text style={small}>This private link expires in 30 days. Please do not forward it.</Text>
        <Hr style={divider} />
        <Text style={small}>{hideMaisonBranding ? studioName : <>Maison Affluency Singapore · <em>Unique by Design</em></>}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `${d.studioName || 'Your designer'} has shared ${d.projectName || d.boardTitle || 'a project'} with you`,
  displayName: 'Board collaborator invite',
  previewData: { studioName: 'Studio Example', hideMaisonBranding: true, projectName: 'Villa Serena', boardTitle: 'Living Room — Curated Edit', role: 'client', link: 'https://www.maisonaffluency.com/shared/board/example' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Georgia, "Times New Roman", serif' }
const container = { padding: '40px 20px', maxWidth: '600px', margin: '0 auto', backgroundColor: '#faf9f7' }
const divider = { border: 'none', borderTop: '1px solid #e8e4de', margin: '0 0 24px' }
const heading = { color: '#1a1a1a', fontSize: '24px', marginBottom: '24px', fontFamily: 'Georgia, "Times New Roman", serif' }
const selection = { color: '#77716a', fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase' as const, margin: '-14px 0 24px' }
const studioWordmark = { color: '#1a1a1a', fontSize: '25px', letterSpacing: '0.08em', margin: '12px 0', fontFamily: 'Georgia, "Times New Roman", serif' }
const paragraph = { color: '#333333', lineHeight: '1.8', marginBottom: '20px', fontSize: '15px' }
const small = { color: '#888888', fontSize: '12px', lineHeight: '1.6' }
const button = { backgroundColor: '#1a1a1a', color: '#faf9f7', padding: '14px 28px', fontSize: '12px', letterSpacing: '0.18em', textTransform: 'uppercase' as const, textDecoration: 'none' }
