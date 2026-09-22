-- Pantalla pública: incluye started_at (para el anillo de progreso) y oculta negocios suspendidos
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
  where b.public_token = p_token and b.status = 'active'
$$;
