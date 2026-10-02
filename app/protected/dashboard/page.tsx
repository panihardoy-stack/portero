import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Indicadores, type ReclamoIndicador } from "@/components/indicadores";

type Parametros = Record<string, string | string[] | undefined>;
const PERIODOS = [3, 6, 12];

export default function DashboardPage({ searchParams }: { searchParams: Promise<Parametros> }) {
  return (
    <Suspense fallback={<p className="text-sm text-[#5B655F]">Cargando indicadores…</p>}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

async function Dashboard({ searchParams }: { searchParams: Promise<Parametros> }) {
  const parametros = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // Solo el admin puede ver los indicadores
  const { data: perfil } = await supabase
    .from("profiles")
    .select("rol")
    .eq("id", user.id)
    .single();
  if (perfil?.rol !== "admin") redirect("/protected");

  const pedido = Number(Array.isArray(parametros.meses) ? parametros.meses[0] : parametros.meses);
  const meses = PERIODOS.includes(pedido) ? pedido : 6;

  // Desde el primer día del mes más antiguo del período
  const hoy = new Date();
  const desde = new Date(hoy.getFullYear(), hoy.getMonth() - (meses - 1), 1);

  // Por RLS, solo trae los datos de los edificios de este admin
  const [edificiosRes, reclamosRes, proveedoresRes] = await Promise.all([
    supabase.from("edificios").select("nombre").order("nombre"),
    supabase
      .from("reclamos")
      .select("categoria, urgencia, estado, created_at, resuelto_at, proveedor_id, unidades(nombre)")
      .gte("created_at", desde.toISOString())
      .limit(5000),
    supabase.from("proveedores").select("id, nombre"),
  ]);

  const reclamos: ReclamoIndicador[] = (reclamosRes.data ?? []).map((r) => {
    const rel = r.unidades as unknown as { nombre: string } | { nombre: string }[] | null;
    const unidad = Array.isArray(rel) ? rel[0]?.nombre : rel?.nombre;
    return { ...r, unidad: unidad ?? "?" };
  });
  const edificios = (edificiosRes.data ?? []).map((e) => e.nombre).join(", ");
  const proveedores = new Map((proveedoresRes.data ?? []).map((p) => [p.id as number, p.nombre as string]));

  return (
    <Indicadores
      reclamos={reclamos}
      edificios={edificios}
      meses={meses}
      periodos={PERIODOS}
      proveedores={proveedores}
    />
  );
}
