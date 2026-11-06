-- Quản lý tài chính — Supabase schema (Postgres)
-- Chạy toàn bộ file 1 lần trong SQL Editor. Region khuyên dùng: Singapore.
-- Gồm: 16 bảng + RLS cho cả 16 bảng + hàm tính thuế.
-- Tài khoản demo demo@quanlytaichinh.vn / 123456 CHỈ ở bản demo local,
-- không có trong Supabase — hãy đăng ký tài khoản thật qua Supabase Auth.

create extension if not exists "pgcrypto";

-- ============ KHỐI A: 16 bảng ============
create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null,
  mode text not null check (mode in ('personal','household','team')),
  tax_circular text not null default 'TT88/2021',
  tax_method text not null default 'turnover_tncn'
    check (tax_method in ('turnover_tncn','profit_tndn','progressive_tncn')),
  vat_rate numeric not null default 0.01,
  tncn_rate numeric not null default 0.005,
  tndn_rate numeric not null default 0.20,
  mon_bai numeric not null default 1000000,
  tncn_deduction numeric not null default 11000000,
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
  occurred_at timestamptz not null default now(),
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
  person text not null default 'Khoản nợ mới',
  name text not null,
  kind text not null check (kind in ('borrow','lend')),
  amount numeric not null,
  paid numeric not null default 0,
  start_date date,
  due_date date,
  payment_history jsonb not null default '[]'::jsonb
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
  workspace_id uuid not null references workspaces(id) on delete cascade,
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
  tax_method text not null default 'turnover_tncn'
    check (tax_method in ('turnover_tncn','profit_tndn','progressive_tncn')),
  vat_rate numeric not null default 0.01,
  tncn_rate numeric not null default 0.005,
  tndn_rate numeric not null default 0.20,
  mon_bai numeric not null default 1000000
);

-- Nâng cấp các bảng đã tồn tại từ schema cũ. CREATE TABLE IF NOT EXISTS không
-- bổ sung cột còn thiếu, vì vậy các cột ứng dụng đang dùng phải được khai báo
-- lại bằng ALTER ... IF NOT EXISTS để có thể chạy an toàn nhiều lần.
alter table workspaces
  add column if not exists owner_id uuid references auth.users(id) on delete cascade,
  add column if not exists name text not null default 'Không gian của tôi',
  add column if not exists mode text not null default 'household',
  add column if not exists tax_circular text not null default 'TT88/2021',
  add column if not exists tax_method text not null default 'turnover_tncn'
    check (tax_method in ('turnover_tncn','profit_tndn','progressive_tncn')),
  add column if not exists vat_rate numeric not null default 0.01,
  add column if not exists tncn_rate numeric not null default 0.005,
  add column if not exists tndn_rate numeric not null default 0.20,
  add column if not exists mon_bai numeric not null default 1000000,
  add column if not exists tncn_deduction numeric not null default 11000000,
  add column if not exists created_at timestamptz default now();
alter table members
  add column if not exists workspace_id uuid references workspaces(id) on delete cascade,
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists role text not null default 'member';
alter table wallets
  add column if not exists workspace_id uuid references workspaces(id) on delete cascade,
  add column if not exists name text not null default 'Ví mới',
  add column if not exists type text not null default 'cash',
  add column if not exists balance numeric not null default 0,
  add column if not exists currency text not null default 'VND',
  add column if not exists created_at timestamptz default now();
alter table categories
  add column if not exists workspace_id uuid references workspaces(id) on delete cascade,
  add column if not exists name text not null default 'Danh mục mới',
  add column if not exists kind text not null default 'expense',
  add column if not exists color text,
  add column if not exists icon text;
alter table transactions
  add column if not exists workspace_id uuid references workspaces(id) on delete cascade,
  add column if not exists wallet_id uuid references wallets(id) on delete set null,
  add column if not exists to_wallet_id uuid references wallets(id) on delete set null,
  add column if not exists category_id uuid references categories(id) on delete set null,
  add column if not exists product_id uuid,
  add column if not exists variant_id uuid,
  add column if not exists imei text,
  add column if not exists type text not null default 'expense',
  add column if not exists amount numeric not null default 0,
  add column if not exists quantity numeric not null default 1,
  add column if not exists unit_price numeric,
  add column if not exists cost_price numeric,
  add column if not exists profit numeric,
  add column if not exists tax_type text,
  add column if not exists tax_rate numeric,
  add column if not exists receipt_image text,
  add column if not exists note text,
  add column if not exists date date not null default current_date,
  add column if not exists occurred_at timestamptz default now(),
  add column if not exists created_at timestamptz default now();
update transactions
set occurred_at = date::timestamptz
where occurred_at is null;
alter table transactions
  alter column occurred_at set default now(),
  alter column occurred_at set not null;
-- Một số database cũ có cột transactions.kind NOT NULL; ứng dụng hiện dùng
-- transactions.type. Cho phép cột legacy để trống để không chặn giao dịch mới.
alter table transactions add column if not exists kind text;
alter table transactions alter column kind drop not null;
alter table budgets
  add column if not exists workspace_id uuid references workspaces(id) on delete cascade,
  add column if not exists category_id uuid references categories(id) on delete cascade,
  add column if not exists month text not null default to_char(current_date, 'YYYY-MM'),
  add column if not exists amount numeric not null default 0;
alter table goals
  add column if not exists workspace_id uuid references workspaces(id) on delete cascade,
  add column if not exists name text not null default 'Mục tiêu mới',
  add column if not exists target numeric not null default 0,
  add column if not exists saved numeric not null default 0,
  add column if not exists deadline date;
alter table debts
  add column if not exists workspace_id uuid references workspaces(id) on delete cascade,
  add column if not exists person text,
  add column if not exists name text not null default 'Khoản nợ mới',
  add column if not exists kind text not null default 'borrow',
  add column if not exists amount numeric not null default 0,
  add column if not exists paid numeric not null default 0,
  add column if not exists start_date date,
  add column if not exists due_date date,
  add column if not exists payment_history jsonb not null default '[]'::jsonb;
update debts
set person = coalesce(nullif(btrim(person), ''), nullif(btrim(name), ''), 'Khoản nợ mới')
where person is null or btrim(person) = '';
alter table debts
  alter column person set default 'Khoản nợ mới',
  alter column person set not null;
alter table reminders
  add column if not exists workspace_id uuid references workspaces(id) on delete cascade,
  add column if not exists title text not null default 'Nhắc việc mới',
  add column if not exists amount numeric,
  add column if not exists next_date date default current_date,
  add column if not exists frequency text not null default 'monthly';
alter table product_categories
  add column if not exists workspace_id uuid references workspaces(id) on delete cascade,
  add column if not exists name text not null default 'Danh mục mới',
  add column if not exists color text,
  add column if not exists icon text;
alter table products
  add column if not exists workspace_id uuid references workspaces(id) on delete cascade,
  add column if not exists category_id uuid references product_categories(id) on delete set null,
  add column if not exists name text not null default 'Sản phẩm mới',
  add column if not exists sku text,
  add column if not exists unit text not null default 'cái',
  add column if not exists cost_price numeric not null default 0,
  add column if not exists sale_price numeric not null default 0,
  add column if not exists stock numeric not null default 0,
  add column if not exists min_stock numeric not null default 0,
  add column if not exists custom_values jsonb not null default '{}'::jsonb,
  add column if not exists image text,
  add column if not exists created_at timestamptz default now();
alter table product_variants
  add column if not exists workspace_id uuid references workspaces(id) on delete cascade,
  add column if not exists product_id uuid references products(id) on delete cascade,
  add column if not exists name text not null default 'Biến thể mới',
  add column if not exists cost_price numeric not null default 0,
  add column if not exists sale_price numeric not null default 0,
  add column if not exists stock numeric not null default 0,
  add column if not exists imeis text[] not null default '{}';
update product_variants v
set workspace_id = p.workspace_id
from products p
where v.product_id = p.id
  and v.workspace_id is null;
alter table product_variants
  alter column workspace_id set not null;
alter table product_fields
  add column if not exists workspace_id uuid references workspaces(id) on delete cascade,
  add column if not exists name text not null default 'Thuộc tính mới',
  add column if not exists field_type text not null default 'text',
  add column if not exists required boolean not null default false,
  add column if not exists enabled boolean not null default true,
  add column if not exists options jsonb;
alter table stock_movements
  add column if not exists workspace_id uuid references workspaces(id) on delete cascade,
  add column if not exists product_id uuid references products(id) on delete cascade,
  add column if not exists variant_id uuid references product_variants(id) on delete set null,
  add column if not exists kind text not null default 'in',
  add column if not exists quantity numeric not null default 0,
  add column if not exists imei text,
  add column if not exists note text,
  add column if not exists created_at timestamptz default now();
alter table tax_payments
  add column if not exists workspace_id uuid references workspaces(id) on delete cascade,
  add column if not exists tax_type text not null default 'VAT',
  add column if not exists period text not null default to_char(current_date, 'YYYY-MM'),
  add column if not exists amount numeric not null default 0,
  add column if not exists paid boolean not null default false,
  add column if not exists due_date date,
  add column if not exists note text;
alter table tax_settings
  add column if not exists workspace_id uuid references workspaces(id) on delete cascade,
  add column if not exists circular text not null default 'TT88/2021',
  add column if not exists tax_method text not null default 'turnover_tncn'
    check (tax_method in ('turnover_tncn','profit_tndn','progressive_tncn')),
  add column if not exists vat_rate numeric not null default 0.01,
  add column if not exists tncn_rate numeric not null default 0.005,
  add column if not exists tndn_rate numeric not null default 0.20,
  add column if not exists mon_bai numeric not null default 1000000;

create index if not exists idx_tx_ws_date on transactions(workspace_id, date desc);
create index if not exists idx_tx_product on transactions(product_id);
create index if not exists idx_products_ws on products(workspace_id);
create index if not exists idx_variants_product on product_variants(product_id);
create index if not exists idx_wallets_ws on wallets(workspace_id);

-- ============ KHỐI B: helper + RLS cho cả 16 bảng ============
create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.members as m
    where m.workspace_id = ws
      and m.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.workspaces as w
    where w.id = ws
      and w.owner_id = (select auth.uid())
  );
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

-- ============ KHỐI C: tồn kho được cập nhật cùng state trong ứng dụng ============
-- Không cộng/trừ stock lần thứ hai ở DB: giao dịch bán/nhập đã cập nhật stock
-- và IMEI trong state trước khi đồng bộ cả products lẫn stock_movements.
drop trigger if exists trg_stock on stock_movements;

-- ============ KHỐI D: hàm tính thuế TT88 (dùng ở SQL khi cần) ============
create or replace function tax88(revenue numeric, vat_rate numeric default 0.01, tncn_rate numeric default 0.005)
returns table (vat numeric, tncn numeric, total numeric) language sql immutable as $$
  select round(revenue * vat_rate), round(revenue * tncn_rate), round(revenue * (vat_rate + tncn_rate));
$$;

-- Storage bucket cho hóa đơn (tạo trong Dashboard > Storage nếu cần): invoices (private).
-- insert into storage.buckets (id, name, public) values ('invoices', 'invoices', false)
--   on conflict (id) do nothing;
