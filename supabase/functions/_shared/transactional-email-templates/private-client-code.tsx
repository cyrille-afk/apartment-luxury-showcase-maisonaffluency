import * as React from 'npm:react@18.3.1';
import { Body, Container, Head, Html, Img, Text, Hr } from 'npm:@react-email/components@0.0.22';
import type { TemplateEntry } from './registry.tsx';

const Email = ({code = '000000'}: {code?: string}) => (
  <Html lang="en"><Head /><Body style={{backgroundColor:'#ffffff',fontFamily:'Georgia, serif'}}>
    <Container style={{maxWidth:'520px',padding:'40px 28px'}}>
      <Img src="https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/affluency-email-wordmark.jpg" alt="Maison Affluency" width="360" style={{margin:'0 auto'}} />
      <Hr style={{borderColor:'#e5e2dc'}} />
      <Text style={{fontSize:'22px',color:'#1f2b27'}}>Your private-client verification</Text>
      <Text>Enter this code to verify your email on Maison Affluency.</Text>
      <Text style={{fontSize:'32px',letterSpacing:'8px',color:'#1f2b27'}}>{code}</Text>
      <Text>The code expires in 10 minutes and can be used once. It does not sign you in or open your order history.</Text>
      <Text>If you did not request this code, you can ignore this email. Never share it.</Text>
    </Container>
  </Body></Html>
);
export const template = {
  component:Email, subject:'Your verification code — Maison Affluency',displayName:'Private-client verification',previewData:{code:'482913'},
} satisfies TemplateEntry;