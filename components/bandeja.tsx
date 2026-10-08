import { GestionarReclamo } from "@/components/gestionar-reclamo";
import { EstadoChip, UrgenciaMarca } from "@/components/marcas";
import { Placa } from "@/components/portero-ui";
import type { ReclamoDetalle } from "@/lib/datos/reclamos";
import type { Etiquetas } from "@/lib/catalogos";
import { tiempoRelativo } from "@/lib/fechas";
import { compararUnidades } from "@/lib/texto";

// Bandeja del administrador: filas de reclamos y vista agrupada por unidad.
// La recurrencia y la urgencia vienen calculadas de la base (vista reclamos_detalle);
// acá solo se muestran, para no tener la misma regla escrita dos veces.

type Proveedor = { id: number; nombre: string; categoria: string };
type PropsFila = {
  ahora: number;
  fotos: Map<string, string>;
  proveedores: Proveedor[];
  etiquetas: Etiquetas;
};

export function VistaPorUnidad({ reclamos, ...props }: { reclamos: ReclamoDetalle[] } & PropsFila) {
  const grupos = new Map<string, ReclamoDetalle[]>();
  reclamos.forEach((r) => grupos.set(r.unidad, [...(grupos.get(r.unidad) ?? []), r]));
  const unidades = [...grupos.keys()].sort(compararUnidades);

  return (
    <div className="flex flex-col gap-4">
      {unidades.map((unidad) => {
        const lista = grupos.get(unidad) ?? [];
        const abiertos = lista.filter((r) => r.estado !== "resuelto").length;
        const ultimo = lista.reduce((a, b) => (a.created_at > b.created_at ? a : b));
        // El reclamo con más repeticiones de la unidad, si alguno cumple la regla (3 en 30 días)
        const repetido = lista
          .filter((r) => r.repeticiones >= 3 && r.categoria_efectiva)
          .sort((a, b) => b.repeticiones - a.repeticiones)[0];

        return (
          <details key={unidad} open className="group/unidad overflow-hidden rounded-lg border border-[#DDE1DB] bg-white">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 bg-[#FAFBF9] px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1E4D3E] [&::-webkit-details-marker]:hidden">
              <Placa unidad={unidad} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {lista.length === 1 ? "1 reclamo" : `${lista.length} reclamos`}
                  {abiertos !== lista.length ? `, ${abiertos} ${abiertos === 1 ? "abierto" : "abiertos"}` : ""}
                </p>
                <p className="text-sm text-[#5B655F]">El último, {tiempoRelativo(ultimo.created_at, props.ahora).toLowerCase()}</p>
                {repetido && (
                  <AvisoRepetido texto={`${props.etiquetas.categoria(repetido.categoria_efectiva)} (${repetido.repeticiones})`} className="mt-1.5 inline-flex sm:hidden" />
                )}
              </div>
              {repetido && (
                <AvisoRepetido texto={`${props.etiquetas.categoria(repetido.categoria_efectiva)} (${repetido.repeticiones})`} className="hidden sm:inline-flex" />
              )}
              <Flecha grupo="unidad" />
            </summary>
            <ul className="divide-y divide-[#E6E9E4] border-t border-[#E6E9E4]">
              {lista.map((r) => (
                <FilaReclamo key={r.id} r={r} {...props} />
              ))}
            </ul>
          </details>
        );
      })}
    </div>
  );
}

function AvisoRepetido({ texto, className }: { texto: string; className: string }) {
  return (
    <span
      className={`items-center rounded-full border border-[#D9BC8A] bg-[#F6EAD6] px-2.5 py-0.5 text-xs font-medium text-[#7A4F12] ${className}`}
      title="La misma categoría se repitió 3 o más veces en 30 días"
    >
      Se repite: {texto}
    </span>
  );
}

function Flecha({ grupo }: { grupo?: "unidad" }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className={`h-4 w-4 shrink-0 text-[#5B655F] transition-transform ${
        grupo === "unidad" ? "group-open/unidad:rotate-180" : "group-open:rotate-180"
      }`}
    >
      <path d="M5 7.5 10 12.5 15 7.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function FilaReclamo({
  r,
  ahora,
  fotos,
  proveedores,
  etiquetas,
  mostrarUnidad = false,
}: { r: ReclamoDetalle; mostrarUnidad?: boolean } & PropsFila) {
  const foto = r.foto_path ? fotos.get(r.foto_path) : undefined;
  // Urgencia sugerida = todavía no la confirmó el admin
  const sugerida = !r.urgencia && !!r.urgencia_final;
  const marcas = (
    <>
      <UrgenciaMarca urgencia={r.urgencia_final} sugerida={sugerida} />
      <EstadoChip estado={r.estado} vista="admin" />
    </>
  );

  return (
    <li>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-4 px-4 py-3.5 transition-colors hover:bg-[#F8F9F7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1E4D3E] [&::-webkit-details-marker]:hidden">
          {mostrarUnidad && <Placa unidad={r.unidad} />}
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{r.descripcion}</p>
            <p className="mt-0.5 text-sm text-[#5B655F]">
              {tiempoRelativo(r.created_at, ahora)}
              {r.categoria_efectiva
                ? `, ${etiquetas.categoria(r.categoria_efectiva)}${r.categoria ? "" : " según la IA"}`
                : ""}
              {foto ? ", con foto" : ""}
              {r.estado === "agendado" && r.ultima_visita
                ? `, visita el ${new Date(r.ultima_visita).toLocaleString("es-UY", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}`
                : ""}
            </p>
          </div>
          <div className="hidden items-center gap-4 sm:flex">{marcas}</div>
          <Flecha />
        </summary>

        <div className={`border-t border-[#E6E9E4] bg-[#FAFBF9] px-4 pb-5 pt-4 ${mostrarUnidad ? "sm:pl-[5.25rem]" : ""}`}>
          <div className="mb-3 flex items-center gap-4 sm:hidden">{marcas}</div>
          <p className="text-sm text-[#5B655F]">
            {r.vecino
              ? `${r.vecino}, unidad ${r.unidad}${r.tipo_vecino !== "estandar" ? ` · vecino ${etiquetas.tipoVecino(r.tipo_vecino).toLowerCase()}` : ""}`
              : `Unidad ${r.unidad} · reclamo histórico`}
          </p>
          {r.descripcion.length > 60 && <p className="mt-2 max-w-prose text-sm">{r.descripcion}</p>}
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
            visita={r.ultima_visita}
            ia={{
              categoria: r.ia_categoria,
              urgencia: r.ia_urgencia,
              proveedor_id: r.ia_proveedor_id,
              justificacion: r.ia_justificacion,
            }}
            prioridad={{ base: r.urgencia_base, calculada: r.urgencia_calculada, motivos: r.motivos ?? [] }}
          />
        </div>
      </details>
    </li>
  );
}
