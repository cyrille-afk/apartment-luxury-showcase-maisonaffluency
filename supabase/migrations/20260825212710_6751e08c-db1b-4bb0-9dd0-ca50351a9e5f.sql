INSERT INTO public.ai_model_pricing (model, input_usd_per_mtok, output_usd_per_mtok, flat_per_call_usd, source, source_url, notes) VALUES
  ('openai/text-embedding-3-small', 0.02, 0, NULL, 'OpenAI embeddings pricing', 'https://openai.com/api/pricing/', 'Embeddings: input tokens only'),
  ('openai/text-embedding-3-large', 0.13, 0, NULL, 'OpenAI embeddings pricing', 'https://openai.com/api/pricing/', 'Embeddings: input tokens only'),
  ('google/text-embedding-004', 0.02, 0, NULL, 'Google embeddings pricing', 'https://ai.google.dev/pricing', 'Embeddings: input tokens only')
ON CONFLICT (model) DO UPDATE SET
  input_usd_per_mtok = EXCLUDED.input_usd_per_mtok,
  output_usd_per_mtok = EXCLUDED.output_usd_per_mtok,
  source = EXCLUDED.source,
  source_url = EXCLUDED.source_url,
  notes = EXCLUDED.notes,
  updated_at = now();