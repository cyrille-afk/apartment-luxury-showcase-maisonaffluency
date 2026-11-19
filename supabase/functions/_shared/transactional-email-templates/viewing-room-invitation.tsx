/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Body, Head, Html, Preview } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.tsx'

interface Props { developerName?: string; developerLogoUrl?: string | null; heroImageUrl?: string | null; link?: string; code?: string }
// Gmail only renders absolute https images; relative CDN paths and data URIs are dropped.
const safeHttps = (value?: string | null) => typeof value === 'string' && /^https:\/\//.test(value) ? value : null

const IVORY = '#FAF9F6', INK = '#1C1C1C', EMERALD = '#1F4E46', HAIRLINE = '1px solid #E5E0D8', MUTED = '#8A857D', BODY = '#55524C'
const SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif"
const SANS = "Helvetica, Arial, sans-serif"
const WORDMARK = 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/affluency-email-wordmark.png'

const Email = ({ developerName = 'Private Residences', developerLogoUrl = null, heroImageUrl = null, link = 'https://www.maisonaffluency.com', code = '' }: Props) => {
  const logo = safeHttps(developerLogoUrl); const hero = safeHttps(heroImageUrl); const href = safeHttps(link) ?? 'https://www.maisonaffluency.com'
  return <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your private viewing room for {developerName}</Preview>
    <Body style={{ backgroundColor: '#ffffff', margin: 0, padding: 0 }}>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0} style={{ backgroundColor: '#ffffff', width: '100%' }}><tbody><tr><td align="center" style={{ padding: '32px 12px' }}>
        <table role="presentation" width="600" cellPadding={0} cellSpacing={0} border={0} style={{ width: '100%', maxWidth: '600px', backgroundColor: IVORY, border: HAIRLINE, borderCollapse: 'collapse' }}><tbody>
          <tr><td align="center" style={{ padding: '40px 40px 8px' }}>
            {logo
              ? <img src={logo} alt={developerName} width="180" style={{ display: 'block', width: '180px', maxWidth: '180px', height: 'auto', border: 0, margin: '0 auto' }} />
              : <p style={{ margin: 0, fontFamily: SERIF, fontSize: '20px', color: INK }}>{developerName}</p>}
          </td></tr>
          <tr><td align="center" style={{ padding: '10px 40px', fontFamily: SANS, fontSize: '11px', color: MUTED }}>×</td></tr>
          <tr><td align="center" style={{ padding: '0 40px 32px' }}>
            <img src={WORDMARK} alt="Maison Affluency" width="190" style={{ display: 'block', width: '190px', height: 'auto', border: 0, margin: '0 auto' }} />
          </td></tr>
          {hero && <tr><td style={{ padding: '0 24px' }}>
            <img src={hero} alt={developerName} width="552" style={{ display: 'block', width: '100%', maxWidth: '552px', height: 'auto', border: 0 }} />
          </td></tr>}
          <tr><td style={{ padding: '32px 40px 0' }}><table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}><tbody><tr><td style={{ borderTop: HAIRLINE, fontSize: 0, lineHeight: 0 }}>&nbsp;</td></tr></tbody></table></td></tr>
          <tr><td align="center" style={{ padding: '24px 40px 0', fontFamily: SERIF, fontSize: '11px', letterSpacing: '3px', textTransform: 'uppercase', color: MUTED }}>Private Viewing Room</td></tr>
          <tr><td align="center" style={{ padding: '12px 40px 0' }}><h1 style={{ margin: 0, fontFamily: SERIF, fontSize: '28px', lineHeight: '36px', fontWeight: 400, color: INK }}>{developerName}</h1></td></tr>
          <tr><td align="center" style={{ padding: '16px 56px 0', fontFamily: SANS, fontSize: '14px', lineHeight: '23px', color: BODY }}>You are invited to explore the residence layouts and curated furniture collections prepared for you by Maison Affluency.</td></tr>
          <tr><td align="center" style={{ padding: '28px 40px 44px' }}>
            <table role="presentation" cellPadding={0} cellSpacing={0} border={0}><tbody><tr><td align="center" bgcolor={EMERALD} style={{ backgroundColor: EMERALD }}>
              <a href={href} target="_blank" style={{ display: 'inline-block', padding: '15px 34px', fontFamily: SANS, fontSize: '13px', letterSpacing: '1px', color: '#ffffff', textDecoration: 'none' }}>Enter the viewing room</a>
            </td></tr></tbody></table>
          </td></tr>
          <tr><td style={{ borderTop: HAIRLINE, padding: '22px 40px 26px', fontFamily: SANS, fontSize: '11px', lineHeight: '18px', color: MUTED, textAlign: 'center' }}>
            {code && <p style={{ margin: '0 0 8px' }}>Private access code: <span style={{ color: INK, letterSpacing: '1px' }}>{code}</span></p>}
            <p style={{ margin: '0 0 8px' }}>Button not working? <a href={href} style={{ color: MUTED, textDecoration: 'underline' }}>Open your private invitation link.</a></p>
            <p style={{ margin: 0 }}>This invitation is personal. Please do not forward it. · Maison Affluency Singapore</p>
          </td></tr>
        </tbody></table>
      </td></tr></tbody></table>
    </Body>
  </Html>
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `${d.developerName ?? 'Private Residences'} × Maison Affluency · Private Viewing Room`,
  displayName: 'Viewing room invitation',
  previewData: { developerName: 'Cipriani Residences Miami', developerLogoUrl: 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/viewing-room/f6068253-c046-44f6-a29d-2efe2fedfb31/logos/cipriani-residences-logo.png', heroImageUrl: 'https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/viewing-room/f6068253-c046-44f6-a29d-2efe2fedfb31/covers/cipriani-residence-living-render.jpg', link: 'https://www.maisonaffluency.com/r/CPR-8492', code: 'CPR-8492' },
} satisfies TemplateEntry
