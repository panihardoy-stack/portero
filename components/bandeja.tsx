import { GestionarReclamo } from "@/components/gestionar-reclamo";
import {
  CATEGORIA_LABEL,
  EstadoChip,
  Placa,
  UrgenciaMarca,
  compararUnidades,
  tiempoRelativo,
} from "@/components/portero-ui";

// Bandeja del administrador: filas de reclamos y vista agrupada por unidad

const DIA = 1000 * 60 * 60 * 24;

export type ReclamoAdmin = {
  id: number;
  descripcion: string;
  estado: string;
  created_at: string;
  foto_path: string | null;
  categoria: string | null;
  urgencia: string | null;
  proveedor_id: number | null;
  ia_categoria: string | null;
  ia_urgencia: string | null;
  ia_proveedor_id: number | null;
  ia_justificacion: string | null;
  visita: string | null;
  unidad: string;
};

// Agrupa los reclamos por unidad y marca los problemas que se repiten
export function VistaPorUnidad({
  reclamos,
  ahora,
  fotos,
  proveedores,
}: {
  reclamos: ReclamoAdmin[];
  ahora: number;
  fotos: Map<string, string>;
  proveedores: { id: number; nombre: string; categoria: string }[];
}) {
  const grupos = new Map<string, ReclamoAdmin[]>();
  reclamos.forEach((r) => grupos.set(r.unidad, [...(grupos.get(r.unidad) ?? []), r]));
  const unidades = [...grupos.keys()].sort(compararUnidades);

  return (
    <div className="flex flex-col gap-4">
      {unidades.map((unidad) => {
        const lista = grupos.get(unidad) ?? [];
        const abiertos = lista.filter((r) => r.estado !== "resuelto").length;
        const ultimo = lista.reduce((a, b) => (a.created_at > b.created_at ? a : b));

        // Misma categoría dos o más veces en los últimos 90 días
        const recientes = lista.filter(
          (r) => r.categoria && ahora - new Date(r.created_at).getTime() < 90 * DIA
        );
        const conteo = new Map<string, number>();
        recientes.forEach((r) => conteo.set(r.categoria!, (conteo.get(r.categoria!) ?? 0) + 1));
        const repetida = [...conteo.entries()].sort((a, b) => b[1] - a[1]).find(([, n]) => n >= 2);

        return (
          <details
            key={unidad}
            open
            className="group/unidad overflow-hidden rounded-lg border border-[#DDE1DB] bg-white"
          >
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 bg-[#FAFBF9] px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1E4D3E] [&::-webkit-details-marker]:hidden">
              <Placa unidad={unidad} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {lista.length === 1 ? "1 reclamo" : `${lista.length} reclamos`}
                  {abiertos !== lista.length ? `, ${abiertos} ${abiertos === 1 ? "abierto" : "abiertos"}` : ""}
                </p>
                <p className="text-sm text-[#5B655F]">
                  El último, {tiempoRelativo(ultimo.created_at, ahora).toLowerCase()}
                </p>
                {repetida && (
                  <AvisoRepetido categoria={repetida[0]} veces={repetida[1]} className="mt-1.5 inline-flex sm:hidden" />
                )}
              </div>
              {repetida && (
                <AvisoRepetido categoria={repetida[0]} veces={repetida[1]} className="hidden sm:inline-flex" />
              )}
              <svg
                aria-hidden
                viewBox="0 0 20 20"
                className="h-4 w-4 shrink-0 text-[#5B655F] transition-transform group-open/unidad:rotate-180"
              >
                <path d="M5 7.5 10 12.5 15 7.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </summary>
            <ul className="divide-y divide-[#E6E9E4] border-t border-[#E6E9E4]">
              {lista.map((r) => (
                <FilaReclamo
                  key={r.id}
                  r={r}
                  ahora={ahora}
                  foto={r.foto_path ? fotos.get(r.foto_path) : undefined}
                  proveedores={proveedores}
                />
              ))}
            </ul>
          </details>
        );
      })}
    </div>
  );
}

function AvisoRepetido({
  categoria,
  veces,
  className,
}: {
  categoria: string;
  veces: number;
  className: string;
}) {
  return (
    <span
      className={`items-center rounded-full border border-[#D9BC8A] bg-[#F6EAD6] px-2.5 py-0.5 text-xs font-medium text-[#7A4F12] ${className}`}
      title="La misma categoría se repitió en los últimos tres meses"
    >
      Se repite: {CATEGORIA_LABEL[categoria]} ({veces})
    </span>
  );
}

export function FilaReclamo({
  r,
  ahora,
  foto,
  proveedores,
  mostrarUnidad = false,
}: {
  r: ReclamoAdmin;
  ahora: number;
  foto?: string;
  proveedores: { id: number; nombre: string; categoria: string }[];
  mostrarUnidad?: boolean;
}) {
  return (
    <li>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-4 px-4 py-3.5 transition-colors hover:bg-[#F8F9F7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1E4D3E] [&::-webkit-details-marker]:hidden">
          {mostrarUnidad && <Placa unidad={r.unidad} />}
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{r.descripcion}</p>
            <p className="mt-0.5 text-sm text-[#5B655F]">
              {tiempoRelativo(r.created_at, ahora)}
              {r.categoria
                ? `, ${CATEGORIA_LABEL[r.categoria] ?? r.categoria}`
                : r.ia_categoria
                  ? `, ${CATEGORIA_LABEL[r.ia_categoria] ?? r.ia_categoria} según la IA`
                  : ""}
              {foto ? ", con foto" : ""}
              {r.estado === "agendado" && r.visita
                ? `, visita el ${new Date(r.visita).toLocaleString("es-UY", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}`
                : ""}
            </p>
          </div>
          <div className="hidden items-center gap-4 sm:flex">
            <UrgenciaMarca urgencia={r.urgencia} />
            <EstadoChip estado={r.estado} vista="admin" />
          </div>
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            className="h-4 w-4 shrink-0 text-[#5B655F] transition-transform group-open:rotate-180"
          >
            <path d="M5 7.5 10 12.5 15 7.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        </summary>

        <div
          className={`border-t border-[#E6E9E4] bg-[#FAFBF9] px-4 pb-5 pt-4 ${
            mostrarUnidad ? "sm:pl-[5.25rem]" : ""
          }`}
        >
          <div className="mb-3 flex items-center gap-4 sm:hidden">
            <UrgenciaMarca urgencia={r.urgencia} />
            <EstadoChip estado={r.estado} vista="admin" />
          </div>
          {r.descripcion.length > 60 && <p className="max-w-prose text-sm">{r.descripcion}</p>}
          {foto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={foto}
              alt={`Foto del reclamo: ${r.descripcion}`}
              className="mt-3 max-h-72 rounded-md border border-[#DDE1DB] object-cover"
            />
          )}
          <GestionarReclamo
            reclamo={{
              id: r.id,
              categoria: r.categoria,
              urgencia: r.urgencia,
              proveedor_id: r.proveedor_id,
              estado: r.estado,
            }}
            proveedores={proveedores}
            visita={r.visita}
            ia={{
              categoria: r.ia_categoria,
              urgencia: r.ia_urgencia,
              proveedor_id: r.ia_proveedor_id,
              justificacion: r.ia_justificacion,
            }}
          />
        </div>
      </details>
    </li>
  );
}

