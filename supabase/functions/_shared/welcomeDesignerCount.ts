import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

/** Resolve at rendering time, never trust a caller's potentially stale count. */
export async function welcomeDesignerData(service: SupabaseClient, templateName: string, props: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (templateName !== 'trade-welcome-auto') return props
  try {
    const { data, error } = await service.rpc('published_maker_count')
    const designerCount = !error && typeof data === 'number' && Number.isSafeInteger(data) && data > 0 ? data : undefined
    return { ...props, designerCount }
  } catch {
    // Keep the welcome deliverable without making an unverified numerical claim.
    return { ...props, designerCount: undefined }
  }
}