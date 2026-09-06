alter table public.trade_program_signups
  add column if not exists business_reg_number text,
  add column if not exists credential_document_path text;