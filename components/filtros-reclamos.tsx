"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCatalogos } from "@/components/catalogos-provider";
import { GRUPO_SEGMENTOS, SELECT, claseSegmento } from "@/components/portero-ui";

const PERIODOS = [
  { valor: "", texto: "Cualquier fecha" },
  { valor: "7", texto: "Últimos 7 días" },
  { valor: "30", texto: "Últimos 30 días" },
  { valor: "90", texto: "Últimos 3 meses" },
  { valor: "180", texto: "Últimos 6 meses" },
];

export type Conteo = { porEstado: Record<string, number>; abiertos: number; total: number; urgentes: number };

// Pestañas por estado, búsqueda y filtros de la bandeja. Todo queda en la dirección de la página,
// así un link (por ejemplo, el del mail de n8n) abre la bandeja ya filtrada.
export function FiltrosReclamos({ conteo }: { conteo: Conteo }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pendiente, startTransition] = useTransition();
  const [texto, setTexto] = useState(params.get("q") ?? "");
  const { categorias, estados } = useCatalogos();

  const estadoActual = params.get("estado") ?? "";
  const vista = params.get("vista") === "unidad" ? "unidad" : "lista";
  const soloUrgentes = params.get("urgencia") === "alta";
  const hayFiltros = ["q", "categoria", "urgencia", "dias"].some((k) => params.get(k));

  function href(cambios: Record<string, string>) {
    const nuevos = new URLSearchParams(params.toString());
    Object.entries(cambios).forEach(([clave, valor]) => (valor ? nuevos.set(clave, valor) : nuevos.delete(clave)));
    const q = nuevos.toString();
    return q ? `${pathname}?${q}` : pathname;
  }

  function cambiar(clave: string, valor: string) {
    startTransition(() => router.replace(href({ [clave]: valor }), { scroll: false }));
  }

  // La búsqueda espera a que termines de escribir antes de filtrar
  useEffect(() => {
    if (texto === (params.get("q") ?? "")) return;
    const espera = setTimeout(() => cambiar("q", texto.trim()), 350);
    return () => clearTimeout(espera);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  const pestanas = [
    { valor: "", texto: "Abiertos", cantidad: conteo.abiertos },
    ...estados.map((e) => ({ valor: e.codigo, texto: e.nombre_admin, cantidad: conteo.porEstado[e.codigo] ?? 0 })),
    { valor: "todos", texto: "Todos", cantidad: conteo.total },
  ];

  return (
    <div className={`flex flex-col gap-3 transition-opacity ${pendiente ? "opacity-60" : ""}`}>
      <nav aria-label="Estado de los reclamos" className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1 border-b border-[#DDE1DB]">
          {pestanas.map((p) => {
            const activa = estadoActual === p.valor;
            return (
              <li key={p.valor || "abiertos"}>
                <Link
                  href={href({ estado: p.valor, r: "" })}
                  scroll={false}
                  aria-current={activa ? "page" : undefined}
                  className={`relative flex items-center gap-2 px-3 pb-2.5 pt-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4D3E] ${
                    activa
                      ? "text-[#18211D] after:absolute after:inset-x-2 after:-bottom-px after:h-[3px] after:rounded-t-full after:bg-[#1E4D3E]"
                      : "text-[#5B655F] hover:text-[#18211D]"
                  }`}
                >
                  {p.texto}
                  <span
                    className={`rounded-full px-1.5 py-px text-xs tabular-nums ${
                      activa ? "bg-[#1E4D3E] text-white" : p.valor === "nuevo" && p.cantidad > 0 ? "bg-[#E6EEF8] text-[#234F85]" : "bg-[#E9ECE7] text-[#5B655F]"
                    }`}
                  >
                    {p.cantidad}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <svg aria-hidden viewBox="0 0 20 20" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5B655F]">
            <circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="m13.5 13.5 3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <label htmlFor="buscar" className="sr-only">
            Buscar reclamos
          </label>
          <input
            id="buscar"
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar por unidad, vecino o problema"
            className="h-10 w-full rounded-md border border-[#CFD5CD] bg-white pl-9 pr-3 text-sm placeholder:text-[#9AA39D] focus:border-[#1E4D3E] focus:outline-none focus:ring-2 focus:ring-[#1E4D3E]/20"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={soloUrgentes}
            onClick={() => cambiar("urgencia", soloUrgentes ? "" : "alta")}
            className={`inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4D3E] ${
              soloUrgentes ? "border-[#B8453A] bg-[#FBEDEB] text-[#A3352B]" : "border-[#CFD5CD] bg-white text-[#18211D] hover:bg-[#F8F9F7]"
            }`}
          >
            <span aria-hidden className="h-2 w-2 rounded-full bg-[#B8453A]" />
            Urgentes
            <span className="tabular-nums text-[#5B655F]">{conteo.urgentes}</span>
          </button>

          <label className="sr-only" htmlFor="f-categoria">
            Categoría
          </label>
          <select id="f-categoria" style={{ flex: "1 1 9rem" }} value={params.get("categoria") ?? ""} onChange={(e) => cambiar("categoria", e.target.value)} className={SELECT}>
            <option value="">Todas las categorías</option>
            {categorias.map((c) => (
              <option key={c.codigo} value={c.codigo}>
                {c.nombre}
              </option>
            ))}
            <option value="sin">Sin clasificar</option>
          </select>

          <label className="sr-only" htmlFor="f-dias">
            Período
          </label>
          <select id="f-dias" style={{ flex: "1 1 9rem" }} value={params.get("dias") ?? ""} onChange={(e) => cambiar("dias", e.target.value)} className={SELECT}>
            {PERIODOS.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.texto}
              </option>
            ))}
          </select>

          <div role="group" aria-label="Ordenar" className={GRUPO_SEGMENTOS}>
            {[
              { valor: "lista", texto: "Por urgencia" },
              { valor: "unidad", texto: "Por unidad" },
            ].map((v) => (
              <button
                key={v.valor}
                type="button"
                aria-pressed={vista === v.valor}
                onClick={() => cambiar("vista", v.valor === "lista" ? "" : v.valor)}
                className={claseSegmento(vista === v.valor)}
              >
                {v.texto}
              </button>
            ))}
          </div>

          {hayFiltros && (
            <Link
              href={href({ q: "", categoria: "", urgencia: "", dias: "" })}
              scroll={false}
              onClick={() => setTexto("")}
              className="rounded px-2 py-1 text-sm font-medium text-[#1E4D3E] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4D3E]"
            >
              Limpiar
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
