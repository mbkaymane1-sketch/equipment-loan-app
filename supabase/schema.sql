-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query)

create table items (
  id bigint generated always as identity primary key,
  description text not null,
  type text,
  created_at timestamptz not null default now()
);

create table clients (
  id bigint generated always as identity primary key,
  clientname text not null,
  adresse text,
  contact text,
  created_at timestamptz not null default now()
);

create table commandeclient (
  id bigint generated always as identity primary key,
  idclients bigint not null references clients (id) on delete cascade,
  iditem bigint not null references items (id) on delete cascade,
  qte integer not null default 1,
  prix numeric(10, 2),
  debut_location date not null default current_date,
  fin_location date,
  created_at timestamptz not null default now()
);

-- Row Level Security: only logged-in users (your one account) can read/write.
-- Without this, the tables would be readable/writable by anyone with the public API key.
alter table items enable row level security;
alter table clients enable row level security;
alter table commandeclient enable row level security;

create policy "authenticated full access" on items
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated full access" on clients
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated full access" on commandeclient
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
