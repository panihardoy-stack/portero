import type { SupabaseClient } from "@supabase/supabase-js";

// Calificaciones de los vecinos al arreglo. Por RLS, el vecino ve las suyas
// y el admin las de los reclamos de sus edificios.

export type Calificacion = {
  reclamo_id: number;
  puntaje: number;
  comentario: string | null;
  created_at: string;
};

const COLUMNAS = "reclamo_id, puntaje, comentario, created_at";

// Las calificaciones de un grupo de reclamos, por id de reclamo
export async function calificacionesDe(supabase: SupabaseClient, ids: number[]) {
  const mapa = new Map<number, Calificacion>();
  if (ids.length === 0) return mapa;
  const { data } = await supabase.from("calificaciones").select(COLUMNAS).in("reclamo_id", ids);
  ((data ?? []) as Calificacion[]).forEach((c) => mapa.set(c.reclamo_id, c));
  return mapa;
}

// Para el dashboard: las calificaciones del período, con el proveedor y la categoría del reclamo
export type CalificacionConReclamo = Calificacion & { proveedor_id: number | null; categoria: string | null };

export async function calificacionesDesde(supabase: SupabaseClient, desde: Date) {
  const { data } = await supabase
    .from("calificaciones")
    .select(`${COLUMNAS}, reclamos(proveedor_id, categoria)`)
    .gte("created_at", desde.toISOString())
    .order("created_at", { ascending: false })
    .limit(5000);
  return (data ?? []).map((fila) => {
    const rel = (fila as { reclamos: unknown }).reclamos as
      | { proveedor_id: number | null; categoria: string | null }
      | { proveedor_id: number | null; categoria: string | null }[]
      | null;
    const reclamo = Array.isArray(rel) ? rel[0] : rel;
    const c = fila as unknown as Calificacion;
    return {
      reclamo_id: c.reclamo_id,
      puntaje: c.puntaje,
      comentario: c.comentario,
      created_at: c.created_at,
      proveedor_id: reclamo?.proveedor_id ?? null,
      categoria: reclamo?.categoria ?? null,
    } satisfies CalificacionConReclamo;
  });
}
