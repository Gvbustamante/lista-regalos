-- Buenas prácticas RLS (ya aplicada en dear-guest-admin):
-- * Helpers en esquema privado (no expuestos por la API REST).
-- * Una política por tabla y acción (sin políticas permisivas duplicadas).
-- * "business_id in (select ...)" y "(select is_admin())": se evalúan una vez por consulta, no por fila.

create schema if not exists playtime_private;
revoke all on schema playtime_private from public;
grant usage on schema playtime_private to authenticated;

create or replace function playtime_private.my_business_ids(p_roles text[] default null, p_include_suspended boolean default false)
returns setof uuid language sql stable security definer set search_path = '' as $$
  select m.business_id
  from public.playtime_members m
  join public.playtime_businesses b on b.id = m.business_id
  join public.playtime_businesses r on r.id = coalesce(b.parent_id, b.id)
  where m.user_id = (select auth.uid())
    and (p_roles is null or m.role = any(p_roles))
    and (p_include_suspended or r.status = 'active')
$$;

create or replace function playtime_private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.playtime_platform_admins a
    join auth.users u on lower(u.email) = a.email
    where u.id = (select auth.uid()) and u.email_confirmed_at is not null
  )
$$;

revoke all on function playtime_private.my_business_ids(text[], boolean) from public;
revoke all on function playtime_private.is_admin() from public;
grant execute on function playtime_private.my_business_ids(text[], boolean) to authenticated;
grant execute on function playtime_private.is_admin() to authenticated;

do $$
declare p record;
begin
  for p in select policyname, tablename from pg_policies where schemaname = 'public' and tablename like 'playtime\_%' loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

create policy pt_select on public.playtime_businesses for select to authenticated
  using (id in (select playtime_private.my_business_ids(null, true)) or (select playtime_private.is_admin()));
create policy pt_update on public.playtime_businesses for update to authenticated
  using (id in (select playtime_private.my_business_ids(array['owner','admin'])) or (select playtime_private.is_admin()))
  with check (id in (select playtime_private.my_business_ids(array['owner','admin'])) or (select playtime_private.is_admin()));
create policy pt_insert on public.playtime_businesses for insert to authenticated with check ((select playtime_private.is_admin()));
create policy pt_delete on public.playtime_businesses for delete to authenticated using ((select playtime_private.is_admin()));

create policy pt_select on public.playtime_members for select to authenticated
  using (user_id = (select auth.uid()) or business_id in (select playtime_private.my_business_ids()) or (select playtime_private.is_admin()));
create policy pt_insert on public.playtime_members for insert to authenticated
  with check (business_id in (select playtime_private.my_business_ids(array['owner'])) or (select playtime_private.is_admin()));
create policy pt_update on public.playtime_members for update to authenticated
  using (business_id in (select playtime_private.my_business_ids(array['owner'])) or (select playtime_private.is_admin()))
  with check (business_id in (select playtime_private.my_business_ids(array['owner'])) or (select playtime_private.is_admin()));
create policy pt_delete on public.playtime_members for delete to authenticated
  using (business_id in (select playtime_private.my_business_ids(array['owner'])) or (select playtime_private.is_admin()));

do $$
declare t text;
begin
  foreach t in array array['playtime_children','playtime_sessions','playtime_extensions','playtime_payments'] loop
    execute format('create policy pt_select on public.%I for select to authenticated using (business_id in (select playtime_private.my_business_ids()) or (select playtime_private.is_admin()))', t);
    execute format('create policy pt_insert on public.%I for insert to authenticated with check (business_id in (select playtime_private.my_business_ids()) or (select playtime_private.is_admin()))', t);
    execute format('create policy pt_update on public.%I for update to authenticated using (business_id in (select playtime_private.my_business_ids()) or (select playtime_private.is_admin())) with check (business_id in (select playtime_private.my_business_ids()) or (select playtime_private.is_admin()))', t);
    execute format('create policy pt_delete on public.%I for delete to authenticated using ((select playtime_private.is_admin()))', t);
  end loop;
end $$;

create policy pt_select on public.playtime_plans for select to authenticated
  using (business_id in (select playtime_private.my_business_ids()) or (select playtime_private.is_admin()));
create policy pt_insert on public.playtime_plans for insert to authenticated
  with check (business_id in (select playtime_private.my_business_ids(array['owner','admin'])) or (select playtime_private.is_admin()));
create policy pt_update on public.playtime_plans for update to authenticated
  using (business_id in (select playtime_private.my_business_ids(array['owner','admin'])) or (select playtime_private.is_admin()))
  with check (business_id in (select playtime_private.my_business_ids(array['owner','admin'])) or (select playtime_private.is_admin()));
create policy pt_delete on public.playtime_plans for delete to authenticated using ((select playtime_private.is_admin()));

create policy pt_select on public.playtime_devices for select to authenticated
  using (root_id in (select playtime_private.my_business_ids()) or business_id in (select playtime_private.my_business_ids()) or (select playtime_private.is_admin()));
create policy pt_delete on public.playtime_devices for delete to authenticated
  using (root_id in (select playtime_private.my_business_ids(array['owner','admin'])) or (select playtime_private.is_admin()));
create policy pt_insert on public.playtime_devices for insert to authenticated with check ((select playtime_private.is_admin()));
create policy pt_update on public.playtime_devices for update to authenticated using ((select playtime_private.is_admin())) with check ((select playtime_private.is_admin()));

create policy pt_select on public.playtime_plan_extras for select to authenticated
  using (root_id in (select playtime_private.my_business_ids(null, true)) or (select playtime_private.is_admin()));
create policy pt_insert on public.playtime_plan_extras for insert to authenticated with check ((select playtime_private.is_admin()));
create policy pt_update on public.playtime_plan_extras for update to authenticated using ((select playtime_private.is_admin())) with check ((select playtime_private.is_admin()));
create policy pt_delete on public.playtime_plan_extras for delete to authenticated using ((select playtime_private.is_admin()));

do $$
declare t text;
begin
  foreach t in array array['playtime_saas_plans','playtime_platform_settings'] loop
    execute format('create policy pt_select on public.%I for select to authenticated using (true)', t);
    execute format('create policy pt_insert on public.%I for insert to authenticated with check ((select playtime_private.is_admin()))', t);
    execute format('create policy pt_update on public.%I for update to authenticated using ((select playtime_private.is_admin())) with check ((select playtime_private.is_admin()))', t);
    execute format('create policy pt_delete on public.%I for delete to authenticated using ((select playtime_private.is_admin()))', t);
  end loop;
end $$;

create policy pt_all on public.playtime_platform_admins for all to authenticated
  using ((select playtime_private.is_admin())) with check ((select playtime_private.is_admin()));
create policy pt_all on public.playtime_admin_notes for all to authenticated
  using ((select playtime_private.is_admin())) with check ((select playtime_private.is_admin()));

revoke execute on function public.playtime_role(uuid) from authenticated;
revoke execute on function public.playtime_is_member(uuid) from authenticated;

create index if not exists playtime_payments_business_created_idx on public.playtime_payments(business_id, created_at);
