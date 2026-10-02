import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Indicadores, type ReclamoIndicador } from "@/components/indicadores";

export default function DashboardPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[#5B655F]">Cargando indicadores…</p>}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
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

  // Por RLS, solo trae los datos de los edificios de este admin
  const [edificiosRes, reclamosRes] = await Promise.all([
    supabase.from("edificios").select("nombre").order("nombre"),
    supabase
      .from("reclamos")
      .select("categoria, urgencia, estado, created_at, resuelto_at")
      .limit(5000),
  ]);
  const reclamos = (reclamosRes.data ?? []) as ReclamoIndicador[];
  const edificios = (edificiosRes.data ?? []).map((e) => e.nombre).join(", ");

  return <Indicadores reclamos={reclamos} edificios={edificios} />;
}
