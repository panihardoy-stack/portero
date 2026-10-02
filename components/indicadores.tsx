import Link from "next/link";
import {
  BOTON_SECUNDARIO,
  CATEGORIAS,
  CATEGORIA_LABEL,
  ESTADOS,
  ESTADO_INFO,
  FUENTE_DISPLAY,
  Placa,
  URGENCIAS,
  URGENCIA_INFO,
} from "@/components/portero-ui";

// Vista del dashboard: recibe los reclamos del período (ya filtrados por RLS) y calcula los indicadores

export type ReclamoIndicador = {
  categoria: string | null;
  urgencia: string | null;
  estado: string;
  created_at: string;
  resuelto_at: string | null;
  proveedor_id: number | null;
  unidad: string;
};
type Reclamo = ReclamoIndicador;

const DIA = 1000 * 60 * 60 * 24;
const unDecimal = new Intl.NumberFormat("es-UY", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const porcentaje = new Intl.NumberFormat("es-UY", { style: "percent", maximumFractionDigits: 0 });

const FILA_LINK =
  "-mx-2 flex items-center gap-3 rounded-md px-2 py-1 text-sm transition-colors hover:bg-[#F3F4F1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4D3E]";

const diasResolucion = (r: Reclamo) =>
  (new Date(r.resuelto_at as string).getTime() - new Date(r.created_at).getTime()) / DIA;
const promedio = (lista: Reclamo[]) =>
  lista.length ? lista.reduce((suma, r) => suma + diasResolucion(r), 0) / lista.length : 0;

export function Indicadores({
  reclamos,
  edificios,
  meses,
  periodos,
  proveedores,
}: {
  reclamos: Reclamo[];
  edificios: string;
  meses: number;
  periodos: number[];
  proveedores: Map<number, string>;
}) {
  const diasPeriodo = meses * 31;

  // ---------- Indicadores ----------
  const total = reclamos.length;
  const resueltos = reclamos.filter((r) => r.estado === "resuelto" && r.resuelto_at);
  const abiertos = reclamos.filter((r) => r.estado !== "resuelto").length;

  // ---------- Agrupaciones ----------
  const porCategoria = CATEGORIAS.map((c) => ({
    clave: c,
    etiqueta: CATEGORIA_LABEL[c],
    valor: reclamos.filter((r) => r.categoria === c).length,
  })).sort((a, b) => b.valor - a.valor);
  const sinClasificar = reclamos.filter((r) => !r.categoria).length;
  if (sinClasificar > 0) porCategoria.push({ clave: "sin", etiqueta: "Sin clasificar", valor: sinClasificar });

  const porEstado = ESTADOS.map((e) => ({
    estado: e,
    valor: reclamos.filter((r) => r.estado === e).length,
  }));

  const porUrgencia = URGENCIAS.map((u) => ({
    urgencia: u,
    dias: promedio(resueltos.filter((r) => r.urgencia === u)),
  }));

  // Reclamos por mes dentro del período (el último está en curso)
  const hoy = new Date();
  const porMes = Array.from({ length: meses }, (_, i) => {
    const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - (meses - 1 - i), 1);
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

  // Unidades con más reclamos y su categoría más frecuente
  const porUnidad = new Map<string, Reclamo[]>();
  reclamos.forEach((r) => porUnidad.set(r.unidad, [...(porUnidad.get(r.unidad) ?? []), r]));
  const topUnidades = [...porUnidad.entries()]
    .map(([unidad, lista]) => {
      const conteo = new Map<string, number>();
      lista.forEach((r) => r.categoria && conteo.set(r.categoria, (conteo.get(r.categoria) ?? 0) + 1));
      const principal = [...conteo.entries()].sort((a, b) => b[1] - a[1])[0];
      return {
        unidad,
        valor: lista.length,
        abiertos: lista.filter((r) => r.estado !== "resuelto").length,
        principal: principal ? CATEGORIA_LABEL[principal[0]] : undefined,
      };
    })
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 6);

  // Desempeño de proveedores: reclamos atendidos y días hasta resolverlos
  const porProveedor = [...proveedores.entries()]
    .map(([id, nombre]) => {
      const asignados = reclamos.filter((r) => r.proveedor_id === id);
      const hechos = asignados.filter((r) => r.estado === "resuelto" && r.resuelto_at);
      return { id, nombre, asignados: asignados.length, resueltos: hechos.length, dias: promedio(hechos) };
    })
    .filter((p) => p.asignados > 0)
    .sort((a, b) => b.asignados - a.asignados);

  const maxMes = Math.max(...porMes.map((m) => m.valor), 1);
  const maxCategoria = Math.max(...porCategoria.map((c) => c.valor), 1);
  const maxDias = Math.max(...porUrgencia.map((u) => u.dias), 1);
  const maxUnidad = Math.max(...topUnidades.map((u) => u.valor), 1);

  const alta = porUrgencia.find((u) => u.urgencia === "alta")?.dias ?? 0;
  const baja = porUrgencia.find((u) => u.urgencia === "baja")?.dias ?? 0;
  const textoPeriodo = meses === 12 ? "último año" : `últimos ${meses} meses`;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-[#5B655F]">{edificios}</p>
          <h1 className={`${FUENTE_DISPLAY} mt-1 text-3xl font-semibold tracking-tight`}>Indicadores</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <nav
            aria-label="Período"
            className="inline-flex rounded-md border border-[#CFD5CD] bg-white p-0.5"
          >
            {periodos.map((p) => (
              <Link
                key={p}
                href={`/protected/dashboard?meses=${p}`}
                aria-current={p === meses ? "page" : undefined}
                className={`rounded-[5px] px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4D3E] ${
                  p === meses ? "bg-[#1E4D3E] text-white" : "text-[#5B655F] hover:text-[#18211D]"
                }`}
              >
                {p === 12 ? "1 año" : `${p} meses`}
              </Link>
            ))}
          </nav>
          <Link href="/protected" className={BOTON_SECUNDARIO}>
            Volver a reclamos
          </Link>
        </div>
      </section>

      <section
        aria-label={`Resumen de los ${textoPeriodo}`}
        className="grid grid-cols-2 divide-[#E6E9E4] overflow-hidden rounded-lg border border-[#DDE1DB] bg-white md:grid-cols-4 md:divide-x"
      >
        <Indicador titulo="Reclamos recibidos" valor={String(total)} />
        <Indicador titulo="Siguen abiertos" valor={String(abiertos)} />
        <Indicador titulo="Resueltos" valor={String(resueltos.length)} />
        <Indicador titulo="Resolución promedio" valor={`${unDecimal.format(promedio(resueltos))} días`} />
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <Tarjeta titulo="Reclamos por mes" nota="El mes actual todavía está en curso." className="lg:col-span-3">
          <div className={`mt-6 flex h-48 items-stretch ${meses > 6 ? "gap-1.5" : "gap-3"}`} role="list">
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

        <Tarjeta titulo="Estado actual" nota="Tocá un estado para ver esos reclamos." className="lg:col-span-2">
          <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-[#EEF0EC]">
            {porEstado.map((e) =>
              e.valor > 0 ? (
                <div
                  key={e.estado}
                  style={{
                    width: `${(e.valor / Math.max(total, 1)) * 100}%`,
                    backgroundColor: ESTADO_INFO[e.estado].color,
                  }}
                />
              ) : null
            )}
          </div>
          <ul className="mt-4 flex flex-col gap-1">
            {porEstado.map((e) => (
              <li key={e.estado}>
                <Link href={`/protected?estado=${e.estado}&dias=${diasPeriodo}`} className={FILA_LINK}>
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
                </Link>
              </li>
            ))}
          </ul>
        </Tarjeta>

        <Tarjeta titulo="Reclamos por categoría" className="lg:col-span-3">
          <ul className="mt-4 flex flex-col gap-1">
            {porCategoria.map((c) => (
              <li key={c.clave}>
                <Link
                  href={`/protected?categoria=${c.clave}&estado=todos&dias=${diasPeriodo}`}
                  className={FILA_LINK}
                >
                  <span className="w-28 shrink-0 text-[#5B655F]">{c.etiqueta}</span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#EEF0EC]">
                    <span
                      className="block h-full rounded-full bg-[#1E4D3E]"
                      style={{ width: `${(c.valor / maxCategoria) * 100}%` }}
                    />
                  </span>
                  <span className="w-8 shrink-0 text-right font-medium tabular-nums">{c.valor}</span>
                </Link>
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
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#EEF0EC]">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${(u.dias / maxDias) * 100}%`,
                      backgroundColor: URGENCIA_INFO[u.urgencia].color,
                    }}
                  />
                </span>
                <span className="w-16 shrink-0 text-right font-medium tabular-nums">
                  {unDecimal.format(u.dias)} días
                </span>
              </li>
            ))}
          </ul>
        </Tarjeta>

        <Tarjeta
          titulo="Unidades con más reclamos"
          nota="Tocá una unidad para ver todos sus reclamos."
          className="lg:col-span-2"
        >
          {topUnidades.length === 0 ? (
            <p className="mt-4 text-sm text-[#5B655F]">No hay reclamos en este período.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-1.5">
              {topUnidades.map((u) => (
                <li key={u.unidad}>
                  <Link
                    href={`/protected?q=${encodeURIComponent(u.unidad)}&estado=todos&dias=${diasPeriodo}`}
                    className={FILA_LINK}
                  >
                    <Placa unidad={u.unidad} />
                    <span className="min-w-0 flex-1">
                      <span className="block h-2 overflow-hidden rounded-full bg-[#EEF0EC]">
                        <span
                          className="block h-full rounded-full bg-[#B8904F]"
                          style={{ width: `${(u.valor / maxUnidad) * 100}%` }}
                        />
                      </span>
                      <span className="mt-1 block truncate text-xs text-[#5B655F]">
                        {u.principal ? `Sobre todo ${u.principal.toLowerCase()}` : "Sin clasificar"}
                        {u.abiertos > 0 ? `, ${u.abiertos} ${u.abiertos === 1 ? "abierto" : "abiertos"}` : ""}
                      </span>
                    </span>
                    <span className="w-8 shrink-0 text-right font-medium tabular-nums">{u.valor}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta
          titulo="Proveedores"
          nota="Reclamos asignados a cada proveedor y días que tardaron en resolverse."
          className="lg:col-span-3"
        >
          {porProveedor.length === 0 ? (
            <p className="mt-4 text-sm text-[#5B655F]">Todavía no hay reclamos asignados a proveedores.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E6E9E4] text-left text-xs text-[#5B655F]">
                    <th scope="col" className="py-2 pr-3 font-medium">Proveedor</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Asignados</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Resueltos</th>
                    <th scope="col" className="py-2 pl-3 text-right font-medium">Días promedio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF0EC]">
                  {porProveedor.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2.5 pr-3">{p.nombre}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{p.asignados}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{p.resueltos}</td>
                      <td className="py-2.5 pl-3 text-right font-medium tabular-nums">
                        {p.resueltos > 0 ? unDecimal.format(p.dias) : "Sin datos"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
