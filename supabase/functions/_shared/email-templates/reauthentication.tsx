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
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your verification code — Maison Affluency</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>MAISON AFFLUENCY</Text>
        <Hr style={divider} />
        <Heading style={h1}>Verification code</Heading>
        <Text style={text}>Use the code below to confirm your identity:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          This code will expire shortly. If you didn't request this, you can
          safely ignore this email.
        </Text>
        <Hr style={divider} />
        <Text style={brandFooter}>Maison Affluency</Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Lora', Georgia, 'Times New Roman', serif" }
const container = { padding: '40px 32px', maxWidth: '520px', margin: '0 auto' }
const brand = {
  fontFamily: "'Cinzel', Georgia, serif",
  fontSize: '13px',
  letterSpacing: '0.2em',
  color: 'hsl(168, 10%, 8%)',
  textAlign: 'center' as const,
  margin: '0 0 24px',
}
const divider = { borderColor: 'hsl(36, 40%, 65%)', margin: '0 0 32px' }
const h1 = {
  fontFamily: "'Playfair Display', Georgia, serif",
  fontSize: '26px',
  fontWeight: 'normal' as const,
  color: 'hsl(168, 10%, 8%)',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: 'hsl(168, 10%, 38%)',
  lineHeight: '1.6',
  margin: '0 0 20px',
}
const codeStyle = {
  fontFamily: "'Cinzel', Georgia, serif",
  fontSize: '28px',
  fontWeight: 'normal' as const,
  letterSpacing: '0.3em',
  color: 'hsl(168, 10%, 8%)',
  margin: '0 0 28px',
  padding: '16px 24px',
  backgroundColor: 'hsl(32, 20%, 97%)',
  border: '1px solid hsl(36, 40%, 65%)',
  display: 'inline-block',
}
const footer = { fontSize: '12px', color: 'hsl(168, 10%, 55%)', margin: '0 0 0', lineHeight: '1.5' }
const brandFooter = {
  fontFamily: "'Cinzel', Georgia, serif",
  fontSize: '11px',
  letterSpacing: '0.15em',
  color: 'hsl(168, 10%, 55%)',
  textAlign: 'center' as const,
  margin: '24px 0 0',
}
