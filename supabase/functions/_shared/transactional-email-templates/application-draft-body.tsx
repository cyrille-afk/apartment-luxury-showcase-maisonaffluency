import * as React from 'npm:react@18.3.1'
import { Heading, Text, Section, Button } from 'npm:@react-email/components@0.0.22'
import { parseDraftBody } from '../applicationNotificationCopy.ts'

export function ApplicationDraftBody({ body, approval }: { body: string; approval: boolean }) {
  const blocks = parseDraftBody(body)
  const lastBenefit = blocks.map(b => b.kind).lastIndexOf('benefit')
  return <>
    {blocks.map((block, i) => <React.Fragment key={i}>
      {block.kind === 'greeting' ? <Heading style={heading}>{block.text}</Heading>
        : block.kind === 'benefit' ? <table width="100%" cellPadding="0" cellSpacing="0"><tbody><tr>
          <td style={icon}>◆</td><td style={{ paddingBottom: '18px' }}>
            <Text style={title}>{block.title}</Text><Text style={description}>{block.description}</Text>
            {block.details.length > 0 && <ul style={details}>{block.details.map((d, n) => <li key={n}>{d}</li>)}</ul>}
          </td>
        </tr></tbody></table>
        : <Text style={{ ...text, whiteSpace: 'pre-wrap', ...(approval && block.kind === 'intro' ? { fontStyle: 'italic' } : {}) }}>{block.text}</Text>}
      {approval && i === lastBenefit && <PortalAction />}
    </React.Fragment>)}
    {approval && lastBenefit < 0 && <PortalAction />}
  </>
}

const PortalAction = () => <Section style={{ textAlign: 'center', margin: '32px 0' }}>
  <Button href="https://www.maisonaffluency.com/trade/login" style={button}>Access Your Trade Portal</Button>
</Section>
const heading = { color: '#1a1a1a', fontSize: '24px', marginBottom: '24px' }
const text = { color: '#333333', lineHeight: '1.8', marginBottom: '20px', fontSize: '15px' }
const title = { color: '#1a1a1a', fontSize: '15px', fontWeight: 'bold' as const, margin: '0 0 4px', lineHeight: '1.4' }
const description = { ...text, fontSize: '14px', lineHeight: '1.6', margin: '0' }
const icon = { verticalAlign: 'top' as const, width: '28px', paddingBottom: '18px', color: '#1a1a1a', fontSize: '14px' }
const details = { color: '#333333', fontSize: '13px', lineHeight: '1.6', margin: '8px 0 0 18px', paddingLeft: '14px' }
const button = { display: 'inline-block', padding: '14px 32px', backgroundColor: '#1a1a1a', color: '#ffffff', textDecoration: 'none', fontSize: '13px', letterSpacing: '0.15em', textTransform: 'uppercase' as const, borderRadius: '24px' }