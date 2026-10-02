import Link from "next/link";
import {
  BOTON_SECUNDARIO,
  CATEGORIAS,
  CATEGORIA_LABEL,
  ESTADOS,
  ESTADO_INFO,
  FUENTE_DISPLAY,
  URGENCIAS,
  URGENCIA_INFO,
} from "@/components/portero-ui";

// Vista del dashboard: recibe los reclamos ya filtrados por RLS y calcula los indicadores

export type ReclamoIndicador = {
  categoria: string | null;
  urgencia: string | null;
  estado: string;
  created_at: string;
  resuelto_at: string | null;
};
type Reclamo = ReclamoIndicador;

const unDecimal = new Intl.NumberFormat("es-UY", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const porcentaje = new Intl.NumberFormat("es-UY", { style: "percent", maximumFractionDigits: 0 });

export function Indicadores({ reclamos, edificios }: { reclamos: Reclamo[]; edificios: string }) {
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
  const porCategoria = CATEGORIAS.map((c) => ({
    etiqueta: CATEGORIA_LABEL[c],
    valor: reclamos.filter((r) => r.categoria === c).length,
  })).sort((a, b) => b.valor - a.valor);
  const sinClasificar = reclamos.filter((r) => !r.categoria).length;
  if (sinClasificar > 0) porCategoria.push({ etiqueta: "Sin clasificar", valor: sinClasificar });

  const porEstado = ESTADOS.map((e) => ({
    estado: e,
    valor: reclamos.filter((r) => r.estado === e).length,
  }));

  const porUrgencia = URGENCIAS.map((u) => ({
    urgencia: u,
    dias: promedio(resueltos.filter((r) => r.urgencia === u)),
  }));

  // Reclamos por mes, últimos 6 meses (el último está en curso)
  const hoy = new Date();
  const porMes = Array.from({ length: 6 }, (_, i) => {
    const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - (5 - i), 1);
    return {
      clave: `${fecha.getFullYear()}-${fecha.getMonth()}`,
      etiqueta: fecha.toLocaleDateString("es-UY", { month: "short" }).replace(".", ""),
      valor: 0,
    };
  });
  reclamos.forEach((r) => {
    const f = new Date(r.created_at);
    const mes = porMes.find((m) => m.clave === `${f.getFullYear()}-${f.getMonth()}`);
    if (mes) mes.valor++;
  });
  const maxMes = Math.max(...porMes.map((m) => m.valor), 1);
  const maxCategoria = Math.max(...porCategoria.map((c) => c.valor), 1);
  const maxDias = Math.max(...porUrgencia.map((u) => u.dias), 1);

  const alta = porUrgencia.find((u) => u.urgencia === "alta")?.dias ?? 0;
  const baja = porUrgencia.find((u) => u.urgencia === "baja")?.dias ?? 0;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-[#5B655F]">{edificios}</p>
          <h1 className={`${FUENTE_DISPLAY} mt-1 text-3xl font-semibold tracking-tight`}>Indicadores</h1>
        </div>
        <Link href="/protected" className={BOTON_SECUNDARIO}>
          Volver a reclamos
        </Link>
      </section>

      <section
        aria-label="Resumen"
        className="grid grid-cols-2 divide-[#E6E9E4] overflow-hidden rounded-lg border border-[#DDE1DB] bg-white md:grid-cols-4 md:divide-x"
      >
        <Indicador titulo="Reclamos totales" valor={String(total)} />
        <Indicador titulo="Abiertos" valor={String(abiertos)} />
        <Indicador titulo="Resueltos" valor={String(resueltos.length)} />
        <Indicador titulo="Resolución promedio" valor={`${unDecimal.format(promedio(resueltos))} días`} />
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <Tarjeta titulo="Reclamos por mes" nota="El mes actual todavía está en curso." className="lg:col-span-3">
          <div className="mt-6 flex h-48 items-stretch gap-3" role="list">
            {porMes.map((m, i) => {
              const enCurso = i === porMes.length - 1;
              return (
                <div key={m.clave} role="listitem" className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex w-full flex-1 flex-col items-center justify-end">
                    <span className="mb-1 text-xs font-medium tabular-nums">{m.valor}</span>
                    <div
                      className={`w-full max-w-[2.75rem] rounded-t-[3px] ${
                        enCurso ? "bg-[#A9C2B6]" : "bg-[#1E4D3E]"
                      }`}
                      style={{ height: `${Math.max((m.valor / maxMes) * 85, 1)}%` }}
                    />
                  </div>
                  <span className="text-xs capitalize text-[#5B655F]">{m.etiqueta}</span>
                </div>
              );
            })}
          </div>
        </Tarjeta>

        <Tarjeta titulo="Estado actual" className="lg:col-span-2">
          <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-[#EEF0EC]">
            {porEstado.map((e) =>
              e.valor > 0 ? (
                <div
                  key={e.estado}
                  style={{ width: `${(e.valor / Math.max(total, 1)) * 100}%`, backgroundColor: ESTADO_INFO[e.estado].color }}
                />
              ) : null
            )}
          </div>
          <ul className="mt-5 flex flex-col gap-2.5">
            {porEstado.map((e) => (
              <li key={e.estado} className="flex items-center gap-3 text-sm">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: ESTADO_INFO[e.estado].color }}
                />
                <span className="flex-1">{ESTADO_INFO[e.estado].admin}</span>
                <span className="font-medium tabular-nums">{e.valor}</span>
                <span className="w-10 text-right tabular-nums text-[#5B655F]">
                  {porcentaje.format(e.valor / Math.max(total, 1))}
                </span>
              </li>
            ))}
          </ul>
        </Tarjeta>

        <Tarjeta titulo="Reclamos por categoría" className="lg:col-span-3">
          <ul className="mt-5 flex flex-col gap-3">
            {porCategoria.map((c) => (
              <li key={c.etiqueta} className="flex items-center gap-3 text-sm">
                <span className="w-28 shrink-0 text-[#5B655F]">{c.etiqueta}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#EEF0EC]">
                  <div
                    className="h-full rounded-full bg-[#1E4D3E]"
                    style={{ width: `${(c.valor / maxCategoria) * 100}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right font-medium tabular-nums">{c.valor}</span>
              </li>
            ))}
          </ul>
        </Tarjeta>

        <Tarjeta
          titulo="Días para resolver, según urgencia"
          nota={
            resueltos.length > 0
              ? `Los reclamos de urgencia alta se resuelven en ${unDecimal.format(alta)} días; los de urgencia baja, en ${unDecimal.format(baja)}.`
              : undefined
          }
          className="lg:col-span-2"
        >
          <ul className="mt-5 flex flex-col gap-3">
            {porUrgencia.map((u) => (
              <li key={u.urgencia} className="flex items-center gap-3 text-sm">
                <span className="w-14 shrink-0 text-[#5B655F]">{URGENCIA_INFO[u.urgencia].label}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#EEF0EC]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(u.dias / maxDias) * 100}%`,
                      backgroundColor: URGENCIA_INFO[u.urgencia].color,
                    }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right font-medium tabular-nums">
                  {unDecimal.format(u.dias)} días
                </span>
              </li>
            ))}
          </ul>
        </Tarjeta>
      </div>
    </div>
  );
}

function Indicador({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="border-[#E6E9E4] p-5 odd:border-r md:odd:border-r-0 [&:nth-child(-n+2)]:border-b md:[&:nth-child(-n+2)]:border-b-0">
      <p className="text-sm text-[#5B655F]">{titulo}</p>
      <p className={`${FUENTE_DISPLAY} mt-1 text-3xl font-semibold tabular-nums tracking-tight`}>{valor}</p>
    </div>
  );
}

function Tarjeta({
  titulo,
  nota,
  className = "",
  children,
}: {
  titulo: string;
  nota?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-lg border border-[#DDE1DB] bg-white p-5 sm:p-6 ${className}`}>
      <h2 className={`${FUENTE_DISPLAY} text-lg font-semibold`}>{titulo}</h2>
      {nota && <p className="mt-1 text-sm text-[#5B655F]">{nota}</p>}
      {children}
    </section>
  );
}
