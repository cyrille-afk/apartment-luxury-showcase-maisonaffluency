import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Text, Img, Hr, Section } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.tsx'

interface Props { name?: string; companyName?: string }

const TradeRejectionEmail = ({ name, companyName }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>An update on your Maison Affluency Trade Program application</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <Img src="https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/affluency-email-wordmark.jpg" alt="Affluency - Unique by Design" width="420" style={{ margin: '0 auto', maxWidth: '100%', height: 'auto' }} />
        </Section>
        <Hr style={divider} />
        <Heading style={heading}>{name ? `Dear ${name},` : 'Dear Applicant,'}</Heading>
        <Text style={text}>Thank you for your interest in the Maison Affluency Trade Program{companyName ? <> on behalf of <strong>{companyName}</strong></> : ''}, and for taking the time to introduce your practice to us.</Text>
        <Text style={text}>Following careful consideration, we regret that we are unable to welcome your practice into the Trade Program at this stage. Our membership is subject to highly selective tier requirements and strict onboarding limitations, which guide the number and scope of practices we can support.</Text>
        <Text style={text}>We appreciate the care behind your application and your interest in our ateliers and designers. Thank you for considering Maison Affluency as a partner for your projects.</Text>
        <Text style={footer}>Warm regards,<br /><strong>The Maison Affluency Team</strong></Text>
        <Hr style={divider} />
        <Text style={small}>Maison Affluency Singapore<br /><em>Unique by Design</em></Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: TradeRejectionEmail,
  subject: 'Maison Affluency Trade Program — Application Update',
  displayName: 'Trade Program Application Update',
  previewData: { name: 'Jane Smith', companyName: 'Atelier Design Co.' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "Georgia, 'Playfair Display', serif" }
const container = { padding: '40px 20px', maxWidth: '600px', margin: '0 auto', backgroundColor: '#faf9f7' }
const logoSection = { textAlign: 'center' as const, marginBottom: '32px', paddingBottom: '24px' }
const divider = { border: 'none', borderTop: '1px solid #e8e4de', margin: '0 0 24px' }
const heading = { color: '#1a1a1a', fontSize: '24px', marginBottom: '24px' }
const text = { color: '#333333', lineHeight: '1.8', marginBottom: '20px', fontSize: '15px' }
const footer = { ...text, marginTop: '32px' }
const small = { color: '#888888', fontSize: '12px', lineHeight: '1.6', textAlign: 'right' as const }