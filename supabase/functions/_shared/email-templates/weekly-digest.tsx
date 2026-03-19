/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
  Column,
  Row,
} from 'npm:@react-email/components@0.0.22'

interface ProductItem {
  name: string
  brand: string
  image_url: string | null
  fav_count?: number
}

interface WeeklyDigestProps {
  recipient: string
  siteUrl: string
  popularProducts: ProductItem[]
  newArrivals: ProductItem[]
  unsubscribeUrl?: string
}

export const WeeklyDigestEmail = ({
  recipient,
  siteUrl,
  popularProducts,
  newArrivals,
  unsubscribeUrl,
}: WeeklyDigestProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your weekly highlights from Maison Affluency</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>MAISON AFFLUENCY</Text>
        <Hr style={divider} />
        <Heading style={h1}>Weekly Digest</Heading>
        <Text style={text}>
          Here's what's trending and new in our collection this week.
        </Text>

        {popularProducts.length > 0 && (
          <>
            <Heading as="h2" style={h2}>Most Popular</Heading>
            <Text style={subtitle}>The pieces your peers are loving</Text>
            {popularProducts.map((p, i) => (
              <Section key={i} style={productRow}>
                {p.image_url && (
                  <Img src={p.image_url} alt={p.name} width="80" height="80" style={productImage} />
                )}
                <div style={productInfo}>
                  <Text style={productName}>{p.name}</Text>
                  <Text style={productBrand}>{p.brand}{p.fav_count ? ` · ${p.fav_count} ♥` : ''}</Text>
                </div>
              </Section>
            ))}
          </>
        )}

        {newArrivals.length > 0 && (
          <>
            <Hr style={sectionDivider} />
            <Heading as="h2" style={h2}>New Arrivals</Heading>
            <Text style={subtitle}>Recently added to the collection</Text>
            {newArrivals.map((p, i) => (
              <Section key={i} style={productRow}>
                {p.image_url && (
                  <Img src={p.image_url} alt={p.name} width="80" height="80" style={productImage} />
                )}
                <div style={productInfo}>
                  <Text style={productName}>{p.name}</Text>
                  <Text style={productBrand}>{p.brand}</Text>
                </div>
              </Section>
            ))}
          </>
        )}

        <Hr style={sectionDivider} />
        <Link href={`${siteUrl}/trade/showroom`} style={button}>
          Browse Showroom
        </Link>

        <Text style={footer}>
          You're receiving this because you're a registered trade professional at Maison Affluency.
        </Text>
        {unsubscribeUrl && (
          <Text style={footer}>
            <Link href={unsubscribeUrl} style={unsubLink}>Unsubscribe from weekly digests</Link>
          </Text>
        )}
        <Hr style={divider} />
        <Text style={brandFooter}>Maison Affluency</Text>
      </Container>
    </Body>
  </Html>
)

export default WeeklyDigestEmail

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
const sectionDivider = { borderColor: 'hsl(36, 40%, 85%)', margin: '24px 0' }
const h1 = {
  fontFamily: "'Playfair Display', Georgia, serif",
  fontSize: '26px',
  fontWeight: 'normal' as const,
  color: 'hsl(168, 10%, 8%)',
  margin: '0 0 12px',
}
const h2 = {
  fontFamily: "'Playfair Display', Georgia, serif",
  fontSize: '18px',
  fontWeight: 'normal' as const,
  color: 'hsl(168, 10%, 8%)',
  margin: '0 0 4px',
}
const subtitle = {
  fontSize: '12px',
  color: 'hsl(168, 10%, 55%)',
  margin: '0 0 16px',
}
const text = {
  fontSize: '14px',
  color: 'hsl(168, 10%, 38%)',
  lineHeight: '1.6',
  margin: '0 0 20px',
}
const productRow = {
  display: 'flex' as const,
  alignItems: 'center' as const,
  gap: '12px',
  marginBottom: '12px',
}
const productImage = {
  borderRadius: '4px',
  objectFit: 'cover' as const,
}
const productInfo = {
  flex: '1',
}
const productName = {
  fontSize: '13px',
  color: 'hsl(168, 10%, 8%)',
  margin: '0 0 2px',
  fontWeight: '600' as const,
}
const productBrand = {
  fontSize: '11px',
  color: 'hsl(168, 10%, 55%)',
  margin: '0',
}
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
const footer = { fontSize: '12px', color: 'hsl(168, 10%, 55%)', margin: '0 0 8px', lineHeight: '1.5' }
const unsubLink = { color: 'hsl(168, 10%, 55%)', textDecoration: 'underline', fontSize: '11px' }
const brandFooter = {
  fontFamily: "'Cinzel', Georgia, serif",
  fontSize: '11px',
  letterSpacing: '0.15em',
  color: 'hsl(168, 10%, 55%)',
  textAlign: 'center' as const,
  margin: '24px 0 0',
}
