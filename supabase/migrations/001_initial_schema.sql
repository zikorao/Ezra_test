-- Artifact Hub: initial schema
-- Run in Supabase SQL Editor or via: supabase db push

create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- Artifacts
-- ---------------------------------------------------------------------------
create table public.artifacts (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text not null default '',
  tags          text[] not null default '{}',
  mime_type     text not null,
  storage_path  text not null,
  content_text  text not null default '',
  file_size     bigint not null default 0,
  created_by    uuid references auth.users (id) on delete set null,
  embedding     vector(1536),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index artifacts_tags_idx on public.artifacts using gin (tags);
create index artifacts_created_at_idx on public.artifacts (created_at desc);
create index artifacts_embedding_idx on public.artifacts
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ---------------------------------------------------------------------------
-- Share links (time-limited public access)
-- ---------------------------------------------------------------------------
create table public.share_links (
  id            uuid primary key default gen_random_uuid(),
  artifact_id   uuid not null references public.artifacts (id) on delete cascade,
  token         text not null unique,
  expires_at    timestamptz,
  password_hash text,
  access_count  integer not null default 0,
  created_at    timestamptz not null default now()
);

create index share_links_token_idx on public.share_links (token);
create index share_links_artifact_idx on public.share_links (artifact_id);

-- ---------------------------------------------------------------------------
-- Feedback / comments
-- ---------------------------------------------------------------------------
create table public.feedback (
  id          uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.artifacts (id) on delete cascade,
  author_name text not null,
  body        text not null,
  parent_id   uuid references public.feedback (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index feedback_artifact_idx on public.feedback (artifact_id, created_at);

-- ---------------------------------------------------------------------------
-- API keys for MCP / programmatic access
-- ---------------------------------------------------------------------------
create table public.api_keys (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  key_hash    text not null unique,
  label       text not null default 'default',
  created_at  timestamptz not null default now(),
  last_used_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Updated-at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger artifacts_updated_at
  before update on public.artifacts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.artifacts enable row level security;
alter table public.share_links enable row level security;
alter table public.feedback enable row level security;
alter table public.api_keys enable row level security;

-- Authenticated users can CRUD their own artifacts
create policy "Users manage own artifacts"
  on public.artifacts for all
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

-- Authenticated users can read all artifacts (gallery)
create policy "Authenticated users browse gallery"
  on public.artifacts for select
  using (auth.role() = 'authenticated');

-- Share links: owners manage links for their artifacts
create policy "Owners manage share links"
  on public.share_links for all
  using (
    exists (
      select 1 from public.artifacts a
      where a.id = artifact_id and a.created_by = auth.uid()
    )
  );

-- Feedback: anyone can read; insert handled via service role API for share links
create policy "Authenticated users read feedback"
  on public.feedback for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users add feedback"
  on public.feedback for insert
  with check (auth.role() = 'authenticated');

-- API keys: users manage their own
create policy "Users manage own api keys"
  on public.api_keys for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage bucket (create in Supabase Dashboard or via CLI)
-- Bucket name: artifacts
-- Public: false — served via signed URLs or share middleware
-- ---------------------------------------------------------------------------
