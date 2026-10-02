"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CATEGORIAS,
  CATEGORIA_LABEL,
  ESTADOS,
  ESTADO_INFO,
  URGENCIAS,
  URGENCIA_INFO,
} from "@/components/portero-ui";

const SELECT =
  "h-10 rounded-md border border-[#CFD5CD] bg-white px-3 text-sm text-[#18211D] focus:border-[#1E4D3E] focus:outline-none focus:ring-2 focus:ring-[#1E4D3E]/20";

const PERIODOS = [
  { valor: "", texto: "Cualquier fecha" },
  { valor: "7", texto: "Últimos 7 días" },
  { valor: "30", texto: "Últimos 30 días" },
  { valor: "90", texto: "Últimos 3 meses" },
  { valor: "180", texto: "Últimos 6 meses" },
];

// Barra de búsqueda y filtros de la bandeja. Guarda todo en la dirección de la página.
export function FiltrosReclamos() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pendiente, startTransition] = useTransition();
  const [texto, setTexto] = useState(params.get("q") ?? "");

  const vista = params.get("vista") === "lista" ? "lista" : "unidad";
  const hayFiltros = ["q", "estado", "categoria", "urgencia", "dias"].some((k) => params.get(k));

  function cambiar(clave: string, valor: string) {
    const nuevos = new URLSearchParams(params.toString());
    if (valor) nuevos.set(clave, valor);
    else nuevos.delete(clave);
    startTransition(() => {
      router.replace(`${pathname}?${nuevos.toString()}`, { scroll: false });
    });
  }

  // La búsqueda espera a que termines de escribir antes de filtrar
  useEffect(() => {
    if (texto === (params.get("q") ?? "")) return;
    const espera = setTimeout(() => cambiar("q", texto.trim()), 350);
    return () => clearTimeout(espera);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  return (
    <div className={`flex flex-col gap-3 transition-opacity ${pendiente ? "opacity-60" : ""}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5B655F]"
          >
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
            placeholder="Buscar por unidad, problema o categoría"
            className="h-10 w-full rounded-md border border-[#CFD5CD] bg-white pl-9 pr-3 text-sm placeholder:text-[#9AA39D] focus:border-[#1E4D3E] focus:outline-none focus:ring-2 focus:ring-[#1E4D3E]/20"
          />
        </div>

        <div role="group" aria-label="Forma de ver los reclamos" className="inline-flex self-start rounded-md border border-[#CFD5CD] bg-white p-0.5 sm:self-auto">
          {[
            { valor: "unidad", texto: "Por unidad" },
            { valor: "lista", texto: "Lista" },
          ].map((v) => (
            <button
              key={v.valor}
              type="button"
              aria-pressed={vista === v.valor}
              onClick={() => cambiar("vista", v.valor === "unidad" ? "" : v.valor)}
              className={`rounded-[5px] px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4D3E] ${
                vista === v.valor ? "bg-[#1E4D3E] text-white" : "text-[#5B655F] hover:text-[#18211D]"
              }`}
            >
              {v.texto}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="f-estado">Estado</label>
        <select
          id="f-estado"
          value={params.get("estado") ?? ""}
          onChange={(e) => cambiar("estado", e.target.value)}
          className={SELECT}
        >
          <option value="">Abiertos</option>
          <option value="todos">Todos los estados</option>
          {ESTADOS.map((e) => (
            <option key={e} value={e}>
              {ESTADO_INFO[e].admin}
            </option>
          ))}
        </select>

        <label className="sr-only" htmlFor="f-categoria">Categoría</label>
        <select
          id="f-categoria"
          value={params.get("categoria") ?? ""}
          onChange={(e) => cambiar("categoria", e.target.value)}
          className={SELECT}
        >
          <option value="">Todas las categorías</option>
          {CATEGORIAS.map((c) => (
            <option key={c} value={c}>
              {CATEGORIA_LABEL[c]}
            </option>
          ))}
          <option value="sin">Sin clasificar</option>
        </select>

        <label className="sr-only" htmlFor="f-urgencia">Urgencia</label>
        <select
          id="f-urgencia"
          value={params.get("urgencia") ?? ""}
          onChange={(e) => cambiar("urgencia", e.target.value)}
          className={SELECT}
        >
          <option value="">Cualquier urgencia</option>
          {URGENCIAS.map((u) => (
            <option key={u} value={u}>
              Urgencia {URGENCIA_INFO[u].label.toLowerCase()}
            </option>
          ))}
        </select>

        <label className="sr-only" htmlFor="f-dias">Período</label>
        <select
          id="f-dias"
          value={params.get("dias") ?? ""}
          onChange={(e) => cambiar("dias", e.target.value)}
          className={SELECT}
        >
          {PERIODOS.map((p) => (
            <option key={p.valor} value={p.valor}>
              {p.texto}
            </option>
          ))}
        </select>

        {hayFiltros && (
          <Link
            href={vista === "lista" ? `${pathname}?vista=lista` : pathname}
            onClick={() => setTexto("")}
            className="rounded px-2 py-1 text-sm font-medium text-[#1E4D3E] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4D3E]"
          >
            Limpiar filtros
          </Link>
        )}
      </div>
    </div>
  );
}
