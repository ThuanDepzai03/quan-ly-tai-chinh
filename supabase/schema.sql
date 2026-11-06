-- Quản lý tài chính — Supabase schema (Postgres)
-- Chạy toàn bộ file 1 lần trong SQL Editor. Region khuyên dùng: Singapore.
-- Gồm: 16 bảng + RLS cho cả 16 bảng + trigger trừ/cộng tồn kho + hàm tính thuế.
-- Tài khoản demo demo@quanlytaichinh.vn / 123456 CHỈ ở bản demo local,
-- không có trong Supabase — hãy đăng ký tài khoản thật qua Supabase Auth.

create extension if not exists "pgcrypto";

-- v5: các cột bổ sung cho tính năng đã có ở bản demo nhưng thiếu ở schema cũ.
-- Chạy lại toàn bộ file trong SQL Editor là an toàn (IF NOT EXISTS).
alter table if exists transactions add column if not exists to_wallet_id uuid references wallets(id) on delete set null;
alter table if exists transactions add column if not exists receipt_image text;
alter table if exists products add column if not exists image text;
alter table if exists workspaces add column if not exists tncn_deduction numeric not null default 11000000;

-- ============ KHỐI A: 16 bảng ============
create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null,
  mode text not null check (mode in ('personal','household','team')),
  tax_circular text not null default 'TT88/2021',
  vat_rate numeric not null default 0.01,
  tncn_rate numeric not null default 0.005,
  tndn_rate numeric not null default 0.20,
  mon_bai numeric not null default 1000000,
  created_at timestamptz default now()
);
create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member','viewer')),
  unique(workspace_id, user_id)
);
create table if not exists wallets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  name text not null,
  type text not null default 'cash',
  balance numeric not null default 0,
  currency text not null default 'VND',
  created_at timestamptz default now()
);
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('income','expense')),
  color text,
  icon text
);
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  wallet_id uuid references wallets(id) on delete set null,
  category_id uuid references categories(id) on delete set null,
  product_id uuid,
  variant_id uuid,
  imei text,
  type text not null check (type in ('income','expense','transfer')),
  amount numeric not null check (amount >= 0),
  quantity numeric not null default 1,
  unit_price numeric,
  cost_price numeric,
  profit numeric,
  tax_type text,
  tax_rate numeric,
  note text,
  date date not null default current_date,
  created_at timestamptz default now()
);
create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  category_id uuid references categories(id) on delete cascade,
  month text not null,
  amount numeric not null,
  unique(workspace_id, category_id, month)
);
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  name text not null,
  target numeric not null,
  saved numeric not null default 0,
  deadline date
);
create table if not exists debts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('borrow','lend')),
  amount numeric not null,
  paid numeric not null default 0,
  due_date date
);
create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  title text not null,
  amount numeric,
  next_date date,
  frequency text not null default 'monthly'
);
create table if not exists product_categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  name text not null,
  color text,
  icon text
);
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  category_id uuid references product_categories(id) on delete set null,
  name text not null,
  sku text,
  unit text not null default 'cái',
  cost_price numeric not null default 0,
  sale_price numeric not null default 0,
  stock numeric not null default 0,
  min_stock numeric not null default 0,
  custom_values jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);
create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  name text not null,
  cost_price numeric not null default 0,
  sale_price numeric not null default 0,
  stock numeric not null default 0,
  imeis text[] not null default '{}'
);
create table if not exists product_fields (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  name text not null,
  field_type text not null check (field_type in ('text','number','date','select','boolean')),
  required boolean not null default false,
  enabled boolean not null default true,
  options jsonb
);
create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  product_id uuid references products(id) on delete cascade,
  variant_id uuid references product_variants(id) on delete set null,
  kind text not null check (kind in ('in','out')),
  quantity numeric not null,
  imei text,
  note text,
  created_at timestamptz default now()
);
create table if not exists tax_payments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  tax_type text not null check (tax_type in ('VAT','TNCN','TNDN','mon_bai')),
  period text not null,
  amount numeric not null,
  paid boolean not null default false,
  due_date date,
  note text
);
create table if not exists tax_settings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade unique,
  circular text not null default 'TT88/2021',
  vat_rate numeric not null default 0.01,
  tncn_rate numeric not null default 0.005,
  tndn_rate numeric not null default 0.20,
  mon_bai numeric not null default 1000000
);

create index if not exists idx_tx_ws_date on transactions(workspace_id, date desc);
create index if not exists idx_tx_product on transactions(product_id);
create index if not exists idx_products_ws on products(workspace_id);
create index if not exists idx_variants_product on product_variants(product_id);
create index if not exists idx_wallets_ws on wallets(workspace_id);

-- ============ KHỐI B: helper + RLS cho cả 16 bảng ============
create or replace function is_workspace_member(wid uuid)
returns boolean language sql stable as $$
  select exists (select 1 from members where workspace_id = wid and user_id = auth.uid())
      or exists (select 1 from workspaces where id = wid and owner_id = auth.uid());
$$;

-- Bật RLS cho mọi bảng có workspace_id (trừ product_variants nối qua products).
alter table workspaces enable row level security;
alter table members enable row level security;
alter table wallets enable row level security;
alter table categories enable row level security;
alter table transactions enable row level security;
alter table budgets enable row level security;
alter table goals enable row level security;
alter table debts enable row level security;
alter table reminders enable row level security;
alter table product_categories enable row level security;
alter table products enable row level security;
alter table product_variants enable row level security;
alter table product_fields enable row level security;
alter table stock_movements enable row level security;
alter table tax_payments enable row level security;
alter table tax_settings enable row level security;

-- Tạo policy đọc/ghi cho từng bảng theo is_workspace_member().
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'members','wallets','categories','transactions','budgets','goals','debts',
    'reminders','product_categories','products','product_fields',
    'stock_movements','tax_payments','tax_settings'
  ]) loop
    begin
      execute format('create policy "members all %s" on %I for all using (is_workspace_member(workspace_id)) with check (is_workspace_member(workspace_id))', t, t);
    exception when duplicate_object then null;
    end;
  end loop;
  begin
    execute 'create policy "members read workspaces" on workspaces for select using (is_workspace_member(id))';
  exception when duplicate_object then null;
  end;
  begin
    execute 'create policy "owner manage workspaces" on workspaces for all using (owner_id = auth.uid()) with check (owner_id = auth.uid())';
  exception when duplicate_object then null;
  end;
  begin
    execute 'create policy "members read variants" on product_variants for select using (exists (select 1 from products p where p.id = product_variants.product_id and is_workspace_member(p.workspace_id)))';
  exception when duplicate_object then null;
  end;
  begin
    execute 'create policy "members manage variants" on product_variants for all using (exists (select 1 from products p where p.id = product_variants.product_id and is_workspace_member(p.workspace_id))) with check (exists (select 1 from products p where p.id = product_variants.product_id and is_workspace_member(p.workspace_id)))';
  exception when duplicate_object then null;
  end;
end $$;

-- ============ KHỐI C: trigger trừ/cộng tồn kho (chặn âm kho) ============
create or replace function apply_stock() returns trigger language plpgsql as $$
begin
  if new.kind = 'out' then
    update products set stock = greatest(0, stock - new.quantity) where id = new.product_id;
    if new.variant_id is not null then
      update product_variants set stock = greatest(0, stock - new.quantity) where id = new.variant_id;
      if new.imei is not null then
        update product_variants set imeis = array_remove(imeis, new.imei) where id = new.variant_id;
      end if;
    end if;
  else
    update products set stock = stock + new.quantity where id = new.product_id;
    if new.variant_id is not null then
      update product_variants set stock = stock + new.quantity where id = new.variant_id;
      if new.imei is not null then
        update product_variants set imeis = array_append(imeis, new.imei) where id = new.variant_id;
      end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_stock on stock_movements;
create trigger trg_stock after insert on stock_movements
  for each row execute function apply_stock();

-- ============ KHỐI D: hàm tính thuế TT88 (dùng ở SQL khi cần) ============
create or replace function tax88(revenue numeric, vat_rate numeric default 0.01, tncn_rate numeric default 0.005)
returns table (vat numeric, tncn numeric, total numeric) language sql immutable as $$
  select round(revenue * vat_rate), round(revenue * tncn_rate), round(revenue * (vat_rate + tncn_rate));
$$;

-- Storage bucket cho hóa đơn (tạo trong Dashboard > Storage nếu cần): invoices (private).
-- insert into storage.buckets (id, name, public) values ('invoices', 'invoices', false)
--   on conflict (id) do nothing;
