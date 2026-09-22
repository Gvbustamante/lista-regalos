-- PlayTime Manager: todas las tablas con prefijo playtime_
-- Proyecto Supabase: dear-guest-admin (ytxhdqonncsvzpszzqub). Ya aplicada.
create table public.playtime_businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  phone text,
  address text,
  currency text not null default 'COP',
  alert_minutes int not null default 5 check (alert_minutes between 0 and 60),
  sound_enabled boolean not null default true,
  public_token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);

create table public.playtime_members (
  business_id uuid not null references public.playtime_businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  email text,
  role text not null default 'employee' check (role in ('owner','admin','employee')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index playtime_members_user_idx on public.playtime_members(user_id);

create table public.playtime_children (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.playtime_businesses(id) on delete cascade,
  name text not null,
  age int check (age is null or age between 0 and 18),
  guardian_name text,
  guardian_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);

create table public.playtime_plans (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.playtime_businesses(id) on delete cascade,
  name text not null,
  duration_minutes int not null check (duration_minutes > 0),
  price numeric(12,2) not null default 0 check (price >= 0),
  is_extension boolean not null default false,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);

create table public.playtime_sessions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.playtime_businesses(id) on delete cascade,
  child_id uuid not null references public.playtime_children(id),
  plan_id uuid references public.playtime_plans(id),
  child_name text not null,
  duration_minutes int not null check (duration_minutes > 0),
  price numeric(12,2) not null default 0 check (price >= 0),
  payment_method text not null check (payment_method in ('cash','nequi','daviplata','card','other')),
  started_at timestamptz not null,
  expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active','completed','cancelled')),
  finished_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);
create index playtime_sessions_child_idx on public.playtime_sessions(child_id);
create index playtime_sessions_plan_idx on public.playtime_sessions(plan_id);
create index playtime_sessions_status_idx on public.playtime_sessions(business_id, status);
create index playtime_sessions_started_idx on public.playtime_sessions(business_id, started_at);

create table public.playtime_extensions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.playtime_businesses(id) on delete cascade,
  session_id uuid not null references public.playtime_sessions(id) on delete cascade,
  minutes int not null check (minutes > 0),
  price numeric(12,2) not null default 0 check (price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);
create index playtime_extensions_session_idx on public.playtime_extensions(session_id);

create table public.playtime_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.playtime_businesses(id) on delete cascade,
  session_id uuid not null references public.playtime_sessions(id) on delete cascade,
  extension_id uuid references public.playtime_extensions(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0),
  method text not null check (method in ('cash','nequi','daviplata','card','other')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);
create index playtime_payments_session_idx on public.playtime_payments(session_id);
create index playtime_payments_extension_idx on public.playtime_payments(extension_id);

-- Índices de sincronización
create index playtime_businesses_sync_idx on public.playtime_businesses(synced_at);
create index playtime_children_sync_idx on public.playtime_children(business_id, synced_at);
create index playtime_plans_sync_idx on public.playtime_plans(business_id, synced_at);
create index playtime_sessions_sync_idx on public.playtime_sessions(business_id, synced_at);
create index playtime_extensions_sync_idx on public.playtime_extensions(business_id, synced_at);
create index playtime_payments_sync_idx on public.playtime_payments(business_id, synced_at);

-- synced_at lo pone siempre el servidor (cursor de sincronización)
create or replace function public.playtime_touch_synced_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.synced_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['playtime_businesses','playtime_children','playtime_plans','playtime_sessions','playtime_extensions','playtime_payments'] loop
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.playtime_touch_synced_at()', t || '_synced_at', t);
  end loop;
end $$;

-- Rol del usuario actual en un negocio
create or replace function public.playtime_role(p_business_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select role from public.playtime_members
  where business_id = p_business_id and user_id = (select auth.uid())
$$;
revoke all on function public.playtime_role(uuid) from public, anon;
grant execute on function public.playtime_role(uuid) to authenticated;

-- RLS
alter table public.playtime_businesses enable row level security;
alter table public.playtime_members enable row level security;
alter table public.playtime_children enable row level security;
alter table public.playtime_plans enable row level security;
alter table public.playtime_sessions enable row level security;
alter table public.playtime_extensions enable row level security;
alter table public.playtime_payments enable row level security;

create policy playtime_businesses_select on public.playtime_businesses for select to authenticated
  using (public.playtime_role(id) is not null);
create policy playtime_businesses_update on public.playtime_businesses for update to authenticated
  using (public.playtime_role(id) in ('owner','admin'))
  with check (public.playtime_role(id) in ('owner','admin'));

create policy playtime_members_select on public.playtime_members for select to authenticated
  using (public.playtime_role(business_id) is not null);
create policy playtime_members_write on public.playtime_members for all to authenticated
  using (public.playtime_role(business_id) = 'owner')
  with check (public.playtime_role(business_id) = 'owner');

create policy playtime_plans_select on public.playtime_plans for select to authenticated
  using (public.playtime_role(business_id) is not null);
create policy playtime_plans_insert on public.playtime_plans for insert to authenticated
  with check (public.playtime_role(business_id) in ('owner','admin'));
create policy playtime_plans_update on public.playtime_plans for update to authenticated
  using (public.playtime_role(business_id) in ('owner','admin'))
  with check (public.playtime_role(business_id) in ('owner','admin'));

do $$
declare t text;
begin
  foreach t in array array['playtime_children','playtime_sessions','playtime_extensions','playtime_payments'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.playtime_role(business_id) is not null)', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.playtime_role(business_id) is not null)', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.playtime_role(business_id) is not null) with check (public.playtime_role(business_id) is not null)', t || '_update', t);
  end loop;
end $$;

-- Crear negocio + dueño + tarifas por defecto
create or replace function public.playtime_create_business(p_name text, p_owner_name text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'name required'; end if;

  insert into public.playtime_businesses (name) values (trim(p_name)) returning id into v_id;

  insert into public.playtime_members (business_id, user_id, name, email, role)
  select v_id, v_uid, p_owner_name, u.email, 'owner' from auth.users u where u.id = v_uid;

  insert into public.playtime_plans (business_id, name, duration_minutes, price, is_extension, sort_order) values
    (v_id, 'Mini', 30, 10000, false, 1),
    (v_id, 'Diversión', 60, 18000, false, 2),
    (v_id, 'Aventura', 120, 30000, false, 3),
    (v_id, 'Extra', 30, 8000, true, 4);

  return v_id;
end $$;
revoke all on function public.playtime_create_business(text, text) from public, anon;
grant execute on function public.playtime_create_business(text, text) to authenticated;

-- Pantalla pública: solo nombre + vencimiento, acceso por token
create or replace function public.playtime_public_board(p_token uuid)
returns json language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'business', json_build_object('name', b.name, 'logo_url', b.logo_url),
    'server_time', now(),
    'sessions', coalesce((
      select json_agg(json_build_object('id', s.id, 'child_name', s.child_name, 'expires_at', s.expires_at) order by s.expires_at)
      from public.playtime_sessions s
      where s.business_id = b.id and s.status = 'active'
    ), '[]'::json)
  )
  from public.playtime_businesses b
  where b.public_token = p_token
$$;
revoke all on function public.playtime_public_board(uuid) from public;
grant execute on function public.playtime_public_board(uuid) to anon, authenticated;

-- Realtime
alter publication supabase_realtime add table
  public.playtime_businesses, public.playtime_children, public.playtime_plans,
  public.playtime_sessions, public.playtime_extensions, public.playtime_payments;
