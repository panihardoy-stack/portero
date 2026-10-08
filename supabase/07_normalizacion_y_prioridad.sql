-- =====================================================================
-- PORTERO · 07: normalización del modelo y criterio de prioridad
-- Conserva todos los datos existentes. Se ejecuta una sola vez,
-- completo, en Supabase → SQL Editor. Si algo falla, no se aplica nada.
-- =====================================================================

begin;

-- ---------- 1. CATÁLOGOS ----------
-- Antes, las categorías, urgencias y estados estaban escritos como texto
-- en varias tablas y en el código. Ahora viven en una sola tabla cada uno,
-- y las demás tablas los referencian con clave foránea.

-- La descripción es la que recibe la IA para clasificar: agregar una categoría
-- acá la suma a la app, a los filtros y a la IA sin tocar código.
create table public.categorias (
  codigo       text primary key,
  nombre       text not null,
  descripcion  text not null,
  orden        int  not null unique
);
insert into public.categorias (codigo, nombre, descripcion, orden) values
  ('sanitaria',  'Sanitaria',  'cañerías, canillas, desagües, inodoros, calefón, pérdidas de agua', 1),
  ('humedad',    'Humedad',    'manchas, filtraciones, goteras, moho, paredes o techos mojados', 2),
  ('electrica',  'Eléctrica',  'luces, enchufes, llaves térmicas, portero eléctrico, cables', 3),
  ('ascensor',   'Ascensor',   'cualquier falla del ascensor', 4),
  ('cerrajeria', 'Cerrajería', 'cerraduras, llaves, puertas que no cierran, buzones', 5),
  ('otros',      'Otros',      'lo que no entra en las anteriores: vidrios, pintura, ruidos, limpieza', 6);

-- El nivel permite "subir un nivel" de urgencia con una suma
create table public.urgencias (
  codigo       text primary key,
  nombre       text not null,
  descripcion  text not null,
  nivel        int  not null unique check (nivel between 1 and 3)
);
insert into public.urgencias (codigo, nombre, descripcion, nivel) values
  ('baja',  'Baja',  'algo estético o menor que puede esperar', 1),
  ('media', 'Media', 'afecta el uso normal de la unidad o del edificio, pero no empeora de un momento a otro', 2),
  ('alta',  'Alta',  'riesgo para las personas o un daño que empeora rápido: agua sin control, chispas u olor a quemado, gente atrapada en el ascensor, la puerta de entrada que no cierra', 3);

create table public.estados (
  codigo         text primary key,
  nombre_admin   text not null,
  nombre_vecino  text not null,
  orden          int  not null unique
);
insert into public.estados (codigo, nombre_admin, nombre_vecino, orden) values
  ('nuevo',    'Sin revisar', 'Recibido',        1),
  ('asignado', 'Asignado',    'Asignado',        2),
  ('agendado', 'Agendado',    'Visita agendada', 3),
  ('resuelto', 'Resuelto',    'Resuelto',        4);

-- Reemplazar las listas fijas (CHECK) por claves foráneas a los catálogos
alter table public.reclamos   drop constraint if exists reclamos_urgencia_check;
alter table public.reclamos   drop constraint if exists reclamos_estado_check;
alter table public.proveedores drop constraint if exists proveedores_categoria_check;

alter table public.reclamos
  add constraint reclamos_categoria_fk foreign key (categoria) references public.categorias (codigo),
  add constraint reclamos_urgencia_fk  foreign key (urgencia)  references public.urgencias (codigo),
  add constraint reclamos_estado_fk    foreign key (estado)    references public.estados (codigo);
alter table public.proveedores
  add constraint proveedores_categoria_fk foreign key (categoria) references public.categorias (codigo);

-- Coherencia entre estado y fecha de resolución (primero se corrigen datos viejos)
update public.reclamos set resuelto_at = null where estado <> 'resuelto' and resuelto_at is not null;
update public.reclamos set resuelto_at = created_at where estado = 'resuelto' and resuelto_at is null;
alter table public.reclamos
  add constraint reclamos_resuelto_coherente
  check ((estado = 'resuelto') = (resuelto_at is not null));

-- ---------- 2. SUGERENCIAS DE LA IA EN SU PROPIA TABLA ----------
-- Antes, reclamos tenía categoria/urgencia/proveedor dos veces (ia_* y la decisión del admin).
-- La sugerencia es otra entidad (relación 1 a 1 con el reclamo), con su modelo y su fecha.

create table public.sugerencias_ia (
  reclamo_id     bigint primary key references public.reclamos (id) on delete cascade,
  categoria      text   not null references public.categorias (codigo),
  urgencia       text   not null references public.urgencias (codigo),
  proveedor_id   bigint references public.proveedores (id) on delete set null,
  justificacion  text,
  modelo         text   not null default 'claude-haiku-4-5',
  created_at     timestamptz not null default now()
);

insert into public.sugerencias_ia (reclamo_id, categoria, urgencia, proveedor_id, justificacion)
select id, ia_categoria, coalesce(ia_urgencia, 'media'), ia_proveedor_id, ia_justificacion
from public.reclamos
where ia_categoria is not null;

alter table public.reclamos
  drop column ia_categoria,
  drop column ia_urgencia,
  drop column ia_proveedor_id,
  drop column ia_justificacion;

-- ---------- 3. VISITAS SIN PROVEEDOR REPETIDO ----------
-- El proveedor de la visita es el del reclamo: se obtiene por la relación.
alter table public.visitas drop column proveedor_id;

-- ---------- 4. TIPOS DE VECINO (criterio de prioridad) ----------
-- Cada tipo define cuántos niveles sube la urgencia y en qué categorías.
-- categorias = null significa "en todas".
create table public.tipos_vecino (
  codigo        text primary key,
  nombre        text not null,
  descripcion   text not null,
  sube_niveles  int  not null default 0 check (sube_niveles between 0 and 2),
  categorias    text[]
);
insert into public.tipos_vecino (codigo, nombre, descripcion, sube_niveles, categorias) values
  ('estandar',    'Estándar',    'Sin ajuste de urgencia.', 0, null),
  ('prioritario', 'Prioritario', 'En la unidad viven personas mayores, con movilidad reducida o niños chicos.',
                  1, array['ascensor', 'sanitaria', 'electrica']),
  ('conflictivo', 'Conflictivo', 'Tiene historial de quejas formales o conflictos con vecinos o la administración.',
                  1, null);

-- La clasificación la asigna el admin y el vecino nunca la ve.
-- Sin fila = estándar.
create table public.clasificacion_vecinos (
  vecino_id     uuid primary key references public.profiles (id) on delete cascade,
  tipo          text not null references public.tipos_vecino (codigo),
  motivo        text,
  asignado_por  uuid not null default auth.uid() references public.profiles (id),
  updated_at    timestamptz not null default now()
);

create or replace function public.administra_vecino(v uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    join unidades un on un.id = p.unidad_id
    join edificios e on e.id = un.edificio_id
    where p.id = v and e.admin_id = auth.uid()
  );
$$;

-- ---------- 5. SEGURIDAD DE LAS TABLAS NUEVAS ----------
alter table public.categorias            enable row level security;
alter table public.urgencias             enable row level security;
alter table public.estados               enable row level security;
alter table public.tipos_vecino          enable row level security;
alter table public.sugerencias_ia        enable row level security;
alter table public.clasificacion_vecinos enable row level security;

-- Los catálogos los lee cualquier usuario con sesión; nadie los modifica desde la app
create policy "leer categorias"   on public.categorias   for select to authenticated using (true);
create policy "leer urgencias"    on public.urgencias    for select to authenticated using (true);
create policy "leer estados"      on public.estados      for select to authenticated using (true);
create policy "admin lee tipos"   on public.tipos_vecino for select to authenticated using (public.es_admin());

-- La sugerencia la escribe solo el servidor (clave secreta); el admin la lee
create policy "admin ve sugerencias de sus edificios" on public.sugerencias_ia
  for select using (exists (
    select 1 from public.reclamos r
    where r.id = reclamo_id and public.administra_unidad(r.unidad_id)));

-- La clasificación de cada vecino solo la ve y la cambia su admin
create policy "admin gestiona la clasificacion de sus vecinos" on public.clasificacion_vecinos
  for all using (public.administra_vecino(vecino_id))
  with check (public.administra_vecino(vecino_id) and asignado_por = auth.uid());

-- ---------- 6. VISTA CON LA URGENCIA CALCULADA ----------
-- Una sola definición de la regla, que usan la app y n8n.
-- security_invoker: la vista respeta el RLS de quien la consulta.
create or replace view public.reclamos_detalle
with (security_invoker = true) as
with base as (
  select
    r.id, r.descripcion, r.foto_path, r.estado, r.origen,
    r.created_at, r.resuelto_at, r.aviso_urgente_at,
    r.categoria, r.urgencia, r.proveedor_id,
    r.unidad_id, u.nombre as unidad,
    u.edificio_id, e.nombre as edificio, e.direccion,
    r.vecino_id, p.nombre as vecino,
    s.categoria as ia_categoria, s.urgencia as ia_urgencia,
    s.proveedor_id as ia_proveedor_id, s.justificacion as ia_justificacion,
    coalesce(cv.tipo, 'estandar') as tipo_vecino,
    coalesce(r.categoria, s.categoria) as categoria_efectiva,
    coalesce(r.urgencia,  s.urgencia)  as urgencia_base
  from public.reclamos r
  join public.unidades  u on u.id = r.unidad_id
  join public.edificios e on e.id = u.edificio_id
  left join public.profiles p on p.id = r.vecino_id
  left join public.sugerencias_ia s on s.reclamo_id = r.id
  left join public.clasificacion_vecinos cv on cv.vecino_id = r.vecino_id
),
senales as (
  select b.*,
    -- Reclamos de la misma unidad y categoría en los 30 días previos (incluido este)
    (select count(*) from public.reclamos r2
       left join public.sugerencias_ia s2 on s2.reclamo_id = r2.id
      where r2.unidad_id = b.unidad_id
        and coalesce(r2.categoria, s2.categoria) = b.categoria_efectiva
        and r2.created_at >  b.created_at - interval '30 days'
        and r2.created_at <= b.created_at) as repeticiones,
    (select count(*) from public.reclamos r3
      where r3.unidad_id = b.unidad_id
        and r3.created_at >  b.created_at - interval '30 days'
        and r3.created_at <= b.created_at) as reclamos_30_dias
  from base b
),
ajustes as (
  select s.*,
    tv.nombre as tipo_vecino_nombre,
    ub.nivel  as nivel_base,
    case when coalesce(tv.sube_niveles, 0) > 0
          and (tv.categorias is null or s.categoria_efectiva = any (tv.categorias))
         then tv.sube_niveles else 0 end as ajuste_perfil,
    -- Tres veces lo mismo en un mes indica un problema de fondo
    case when s.repeticiones >= 3 then 1 else 0 end as ajuste_recurrencia
  from senales s
  -- left join: el vecino no puede leer los tipos, y su consulta no debe perder filas
  left join public.tipos_vecino tv on tv.codigo = s.tipo_vecino
  left join public.urgencias ub on ub.codigo = s.urgencia_base
)
select
  a.id, a.descripcion, a.foto_path, a.estado, a.origen,
  a.created_at, a.resuelto_at, a.aviso_urgente_at,
  a.categoria, a.urgencia, a.proveedor_id,
  a.unidad_id, a.unidad, a.edificio_id, a.edificio, a.direccion,
  a.vecino_id, a.vecino, a.tipo_vecino,
  a.ia_categoria, a.ia_urgencia, a.ia_proveedor_id, a.ia_justificacion,
  a.categoria_efectiva, a.urgencia_base,
  a.repeticiones, a.reclamos_30_dias,
  a.reclamos_30_dias >= 8 as unidad_frecuente,
  uc.codigo as urgencia_calculada,
  -- La decisión del admin manda; si todavía no decidió, vale la calculada
  coalesce(a.urgencia, uc.codigo) as urgencia_final,
  coalesce(uf.nivel, uc.nivel)    as nivel_final,
  array_remove(array[
    case when a.ajuste_perfil > 0 then 'Vecino ' || lower(a.tipo_vecino_nombre) end,
    case when a.ajuste_recurrencia > 0 then 'Problema que se repite (' || a.repeticiones || ' en 30 días)' end
  ], null) as motivos,
  (select max(v.fecha) from public.visitas v where v.reclamo_id = a.id) as ultima_visita
from ajustes a
left join public.urgencias uc
  -- Sin urgencia base (ni IA ni admin) no hay nada que ajustar
  on a.nivel_base is not null
 and uc.nivel = least(3, a.nivel_base + a.ajuste_perfil + a.ajuste_recurrencia)
left join public.urgencias uf on uf.codigo = a.urgencia;

-- ---------- 7. ÍNDICES ----------
create index if not exists reclamos_unidad_fecha on public.reclamos (unidad_id, created_at);
create index if not exists reclamos_estado       on public.reclamos (estado);
create index if not exists visitas_reclamo       on public.visitas (reclamo_id);
create index if not exists unidades_edificio     on public.unidades (edificio_id);

commit;
