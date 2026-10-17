-- A small stand-in for the parts of Supabase the migrations use, so the
-- migrations can run in PGlite during tests. Not a migration: never run this
-- on the real database.

create role anon nologin;
create role authenticated nologin;
grant usage on schema public to anon, authenticated;

-- Supabase gives these roles table access by default; RLS and the
-- migrations' revokes do the rest.
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;

create schema auth;
grant usage on schema auth to anon, authenticated;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

-- The signed-in user, set by the tests with set_config('request.jwt.claim.sub', ...).
create function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create schema storage;
grant usage on schema storage to anon, authenticated;

create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text not null
);
alter table storage.objects enable row level security;
grant select, insert, delete on storage.objects to authenticated;

create function storage.foldername(name text) returns text[]
language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1];
$$;
