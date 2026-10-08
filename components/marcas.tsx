"use client";

import { useCatalogos } from "@/components/catalogos-provider";
import { ESTILO_ESTADO, ESTILO_URGENCIA } from "@/components/portero-ui";

// Marcas de estado y urgencia: mismo aspecto en la bandeja, el panel del vecino y el dashboard

export function EstadoChip({ estado, vista }: { estado: string; vista: "admin" | "vecino" }) {
  const { etiquetas } = useCatalogos();
  const estilo = ESTILO_ESTADO[estado];
  if (!estilo) return null;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${estilo.clase}`}>
      {vista === "admin" ? etiquetas.estadoAdmin(estado) : etiquetas.estadoVecino(estado)}
    </span>
  );
}

export function UrgenciaMarca({ urgencia, sugerida = false }: { urgencia: string | null; sugerida?: boolean }) {
  const { etiquetas } = useCatalogos();
  if (!urgencia || !ESTILO_URGENCIA[urgencia]) return null;
  const estilo = ESTILO_URGENCIA[urgencia];
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${estilo.clase}`}
      title={sugerida ? "Sugerida por la IA y las reglas de prioridad; la administración todavía no la confirmó" : undefined}
    >
      <span
        aria-hidden
        className={`h-2 w-2 rounded-full ${sugerida ? "border-[1.5px] bg-transparent" : ""}`}
        style={sugerida ? { borderColor: estilo.color } : { backgroundColor: estilo.color }}
      />
      Urgencia {etiquetas.urgencia(urgencia).toLowerCase()}
      {sugerida && <span className="font-normal text-[#5B655F]">(sugerida)</span>}
    </span>
  );
}

// Avance del reclamo en pasos, en el orden de la tabla estados
export function Seguimiento({ estado }: { estado: string }) {
  const { estados } = useCatalogos();
  const actual = estados.findIndex((e) => e.codigo === estado);
  return (
    <ol className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${estados.length}, minmax(0, 1fr))` }} aria-label="Avance del reclamo">
      {estados.map((e, i) => {
        const hecho = i <= actual;
        const esActual = i === actual;
        return (
          <li key={e.codigo} className="flex flex-col gap-1.5" aria-current={esActual ? "step" : undefined}>
            <span className={`h-1.5 rounded-full ${hecho ? "bg-[#1E4D3E]" : "bg-[#E1E5DF]"}`} />
            <span
              className={`text-xs leading-tight ${
                esActual ? "font-semibold text-[#18211D]" : hecho ? "text-[#5B655F]" : "text-[#9AA39D]"
              }`}
            >
              {e.nombre_vecino}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
