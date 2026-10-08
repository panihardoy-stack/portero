import type { SupabaseClient } from "@supabase/supabase-js";
import { compararUnidades } from "@/lib/texto";

export type VecinoAdmin = {
  id: string;
  nombre: string | null;
  unidad: string;
  tipo: string;
  motivo: string | null;
};

// Vecinos de los edificios del admin, con su clasificación (por RLS, solo los suyos)
export async function listarVecinosAdmin(supabase: SupabaseClient): Promise<VecinoAdmin[]> {
  const [perfiles, clasificaciones] = await Promise.all([
    supabase.from("profiles").select("id, nombre, unidades(nombre)").eq("rol", "vecino").not("unidad_id", "is", null),
    supabase.from("clasificacion_vecinos").select("vecino_id, tipo, motivo"),
  ]);
  const porVecino = new Map((clasificaciones.data ?? []).map((c) => [c.vecino_id as string, c]));

  return (perfiles.data ?? [])
    .map((p) => {
      const rel = p.unidades as unknown as { nombre: string } | { nombre: string }[] | null;
      const unidad = (Array.isArray(rel) ? rel[0]?.nombre : rel?.nombre) ?? "?";
      const c = porVecino.get(p.id);
      return { id: p.id, nombre: p.nombre, unidad, tipo: c?.tipo ?? "estandar", motivo: c?.motivo ?? null };
    })
    .sort((a, b) => compararUnidades(a.unidad, b.unidad));
}
