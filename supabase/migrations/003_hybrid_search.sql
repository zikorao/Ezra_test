-- Hybrid search: weighted full-text (tsvector) + pgvector semantic similarity
-- Embedding dimension 768 matches nomic-embed-text (Ollama) and jina-embeddings-v3

drop index if exists public.artifacts_embedding_idx;

-- Reset embeddings when migrating from 1536-dim schema
update public.artifacts set embedding = null where embedding is not null;

alter table public.artifacts
  alter column embedding type vector(768)
  using null;

create index if not exists artifacts_embedding_hnsw_idx
  on public.artifacts using hnsw (embedding vector_cosine_ops);

-- Generated columns require an IMMUTABLE expression; wrap to_tsvector in a
-- dedicated function (plain to_tsvector('english', ...) is STABLE, not IMMUTABLE).
create or replace function public.artifacts_search_vector(
  p_title text,
  p_description text,
  p_tags text[],
  p_content_text text
)
returns tsvector
language sql
immutable
parallel safe
set search_path = public
as $$
  select
    setweight(to_tsvector('english'::regconfig, coalesce(p_title, '')), 'A') ||
    setweight(
      to_tsvector('english'::regconfig, coalesce(array_to_string(p_tags, ' '), '')),
      'A'
    ) ||
    setweight(to_tsvector('english'::regconfig, coalesce(p_description, '')), 'B') ||
    setweight(
      to_tsvector('english'::regconfig, coalesce(left(p_content_text, 50000), '')),
      'C'
    );
$$;

alter table public.artifacts drop column if exists search_vector;

alter table public.artifacts
  add column search_vector tsvector
  generated always as (
    public.artifacts_search_vector(title, description, tags, content_text)
  ) stored;

create index if not exists artifacts_search_vector_idx
  on public.artifacts using gin (search_vector);

-- Semantic nearest-neighbor search
create or replace function public.match_artifacts(
  query_embedding vector(768),
  match_threshold float default 0.25,
  match_count int default 30
)
returns setof public.artifacts
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.artifacts
  where embedding is not null
    and (1 - (embedding <=> query_embedding)) >= match_threshold
  order by embedding <=> query_embedding asc
  limit match_count;
$$;

-- Full-text search (web-style query syntax)
create or replace function public.search_artifacts_fts(
  query_text text,
  match_count int default 30
)
returns setof public.artifacts
language sql
stable
security definer
set search_path = public
as $$
  select a.*
  from public.artifacts a,
       websearch_to_tsquery('english', query_text) q
  where a.search_vector @@ q
  order by ts_rank_cd(a.search_vector, q) desc
  limit match_count;
$$;

grant execute on function public.match_artifacts(vector, float, int) to service_role;
grant execute on function public.search_artifacts_fts(text, int) to service_role;
