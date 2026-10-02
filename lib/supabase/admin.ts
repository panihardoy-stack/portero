import { createClient } from "@supabase/supabase-js";

// Cliente con permisos totales sobre la base (se saltea RLS).
// SOLO se usa en el servidor: la clave secreta nunca llega al navegador.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SECRET_KEY;
  if (!url || !clave) {
    throw new Error("Falta SUPABASE_SECRET_KEY en las variables de entorno.");
  }
  return createClient(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
