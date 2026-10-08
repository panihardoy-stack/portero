import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Usuario y perfil de la sesión actual.
// `cache` hace que, en una misma carga de página, la consulta se haga una sola vez
// aunque la pidan el encabezado, el panel y el dashboard.
export const obtenerSesion = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await supabase
    .from("profiles")
    .select("nombre, rol")
    .eq("id", user.id)
    .single();

  return {
    supabase,
    user,
    nombre: perfil?.nombre ?? user.email ?? "",
    tieneNombre: !!perfil?.nombre,
    esAdmin: perfil?.rol === "admin",
  };
});

export type Sesion = NonNullable<Awaited<ReturnType<typeof obtenerSesion>>>;

export async function exigirSesion() {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/auth/login");
  return sesion;
}

export async function exigirAdmin() {
  const sesion = await exigirSesion();
  if (!sesion.esAdmin) redirect("/protected");
  return sesion;
}
