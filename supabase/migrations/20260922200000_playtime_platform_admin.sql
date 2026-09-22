-- Super-admin de plataforma, catálogo de planes SaaS y suspensión de negocios.
-- Ya aplicada en dear-guest-admin.

-- ===== Super-admin de la plataforma PlayTime =====
create table public.playtime_platform_admins (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);
insert into public.playtime_platform_admins(email) values ('gvbustamante02@gmail.com');
alter table public.playtime_platform_admins enable row level security;

create or replace function public.playtime_is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.playtime_platform_admins a
    join auth.users u on lower(u.email) = a.email
    where u.id = (select auth.uid()) and u.email_confirmed_at is not null
  )
$$;
revoke all on function public.playtime_is_platform_admin() from public, anon;
grant execute on function public.playtime_is_platform_admin() to authenticated;

create policy playtime_platform_admins_select on public.playtime_platform_admins for select to authenticated
  using (public.playtime_is_platform_admin());

-- ===== Catálogo de planes SaaS =====
create table public.playtime_saas_plans (
  id text primary key,
  name text not null,
  price_monthly numeric(12,2) not null default 0 check (price_monthly >= 0),
  currency text not null default 'COP',
  max_devices int,            -- null = ilimitado
  max_sessions_month int,     -- null = ilimitado
  max_members int,            -- null = ilimitado
  features text[] not null default '{}',
  sort_order int not null default 0,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.playtime_saas_plans (id, name, price_monthly, max_devices, max_sessions_month, max_members, features, sort_order) values
  ('free', 'Gratis', 0, 1, 300, 1, array['Cronómetro','Registro básico'], 1),
  ('basic', 'Básico', 49000, 1, null, 2, array['Sesiones ilimitadas','Historial','Tarifas','Reportes'], 2),
  ('pro', 'Pro', 99000, 3, null, 5, array['Múltiples dispositivos','Sincronización','Empleados','Pantalla pública','Reportes avanzados'], 3),
  ('business', 'Business', 199000, null, null, null, array['Múltiples sedes','Administración centralizada','Estadísticas','Usuarios ilimitados'], 4);
alter table public.playtime_saas_plans enable row level security;
create policy playtime_saas_plans_select on public.playtime_saas_plans for select to authenticated using (true);
create policy playtime_saas_plans_admin on public.playtime_saas_plans for all to authenticated
  using (public.playtime_is_platform_admin()) with check (public.playtime_is_platform_admin());

-- ===== Campos de administración en negocios =====
alter table public.playtime_businesses
  add column saas_plan text not null default 'free' references public.playtime_saas_plans(id),
  add column status text not null default 'active' check (status in ('active','suspended')),
  add column plan_expires_at timestamptz;
create index playtime_businesses_saas_plan_idx on public.playtime_businesses(saas_plan);

-- Solo el super-admin puede cambiar plan/estado/vencimiento
create or replace function public.playtime_protect_admin_fields()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not public.playtime_is_platform_admin() and current_user in ('authenticated','anon') then
    new.saas_plan := old.saas_plan;
    new.status := old.status;
    new.plan_expires_at := old.plan_expires_at;
  end if;
  return new;
end $$;
create trigger playtime_businesses_protect before update on public.playtime_businesses
  for each row execute function public.playtime_protect_admin_fields();

-- Notas internas (solo super-admin)
create table public.playtime_admin_notes (
  business_id uuid primary key references public.playtime_businesses(id) on delete cascade,
  notes text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.playtime_admin_notes enable row level security;
create policy playtime_admin_notes_admin on public.playtime_admin_notes for all to authenticated
  using (public.playtime_is_platform_admin()) with check (public.playtime_is_platform_admin());

-- ===== Negocio suspendido = sin acceso a datos =====
create or replace function public.playtime_role(p_business_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select m.role from public.playtime_members m
  join public.playtime_businesses b on b.id = m.business_id
  where m.business_id = p_business_id and m.user_id = (select auth.uid()) and b.status = 'active'
$$;

create or replace function public.playtime_is_member(p_business_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.playtime_members where business_id = p_business_id and user_id = (select auth.uid()))
$$;
revoke all on function public.playtime_is_member(uuid) from public, anon;
grant execute on function public.playtime_is_member(uuid) to authenticated;

drop policy playtime_businesses_select on public.playtime_businesses;
create policy playtime_businesses_select on public.playtime_businesses for select to authenticated
  using (public.playtime_is_member(id));
drop policy playtime_members_select on public.playtime_members;
create policy playtime_members_select on public.playtime_members for select to authenticated
  using (user_id = (select auth.uid()) or public.playtime_role(business_id) is not null);

-- ===== Acceso total del super-admin =====
do $$
declare t text;
begin
  foreach t in array array['playtime_businesses','playtime_members','playtime_children','playtime_plans','playtime_sessions','playtime_extensions','playtime_payments'] loop
    execute format('create policy %I on public.%I for all to authenticated using (public.playtime_is_platform_admin()) with check (public.playtime_is_platform_admin())', t || '_platform_admin', t);
  end loop;
end $$;

-- ===== RPCs del panel admin =====
create or replace function public.playtime_admin_overview()
returns table (
  id uuid, name text, phone text, address text, currency text, saas_plan text, status text,
  plan_expires_at timestamptz, created_at timestamptz,
  owner_email text, members int, children int,
  sessions_total int, sessions_month int, active_now int,
  revenue_month numeric, revenue_total numeric, last_activity timestamptz
) language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.playtime_is_platform_admin() then raise exception 'forbidden'; end if;
  return query
  select b.id, b.name, b.phone, b.address, b.currency, b.saas_plan, b.status, b.plan_expires_at, b.created_at,
    (select m.email from public.playtime_members m where m.business_id = b.id and m.role = 'owner' order by m.created_at limit 1),
    (select count(*)::int from public.playtime_members m where m.business_id = b.id),
    (select count(*)::int from public.playtime_children c where c.business_id = b.id),
    (select count(*)::int from public.playtime_sessions s where s.business_id = b.id and s.status <> 'cancelled'),
    (select count(*)::int from public.playtime_sessions s where s.business_id = b.id and s.status <> 'cancelled' and s.started_at >= date_trunc('month', now())),
    (select count(*)::int from public.playtime_sessions s where s.business_id = b.id and s.status = 'active'),
    (select coalesce(sum(p.amount),0) from public.playtime_payments p join public.playtime_sessions s on s.id = p.session_id
       where p.business_id = b.id and s.status <> 'cancelled' and p.created_at >= date_trunc('month', now())),
    (select coalesce(sum(p.amount),0) from public.playtime_payments p join public.playtime_sessions s on s.id = p.session_id
       where p.business_id = b.id and s.status <> 'cancelled'),
    (select max(s.updated_at) from public.playtime_sessions s where s.business_id = b.id)
  from public.playtime_businesses b
  order by b.created_at desc;
end $$;
revoke all on function public.playtime_admin_overview() from public, anon;
grant execute on function public.playtime_admin_overview() to authenticated;

-- Agregar una cuenta existente (por correo) a un negocio: super-admin o dueño
create or replace function public.playtime_add_member(p_business_id uuid, p_email text, p_role text default 'employee')
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;
begin
  if not (public.playtime_is_platform_admin() or public.playtime_role(p_business_id) = 'owner') then
    raise exception 'forbidden';
  end if;
  if p_role not in ('owner','admin','employee') then raise exception 'rol inválido'; end if;
  select u.id into v_uid from auth.users u where lower(u.email) = lower(trim(p_email));
  if v_uid is null then raise exception 'No existe una cuenta con ese correo. La persona debe registrarse primero.'; end if;
  insert into public.playtime_members (business_id, user_id, email, role)
  values (p_business_id, v_uid, lower(trim(p_email)), p_role)
  on conflict (business_id, user_id) do update set role = excluded.role;
end $$;
revoke all on function public.playtime_add_member(uuid, text, text) from public, anon;
grant execute on function public.playtime_add_member(uuid, text, text) to authenticated;
