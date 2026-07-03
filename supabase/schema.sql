-- ============================================================================
-- dip-feedback · Supabase kurulum SQL'i
-- Supabase Dashboard → SQL Editor → yapıştır → Run. (Tekrar çalıştırmak güvenli.)
-- ============================================================================

-- 1) Tablolar --------------------------------------------------------------
create table if not exists public.projects (
  id         uuid primary key default gen_random_uuid(),
  key        text unique not null,
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.feedback (
  id           uuid primary key default gen_random_uuid(),
  project_key  text not null references public.projects(key),
  title        text,
  comment      text,
  category     text not null default 'bug',        -- bug | cosmetic | enhancement | content | question
  status       text not null default 'open',      -- open | in_progress | done | wontfix
  priority     text not null default 'normal',    -- low | normal | high
  assignee     text,
  url          text,
  viewport_w   integer,
  viewport_h   integer,
  user_agent   text,
  reporter     text,
  screenshot_url text,
  annotations  jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Mevcut tabloya kolon ekle (tekrar çalıştırmada / eski tabloda self-healing)
alter table public.feedback add column if not exists category text not null default 'bug';
alter table public.feedback add column if not exists votes integer not null default 0;

-- Atomik oy (anonim +1 / -1). security definer → anon da RLS'e takılmadan sayacı değiştirebilir.
create or replace function public.vote(fid uuid, delta int)
returns integer language sql security definer set search_path = public as $$
  update public.feedback set votes = greatest(0, votes + delta) where id = fid returning votes;
$$;
grant execute on function public.vote(uuid, int) to anon, authenticated;

create index if not exists idx_feedback_project on public.feedback(project_key);
create index if not exists idx_feedback_status  on public.feedback(status);

-- 2) Örnek projeler --------------------------------------------------------
insert into public.projects (key, name) values ('metaworks',    'Metaworks')          on conflict (key) do nothing;
insert into public.projects (key, name) values ('metaworksweb', 'Metaworks Web Page') on conflict (key) do nothing;
insert into public.projects (key, name) values ('dipcomtr',     'DIP Web Page')       on conflict (key) do nothing;

-- 3) RLS + politikalar -----------------------------------------------------
-- Model: anon (widget) yalnızca feedback EKLER; giriş yapmış kullanıcı (dashboard)
-- hepsini okur/günceller. Proje listesi herkese açık okunur.
alter table public.projects enable row level security;
alter table public.feedback enable row level security;

drop policy if exists "projects read"        on public.projects;
drop policy if exists "feedback insert anon" on public.feedback;
drop policy if exists "feedback read auth"   on public.feedback;
drop policy if exists "feedback update auth" on public.feedback;

create policy "projects read"        on public.projects for select using (true);
create policy "feedback insert anon"  on public.feedback for insert to anon           with check (true);
create policy "feedback read auth"    on public.feedback for select to authenticated  using (true);
create policy "feedback update auth"  on public.feedback for update to authenticated  using (true) with check (true);

grant usage on schema public to anon, authenticated;
grant select on public.projects to anon, authenticated;
grant insert on public.feedback to anon;
grant select, update on public.feedback to authenticated;

-- 3b) Yorum thread'i (feedback altında tartışma) --------------------------
create table if not exists public.feedback_comments (
  id          uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.feedback(id) on delete cascade,
  author      text,                 -- opsiyonel isim (anonim olabilir)
  body        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_fc_feedback on public.feedback_comments(feedback_id);

alter table public.feedback_comments enable row level security;
drop policy if exists "fc read auth"   on public.feedback_comments;
drop policy if exists "fc insert auth" on public.feedback_comments;
create policy "fc read auth"   on public.feedback_comments for select to authenticated using (true);
create policy "fc insert auth" on public.feedback_comments for insert to authenticated with check (true);
grant select, insert on public.feedback_comments to authenticated;

-- 4) Storage (ekran görüntüleri) ------------------------------------------
insert into storage.buckets (id, name, public) values ('screenshots', 'screenshots', true)
  on conflict (id) do nothing;

drop policy if exists "screenshots anon upload" on storage.objects;
drop policy if exists "screenshots public read" on storage.objects;

create policy "screenshots anon upload" on storage.objects
  for insert to anon with check (bucket_id = 'screenshots');
create policy "screenshots public read" on storage.objects
  for select using (bucket_id = 'screenshots');
