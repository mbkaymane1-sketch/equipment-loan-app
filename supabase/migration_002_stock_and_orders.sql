-- Migration 002: suppliers, purchases (stock-in), automatic stock tracking,
-- and multi-item orders (a "commande" now has several item lines instead of
-- being one row per item).
--
-- Safe to run once on top of schema.sql. Existing data in `commandeclient`
-- is migrated into the new `commandes` / `commande_lignes` tables; the old
-- table is renamed to `commandeclient_legacy` (kept as a backup, not
-- dropped) rather than deleted.
--
-- Run this in the Supabase SQL Editor.

-- ─── Stock tracking on items ────────────────────────────────────────────
alter table items add column if not exists stock_actuel integer not null default 0;
alter table items add column if not exists seuil_alerte integer;

-- ─── Suppliers ───────────────────────────────────────────────────────────
create table suppliers (
  id bigint generated always as identity primary key,
  name text not null,
  adresse text,
  contact text,
  created_at timestamptz not null default now()
);

alter table suppliers enable row level security;
create policy "authenticated full access" on suppliers
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ─── Purchases (stock-in) ────────────────────────────────────────────────
create table achats (
  id bigint generated always as identity primary key,
  id_supplier bigint references suppliers (id) on delete set null,
  iditem bigint not null references items (id) on delete cascade,
  qte integer not null check (qte > 0),
  prix_achat numeric(10, 2),
  date_achat date not null default current_date,
  created_at timestamptz not null default now()
);

alter table achats enable row level security;
create policy "authenticated full access" on achats
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create or replace function achats_apply_stock() returns trigger as $$
begin
  if tg_op = 'INSERT' then
    update items set stock_actuel = stock_actuel + new.qte where id = new.iditem;
  elsif tg_op = 'UPDATE' then
    if old.iditem = new.iditem then
      update items set stock_actuel = stock_actuel + (new.qte - old.qte) where id = new.iditem;
    else
      update items set stock_actuel = stock_actuel - old.qte where id = old.iditem;
      update items set stock_actuel = stock_actuel + new.qte where id = new.iditem;
    end if;
  elsif tg_op = 'DELETE' then
    update items set stock_actuel = stock_actuel - old.qte where id = old.iditem;
  end if;
  return null;
end;
$$ language plpgsql;

create trigger trg_achats_stock
after insert or update or delete on achats
for each row execute function achats_apply_stock();

-- ─── Orders (commandes) with multiple item lines ────────────────────────
create table commandes (
  id bigint generated always as identity primary key,
  idclients bigint not null references clients (id) on delete cascade,
  date_debut date not null default current_date,
  date_fin_prevue date,
  statut text not null default 'en_cours' check (statut in ('en_cours', 'retourne', 'annule')),
  notes text,
  created_at timestamptz not null default now()
);

create table commande_lignes (
  id bigint generated always as identity primary key,
  id_commande bigint not null references commandes (id) on delete cascade,
  iditem bigint not null references items (id) on delete restrict,
  qte integer not null check (qte > 0),
  prix numeric(10, 2),
  date_retour_reelle date,
  created_at timestamptz not null default now()
);

alter table commandes enable row level security;
alter table commande_lignes enable row level security;
create policy "authenticated full access" on commandes
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on commande_lignes
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- A loan line takes stock out when created (and there must be enough
-- available), returns it when date_retour_reelle is set, and reconciles
-- correctly on edits/deletes.
create or replace function commande_lignes_apply_stock() returns trigger as $$
declare
  available integer;
begin
  if tg_op = 'INSERT' then
    if new.date_retour_reelle is null then
      select stock_actuel into available from items where id = new.iditem for update;
      if available < new.qte then
        raise exception 'Stock insuffisant pour cet article (disponible: %, demandé: %)', available, new.qte;
      end if;
      update items set stock_actuel = stock_actuel - new.qte where id = new.iditem;
    end if;
    return new;

  elsif tg_op = 'UPDATE' then
    if old.iditem <> new.iditem then
      if old.date_retour_reelle is null then
        update items set stock_actuel = stock_actuel + old.qte where id = old.iditem;
      end if;
      if new.date_retour_reelle is null then
        select stock_actuel into available from items where id = new.iditem for update;
        if available < new.qte then
          raise exception 'Stock insuffisant pour cet article (disponible: %, demandé: %)', available, new.qte;
        end if;
        update items set stock_actuel = stock_actuel - new.qte where id = new.iditem;
      end if;
    else
      if old.date_retour_reelle is null and new.date_retour_reelle is not null then
        update items set stock_actuel = stock_actuel + old.qte where id = new.iditem;
      elsif old.date_retour_reelle is not null and new.date_retour_reelle is null then
        select stock_actuel into available from items where id = new.iditem for update;
        if available < new.qte then
          raise exception 'Stock insuffisant pour cet article (disponible: %, demandé: %)', available, new.qte;
        end if;
        update items set stock_actuel = stock_actuel - new.qte where id = new.iditem;
      elsif old.date_retour_reelle is null and new.date_retour_reelle is null and old.qte <> new.qte then
        if new.qte > old.qte then
          select stock_actuel into available from items where id = new.iditem for update;
          if available < (new.qte - old.qte) then
            raise exception 'Stock insuffisant pour cet article (disponible: %, demandé: %)', available, new.qte - old.qte;
          end if;
        end if;
        update items set stock_actuel = stock_actuel - (new.qte - old.qte) where id = new.iditem;
      end if;
    end if;
    return new;

  elsif tg_op = 'DELETE' then
    if old.date_retour_reelle is null then
      update items set stock_actuel = stock_actuel + old.qte where id = old.iditem;
    end if;
    return old;
  end if;
end;
$$ language plpgsql;

create trigger trg_commande_lignes_stock
before insert or update or delete on commande_lignes
for each row execute function commande_lignes_apply_stock();

-- Keep commandes.statut in sync: 'retourne' once every line has a return
-- date, 'en_cours' otherwise (a freshly created order with no lines yet
-- is left untouched).
create or replace function commandes_sync_status() returns trigger as $$
declare
  cmd_id bigint;
  total integer;
  remaining integer;
begin
  cmd_id := coalesce(new.id_commande, old.id_commande);
  select count(*) into total from commande_lignes where id_commande = cmd_id;
  if total = 0 then
    return null;
  end if;
  select count(*) into remaining from commande_lignes where id_commande = cmd_id and date_retour_reelle is null;
  if remaining = 0 then
    update commandes set statut = 'retourne' where id = cmd_id and statut <> 'retourne';
  else
    update commandes set statut = 'en_cours' where id = cmd_id and statut = 'retourne';
  end if;
  return null;
end;
$$ language plpgsql;

create trigger trg_commandes_sync_status
after insert or update or delete on commande_lignes
for each row execute function commandes_sync_status();

-- ─── Migrate existing data from commandeclient ──────────────────────────
alter table commandes add column legacy_id bigint;

insert into commandes (idclients, date_debut, date_fin_prevue, statut, created_at, legacy_id)
select
  idclients,
  debut_location,
  fin_location,
  case when fin_location is not null and fin_location <= current_date then 'retourne' else 'en_cours' end,
  created_at,
  id
from commandeclient;

alter table commande_lignes disable trigger trg_commande_lignes_stock;

insert into commande_lignes (id_commande, iditem, qte, prix, date_retour_reelle, created_at)
select
  c.id,
  l.iditem,
  l.qte,
  l.prix,
  case when l.fin_location is not null and l.fin_location <= current_date then l.fin_location else null end,
  l.created_at
from commandeclient l
join commandes c on c.legacy_id = l.id;

alter table commande_lignes enable trigger trg_commande_lignes_stock;

alter table commandes drop column legacy_id;

alter table commandeclient rename to commandeclient_legacy;
