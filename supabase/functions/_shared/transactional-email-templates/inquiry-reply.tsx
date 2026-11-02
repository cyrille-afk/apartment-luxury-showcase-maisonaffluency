import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Text, Hr } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.tsx'

const InquiryReply = ({ name, bodyText }: { name?: string; bodyText?: string }) => (
  <Html lang="en"><Head /><Preview>A reply from Maison Affluency</Preview>
    <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Georgia, serif' }}>
      <Container style={{ maxWidth: '600px', padding: '36px 28px', backgroundColor: '#faf9f7' }}>
        <Heading style={{ color: '#183e36', fontSize: '32px', margin: '0' }}>AFFLUENCY</Heading>
        <Text style={{ color: '#9c8355', fontSize: '12px' }}>Unique by Design</Text><Hr />
        <Text style={{ color: '#183e36', fontSize: '18px' }}>Dear {name || 'visitor'},</Text>
        <Text style={{ color: '#333333', fontSize: '15px', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>{bodyText}</Text>
        <Text style={{ color: '#183e36', fontSize: '15px' }}>Warm regards,<br />Maison Affluency</Text>
        <Text style={{ fontSize: '13px' }}>You can reach our team at concierge@maisonaffluency.com.</Text>
        <Hr /><Text style={{ color: '#777777', fontSize: '12px', textAlign: 'right' }}>Maison Affluency Singapore — Unique by Design</Text>
      </Container>
    </Body>
  </Html>
);
export const template = {
  component: InquiryReply,
  subject: (data: Record<string, unknown>) => String(data.subjectText || 'Your Maison Affluency inquiry'),
  displayName: 'Inquiry reply',
} satisfies TemplateEntry;