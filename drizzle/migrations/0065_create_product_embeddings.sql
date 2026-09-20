create extension if not exists vector;

create table if not exists public.product_embeddings (
    id uuid default gen_random_uuid() primary key,
    product_id uuid not null references public.designer_curator_picks(id) on delete cascade,
    designer_name text not null,
    verbatim_title text not null,
    dimensions_json jsonb,
    design_taxonomy text[],
    content_chunk text not null,
    embedding vector(1536),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists product_embeddings_embedding_idx on public.product_embeddings using hnsw (embedding vector_cosine_ops);
create index if not exists product_embeddings_product_id_idx on public.product_embeddings(product_id);

grant select on public.product_embeddings to authenticated;
grant all on public.product_embeddings to service_role;

alter table public.product_embeddings enable row level security;

create policy "Authenticated users can read product embeddings"
  on public.product_embeddings for select
  to authenticated
  using (true);

create or replace function match_products (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  product_id uuid,
  designer_name text,
  verbatim_title text,
  dimensions_json jsonb,
  design_taxonomy text[],
  content_chunk text,
  similarity float
)
language sql stable
as $$
  select
    id,
    product_id,
    designer_name,
    verbatim_title,
    dimensions_json,
    design_taxonomy,
    content_chunk,
    (1 - (embedding <=> query_embedding)) as similarity
  from product_embeddings
  where (1 - (embedding <=> query_embedding)) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;