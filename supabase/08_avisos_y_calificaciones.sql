-- =====================================================================
-- Portero: avisos al vecino y calificación del arreglo
-- Correr una sola vez en Supabase → SQL Editor, después de 07.
-- Todo va en una transacción: si algo falla, no se aplica nada.
-- =====================================================================
begin;

-- ---------- 1. CALIFICACIONES ----------
-- Una por reclamo. No guarda el vecino ni el proveedor: se obtienen del reclamo.
create table public.calificaciones (
  reclamo_id  bigint primary key references public.reclamos (id) on delete cascade,
  puntaje     smallint not null check (puntaje between 1 and 5),
  comentario  text check (char_length(comentario) <= 500),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.calificaciones enable row level security;

-- El vecino califica (y puede corregir) solo sus propios reclamos, y solo si están resueltos
create policy "vecino califica sus reclamos resueltos" on public.calificaciones
  for all using (exists (
    select 1 from public.reclamos r
    where r.id = reclamo_id and r.vecino_id = auth.uid()))
  with check (exists (
    select 1 from public.reclamos r
    where r.id = reclamo_id and r.vecino_id = auth.uid() and r.estado = 'resuelto'));

-- El admin lee las calificaciones de los reclamos de sus edificios
create policy "admin ve calificaciones de sus edificios" on public.calificaciones
  for select using (exists (
    select 1 from public.reclamos r
    where r.id = reclamo_id and public.administra_unidad(r.unidad_id)));

-- ---------- 2. AVISOS AL VECINO ----------
-- Cola de mails: la base anota cada cambio que hay que avisar y n8n los manda.
-- estado = qué pasó (asignado, agendado o resuelto); visita_id solo para "agendado".
create table public.avisos_vecino (
  id          bigint generated always as identity primary key,
  reclamo_id  bigint not null references public.reclamos (id) on delete cascade,
  estado      text not null references public.estados (codigo),
  visita_id   bigint references public.visitas (id) on delete cascade,
  created_at  timestamptz not null default now(),
  enviado_at  timestamptz
);

create index avisos_vecino_pendientes on public.avisos_vecino (created_at) where enviado_at is null;

-- Nadie la lee desde la app: solo los disparadores escriben y n8n lee
alter table public.avisos_vecino enable row level security;
revoke all on public.avisos_vecino from anon, authenticated;

-- Al asignar, resolver o reabrir un reclamo de la app, se anota el aviso
create or replace function public.anotar_aviso_reclamo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.origen = 'app' and new.vecino_id is not null
     and new.estado in ('asignado', 'resuelto')
     and new.estado is distinct from old.estado then
    insert into avisos_vecino (reclamo_id, estado) values (new.id, new.estado);
  end if;
  return new;
end;
$$;

create trigger aviso_al_cambiar_estado
  after update of estado on public.reclamos
  for each row execute function public.anotar_aviso_reclamo();

-- Cada visita nueva (también si se cambia la fecha) avisa con la fecha.
-- "Agendado" se avisa acá y no en el cambio de estado, para no mandar dos mails.
create or replace function public.anotar_aviso_visita()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into avisos_vecino (reclamo_id, estado, visita_id)
  select r.id, 'agendado', new.id
  from reclamos r
  where r.id = new.reclamo_id and r.origen = 'app' and r.vecino_id is not null;
  return new;
end;
$$;

create trigger aviso_al_agendar
  after insert on public.visitas
  for each row execute function public.anotar_aviso_visita();

commit;
