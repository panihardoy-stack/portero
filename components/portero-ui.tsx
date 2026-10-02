// Piezas visuales compartidas de Portero.
// No usan hooks, así que sirven tanto en componentes de servidor como de cliente.

export const FUENTE_DISPLAY = "[font-family:var(--font-display)]";

export const BOTON_PRIMARIO =
  "inline-flex items-center justify-center rounded-md bg-[#1E4D3E] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#173D31] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4D3E] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

export const BOTON_SECUNDARIO =
  "inline-flex items-center justify-center rounded-md border border-[#CFD5CD] bg-white px-4 py-2 text-sm font-medium text-[#18211D] transition-colors hover:bg-[#F3F4F1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4D3E] focus-visible:ring-offset-2";

export const CAMPO =
  "w-full rounded-md border border-[#CFD5CD] bg-white px-3 py-2 text-sm text-[#18211D] placeholder:text-[#9AA39D] focus:border-[#1E4D3E] focus:outline-none focus:ring-2 focus:ring-[#1E4D3E]/20";

export const CATEGORIAS = ["sanitaria", "humedad", "electrica", "ascensor", "cerrajeria", "otros"];

export const CATEGORIA_LABEL: Record<string, string> = {
  sanitaria: "Sanitaria",
  humedad: "Humedad",
  electrica: "Eléctrica",
  ascensor: "Ascensor",
  cerrajeria: "Cerrajería",
  otros: "Otros",
};

export const ESTADOS = ["nuevo", "asignado", "agendado", "resuelto"];

// Cada estado tiene un nombre para el admin y otro, más claro, para el vecino
export const ESTADO_INFO: Record<
  string,
  { admin: string; vecino: string; clase: string; color: string }
> = {
  nuevo: { admin: "Sin revisar", vecino: "Recibido", clase: "bg-[#E6EEF8] text-[#234F85]", color: "#3A6EA8" },
  asignado: { admin: "Asignado", vecino: "Asignado", clase: "bg-[#F6EAD6] text-[#7A4F12]", color: "#B07A2A" },
  agendado: { admin: "Agendado", vecino: "Visita agendada", clase: "bg-[#ECE8F6] text-[#4E3F8A]", color: "#6A5AAE" },
  resuelto: { admin: "Resuelto", vecino: "Resuelto", clase: "bg-[#E3F0E8] text-[#265A42]", color: "#2F7356" },
};

export const URGENCIAS = ["alta", "media", "baja"];

export const URGENCIA_INFO: Record<string, { label: string; clase: string; color: string }> = {
  alta: { label: "Alta", clase: "text-[#A3352B]", color: "#B8453A" },
  media: { label: "Media", clase: "text-[#7A4F12]", color: "#B07A2A" },
  baja: { label: "Baja", clase: "text-[#5B655F]", color: "#8C958F" },
};

// Placa de puerta en bronce: el sello visual de Portero para cada unidad
export function Placa({ unidad, tamano = "sm" }: { unidad?: string | null; tamano?: "sm" | "lg" }) {
  const grande = tamano === "lg";
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-[3px] border border-[#B8904F] bg-[linear-gradient(180deg,#F4E7CF,#E3CA9F)] text-[#4A3415] shadow-[inset_0_0_0_2px_#F8EEDC] ${FUENTE_DISPLAY} font-semibold tabular-nums ${
        grande ? "h-16 min-w-[5.5rem] px-6 text-3xl" : "h-9 min-w-[3.25rem] px-3.5 text-sm"
      }`}
    >
      <span aria-hidden className="absolute left-1 top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-[#9C7638]" />
      <span aria-hidden className="absolute right-1 top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-[#9C7638]" />
      <span className="sr-only">Unidad </span>
      {unidad ?? "?"}
    </span>
  );
}

export function EstadoChip({ estado, vista }: { estado: string; vista: "admin" | "vecino" }) {
  const info = ESTADO_INFO[estado];
  if (!info) return null;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${info.clase}`}>
      {vista === "admin" ? info.admin : info.vecino}
    </span>
  );
}

export function UrgenciaMarca({ urgencia }: { urgencia: string | null }) {
  if (!urgencia || !URGENCIA_INFO[urgencia]) return null;
  const info = URGENCIA_INFO[urgencia];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${info.clase}`}>
      <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: info.color }} />
      Urgencia {info.label.toLowerCase()}
    </span>
  );
}

// Avance del reclamo en cuatro pasos, pensado para el vecino
export function Seguimiento({ estado }: { estado: string }) {
  const actual = ESTADOS.indexOf(estado);
  return (
    <ol className="grid grid-cols-4 gap-1.5" aria-label="Avance del reclamo">
      {ESTADOS.map((e, i) => {
        const hecho = i <= actual;
        const esActual = i === actual;
        return (
          <li key={e} className="flex flex-col gap-1.5" aria-current={esActual ? "step" : undefined}>
            <span className={`h-1.5 rounded-full ${hecho ? "bg-[#1E4D3E]" : "bg-[#E1E5DF]"}`} />
            <span
              className={`text-xs leading-tight ${
                esActual ? "font-semibold text-[#18211D]" : hecho ? "text-[#5B655F]" : "text-[#9AA39D]"
              }`}
            >
              {ESTADO_INFO[e].vecino}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function tiempoRelativo(iso: string, ahora: number) {
  const dias = Math.floor((ahora - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  if (dias <= 0) return "Hoy";
  if (dias === 1) return "Ayer";
  if (dias < 30) return `Hace ${dias} días`;
  return new Date(iso).toLocaleDateString("es-UY", { day: "numeric", month: "long" });
}

// Pasa a minúsculas y saca tildes, para que "electrica" encuentre "Eléctrica"
export function normalizar(texto: string) {
  return texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

// Ordena unidades como las ve una persona: 1A, 1B, 2A, 10A
export function compararUnidades(a: string, b: string) {
  return a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });
}
