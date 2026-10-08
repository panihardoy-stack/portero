import type { SupabaseClient } from "@supabase/supabase-js";
import { DIA } from "@/lib/fechas";
import { normalizar } from "@/lib/texto";
import type { Etiquetas } from "@/lib/catalogos";

// Todas las pantallas leen los reclamos de la vista reclamos_detalle,
// que ya trae las uniones y la urgencia calculada. Por RLS, cada usuario
// recibe solo lo que puede ver.

export type ReclamoDetalle = {
  id: number;
  descripcion: string;
  foto_path: string | null;
  estado: string;
  origen: string;
  created_at: string;
  resuelto_at: string | null;
  categoria: string | null;
  urgencia: string | null;
  proveedor_id: number | null;
  unidad_id: number;
  unidad: string;
  edificio: string;
  vecino_id: string | null;
  vecino: string | null;
  tipo_vecino: string;
  ia_categoria: string | null;
  ia_urgencia: string | null;
  ia_proveedor_id: number | null;
  ia_justificacion: string | null;
  categoria_efectiva: string | null;
  urgencia_base: string | null;
  urgencia_calculada: string | null;
  urgencia_final: string | null;
  nivel_final: number | null;
  motivos: string[];
  unidad_frecuente: boolean;
  repeticiones: number;
  ultima_visita: string | null;
};

const COLUMNAS =
  "id, descripcion, foto_path, estado, origen, created_at, resuelto_at, categoria, urgencia, proveedor_id, " +
  "unidad_id, unidad, edificio, vecino_id, vecino, tipo_vecino, ia_categoria, ia_urgencia, ia_proveedor_id, " +
  "ia_justificacion, categoria_efectiva, urgencia_base, urgencia_calculada, urgencia_final, nivel_final, " +
  "motivos, unidad_frecuente, repeticiones, ultima_visita";

export type FiltroBandeja = {
  q: string;
  estado: string;
  categoria: string;
  urgencia: string;
  dias: number;
};

export const LIMITE_BANDEJA = 500;

// Primero lo que nadie revisó; después, de mayor a menor urgencia final
export function ordenarPorPrioridad(a: ReclamoDetalle, b: ReclamoDetalle) {
  const revisar = (r: ReclamoDetalle) => (r.estado === "nuevo" ? 0 : r.estado === "resuelto" ? 2 : 1);
  return (
    revisar(a) - revisar(b) ||
    (b.nivel_final ?? 0) - (a.nivel_final ?? 0) ||
    b.created_at.localeCompare(a.created_at)
  );
}

export async function listarReclamosAdmin(
  supabase: SupabaseClient,
  filtro: FiltroBandeja,
  etiquetas: Etiquetas
) {
  let consulta = supabase
    .from("reclamos_detalle")
    .select(COLUMNAS)
    .order("created_at", { ascending: false })
    .limit(LIMITE_BANDEJA);

  if (!filtro.estado) consulta = consulta.neq("estado", "resuelto");
  else if (filtro.estado !== "todos") consulta = consulta.eq("estado", filtro.estado);
  if (filtro.categoria === "sin") consulta = consulta.is("categoria_efectiva", null);
  else if (filtro.categoria) consulta = consulta.eq("categoria_efectiva", filtro.categoria);
  if (filtro.urgencia) consulta = consulta.eq("urgencia_final", filtro.urgencia);
  if (filtro.dias) {
    consulta = consulta.gte("created_at", new Date(Date.now() - filtro.dias * DIA).toISOString());
  }

  const { data } = await consulta;
  const filas = (data ?? []) as unknown as ReclamoDetalle[];

  // Búsqueda de texto: unidad, descripción, categoría, estado o nombre del vecino
  const busqueda = normalizar(filtro.q);
  const encontrados = busqueda
    ? filas.filter((r) =>
        [r.unidad, r.descripcion, r.vecino ?? "", etiquetas.categoria(r.categoria_efectiva), etiquetas.estadoAdmin(r.estado)]
          .some((c) => normalizar(c).includes(busqueda))
      )
    : filas;

  return { reclamos: encontrados.sort(ordenarPorPrioridad), truncado: filas.length === LIMITE_BANDEJA };
}

// Las tres cifras del resumen de la bandeja, contadas en la base
export async function resumenBandeja(supabase: SupabaseClient) {
  const contar = () => supabase.from("reclamos_detalle").select("*", { count: "exact", head: true });
  const [abiertos, sinRevisar, urgentes] = await Promise.all([
    contar().neq("estado", "resuelto"),
    contar().eq("estado", "nuevo"),
    contar().neq("estado", "resuelto").eq("urgencia_final", "alta"),
  ]);
  return {
    abiertos: abiertos.count ?? 0,
    sinRevisar: sinRevisar.count ?? 0,
    urgentes: urgentes.count ?? 0,
  };
}

export async function listarReclamosVecino(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("reclamos_detalle")
    .select("id, descripcion, foto_path, estado, created_at, resuelto_at, categoria, ultima_visita")
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as Pick<
    ReclamoDetalle,
    "id" | "descripcion" | "foto_path" | "estado" | "created_at" | "resuelto_at" | "categoria" | "ultima_visita"
  >[];
}

export async function reclamosDesde(supabase: SupabaseClient, desde: Date) {
  const { data } = await supabase
    .from("reclamos_detalle")
    .select(COLUMNAS)
    .gte("created_at", desde.toISOString())
    .limit(5000);
  return (data ?? []) as unknown as ReclamoDetalle[];
}
