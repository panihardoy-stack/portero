import Link from "next/link";
import { GestionarReclamo } from "@/components/gestionar-reclamo";
import { EstadoChip, Seguimiento, UrgenciaMarca } from "@/components/marcas";
import { Estrellas, FUENTE_DISPLAY, Placa } from "@/components/portero-ui";
import type { Calificacion } from "@/lib/datos/calificaciones";
import type { ReclamoDetalle } from "@/lib/datos/reclamos";
import type { Etiquetas } from "@/lib/catalogos";

type Proveedor = { id: number; nombre: string; categoria: string };

// Panel con un reclamo abierto: quién, qué, en qué va y el próximo paso
export function DetalleReclamo({
  r,
  foto,
  calificacion,
  proveedores,
  etiquetas,
  hrefVolver,
}: {
  r: ReclamoDetalle;
  foto?: string;
  calificacion?: Calificacion;
  proveedores: Proveedor[];
  etiquetas: Etiquetas;
  hrefVolver: string;
}) {
  const fecha = new Date(r.created_at);
  const recibido = `${fecha.toLocaleDateString("es-UY", { day: "numeric", month: "long" })}, ${fecha.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}`;
  const sugerida = !r.urgencia && !!r.urgencia_final;

  return (
    <article aria-labelledby={`titulo-${r.id}`} className="flex flex-col gap-5 p-5 sm:p-6">
      <Link
        href={hrefVolver}
        className="-mb-1 inline-flex items-center gap-1 self-start rounded text-sm font-medium text-[#1E4D3E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4D3E] lg:hidden"
      >
        <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4">
          <path d="M12.5 5 7.5 10l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
        Volver a la lista
      </Link>

      <header className="flex items-start gap-4">
        <Placa unidad={r.unidad} tamano="lg" />
        <div className="min-w-0 flex-1">
          <h2 id={`titulo-${r.id}`} className={`${FUENTE_DISPLAY} text-xl font-semibold leading-snug tracking-tight`}>
            {r.descripcion}
          </h2>
          <p className="mt-1 text-sm text-[#5B655F]">
            {r.vecino ? `${r.vecino}, ` : "Reclamo histórico, "}
            {r.edificio}, {recibido}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
            <EstadoChip estado={r.estado} vista="admin" />
            <UrgenciaMarca urgencia={r.urgencia_final} sugerida={sugerida} />
            {r.tipo_vecino !== "estandar" && (
              <span className="rounded-full border border-[#D9BC8A] px-2.5 py-0.5 text-xs font-medium text-[#7A4F12]">
                Vecino {etiquetas.tipoVecino(r.tipo_vecino).toLowerCase()}
              </span>
            )}
            {r.repeticiones >= 3 && r.categoria_efectiva && (
              <span className="rounded-full border border-[#D9BC8A] bg-[#F6EAD6] px-2.5 py-0.5 text-xs font-medium text-[#7A4F12]">
                {r.repeticiones} de {etiquetas.categoria(r.categoria_efectiva).toLowerCase()} en 30 días
              </span>
            )}
          </div>
        </div>
      </header>

      <Seguimiento estado={r.estado} vista="admin" />

      {r.estado === "resuelto" && r.vecino && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-[#F6F1E6] px-3 py-2.5 text-sm">
          {calificacion ? (
            <>
              <span className="text-[#5B655F]">Calificación del vecino</span>
              <Estrellas puntaje={calificacion.puntaje} />
              {calificacion.comentario && <span>“{calificacion.comentario}”</span>}
            </>
          ) : (
            <span className="text-[#5B655F]">El vecino todavía no calificó el arreglo.</span>
          )}
        </div>
      )}

      <GestionarReclamo
        // La clave fuerza un formulario nuevo cuando cambia el reclamo o su estado
        key={`${r.id}-${r.estado}-${r.ultima_visita ?? ""}-${r.ia_categoria ?? ""}`}
        reclamo={{ id: r.id, categoria: r.categoria, urgencia: r.urgencia, proveedor_id: r.proveedor_id, estado: r.estado }}
        proveedores={proveedores}
        visita={r.ultima_visita}
        resueltoAt={r.resuelto_at}
        ia={{
          categoria: r.ia_categoria,
          urgencia: r.ia_urgencia,
          proveedor_id: r.ia_proveedor_id,
          justificacion: r.ia_justificacion,
        }}
        prioridad={{ base: r.urgencia_base, calculada: r.urgencia_calculada, motivos: r.motivos ?? [] }}
      />
      {foto && (
        <a href={foto} target="_blank" rel="noreferrer" className="block self-start rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4D3E]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={foto}
            alt={`Foto del reclamo: ${r.descripcion}`}
            className="max-h-56 rounded-md border border-[#DDE1DB] object-cover"
          />
          <span className="sr-only">Abrir la foto en tamaño completo</span>
        </a>
      )}

    </article>
  );
}
