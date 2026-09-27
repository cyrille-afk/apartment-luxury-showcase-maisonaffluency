/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Text, Hr, Section, Img } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.tsx'

interface Props { code?: string; studioName?: string; studioLogoUrl?: string | null; hideMaisonBranding?: boolean; projectName?: string }

const Email = ({ code = '000000', studioName = 'Your designer', studioLogoUrl = null, hideMaisonBranding = true, projectName = 'Project portfolio' }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your access code for {projectName}</Preview>
    <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Georgia, serif' }}>
      <Container style={{ padding: '40px 28px', maxWidth: '520px' }}>
        <Section style={{ textAlign: 'center' as const, marginBottom: '24px' }}>
          {hideMaisonBranding
            ? (studioLogoUrl ? <Img src={studioLogoUrl} alt={studioName} width="200" style={{ margin: '0 auto', maxHeight: '64px', objectFit: 'contain' as const }} /> : <Text style={{ fontSize: '20px', color: '#1f2b27', margin: 0 }}>{studioName}</Text>)
            : <Img src="https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/affluency-email-wordmark.jpg" alt="Maison Affluency" width="360" style={{ margin: '0 auto' }} />}
        </Section>
        <Hr style={{ borderColor: '#e5e2dc' }} />
        <Heading style={{ fontSize: '22px', fontWeight: 400, color: '#1f2b27', textAlign: 'center' as const }}>{projectName}</Heading>
        <Text style={{ fontSize: '14px', color: '#55575d', textAlign: 'center' as const }}>Enter this code to open your private board:</Text>
        <Text style={{ fontSize: '32px', letterSpacing: '10px', color: '#1f2b27', textAlign: 'center' as const, margin: '24px 0' }}>{code}</Text>
        <Text style={{ fontSize: '12px', color: '#8a8a8a', textAlign: 'center' as const }}>The code expires in 10 minutes. If you did not request it, you can ignore this email.</Text>
        <Hr style={{ borderColor: '#e5e2dc' }} />
        <Text style={{ fontSize: '12px', color: '#8a8a8a', textAlign: 'center' as const }}>{hideMaisonBranding ? studioName : 'Maison Affluency Singapore'}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Your access code — ${d.projectName ?? 'Project board'}`,
  displayName: 'Board access code',
  previewData: { code: '482913', studioName: 'JMW Studio', hideMaisonBranding: true, projectName: 'Singapore GCB workflow' },
} satisfies TemplateEntry
