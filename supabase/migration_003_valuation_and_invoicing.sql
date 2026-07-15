-- Migration 003: weighted-average stock valuation (CUMP), invoicing, and
-- company settings.
--
-- Run this once in the Supabase SQL Editor, after migration_002.

-- ─── CUMP (coût moyen unitaire pondéré) stock valuation ─────────────────
-- `qte_totale` tracks total quantity ever owned (purchases in, regardless
-- of whether currently on loan) — this is the weight used for the average
-- cost. `stock_actuel` keeps meaning "available to loan right now" exactly
-- as before, untouched by this migration's cost logic.
alter table items add column if not exists qte_totale integer not null default 0;
alter table items add column if not exists cout_moyen numeric(10, 2) not null default 0;

create or replace function apply_purchase_cost(p_item_id bigint, p_qte integer, p_prix numeric) returns void as $$
declare
  cur_total integer;
  cur_cout numeric;
  new_total integer;
begin
  select qte_totale, cout_moyen into cur_total, cur_cout from items where id = p_item_id for update;
  new_total := cur_total + p_qte;
  if new_total <= 0 then
    update items set qte_totale = new_total, stock_actuel = stock_actuel + p_qte where id = p_item_id;
  else
    update items set
      qte_totale = new_total,
      stock_actuel = stock_actuel + p_qte,
      cout_moyen = (cur_total * coalesce(cur_cout, 0) + p_qte * coalesce(p_prix, cur_cout, 0)) / new_total
    where id = p_item_id;
  end if;
end;
$$ language plpgsql;

create or replace function reverse_purchase_cost(p_item_id bigint, p_qte integer, p_prix numeric) returns void as $$
declare
  cur_total integer;
  cur_cout numeric;
  new_total integer;
begin
  select qte_totale, cout_moyen into cur_total, cur_cout from items where id = p_item_id for update;
  new_total := cur_total - p_qte;
  if new_total <= 0 then
    update items set qte_totale = new_total, stock_actuel = stock_actuel - p_qte where id = p_item_id;
  else
    update items set
      qte_totale = new_total,
      stock_actuel = stock_actuel - p_qte,
      cout_moyen = greatest((cur_total * coalesce(cur_cout, 0) - p_qte * coalesce(p_prix, cur_cout, 0)) / new_total, 0)
    where id = p_item_id;
  end if;
end;
$$ language plpgsql;

-- Replace the achats trigger function (from migration_002) so it also
-- maintains qte_totale / cout_moyen. The trigger itself doesn't need to be
-- recreated since it already points at this function by name.
create or replace function achats_apply_stock() returns trigger as $$
begin
  if tg_op = 'INSERT' then
    perform apply_purchase_cost(new.iditem, new.qte, new.prix_achat);
  elsif tg_op = 'UPDATE' then
    perform reverse_purchase_cost(old.iditem, old.qte, old.prix_achat);
    perform apply_purchase_cost(new.iditem, new.qte, new.prix_achat);
  elsif tg_op = 'DELETE' then
    perform reverse_purchase_cost(old.iditem, old.qte, old.prix_achat);
  end if;
  return null;
end;
$$ language plpgsql;

-- One-time backfill: replay existing achats history (chronologically) to
-- compute qte_totale / cout_moyen for items that already had purchases
-- before this migration. This does NOT touch stock_actuel (already correct
-- from migration_002's triggers) — only cost-basis fields.
create or replace function backfill_apply_cost(p_item_id bigint, p_qte integer, p_prix numeric) returns void as $$
declare
  cur_total integer;
  cur_cout numeric;
  new_total integer;
begin
  select qte_totale, cout_moyen into cur_total, cur_cout from items where id = p_item_id for update;
  new_total := cur_total + p_qte;
  if new_total <= 0 then
    update items set qte_totale = new_total where id = p_item_id;
  else
    update items set
      qte_totale = new_total,
      cout_moyen = (cur_total * coalesce(cur_cout, 0) + p_qte * coalesce(p_prix, cur_cout, 0)) / new_total
    where id = p_item_id;
  end if;
end;
$$ language plpgsql;

do $$
declare
  r record;
begin
  update items set qte_totale = 0, cout_moyen = 0;
  for r in (
    select iditem, qte, prix_achat
    from achats
    order by iditem, date_achat, created_at, id
  ) loop
    perform backfill_apply_cost(r.iditem, r.qte, r.prix_achat);
  end loop;
end;
$$;

drop function backfill_apply_cost(bigint, integer, numeric);

-- ─── Company settings (invoice letterhead) ──────────────────────────────
create table parametres (
  id integer primary key default 1,
  nom_entreprise text,
  adresse text,
  ice text,
  telephone text,
  email text,
  taux_tva_defaut numeric(5, 2) not null default 20,
  constraint parametres_singleton check (id = 1)
);

insert into parametres (id) values (1);

alter table parametres enable row level security;
create policy "authenticated full access" on parametres
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ─── Invoicing ───────────────────────────────────────────────────────────
create sequence facture_numero_seq;

create table factures (
  id bigint generated always as identity primary key,
  id_commande bigint references commandes (id) on delete set null,
  idclients bigint not null references clients (id) on delete cascade,
  numero text unique,
  date_facture date not null default current_date,
  taux_tva numeric(5, 2) not null default 20,
  statut_paiement text not null default 'impayee' check (statut_paiement in ('impayee', 'partielle', 'payee')),
  mode_paiement text,
  date_paiement date,
  notes text,
  created_at timestamptz not null default now()
);

create table facture_lignes (
  id bigint generated always as identity primary key,
  id_facture bigint not null references factures (id) on delete cascade,
  description text not null,
  qte integer not null check (qte > 0),
  prix_unitaire numeric(10, 2) not null default 0,
  created_at timestamptz not null default now()
);

alter table factures enable row level security;
alter table facture_lignes enable row level security;
create policy "authenticated full access" on factures
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on facture_lignes
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create or replace function set_facture_numero() returns trigger as $$
begin
  if new.numero is null then
    new.numero := 'FACT-' || to_char(new.date_facture, 'YYYY') || '-' || lpad(nextval('facture_numero_seq')::text, 4, '0');
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_set_facture_numero
before insert on factures
for each row execute function set_facture_numero();
