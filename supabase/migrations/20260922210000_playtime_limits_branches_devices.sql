-- Límites por plan, extras, sedes, dispositivos y contacto de la plataforma.
-- Ya aplicada en dear-guest-admin (migraciones playtime_limits_branches_devices + playtime_limits_fix_guards).

-- ===== Sedes (un nivel) =====
alter table public.playtime_businesses
  add column parent_id uuid references public.playtime_businesses(id) on delete cascade,
  add column timezone text not null default 'America/Bogota';
create index playtime_businesses_parent_idx on public.playtime_businesses(parent_id);

create or replace function public.playtime_check_parent()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.parent_id is not null then
    if new.parent_id = new.id then raise exception 'Una sede no puede ser su propio principal'; end if;
    if exists (select 1 from public.playtime_businesses p where p.id = new.parent_id and p.parent_id is not null) then
      raise exception 'Las sedes solo pueden colgar de un negocio principal';
    end if;
  end if;
  return new;
end $$;
create trigger playtime_businesses_parent before insert or update of parent_id on public.playtime_businesses
  for each row execute function public.playtime_check_parent();

create or replace function public.playtime_root(p_business_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select coalesce(parent_id, id) from public.playtime_businesses where id = p_business_id
$$;
revoke all on function public.playtime_root(uuid) from public, anon;
grant execute on function public.playtime_root(uuid) to authenticated;

create or replace function public.playtime_role(p_business_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select m.role from public.playtime_members m
  join public.playtime_businesses b on b.id = m.business_id
  join public.playtime_businesses r on r.id = coalesce(b.parent_id, b.id)
  where m.business_id = p_business_id and m.user_id = (select auth.uid()) and r.status = 'active'
$$;

alter table public.playtime_saas_plans add column max_branches int;
update public.playtime_saas_plans set max_branches = case id when 'free' then 1 when 'basic' then 1 when 'pro' then 2 else null end;

-- ===== Extras =====
create table public.playtime_plan_extras (
  id uuid primary key default gen_random_uuid(),
  root_id uuid not null references public.playtime_businesses(id) on delete cascade,
  kind text not null check (kind in ('sessions','members','devices','branches')),
  amount int not null check (amount > 0),
  valid_until timestamptz,
  note text,
  created_at timestamptz not null default now()
);
create index playtime_plan_extras_root_idx on public.playtime_plan_extras(root_id);
alter table public.playtime_plan_extras enable row level security;
create policy playtime_plan_extras_admin on public.playtime_plan_extras for all to authenticated
  using (public.playtime_is_platform_admin()) with check (public.playtime_is_platform_admin());
create policy playtime_plan_extras_select on public.playtime_plan_extras for select to authenticated
  using (public.playtime_is_member(root_id));

-- ===== Dispositivos =====
create table public.playtime_devices (
  id uuid primary key,
  root_id uuid not null references public.playtime_businesses(id) on delete cascade,
  business_id uuid not null references public.playtime_businesses(id) on delete cascade,
  name text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index playtime_devices_root_idx on public.playtime_devices(root_id);
create index playtime_devices_business_idx on public.playtime_devices(business_id);
alter table public.playtime_devices enable row level security;
create policy playtime_devices_admin on public.playtime_devices for all to authenticated
  using (public.playtime_is_platform_admin()) with check (public.playtime_is_platform_admin());
create policy playtime_devices_select on public.playtime_devices for select to authenticated
  using (public.playtime_role(root_id) is not null or public.playtime_role(business_id) is not null);
create policy playtime_devices_delete on public.playtime_devices for delete to authenticated
  using (public.playtime_role(root_id) in ('owner','admin'));

-- ===== Contacto de la plataforma =====
create table public.playtime_platform_settings (
  id int primary key default 1 check (id = 1),
  contact_whatsapp text,
  contact_email text,
  updated_at timestamptz not null default now()
);
insert into public.playtime_platform_settings(id) values (1);
alter table public.playtime_platform_settings enable row level security;
create policy playtime_platform_settings_select on public.playtime_platform_settings for select to authenticated using (true);
create policy playtime_platform_settings_admin on public.playtime_platform_settings for all to authenticated
  using (public.playtime_is_platform_admin()) with check (public.playtime_is_platform_admin());
create policy playtime_platform_admins_write on public.playtime_platform_admins for all to authenticated
  using (public.playtime_is_platform_admin()) with check (public.playtime_is_platform_admin());

-- ===== Límites y uso =====
create or replace function public.playtime_month_start(p_root uuid)
returns timestamptz language sql stable security definer set search_path = '' as $$
  select (date_trunc('month', now() at time zone b.timezone)) at time zone b.timezone
  from public.playtime_businesses b where b.id = p_root
$$;

create or replace function public.playtime_limit(p_root uuid, p_kind text)
returns int language plpgsql stable security definer set search_path = '' as $$
declare v_base int; v_extra int;
begin
  select case p_kind
      when 'sessions' then sp.max_sessions_month
      when 'members' then sp.max_members
      when 'devices' then sp.max_devices
      when 'branches' then sp.max_branches end
    into v_base
  from public.playtime_businesses b join public.playtime_saas_plans sp on sp.id = b.saas_plan
  where b.id = p_root;
  if v_base is null then return null; end if;
  select coalesce(sum(amount), 0) into v_extra from public.playtime_plan_extras
  where root_id = p_root and kind = p_kind and (valid_until is null or valid_until > now());
  return v_base + v_extra;
end $$;

create or replace function public.playtime_used(p_root uuid, p_kind text)
returns int language sql stable security definer set search_path = '' as $$
  select case p_kind
    when 'sessions' then (select count(*)::int from public.playtime_sessions s
      join public.playtime_businesses b on b.id = s.business_id
      where coalesce(b.parent_id, b.id) = p_root and s.status <> 'cancelled' and s.started_at >= public.playtime_month_start(p_root))
    when 'members' then (select count(distinct m.user_id)::int from public.playtime_members m
      join public.playtime_businesses b on b.id = m.business_id where coalesce(b.parent_id, b.id) = p_root)
    when 'devices' then (select count(*)::int from public.playtime_devices d where d.root_id = p_root)
    when 'branches' then (select count(*)::int from public.playtime_businesses b where coalesce(b.parent_id, b.id) = p_root)
  end
$$;
revoke all on function public.playtime_month_start(uuid) from public, anon;
revoke all on function public.playtime_limit(uuid, text) from public, anon;
revoke all on function public.playtime_used(uuid, text) from public, anon;
grant execute on function public.playtime_limit(uuid, text) to authenticated;
grant execute on function public.playtime_used(uuid, text) to authenticated;
grant execute on function public.playtime_month_start(uuid) to authenticated;

create or replace function public.playtime_usage(p_business_id uuid)
returns json language plpgsql stable security definer set search_path = '' as $$
declare v_root uuid; r record; k text; v_limits jsonb := '{}'; v_used jsonb := '{}'; s record;
begin
  v_root := public.playtime_root(p_business_id);
  if v_root is null then raise exception 'negocio no existe'; end if;
  if not (public.playtime_is_member(p_business_id) or public.playtime_is_member(v_root) or public.playtime_is_platform_admin()) then
    raise exception 'forbidden';
  end if;
  select b.*, sp.name as plan_name, sp.price_monthly, sp.currency as plan_currency into r
  from public.playtime_businesses b join public.playtime_saas_plans sp on sp.id = b.saas_plan where b.id = v_root;
  foreach k in array array['sessions','members','devices','branches'] loop
    v_limits := v_limits || jsonb_build_object(k, public.playtime_limit(v_root, k));
    v_used := v_used || jsonb_build_object(k, public.playtime_used(v_root, k));
  end loop;
  select contact_whatsapp, contact_email into s from public.playtime_platform_settings where id = 1;
  return json_build_object(
    'root_id', v_root, 'root_name', r.name,
    'plan_id', r.saas_plan, 'plan_name', r.plan_name, 'plan_price', r.price_monthly, 'plan_currency', r.plan_currency,
    'status', r.status, 'plan_expires_at', r.plan_expires_at,
    'expired', r.plan_expires_at is not null and r.plan_expires_at < now(),
    'month_start', public.playtime_month_start(v_root),
    'limits', v_limits, 'used', v_used,
    'contact', json_build_object('whatsapp', s.contact_whatsapp, 'email', s.contact_email),
    'server_time', now()
  );
end $$;
revoke all on function public.playtime_usage(uuid) from public, anon;
grant execute on function public.playtime_usage(uuid) to authenticated;

-- ===== Bloqueos (auth.uid() null = SQL/servicio; el super-admin no se bloquea) =====
create or replace function public.playtime_enforce_session_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_root uuid; v_limit int; v_exp timestamptz;
begin
  if (select auth.uid()) is null or public.playtime_is_platform_admin() then return new; end if;
  v_root := public.playtime_root(new.business_id);
  select plan_expires_at into v_exp from public.playtime_businesses where id = v_root;
  if v_exp is not null and new.started_at > v_exp + interval '12 hours' then
    raise exception 'PLAYTIME_PLAN_EXPIRED: el plan venció el %', v_exp;
  end if;
  v_limit := public.playtime_limit(v_root, 'sessions');
  -- margen de 10 para entradas hechas sin internet; la app bloquea exactamente en el límite
  if v_limit is not null and public.playtime_used(v_root, 'sessions') >= v_limit + 10 then
    raise exception 'PLAYTIME_SESSION_LIMIT: límite de % entradas del mes alcanzado', v_limit;
  end if;
  return new;
end $$;
create trigger playtime_sessions_limit before insert on public.playtime_sessions
  for each row execute function public.playtime_enforce_session_limit();

create or replace function public.playtime_enforce_member_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_root uuid; v_limit int;
begin
  if (select auth.uid()) is null or public.playtime_is_platform_admin() then return new; end if;
  v_root := public.playtime_root(new.business_id);
  if exists (select 1 from public.playtime_members m join public.playtime_businesses b on b.id = m.business_id
             where m.user_id = new.user_id and coalesce(b.parent_id, b.id) = v_root) then return new; end if;
  v_limit := public.playtime_limit(v_root, 'members');
  if v_limit is not null and public.playtime_used(v_root, 'members') >= v_limit then
    raise exception 'PLAYTIME_MEMBER_LIMIT: tu plan permite % cuentas', v_limit;
  end if;
  return new;
end $$;
create trigger playtime_members_limit before insert on public.playtime_members
  for each row execute function public.playtime_enforce_member_limit();

create or replace function public.playtime_protect_admin_fields()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not public.playtime_is_platform_admin() then
    new.saas_plan := old.saas_plan;
    new.status := old.status;
    new.plan_expires_at := old.plan_expires_at;
    new.parent_id := old.parent_id;
  end if;
  return new;
end $$;

-- ===== Crear sede =====
create or replace function public.playtime_create_branch(p_root uuid, p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_limit int; r record;
begin
  if not (public.playtime_is_platform_admin() or public.playtime_role(p_root) = 'owner') then raise exception 'forbidden'; end if;
  select * into r from public.playtime_businesses where id = p_root;
  if r.id is null or r.parent_id is not null then raise exception 'Elige el negocio principal'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Escribe el nombre de la sede'; end if;
  v_limit := public.playtime_limit(p_root, 'branches');
  if not public.playtime_is_platform_admin() and v_limit is not null and public.playtime_used(p_root, 'branches') >= v_limit then
    raise exception 'PLAYTIME_BRANCH_LIMIT: tu plan permite % sede(s)', v_limit;
  end if;
  insert into public.playtime_businesses (name, parent_id, currency, alert_minutes, sound_enabled, timezone, saas_plan, phone)
  values (trim(p_name), p_root, r.currency, r.alert_minutes, r.sound_enabled, r.timezone, r.saas_plan, r.phone)
  returning id into v_id;
  insert into public.playtime_members (business_id, user_id, name, email, role)
  select v_id, m.user_id, m.name, m.email, m.role from public.playtime_members m
  where m.business_id = p_root and m.role in ('owner','admin');
  insert into public.playtime_plans (business_id, name, duration_minutes, price, is_extension, sort_order)
  select v_id, p.name, p.duration_minutes, p.price, p.is_extension, p.sort_order from public.playtime_plans p
  where p.business_id = p_root and p.active;
  return v_id;
end $$;
revoke all on function public.playtime_create_branch(uuid, text) from public, anon;
grant execute on function public.playtime_create_branch(uuid, text) to authenticated;

-- ===== Registrar dispositivo =====
create or replace function public.playtime_register_device(p_business_id uuid, p_device_id uuid, p_name text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_root uuid; v_limit int;
begin
  if public.playtime_role(p_business_id) is null then raise exception 'forbidden'; end if;
  v_root := public.playtime_root(p_business_id);
  if exists (select 1 from public.playtime_devices where id = p_device_id and root_id = v_root) then
    update public.playtime_devices set last_seen_at = now(), business_id = p_business_id,
      name = coalesce(nullif(trim(p_name), ''), name) where id = p_device_id;
    return 'ok';
  end if;
  v_limit := public.playtime_limit(v_root, 'devices');
  if v_limit is not null and public.playtime_used(v_root, 'devices') >= v_limit then
    raise exception 'PLAYTIME_DEVICE_LIMIT: tu plan permite % dispositivo(s)', v_limit;
  end if;
  insert into public.playtime_devices (id, root_id, business_id, name) values (p_device_id, v_root, p_business_id, nullif(trim(p_name), ''))
  on conflict (id) do update set root_id = excluded.root_id, business_id = excluded.business_id, last_seen_at = now();
  return 'ok';
end $$;
revoke all on function public.playtime_register_device(uuid, uuid, text) from public, anon;
grant execute on function public.playtime_register_device(uuid, uuid, text) to authenticated;

-- ===== Pantalla pública: estado del principal =====
create or replace function public.playtime_public_board(p_token uuid)
returns json language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'business', json_build_object('name', b.name, 'logo_url', b.logo_url),
    'server_time', now(),
    'sessions', coalesce((
      select json_agg(json_build_object('id', s.id, 'child_name', s.child_name, 'started_at', s.started_at, 'expires_at', s.expires_at) order by s.expires_at)
      from public.playtime_sessions s
      where s.business_id = b.id and s.status = 'active'
    ), '[]'::json)
  )
  from public.playtime_businesses b
  join public.playtime_businesses r on r.id = coalesce(b.parent_id, b.id)
  where b.public_token = p_token and r.status = 'active'
$$;

-- ===== Resumen admin con parent_id y dispositivos =====
drop function public.playtime_admin_overview();
create or replace function public.playtime_admin_overview()
returns table (
  id uuid, parent_id uuid, name text, phone text, address text, currency text, saas_plan text, status text,
  plan_expires_at timestamptz, created_at timestamptz,
  owner_email text, members int, children int,
  sessions_total int, sessions_month int, active_now int,
  revenue_month numeric, revenue_total numeric, last_activity timestamptz, devices int
) language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.playtime_is_platform_admin() then raise exception 'forbidden'; end if;
  return query
  select b.id, b.parent_id, b.name, b.phone, b.address, b.currency, b.saas_plan, b.status, b.plan_expires_at, b.created_at,
    (select m.email from public.playtime_members m where m.business_id = b.id and m.role = 'owner' order by m.created_at limit 1),
    (select count(*)::int from public.playtime_members m where m.business_id = b.id),
    (select count(*)::int from public.playtime_children c where c.business_id = b.id),
    (select count(*)::int from public.playtime_sessions s where s.business_id = b.id and s.status <> 'cancelled'),
    (select count(*)::int from public.playtime_sessions s where s.business_id = b.id and s.status <> 'cancelled'
       and s.started_at >= public.playtime_month_start(coalesce(b.parent_id, b.id))),
    (select count(*)::int from public.playtime_sessions s where s.business_id = b.id and s.status = 'active'),
    (select coalesce(sum(p.amount),0) from public.playtime_payments p join public.playtime_sessions s on s.id = p.session_id
       where p.business_id = b.id and s.status <> 'cancelled' and p.created_at >= public.playtime_month_start(coalesce(b.parent_id, b.id))),
    (select coalesce(sum(p.amount),0) from public.playtime_payments p join public.playtime_sessions s on s.id = p.session_id
       where p.business_id = b.id and s.status <> 'cancelled'),
    (select max(s.updated_at) from public.playtime_sessions s where s.business_id = b.id),
    (select count(*)::int from public.playtime_devices d where d.business_id = b.id)
  from public.playtime_businesses b
  order by b.created_at desc;
end $$;
revoke all on function public.playtime_admin_overview() from public, anon;
grant execute on function public.playtime_admin_overview() to authenticated;

-- Funciones internas: no expuestas por la API
revoke execute on function public.playtime_enforce_session_limit() from public, anon, authenticated;
revoke execute on function public.playtime_enforce_member_limit() from public, anon, authenticated;
revoke execute on function public.playtime_limit(uuid, text) from authenticated;
revoke execute on function public.playtime_used(uuid, text) from authenticated;
revoke execute on function public.playtime_month_start(uuid) from authenticated;
revoke execute on function public.playtime_root(uuid) from authenticated;
