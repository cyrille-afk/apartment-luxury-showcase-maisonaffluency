import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Img, Preview, Text, Hr } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.tsx'

interface Props { studioName?: string; inviterName?: string; role?: string; recipientEmail?: string; link?: string; expiresAt?: string }
const Email = ({ studioName = 'Your studio', inviterName = 'Your colleague', role = 'editor', recipientEmail = '', link = 'https://www.maisonaffluency.com/trade/settings/studio', expiresAt }: Props) => (
  <Html lang="en" dir="ltr"><Head /><Preview>{inviterName} has invited you to {studioName}</Preview>
    <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Georgia, serif' }}>
      <Container style={{ maxWidth: '600px', padding: '40px 24px', backgroundColor: '#faf9f7' }}>
        <Img src="https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/affluency-email-wordmark.jpg" alt="AFFLUENCY — Unique by Design" width="420" style={{ maxWidth: '100%', margin: '0 auto 32px' }} />
        <Hr style={{ borderColor: '#c69a45' }} />
        <Heading style={{ color: '#123f35', fontSize: '26px' }}>An invitation to {studioName}</Heading>
        <Text style={{ color: '#333333', lineHeight: '1.8' }}>{inviterName} has invited you to join {studioName} on Maison Affluency as an {role}.</Text>
        <Text style={{ color: '#333333', lineHeight: '1.8' }}>Sign in with {recipientEmail}, then select Accept in your Studio invitations.</Text>
        <Button href={link} style={{ backgroundColor: '#123f35', color: '#ffffff', padding: '16px 26px', margin: '16px 0' }}>View studio invitation</Button>
        <Text style={{ color: '#666666', fontSize: '12px', overflowWrap: 'anywhere' }}>Or open: {link}</Text>
        {expiresAt && <Text style={{ color: '#666666', fontSize: '12px' }}>Invitation expires {new Date(expiresAt).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' })}.</Text>}
        <Hr style={{ borderColor: '#c69a45', marginTop: '32px' }} />
        <Text style={{ color: '#666666', textAlign: 'right', fontSize: '12px' }}>Maison Affluency Singapore · Unique by Design</Text>
      </Container>
    </Body>
  </Html>
)
export const template = { component: Email, subject: (d: Record<string, any>) => `Your invitation to ${d.studioName || 'your studio'} — Maison Affluency`, displayName: 'Studio teammate invitation', previewData: { studioName: 'Example Studio', inviterName: 'Your colleague', role: 'editor', recipientEmail: 'colleague@example.com' } } satisfies TemplateEntry