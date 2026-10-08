import Link from "next/link";
import {
  BOTON_SECUNDARIO,
  ESTILO_ESTADO,
  ESTILO_URGENCIA,
  FUENTE_DISPLAY,
  GRUPO_SEGMENTOS,
  Placa,
  claseSegmento,
} from "@/components/portero-ui";
import { crearEtiquetas, type Catalogos } from "@/lib/catalogos";
import type { ReclamoDetalle } from "@/lib/datos/reclamos";
import { diasEntre } from "@/lib/fechas";

// Vista del dashboard: recibe los reclamos del período (ya filtrados por RLS) y calcula los indicadores

type Reclamo = ReclamoDetalle;

const unDecimal = new Intl.NumberFormat("es-UY", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const porcentaje = new Intl.NumberFormat("es-UY", { style: "percent", maximumFractionDigits: 0 });

const FILA_LINK =
  "-mx-2 flex items-center gap-3 rounded-md px-2 py-1 text-sm transition-colors hover:bg-[#F3F4F1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4D3E]";

const diasResolucion = (r: Reclamo) => diasEntre(r.created_at, r.resuelto_at as string);
const promedio = (lista: Reclamo[]) =>
  lista.length ? lista.reduce((suma, r) => suma + diasResolucion(r), 0) / lista.length : 0;

export function Indicadores({
  reclamos,
  catalogos,
  edificios,
  meses,
  periodos,
  proveedores,
}: {
  reclamos: Reclamo[];
  catalogos: Catalogos;
  edificios: string;
  meses: number;
  periodos: number[];
  proveedores: Map<number, string>;
}) {
  const diasPeriodo = meses * 31;
  const etiquetas = crearEtiquetas(catalogos);

  // ---------- Indicadores ----------
  const total = reclamos.length;
  const resueltos = reclamos.filter((r) => r.estado === "resuelto" && r.resuelto_at);
  const abiertos = reclamos.filter((r) => r.estado !== "resuelto").length;

  // ---------- Agrupaciones ----------
  // Categoría efectiva: la del admin o, si todavía no decidió, la de la IA (igual que en la bandeja)
  const porCategoria = catalogos.categorias.map((c) => ({
    clave: c.codigo,
    etiqueta: c.nombre,
    valor: reclamos.filter((r) => r.categoria_efectiva === c.codigo).length,
  })).sort((a, b) => b.valor - a.valor);
  const sinClasificar = reclamos.filter((r) => !r.categoria_efectiva).length;
  if (sinClasificar > 0) porCategoria.push({ clave: "sin", etiqueta: "Sin clasificar", valor: sinClasificar });

  const porEstado = catalogos.estados.map((e) => ({
    estado: e.codigo,
    nombre: e.nombre_admin,
    valor: reclamos.filter((r) => r.estado === e.codigo).length,
  }));

  const porUrgencia = catalogos.urgencias.map((u) => ({
    urgencia: u.codigo,
    nombre: u.nombre,
    dias: promedio(resueltos.filter((r) => r.urgencia === u.codigo)),
  }));

  // Criterio de prioridad: cuántos reclamos subieron de urgencia y por qué
  const subieron = reclamos.filter((r) => (r.motivos ?? []).length > 0 && r.urgencia_calculada !== r.urgencia_base);
  const porMotivo = [
    { etiqueta: "Vecino prioritario", valor: subieron.filter((r) => r.motivos.some((m) => m.startsWith("Vecino prioritario"))).length },
    { etiqueta: "Vecino conflictivo", valor: subieron.filter((r) => r.motivos.some((m) => m.startsWith("Vecino conflictivo"))).length },
    { etiqueta: "Problema repetido", valor: subieron.filter((r) => r.motivos.some((m) => m.startsWith("Problema"))).length },
  ];

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
      lista.forEach((r) => r.categoria_efectiva && conteo.set(r.categoria_efectiva, (conteo.get(r.categoria_efectiva) ?? 0) + 1));
      const principal = [...conteo.entries()].sort((a, b) => b[1] - a[1])[0];
      return {
        unidad,
        valor: lista.length,
        abiertos: lista.filter((r) => r.estado !== "resuelto").length,
        principal: principal ? etiquetas.categoria(principal[0]) : undefined,
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

  // Acierto de la IA: solo cuenta los reclamos donde el admin ya decidió
  const compararIA = (ia: keyof Reclamo, final: keyof Reclamo) => {
    const evaluados = reclamos.filter((r) => r[ia] != null && r[final] != null);
    return {
      evaluados: evaluados.length,
      aciertos: evaluados.filter((r) => r[ia] === r[final]).length,
    };
  };
  const acierto = [
    { etiqueta: "Categoría", ...compararIA("ia_categoria", "categoria") },
    { etiqueta: "Urgencia", ...compararIA("ia_urgencia", "urgencia") },
    { etiqueta: "Proveedor", ...compararIA("ia_proveedor_id", "proveedor_id") },
  ];
  const evaluadosIA = acierto[0].evaluados;

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
            className={GRUPO_SEGMENTOS}
          >
            {periodos.map((p) => (
              <Link
                key={p}
                href={`/protected/dashboard?meses=${p}`}
                aria-current={p === meses ? "page" : undefined}
                className={claseSegmento(p === meses)}
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
                    backgroundColor: ESTILO_ESTADO[e.estado]?.color,
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
                    style={{ backgroundColor: ESTILO_ESTADO[e.estado]?.color }}
                  />
                  <span className="flex-1">{e.nombre}</span>
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
                <span className="w-14 shrink-0 text-[#5B655F]">{u.nombre}</span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#EEF0EC]">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${(u.dias / maxDias) * 100}%`,
                      backgroundColor: ESTILO_URGENCIA[u.urgencia]?.color,
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
        <Tarjeta
          titulo="Criterio de prioridad"
          nota={`${subieron.length} de ${total} reclamos subieron de urgencia por el perfil del vecino o por un problema repetido. Un reclamo puede tener los dos motivos.`}
          className="lg:col-span-5"
        >
          <ul className="mt-5 grid gap-5 sm:grid-cols-3">
            {porMotivo.map((m) => (
              <li key={m.etiqueta} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm text-[#5B655F]">{m.etiqueta}</span>
                  <span className={`${FUENTE_DISPLAY} text-2xl font-semibold tabular-nums`}>{m.valor}</span>
                </div>
                <span className="h-2.5 overflow-hidden rounded-full bg-[#EEF0EC]">
                  <span
                    className="block h-full rounded-full bg-[#B07A2A]"
                    style={{ width: `${(m.valor / Math.max(subieron.length, 1)) * 100}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </Tarjeta>

        <Tarjeta
          titulo="Acierto de la IA"
          nota={
            evaluadosIA > 0
              ? `En cuántos reclamos la administración coincidió con la sugerencia de la IA. Sobre ${evaluadosIA} ${evaluadosIA === 1 ? "reclamo" : "reclamos"} con sugerencia y decisión.`
              : "Va a aparecer cuando haya reclamos con sugerencia de la IA que la administración ya clasificó."
          }
          className="lg:col-span-5"
        >
          {evaluadosIA > 0 && (
            <ul className="mt-5 grid gap-5 sm:grid-cols-3">
              {acierto.map((a) => {
                const tasa = a.evaluados ? a.aciertos / a.evaluados : 0;
                return (
                  <li key={a.etiqueta} className="flex flex-col gap-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm text-[#5B655F]">{a.etiqueta}</span>
                      <span className={`${FUENTE_DISPLAY} text-2xl font-semibold tabular-nums`}>
                        {a.evaluados ? porcentaje.format(tasa) : "Sin datos"}
                      </span>
                    </div>
                    <span className="h-2.5 overflow-hidden rounded-full bg-[#EEF0EC]">
                      <span className="block h-full rounded-full bg-[#1E4D3E]" style={{ width: `${tasa * 100}%` }} />
                    </span>
                    <span className="text-xs text-[#5B655F]">
                      {a.aciertos} de {a.evaluados}
                    </span>
                  </li>
                );
              })}
            </ul>
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
