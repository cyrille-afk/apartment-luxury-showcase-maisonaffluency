/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface EmailChangeEmailProps {
  siteName: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  email,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your email change — Maison Affluency</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>MAISON AFFLUENCY</Text>
        <Hr style={divider} />
        <Heading style={h1}>Confirm your email change</Heading>
        <Text style={text}>
          You requested to change your email from{' '}
          <Link href={`mailto:${email}`} style={link}>{email}</Link>
          {' '}to{' '}
          <Link href={`mailto:${newEmail}`} style={link}>{newEmail}</Link>.
        </Text>
        <Text style={text}>
          Click the button below to confirm:
        </Text>
        <Button style={button} href={confirmationUrl}>
          Confirm Email Change
        </Button>
        <Text style={footer}>
          If you didn't request this change, please secure your account immediately.
        </Text>
        <Hr style={divider} />
        <Text style={brandFooter}>Maison Affluency</Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

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
const link = { color: 'hsl(168, 45%, 30%)', textDecoration: 'underline' }
const button = {
  backgroundColor: 'hsl(168, 45%, 30%)',
  color: 'hsl(32, 20%, 97%)',
  fontSize: '12px',
  letterSpacing: '0.15em',
  textTransform: 'uppercase' as const,
  borderRadius: '0px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block',
  margin: '0 0 28px',
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
