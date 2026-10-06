/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.tsx'

interface Props {
  userName?: string
  companyName?: string
}

const StudioActivationAlertEmail = ({ userName = 'A trade member', companyName = 'their studio' }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New studio activation — {userName} ({companyName})</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Maison Affluency Admin Alert</Heading>
        <Text style={eyebrow}>New Studio Activation</Text>
        <Section style={box}>
          <Text style={text}>
            {userName} from {companyName} has successfully authorized their workspace
            session, signed the secure studio agreement, and initialized their live
            portal account.
          </Text>
        </Section>
        <Hr style={divider} />
        <Text style={smallText}>Automatic notification — Maison Affluency Trade Desk.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: StudioActivationAlertEmail,
  subject: (data: Record<string, any>) =>
    `New studio activation — ${data?.userName ?? 'Trade member'} (${data?.companyName ?? 'Studio'})`,
  displayName: 'Studio activation alert (internal)',
  previewData: { userName: 'Jane Doe', companyName: 'Atelier Doe' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '32px 25px' }
const h1 = { fontSize: '20px', fontWeight: '600' as const, margin: '0 0 4px', color: '#111111' }
const eyebrow = { fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' as const, color: '#2f4f4f', margin: '0 0 16px' }
const box = { backgroundColor: '#f6f4ef', padding: '20px 24px', borderRadius: '4px' }
const text = { fontSize: '15px', lineHeight: '24px', color: '#222222', margin: '0' }
const divider = { borderColor: '#e5e2da', margin: '24px 0 16px' }
const smallText = { fontSize: '12px', color: '#888888', margin: '0' }
