import { exigirSesion } from "@/lib/datos/sesion";
import type { Parametros } from "@/lib/parametros";
import { PanelAdmin } from "@/components/panel-admin";
import { PanelVecino } from "@/components/panel-vecino";

// Página principal después del login: cada rol tiene su panel.
// La seguridad no depende de esta elección: la hace cumplir RLS en la base.
export default async function ProtectedPage({ searchParams }: { searchParams: Promise<Parametros> }) {
  const [sesion, parametros] = await Promise.all([exigirSesion(), searchParams]);
  return sesion.esAdmin ? (
    <PanelAdmin sesion={sesion} parametros={parametros} />
  ) : (
    <PanelVecino sesion={sesion} parametros={parametros} />
  );
}
