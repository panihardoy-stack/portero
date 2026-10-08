import Link from "next/link";
import { EstadoChip, UrgenciaMarca } from "@/components/marcas";
import { ESTILO_URGENCIA, Placa } from "@/components/portero-ui";
import type { ReclamoDetalle } from "@/lib/datos/reclamos";
import type { Etiquetas } from "@/lib/catalogos";
import { tiempoRelativo } from "@/lib/fechas";

// Lista de la bandeja del administrador. Cada fila es un link que abre el reclamo
// en el panel de detalle (?r=id), sin perder los filtros.
// La recurrencia y la urgencia vienen calculadas de la base (vista reclamos_detalle).

type PropsLista = {
  reclamos: ReclamoDetalle[];
  seleccionado: number | null;
  ahora: number;
  etiquetas: Etiquetas;
  hrefDe: (id: number) => string;
  porUnidad: boolean;
};

export function ListaReclamos({ reclamos, porUnidad, ...props }: PropsLista) {
  if (!porUnidad) {
    return (
      <ul className="divide-y divide-[#E6E9E4]">
        {reclamos.map((r) => (
          <FilaReclamo key={r.id} r={r} mostrarUnidad {...props} />
        ))}
      </ul>
    );
  }

  const grupos = new Map<string, ReclamoDetalle[]>();
  reclamos.forEach((r) => grupos.set(r.unidad, [...(grupos.get(r.unidad) ?? []), r]));
  // Las unidades quedan en el orden de su reclamo más urgente (la lista ya viene ordenada)
  const unidades = [...grupos.keys()];

  return (
    <div>
      {unidades.map((unidad) => {
        const lista = grupos.get(unidad) ?? [];
        // El reclamo con más repeticiones de la unidad, si alguno cumple la regla (3 en 30 días)
        const repetido = lista
          .filter((r) => r.repeticiones >= 3 && r.categoria_efectiva)
          .sort((a, b) => b.repeticiones - a.repeticiones)[0];
        return (
          <section key={unidad} aria-label={`Unidad ${unidad}`}>
            <div className="sticky top-0 z-10 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#E6E9E4] bg-[#F8F9F7] px-4 py-2">
              <Placa unidad={unidad} />
              <span className="text-sm text-[#5B655F]">{lista.length === 1 ? "1 reclamo" : `${lista.length} reclamos`}</span>
              {repetido && (
                <span
                  className="ml-auto rounded-full border border-[#D9BC8A] bg-[#F6EAD6] px-2.5 py-0.5 text-xs font-medium text-[#7A4F12]"
                  title="La misma categoría se repitió 3 o más veces en 30 días"
                >
                  Se repite: {props.etiquetas.categoria(repetido.categoria_efectiva)} ({repetido.repeticiones})
                </span>
              )}
            </div>
            <ul className="divide-y divide-[#E6E9E4] border-b border-[#E6E9E4]">
              {lista.map((r) => (
                <FilaReclamo key={r.id} r={r} {...props} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function FilaReclamo({
  r,
  seleccionado,
  ahora,
  etiquetas,
  hrefDe,
  mostrarUnidad = false,
}: Omit<PropsLista, "reclamos" | "porUnidad"> & { r: ReclamoDetalle; mostrarUnidad?: boolean }) {
  const activo = r.id === seleccionado;
  // Urgencia sugerida = todavía no la confirmó el admin
  const sugerida = !r.urgencia && !!r.urgencia_final;
  const color = r.urgencia_final ? ESTILO_URGENCIA[r.urgencia_final]?.color : undefined;
  const detalle = [
    tiempoRelativo(r.created_at, ahora),
    r.categoria_efectiva ? etiquetas.categoria(r.categoria_efectiva) : "Sin clasificar",
    r.vecino ?? null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <li>
      <Link
        href={hrefDe(r.id)}
        aria-current={activo ? "true" : undefined}
        className={`relative flex items-start gap-3 py-3 pl-5 pr-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1E4D3E] ${
          activo ? "hover:bg-[#F8F9F7] lg:bg-[#EAF2ED]" : "hover:bg-[#F8F9F7]"
        }`}
      >
        {/* Franja de urgencia: se lee de un vistazo qué es más grave */}
        <span
          aria-hidden
          className="absolute inset-y-2 left-1.5 w-1 rounded-full"
          style={{ backgroundColor: color ?? "#E1E5DF", opacity: sugerida ? 0.45 : 1 }}
        />
        {mostrarUnidad && <Placa unidad={r.unidad} />}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className={`line-clamp-2 text-sm leading-snug ${r.estado === "nuevo" ? "font-semibold" : "font-medium"}`}>
              {r.descripcion}
            </p>
            <EstadoChip estado={r.estado} vista="admin" />
          </div>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <p className="truncate text-xs text-[#5B655F]">{detalle}</p>
            <UrgenciaMarca urgencia={r.urgencia_final} sugerida={sugerida} />
          </div>
        </div>
      </Link>
    </li>
  );
}
