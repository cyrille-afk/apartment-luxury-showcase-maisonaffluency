import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { welcomeTaxStatus } from './welcomeTaxStatus.ts'

Deno.test('missing verification is not recorded, never exempt', () => {
  assertEquals(welcomeTaxStatus(null, null), 'Not recorded')
  assertEquals(welcomeTaxStatus({ vat_valid_status: false }, null), 'Not recorded')
})
Deno.test('submitted or unchecked VAT IDs are pending', () => {
  assertEquals(welcomeTaxStatus(null, null, 'SG123'), 'Pending verification')
  assertEquals(welcomeTaxStatus({ vat_number: 'SG123', vat_valid_status: false }, null), 'Pending verification')
})
Deno.test('recorded failed validation is not validated', () => {
  assertEquals(welcomeTaxStatus({ vat_number: 'VAT123', vat_valid_status: false, vat_last_checked_at: '2026-10-08' }, null), 'Not validated — verification required')
})
Deno.test('verified identity in either checkout profile does not imply exemption', () => {
  const verified = { vat_number: 'VAT123', vat_valid_status: true }
  assertEquals(welcomeTaxStatus(verified, null), 'Verified — tax treatment determined per invoice')
  assertEquals(welcomeTaxStatus(null, verified), 'Verified — tax treatment determined per invoice')
  assertEquals(welcomeTaxStatus({ vat_valid_status: true }, null), 'Not recorded')
})