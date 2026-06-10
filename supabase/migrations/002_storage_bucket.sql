-- Artifact Hub: storage bucket for uploaded files
-- Run after 001_initial_schema.sql

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'artifacts',
  'artifacts',
  false,
  10485760,
  array['text/html', 'image/png', 'image/jpeg', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- Authenticated users may upload to their own folder (future client-side uploads)
create policy "Authenticated upload to artifacts bucket"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'artifacts');

-- Service role bypasses RLS; gallery serves files via signed URLs from the API.
