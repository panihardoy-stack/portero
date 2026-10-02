-- =====================================================================
-- PORTERO · Modelo de datos, roles y Row Level Security
-- Pegar completo en Supabase → SQL Editor → New query → Run
-- =====================================================================

-- ---------- 1. TABLAS ----------

-- Perfil de cada usuario (1 a 1 con auth.users). El rol vive acá.
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nombre      text,
  rol         text not null default 'vecino' check (rol in ('vecino', 'admin')),
  unidad_id   bigint,                       -- se completa al unirse a un edificio
  created_at  timestamptz not null default now()
);

create table public.edificios (
  id                 bigint generated always as identity primary key,
  nombre             text not null,
  direccion          text,
  codigo_invitacion  text not null unique default substr(md5(random()::text), 1, 6),
  admin_id           uuid not null references public.profiles(id),
  created_at         timestamptz not null default now()
);

create table public.unidades (
  id           bigint generated always as identity primary key,
  edificio_id  bigint not null references public.edificios(id) on delete cascade,
  nombre       text not null,               -- ej: "3B"
  unique (edificio_id, nombre)
);

alter table public.profiles
  add constraint profiles_unidad_fk
  foreign key (unidad_id) references public.unidades(id) on delete set null;

create table public.proveedores (
  id         bigint generated always as identity primary key,
  admin_id   uuid not null references public.profiles(id),
  nombre     text not null,
  categoria  text not null check (categoria in
             ('sanitaria', 'electrica', 'ascensor', 'humedad', 'cerrajeria', 'otros')),
  email      text,
  telefono   text
);

create table public.reclamos (
  id                bigint generated always as identity primary key,
  unidad_id         bigint not null references public.unidades(id),
  vecino_id         uuid not null default auth.uid() references public.profiles(id),
  descripcion       text not null,
  foto_path         text,                   -- ruta en Supabase Storage (bucket privado)

  -- Lo que sugirió la IA
  ia_categoria      text,
  ia_urgencia       text check (ia_urgencia in ('baja', 'media', 'alta')),
  ia_proveedor_id   bigint references public.proveedores(id),
  ia_justificacion  text,

  -- Lo que decidió el admin (para medir el acierto de la IA)
  categoria         text,
  urgencia          text check (urgencia in ('baja', 'media', 'alta')),
  proveedor_id      bigint references public.proveedores(id),

  estado            text not null default 'nuevo'
                    check (estado in ('nuevo', 'asignado', 'agendado', 'resuelto')),
  created_at        timestamptz not null default now(),
  resuelto_at       timestamptz
);

create table public.visitas (
  id                 bigint generated always as identity primary key,
  reclamo_id         bigint not null references public.reclamos(id) on delete cascade,
  proveedor_id       bigint not null references public.proveedores(id),
  fecha              timestamptz not null,
  calendar_event_id  text,                  -- id del evento creado por n8n en Google Calendar
  created_at         timestamptz not null default now()
);

-- ---------- 2. PERFIL AUTOMÁTICO AL REGISTRARSE ----------

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nombre)
  values (new.id, new.raw_user_meta_data ->> 'nombre');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Crear perfil para los usuarios que ya existían (ej: el de prueba)
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

-- ---------- 3. PROTECCIÓN DEL ROL ----------
-- El usuario solo puede editar su nombre. El rol y la unidad
-- se cambian únicamente desde el servidor o el panel de Supabase.

revoke update on public.profiles from anon, authenticated;
grant update (nombre) on public.profiles to authenticated;

-- ---------- 4. FUNCIONES AUXILIARES PARA RLS ----------

create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and rol = 'admin');
$$;

create or replace function public.mi_unidad()
returns bigint language sql stable security definer set search_path = public as $$
  select unidad_id from profiles where id = auth.uid();
$$;

create or replace function public.mi_edificio()
returns bigint language sql stable security definer set search_path = public as $$
  select u.edificio_id from unidades u where u.id = public.mi_unidad();
$$;

create or replace function public.administra_edificio(e bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from edificios where id = e and admin_id = auth.uid());
$$;

create or replace function public.administra_unidad(u bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from unidades un
    join edificios e on e.id = un.edificio_id
    where un.id = u and e.admin_id = auth.uid()
  );
$$;

-- ---------- 5. ROW LEVEL SECURITY ----------

alter table public.profiles    enable row level security;
alter table public.edificios   enable row level security;
alter table public.unidades    enable row level security;
alter table public.proveedores enable row level security;
alter table public.reclamos    enable row level security;
alter table public.visitas     enable row level security;

-- profiles
create policy "ver mi perfil" on public.profiles
  for select using (id = auth.uid());
create policy "admin ve vecinos de sus edificios" on public.profiles
  for select using (public.administra_unidad(unidad_id));
create policy "editar mi perfil" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- edificios
create policy "admin gestiona sus edificios" on public.edificios
  for all using (admin_id = auth.uid())
  with check (admin_id = auth.uid() and public.es_admin());
create policy "vecino ve su edificio" on public.edificios
  for select using (id = public.mi_edificio());

-- unidades
create policy "admin gestiona unidades de sus edificios" on public.unidades
  for all using (public.administra_edificio(edificio_id))
  with check (public.administra_edificio(edificio_id));
create policy "vecino ve su unidad" on public.unidades
  for select using (id = public.mi_unidad());

-- proveedores (solo el admin)
create policy "admin gestiona sus proveedores" on public.proveedores
  for all using (admin_id = auth.uid())
  with check (admin_id = auth.uid() and public.es_admin());

-- reclamos
create policy "vecino ve sus reclamos" on public.reclamos
  for select using (vecino_id = auth.uid());
create policy "vecino crea reclamos en su unidad" on public.reclamos
  for insert with check (vecino_id = auth.uid() and unidad_id = public.mi_unidad());
create policy "admin ve reclamos de sus edificios" on public.reclamos
  for select using (public.administra_unidad(unidad_id));
create policy "admin actualiza reclamos de sus edificios" on public.reclamos
  for update using (public.administra_unidad(unidad_id))
  with check (public.administra_unidad(unidad_id));

-- visitas
create policy "admin gestiona visitas de sus edificios" on public.visitas
  for all using (exists (
    select 1 from public.reclamos r
    where r.id = reclamo_id and public.administra_unidad(r.unidad_id)))
  with check (exists (
    select 1 from public.reclamos r
    where r.id = reclamo_id and public.administra_unidad(r.unidad_id)));
create policy "vecino ve visitas de sus reclamos" on public.visitas
  for select using (exists (
    select 1 from public.reclamos r
    where r.id = reclamo_id and r.vecino_id = auth.uid()));