-- Frente C: lo que necesita n8n para no repetir avisos ni eventos

-- Marca cuándo se mandó el mail de reclamo urgente (así se manda una sola vez)
alter table public.reclamos add column if not exists aviso_urgente_at timestamptz;

-- n8n busca cada minuto las visitas que todavía no tienen evento en Calendar
create index if not exists visitas_sin_evento
  on public.visitas (created_at)
  where calendar_event_id is null;

-- Y los reclamos urgentes sin aviso
create index if not exists reclamos_urgentes_sin_aviso
  on public.reclamos (created_at)
  where aviso_urgente_at is null;
