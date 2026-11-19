/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Text, Hr, Section, Img, Link } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.tsx'

interface Props { developerName?: string; developerLogoUrl?: string | null; heroImageUrl?: string | null; link?: string; code?: string }
const safeHttps = (value?: string | null) => typeof value === 'string' && /^https:\/\//.test(value) ? value : null

const Email = ({ developerName = 'Private Residences', developerLogoUrl = null, heroImageUrl = null, link = 'https://www.maisonaffluency.com', code = '' }: Props) => {
  const logo = safeHttps(developerLogoUrl); const hero = safeHttps(heroImageUrl); const href = safeHttps(link) ?? 'https://www.maisonaffluency.com'
  return <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your private viewing room for {developerName}</Preview>
    <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Georgia, serif' }}>
      <Container style={{ padding: '36px 28px', maxWidth: '560px' }}>
        <Section style={{ textAlign: 'center' as const, marginBottom: '20px' }}>
          {logo ? <Img src={logo} alt={developerName} width="160" style={{ margin: '0 auto 14px', maxHeight: '56px', objectFit: 'contain' as const }} /> : <Text style={{ fontSize: '18px', color: '#1f2b27', margin: '0 0 10px' }}>{developerName}</Text>}
          <Text style={{ fontSize: '11px', color: '#8a8a8a', letterSpacing: '3px', margin: '0 0 10px' }}>×</Text>
          <Img src="https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/affluency-email-wordmark.jpg" alt="Maison Affluency" width="240" style={{ margin: '0 auto' }} />
        </Section>
        {hero && <Img src={hero} alt={developerName} width="504" style={{ width: '100%', height: 'auto', margin: '0 0 24px' }} />}
        <Hr style={{ borderColor: '#e5e2dc' }} />
        <Text style={{ fontSize: '11px', color: '#8a8a8a', letterSpacing: '2px', textAlign: 'center' as const, textTransform: 'uppercase' as const }}>Private Viewing Room</Text>
        <Heading style={{ fontSize: '26px', fontWeight: 400, color: '#1f2b27', textAlign: 'center' as const, margin: '8px 0 16px' }}>{developerName}</Heading>
        <Text style={{ fontSize: '14px', lineHeight: '22px', color: '#55575d', textAlign: 'center' as const }}>You are invited to explore the residence layouts and curated furniture collections prepared for you by Maison Affluency.</Text>
        <Section style={{ textAlign: 'center' as const, margin: '28px 0 12px' }}>
          <Button href={href} style={{ backgroundColor: '#1f2b27', color: '#ffffff', padding: '14px 28px', fontSize: '13px', letterSpacing: '1px', textDecoration: 'none' }}>Enter the viewing room</Button>
        </Section>
        <Text style={{ fontSize: '12px', color: '#8a8a8a', textAlign: 'center' as const, wordBreak: 'break-all' as const }}>If the button doesn’t work, copy this link: <Link href={href} style={{ color: '#1f2b27' }}>{href}</Link></Text>
        {code && <Text style={{ fontSize: '12px', color: '#55575d', textAlign: 'center' as const, margin: '18px 0 0' }}>Private access code: <span style={{ letterSpacing: '1px', color: '#1f2b27' }}>{code}</span></Text>}
        <Hr style={{ borderColor: '#e5e2dc', marginTop: '28px' }} />
        <Text style={{ fontSize: '12px', color: '#8a8a8a', textAlign: 'center' as const }}>This invitation is personal. Please do not forward it. · Maison Affluency Singapore</Text>
      </Container>
    </Body>
  </Html>
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `${d.developerName ?? 'Private Residences'} × Maison Affluency · Private Viewing Room`,
  displayName: 'Viewing room invitation',
  previewData: { developerName: 'Cipriani Residences Miami', link: 'https://www.maisonaffluency.com/viewing-room/cipriani-residences-miami?code=preview', code: 'preview-code' },
} satisfies TemplateEntry
