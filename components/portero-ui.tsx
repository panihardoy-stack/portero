// Piezas visuales compartidas de Portero.
// No usan hooks, así que sirven tanto en componentes de servidor como de cliente.

export const FUENTE_DISPLAY = "[font-family:var(--font-display)]";

export const BOTON_PRIMARIO =
  "inline-flex items-center justify-center rounded-md bg-[#1E4D3E] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#173D31] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4D3E] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

export const BOTON_SECUNDARIO =
  "inline-flex items-center justify-center rounded-md border border-[#CFD5CD] bg-white px-4 py-2 text-sm font-medium text-[#18211D] transition-colors hover:bg-[#F3F4F1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4D3E] focus-visible:ring-offset-2";

export const CAMPO =
  "w-full rounded-md border border-[#CFD5CD] bg-white px-3 py-2 text-sm text-[#18211D] placeholder:text-[#9AA39D] focus:border-[#1E4D3E] focus:outline-none focus:ring-2 focus:ring-[#1E4D3E]/20";

// Solo presentación: los nombres de estados y urgencias vienen de la base (tablas estados y urgencias).
// Acá se define únicamente el color de cada código.
export const ESTILO_ESTADO: Record<string, { clase: string; color: string }> = {
  nuevo: { clase: "bg-[#E6EEF8] text-[#234F85]", color: "#3A6EA8" },
  asignado: { clase: "bg-[#F6EAD6] text-[#7A4F12]", color: "#B07A2A" },
  agendado: { clase: "bg-[#ECE8F6] text-[#4E3F8A]", color: "#6A5AAE" },
  resuelto: { clase: "bg-[#E3F0E8] text-[#265A42]", color: "#2F7356" },
};

export const ESTILO_URGENCIA: Record<string, { clase: string; color: string }> = {
  alta: { clase: "text-[#A3352B]", color: "#B8453A" },
  media: { clase: "text-[#7A4F12]", color: "#B07A2A" },
  baja: { clase: "text-[#5B655F]", color: "#8C958F" },
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

// Selector de opciones (pestañas, vista, período): mismo estilo en toda la app
export const GRUPO_SEGMENTOS = "inline-flex self-start rounded-md border border-[#CFD5CD] bg-white p-0.5";

export function claseSegmento(activa: boolean) {
  return `rounded-[5px] px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4D3E] ${
    activa ? "bg-[#1E4D3E] text-white" : "text-[#5B655F] hover:text-[#18211D]"
  }`;
}
