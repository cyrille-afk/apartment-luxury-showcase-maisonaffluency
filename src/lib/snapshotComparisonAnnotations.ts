import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import type { ComparisonAnnotations } from './snapshotComparisonPdf';
import { z } from 'zod';

const annotationsSchema = z.object({
  summary: z.string().max(1200).optional(),
  notes: z.record(z.string().max(600)).optional(),
  highlightChanges: z.boolean().optional(),
  photos: z.record(z.array(z.string().max(2200000).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/)).max(3)).optional(),
});
export function validateComparisonAnnotations(value: unknown): ComparisonAnnotations {
  const parsed = annotationsSchema.parse(value);
  if (new TextEncoder().encode(JSON.stringify(parsed)).length > 24 * 1024 * 1024) throw new Error('Reference photos are too large. Remove a photo and try again.');
  return parsed;
}
export async function loadComparisonAnnotations(projectKey: string, left: string, right: string): Promise<ComparisonAnnotations | null> {
  const { data, error } = await supabase.from('project_snapshot_comparison_annotations').select('annotations').eq('project_key', projectKey).eq('left_snapshot_id', left).eq('right_snapshot_id', right).maybeSingle();
  if (error) throw error;
  return data ? validateComparisonAnnotations(data.annotations) : null;
}
export async function saveComparisonAnnotations(projectKey: string, left: string, right: string, value: ComparisonAnnotations) {
  const annotations = validateComparisonAnnotations(value);
  const { data: session, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session.session) throw new Error('Sign in to save annotations.');
  const { error } = await supabase.from('project_snapshot_comparison_annotations').upsert({
    user_id: session.session.user.id, project_key: projectKey, left_snapshot_id: left, right_snapshot_id: right,
    annotations: annotations as Json, updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,project_key,left_snapshot_id,right_snapshot_id' });
  if (error) throw error;
}