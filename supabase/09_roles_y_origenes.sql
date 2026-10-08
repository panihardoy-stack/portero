-- =====================================================================
-- Portero: los dos últimos valores fijos pasan a tablas catálogo
-- (rol del usuario y origen del reclamo), igual que categorías, urgencias y estados.
-- Correr una sola vez en Supabase → SQL Editor, después de 08. No borra datos.
-- =====================================================================
begin;

create table public.roles (
  codigo       text primary key,
  nombre       text not null,
  descripcion  text not null
);
insert into public.roles (codigo, nombre, descripcion) values
  ('vecino', 'Vecino', 'Hace reclamos de su unidad y sigue su avance.'),
  ('admin',  'Administración', 'Gestiona los reclamos, proveedores y vecinos de sus edificios.');

create table public.origenes (
  codigo       text primary key,
  nombre       text not null,
  descripcion  text not null
);
insert into public.origenes (codigo, nombre, descripcion) values
  ('app',       'App',       'Lo cargó un vecino desde la aplicación.'),
  ('historico', 'Histórico', 'Carga masiva de reclamos anteriores, para el dashboard.');

alter table public.profiles drop constraint if exists profiles_rol_check;
alter table public.profiles
  add constraint profiles_rol_fk foreign key (rol) references public.roles (codigo);

alter table public.reclamos drop constraint if exists reclamos_origen_check;
alter table public.reclamos
  add constraint reclamos_origen_fk foreign key (origen) references public.origenes (codigo);

-- Catálogos de solo lectura para cualquier usuario con sesión
alter table public.roles    enable row level security;
alter table public.origenes enable row level security;
create policy "leer roles"    on public.roles    for select to authenticated using (true);
create policy "leer origenes" on public.origenes for select to authenticated using (true);

commit;
