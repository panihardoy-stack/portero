import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Catalogos } from "@/lib/catalogos";

// Lee los catálogos de la base una sola vez por carga de página
export const obtenerCatalogos = cache(async (): Promise<Catalogos> => {
  const supabase = await createClient();
  const [categorias, urgencias, estados, tiposVecino] = await Promise.all([
    supabase.from("categorias").select("codigo, nombre, descripcion, orden").order("orden"),
    supabase.from("urgencias").select("codigo, nombre, descripcion, nivel").order("nivel", { ascending: false }),
    supabase.from("estados").select("codigo, nombre_admin, nombre_vecino, orden").order("orden"),
    // Por RLS, solo el admin recibe los tipos de vecino; el vecino recibe una lista vacía
    supabase.from("tipos_vecino").select("codigo, nombre, descripcion, sube_niveles, categorias").order("sube_niveles"),
  ]);
  return {
    categorias: categorias.data ?? [],
    urgencias: urgencias.data ?? [],
    estados: estados.data ?? [],
    tiposVecino: tiposVecino.data ?? [],
  };
});
