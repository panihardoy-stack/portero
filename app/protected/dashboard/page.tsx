import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const CATEGORIAS = ["sanitaria", "humedad", "electrica", "ascensor", "cerrajeria", "otros"];
const ESTADOS = ["nuevo", "asignado", "agendado", "resuelto"];
const URGENCIAS = ["alta", "media", "baja"];

type Reclamo = {
  categoria: string | null;
  urgencia: string | null;
  estado: string;
  created_at: string;
  resuelto_at: string | null;
};

type Dato = { etiqueta: string; valor: number };

export default function DashboardPage() {
  return (
    <div className="flex-1 w-full flex flex-col gap-8">
      <Suspense fallback={<p>Cargando dashboard...</p>}>
        <Dashboard />
      </Suspense>
    </div>
  );
}

async function Dashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // Solo el admin puede ver el dashboard
  const { data: perfil } = await supabase
    .from("profiles")
    .select("rol")
    .eq("id", user.id)
    .single();
  if (perfil?.rol !== "admin") redirect("/protected");

  // Por RLS, solo trae los reclamos de los edificios de este admin
  const { data } = await supabase
    .from("reclamos")
    .select("categoria, urgencia, estado, created_at, resuelto_at")
    .limit(5000);
  const reclamos = (data ?? []) as Reclamo[];

  // ---------- Indicadores ----------
  const total = reclamos.length;
  const resueltos = reclamos.filter((r) => r.estado === "resuelto" && r.resuelto_at);
  const abiertos = reclamos.filter((r) => r.estado !== "resuelto").length;

  const diasResolucion = (r: Reclamo) =>
    (new Date(r.resuelto_at as string).getTime() - new Date(r.created_at).getTime()) /
    (1000 * 60 * 60 * 24);

  const promedio = (lista: Reclamo[]) =>
    lista.length ? lista.reduce((suma, r) => suma + diasResolucion(r), 0) / lista.length : 0;

  // ---------- Agrupaciones ----------
  const porCategoria: Dato[] = CATEGORIAS.map((c) => ({
    etiqueta: c,
    valor: reclamos.filter((r) => r.categoria === c).length,
  })).sort((a, b) => b.valor - a.valor);

  const sinCategoria = reclamos.filter((r) => !r.categoria).length;
  if (sinCategoria > 0) porCategoria.push({ etiqueta: "sin definir", valor: sinCategoria });

  const porEstado: Dato[] = ESTADOS.map((e) => ({
    etiqueta: e,
    valor: reclamos.filter((r) => r.estado === e).length,
  }));

  const tiempoPorUrgencia: Dato[] = URGENCIAS.map((u) => ({
    etiqueta: u,
    valor: promedio(resueltos.filter((r) => r.urgencia === u)),
  }));

  // Reclamos por mes, últimos 6 meses
  const hoy = new Date();
  const porMes = Array.from({ length: 6 }, (_, i) => {
    const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - (5 - i), 1);
    return {
      clave: `${fecha.getFullYear()}-${fecha.getMonth()}`,
      etiqueta: fecha.toLocaleDateString("es-UY", { month: "short", year: "2-digit" }),
      valor: 0,
    };
  });
  reclamos.forEach((r) => {
    const f = new Date(r.created_at);
    const mes = porMes.find((m) => m.clave === `${f.getFullYear()}-${f.getMonth()}`);
    if (mes) mes.valor++;
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Panel del administrador</p>
          <h1 className="text-2xl font-bold">Dashboard de reclamos</h1>
        </div>
        <Link href="/protected" className="text-sm underline">
          ← Volver al panel
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicador titulo="Total" valor={String(total)} />
        <Indicador titulo="Abiertos" valor={String(abiertos)} />
        <Indicador titulo="Resueltos" valor={String(resueltos.length)} />
        <Indicador titulo="Resolución promedio" valor={`${promedio(resueltos).toFixed(1)} días`} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Barras titulo="Reclamos por categoría" datos={porCategoria} />
        <Barras titulo="Reclamos por estado" datos={porEstado} />
        <Barras titulo="Reclamos por mes" datos={porMes} />
        <Barras
          titulo="Días promedio de resolución según urgencia"
          datos={tiempoPorUrgencia}
          decimales={1}
          sufijo=" días"
        />
      </div>
    </div>
  );
}

function Indicador({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-md border p-4">
      <p className="text-sm text-muted-foreground">{titulo}</p>
      <p className="text-2xl font-bold">{valor}</p>
    </div>
  );
}

function Barras({
  titulo,
  datos,
  decimales = 0,
  sufijo = "",
}: {
  titulo: string;
  datos: Dato[];
  decimales?: number;
  sufijo?: string;
}) {
  const maximo = Math.max(...datos.map((d) => d.valor), 1);

  return (
    <div className="rounded-md border p-4 flex flex-col gap-3">
      <h2 className="font-semibold">{titulo}</h2>
      {datos.map((d) => (
        <div key={d.etiqueta} className="flex items-center gap-3 text-sm">
          <span className="w-24 shrink-0 capitalize text-muted-foreground">{d.etiqueta}</span>
          <div className="flex-1 h-4 rounded bg-muted overflow-hidden">
            <div
              className="h-full rounded bg-foreground"
              style={{ width: `${(d.valor / maximo) * 100}%` }}
            />
          </div>
          <span className="w-20 shrink-0 text-right font-medium">
            {d.valor.toFixed(decimales)}
            {sufijo}
          </span>
        </div>
      ))}
    </div>
  );
}