import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { welcomeDesignerData } from './welcomeDesignerCount.ts'

Deno.test('welcome always replaces supplied count with the current published count', async () => {
  let count = 101
  const service = { rpc: () => Promise.resolve({ data: count, error: null }) } as unknown as SupabaseClient
  assertEquals(await welcomeDesignerData(service, 'trade-welcome-auto', { designerCount: 170 }), { designerCount: 101 })
  count = 102
  assertEquals(await welcomeDesignerData(service, 'trade-welcome-auto', {}), { designerCount: 102 })
})
Deno.test('failed, missing or invalid counts omit numerical claims', async () => {
  for (const data of [null, 0, -1, 1.5, '170', NaN]) {
    const service = { rpc: () => Promise.resolve({ data, error: null }) } as unknown as SupabaseClient
    assertEquals(await welcomeDesignerData(service, 'trade-welcome-auto', { designerCount: 170 }), { designerCount: undefined })
  }
  for (const rpc of [() => Promise.resolve({ data: 170, error: new Error('unavailable') }), () => Promise.reject(new Error('unavailable'))]) {
    assertEquals(await welcomeDesignerData({ rpc } as unknown as SupabaseClient, 'trade-welcome-auto', {}), { designerCount: undefined })
  }
})
Deno.test('other templates remain untouched', async () => {
  const service = { rpc: () => { throw new Error('Must not query') } } as unknown as SupabaseClient
  assertEquals(await welcomeDesignerData(service, 'studio-activation-alert', { name: 'Test' }), { name: 'Test' })
})