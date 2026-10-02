create or replace function public.unirse_edificio(
  p_codigo text,
  p_unidad text,
  p_nombre text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_edificio bigint;
  v_unidad bigint;
begin
  if auth.uid() is null then
    raise exception 'Tenés que iniciar sesión';
  end if;

  select id into v_edificio
  from edificios
  where codigo_invitacion = lower(trim(p_codigo));

  if v_edificio is null then
    raise exception 'El código de invitación no es válido';
  end if;

  select id into v_unidad
  from unidades
  where edificio_id = v_edificio and upper(nombre) = upper(trim(p_unidad));

  if v_unidad is null then
    raise exception 'Esa unidad no existe en el edificio';
  end if;

  update profiles
  set unidad_id = v_unidad,
      nombre = coalesce(nullif(trim(p_nombre), ''), nombre)
  where id = auth.uid() and rol = 'vecino';

  if not found then
    raise exception 'Solo los vecinos pueden unirse a un edificio';
  end if;

  return 'ok';
end;
$$;

revoke execute on function public.unirse_edificio(text, text, text) from public, anon;
grant execute on function public.unirse_edificio(text, text, text) to authenticated;