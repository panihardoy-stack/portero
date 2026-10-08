import type { SupabaseClient } from "@supabase/supabase-js";

// Links temporales (1 hora) para ver las fotos del bucket privado
export async function urlsFirmadas(supabase: SupabaseClient, paths: (string | null)[]) {
  const validos = paths.filter((p): p is string => !!p);
  const mapa = new Map<string, string>();
  if (validos.length === 0) return mapa;

  const { data } = await supabase.storage.from("fotos-reclamos").createSignedUrls(validos, 3600);
  data?.forEach((d) => {
    if (d.path && d.signedUrl) mapa.set(d.path, d.signedUrl);
  });
  return mapa;
}
