-- Esquema do Fight Club no Supabase (PostgreSQL).
-- Rodar uma vez no painel: SQL Editor > New query > colar e executar.
-- Espelha o formato de data/eventos.json. O cartel (record) fica na própria
-- linha do lutador em cada luta, pois é o cartel naquele evento.

create table if not exists public.events (
  id            text primary key check (id !~ '\s'),
  is_sample     boolean not null default false,
  organization  text not null check (organization in ('UFC', 'PFL', 'ONE')),
  name          text not null,
  starts_at     timestamptz not null,
  status        text not null check (status in ('scheduled', 'live', 'completed', 'cancelled', 'postponed')),
  venue_name    text not null,
  venue_city    text,
  venue_country text,
  source_url    text,
  -- Evento real precisa de fonte oficial.
  constraint events_real_tem_fonte check (is_sample or source_url is not null)
);

create table if not exists public.event_broadcasts (
  id        bigint generated always as identity primary key,
  event_id  text not null references public.events (id) on delete cascade,
  name      text not null,
  type      text not null check (type in ('streaming', 'tv')),
  url       text
);

create table if not exists public.fights (
  id               bigint generated always as identity primary key,
  event_id         text not null references public.events (id) on delete cascade,
  "order"          integer not null check ("order" >= 1),
  card_section     text not null check (card_section in ('main_event', 'co_main', 'main_card', 'prelims', 'early_prelims')),
  weight_class     text not null,
  weight_limit_lbs integer,
  unique (event_id, "order")
);

create table if not exists public.fight_fighters (
  id           bigint generated always as identity primary key,
  fight_id     bigint not null references public.fights (id) on delete cascade,
  position     smallint not null check (position in (1, 2)),
  name         text not null,
  nationality  text,
  wins         integer check (wins >= 0),
  losses       integer check (losses >= 0),
  draws        integer check (draws >= 0),
  no_contests  integer check (no_contests >= 0),
  height_ft    numeric,
  reach_in     numeric,
  unique (fight_id, position)
);

create index if not exists events_starts_at_idx on public.events (starts_at);
create index if not exists event_broadcasts_event_idx on public.event_broadcasts (event_id);
create index if not exists fights_event_idx on public.fights (event_id);

-- Segurança: RLS ligada e leitura pública. Sem política de escrita, o acesso
-- anônimo não consegue inserir, alterar nem apagar nada.
alter table public.events           enable row level security;
alter table public.event_broadcasts enable row level security;
alter table public.fights           enable row level security;
alter table public.fight_fighters   enable row level security;

create policy "leitura publica" on public.events           for select to anon, authenticated using (true);
create policy "leitura publica" on public.event_broadcasts for select to anon, authenticated using (true);
create policy "leitura publica" on public.fights           for select to anon, authenticated using (true);
create policy "leitura publica" on public.fight_fighters   for select to anon, authenticated using (true);

-- Como "Automatically expose new tables" ficou desmarcado, é preciso liberar
-- só a leitura para a API.
grant usage on schema public to anon, authenticated;
grant select on public.events, public.event_broadcasts, public.fights, public.fight_fighters to anon, authenticated;
