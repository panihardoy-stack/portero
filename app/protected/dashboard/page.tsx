import { exigirAdmin } from "@/lib/datos/sesion";
import { obtenerCatalogos } from "@/lib/datos/catalogos";
import { reclamosDesde } from "@/lib/datos/reclamos";
import { leerParametro, type Parametros } from "@/lib/parametros";
import { Indicadores } from "@/components/indicadores";

const PERIODOS = [3, 6, 12];

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Parametros> }) {
  const [{ supabase }, parametros, catalogos] = await Promise.all([exigirAdmin(), searchParams, obtenerCatalogos()]);

  const pedido = Number(leerParametro(parametros, "meses"));
  const meses = PERIODOS.includes(pedido) ? pedido : 6;
  const hoy = new Date();
  const desde = new Date(hoy.getFullYear(), hoy.getMonth() - (meses - 1), 1);

  // Por RLS, solo trae los datos de los edificios de este admin
  const [edificiosRes, reclamos, proveedoresRes] = await Promise.all([
    supabase.from("edificios").select("nombre").order("nombre"),
    reclamosDesde(supabase, desde),
    supabase.from("proveedores").select("id, nombre"),
  ]);

  return (
    <Indicadores
      reclamos={reclamos}
      catalogos={catalogos}
      edificios={(edificiosRes.data ?? []).map((e) => e.nombre).join(", ")}
      meses={meses}
      periodos={PERIODOS}
      proveedores={new Map((proveedoresRes.data ?? []).map((p) => [p.id as number, p.nombre as string]))}
    />
  );
}
